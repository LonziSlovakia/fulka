-- FULka: ručné zálohy dát (snímky všetkých tabuliek fulka_*) a návrat k zálohe.
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.
--
-- Ako to funguje:
--   * Záloha = jeden riadok v fulka_backups s celým stavom 8 tabuliek ako JSON (dnes ~25 kB).
--     Vytvára sa IBA ručne tlačidlom v admine (napr. po odohranom kole), nič automaticky.
--   * Zálohy vidí, vytvára a maže iba admin FULky (anonym nič). Fotky v buckete sa nezálohujú.
--   * Návrat k zálohe (fulka_restore) naraz, v jednej transakcii (buď všetko, alebo nič), nahradí obsah tabuliek.
--     Stav tesne pred návratom sa uloží do jedinej špeciálnej zálohy „poistka“ (kind = 'undo'). Pri ďalšom návrate
--     sa prepíše, takže je vždy iba jedna. fulka_undo = „Vrátiť späť“: vymení aktuálny stav s poistkou
--     (aj „vrátiť späť“ sa dá vrátiť). Poistku cez web zmazať nejde.

-- ---------- Tabuľka záloh ----------
create table if not exists public.fulka_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'manual',                 -- manual = ručná záloha, undo = poistka pred posledným návratom
  label text not null default '',
  summary jsonb not null default '{}'::jsonb,          -- počty riadkov (na zoznam v admine bez sťahovania celých dát)
  data jsonb not null,                                 -- { "format": "fulka-zaloha-1", "settings": [...], "seasons": [...], ... }
  created_by uuid default auth.uid()
);
alter table public.fulka_backups drop constraint if exists fulka_backups_kind_check;
update public.fulka_backups set kind = 'manual' where kind not in ('manual', 'undo');  -- keby bežala staršia verzia skriptu
alter table public.fulka_backups add constraint fulka_backups_kind_check check (kind in ('manual', 'undo'));
create index if not exists fulka_backups_created on public.fulka_backups (created_at desc);
create unique index if not exists fulka_backups_one_undo on public.fulka_backups (kind) where kind = 'undo';  -- poistka je iba jedna

alter table public.fulka_backups enable row level security;
revoke all on public.fulka_backups from anon, authenticated;
grant select, delete on public.fulka_backups to authenticated;
drop policy if exists "zalohy vidi admin" on public.fulka_backups;
create policy "zalohy vidi admin" on public.fulka_backups for select to authenticated using (public.is_admin('fulka'));
drop policy if exists "zalohy maze admin" on public.fulka_backups;
create policy "zalohy maze admin" on public.fulka_backups for delete to authenticated using (public.is_admin('fulka') and kind = 'manual');
-- insert / update iba cez funkcie nižšie

-- ---------- Upratanie po staršej verzii (automatické zálohy už nie sú) ----------
do $$
declare t text;
begin
  foreach t in array array['fulka_settings', 'fulka_seasons', 'fulka_teams', 'fulka_season_teams', 'fulka_players', 'fulka_roster', 'fulka_matches', 'fulka_goals'] loop
    execute format('drop trigger if exists fulka_zaloha_pred_zmenou on public.%I', t);
  end loop;
end $$;
drop function if exists public.fulka_auto_backup();
drop function if exists public.fulka_take_backup(text, text);

-- ---------- Aktuálny stav ako JSON ----------
create or replace function public.fulka_state()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'format', 'fulka-zaloha-1',
    'settings',     coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from fulka_settings t), '[]'),
    'seasons',      coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from fulka_seasons t), '[]'),
    'teams',        coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from fulka_teams t), '[]'),
    'season_teams', coalesce((select jsonb_agg(to_jsonb(t) order by t.season_id, t.team_id) from fulka_season_teams t), '[]'),
    'players',      coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from fulka_players t), '[]'),
    'roster',       coalesce((select jsonb_agg(to_jsonb(t) order by t.season_id, t.player_id) from fulka_roster t), '[]'),
    'matches',      coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from fulka_matches t), '[]'),
    'goals',        coalesce((select jsonb_agg(to_jsonb(t) order by t.match_id, t.seq) from fulka_goals t), '[]')
  )
$$;
revoke execute on function public.fulka_state() from public, anon, authenticated;

-- počty riadkov zálohy, napr. { "matches": 16, "goals": 31, ... }
create or replace function public.fulka_summary(p_data jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, jsonb_array_length(p_data -> k)), '{}')
  from unnest(array['seasons', 'teams', 'season_teams', 'players', 'roster', 'matches', 'goals']) k
  where jsonb_typeof(p_data -> k) = 'array'
$$;

-- ---------- Ručná záloha (tlačidlo „Uložiť zálohu“) ----------
create or replace function public.fulka_backup(p_label text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare s jsonb; new_id bigint;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  -- proti dvojkliku: najviac jedna záloha za 30 sekúnd
  if exists (select 1 from fulka_backups where kind = 'manual' and created_at > now() - interval '30 seconds') then
    raise exception 'Záloha sa práve uložila, skús o chvíľu' using errcode = 'P0001';
  end if;
  s := fulka_state();
  insert into fulka_backups (kind, label, summary, data) values ('manual', left(coalesce(p_label, ''), 120), fulka_summary(s), s)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.fulka_backup(text) from public, anon;
grant execute on function public.fulka_backup(text) to authenticated;

-- ---------- Poistka: uloží daný stav ako jedinú zálohu „undo“ (prepíše starú) ----------
create or replace function public.fulka_keep_undo(p_data jsonb, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from fulka_backups where kind = 'undo';
  insert into fulka_backups (kind, label, summary, data) values ('undo', p_label, fulka_summary(p_data), p_data);
end $$;
revoke execute on function public.fulka_keep_undo(jsonb, text) from public, anon, authenticated;

-- ---------- Nahradenie všetkých tabuliek daným stavom (vnútorná časť) ----------
create or replace function public.fulka_apply(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_data ->> 'format' is distinct from 'fulka-zaloha-1' then raise exception 'Toto nie je záloha FULky' using errcode = '22023'; end if;
  if jsonb_typeof(p_data -> 'seasons') <> 'array' or jsonb_array_length(p_data -> 'seasons') = 0 then
    raise exception 'Záloha neobsahuje žiadnu sezónu' using errcode = '22023';
  end if;
  -- zmazať odspodu (góly → … → nastavenia), vložiť odhora; "where true" kvôli ochrane pred delete bez where
  delete from fulka_goals where true;
  delete from fulka_matches where true;
  delete from fulka_roster where true;
  delete from fulka_season_teams where true;
  delete from fulka_players where true;
  delete from fulka_teams where true;
  delete from fulka_seasons where true;
  delete from fulka_settings where true;
  insert into fulka_settings select * from jsonb_populate_recordset(null::fulka_settings, p_data -> 'settings');
  insert into fulka_seasons select * from jsonb_populate_recordset(null::fulka_seasons, p_data -> 'seasons');
  insert into fulka_teams select * from jsonb_populate_recordset(null::fulka_teams, p_data -> 'teams');
  insert into fulka_season_teams select * from jsonb_populate_recordset(null::fulka_season_teams, p_data -> 'season_teams');
  insert into fulka_players select * from jsonb_populate_recordset(null::fulka_players, p_data -> 'players');
  insert into fulka_roster select * from jsonb_populate_recordset(null::fulka_roster, p_data -> 'roster');
  insert into fulka_matches select * from jsonb_populate_recordset(null::fulka_matches, p_data -> 'matches');
  insert into fulka_goals select * from jsonb_populate_recordset(null::fulka_goals, p_data -> 'goals');
end $$;
revoke execute on function public.fulka_apply(jsonb) from public, anon, authenticated;

-- ---------- Návrat k zálohe z databázy (admin → Zálohy → „Vrátiť sa sem“) ----------
create or replace function public.fulka_restore(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb; before jsonb;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  select data into d from fulka_backups where id = p_id and kind = 'manual';
  if d is null then raise exception 'Záloha neexistuje' using errcode = 'P0002'; end if;
  before := fulka_state();
  perform fulka_apply(d);
  perform fulka_keep_undo(before, format('Stav pred návratom k zálohe č. %s', p_id));
end $$;
revoke execute on function public.fulka_restore(bigint) from public, anon;
grant execute on function public.fulka_restore(bigint) to authenticated;

-- ---------- Návrat zo súboru stiahnutého do počítača ----------
create or replace function public.fulka_restore_file(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare before jsonb;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  before := fulka_state();
  perform fulka_apply(p_data);
  perform fulka_keep_undo(before, 'Stav pred nahratím zálohy zo súboru');
end $$;
revoke execute on function public.fulka_restore_file(jsonb) from public, anon;
grant execute on function public.fulka_restore_file(jsonb) to authenticated;

-- ---------- „Vrátiť späť“: vymení aktuálny stav s poistkou ----------
create or replace function public.fulka_undo()
returns void language plpgsql security definer set search_path = public as $$
declare u jsonb; before jsonb;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  select data into u from fulka_backups where kind = 'undo';
  if u is null then raise exception 'Nie je čo vrátiť späť' using errcode = 'P0002'; end if;
  before := fulka_state();
  perform fulka_apply(u);
  perform fulka_keep_undo(before, 'Stav pred „Vrátiť späť“');
end $$;
revoke execute on function public.fulka_undo() from public, anon;
grant execute on function public.fulka_undo() to authenticated;

-- ---------- Kontrola ----------
-- 1) funkcie a tabuľka existujú (má vrátiť 0, žiadna záloha ešte nie je):
--    select count(*) from public.fulka_backups;
-- 2) automatické zálohy nie sú (má vrátiť 0 riadkov):
--    select tgname from pg_trigger where tgname = 'fulka_zaloha_pred_zmenou';
-- 3) potom v admine → Zálohy → „Uložiť zálohu“ a znova 1) → 1.
