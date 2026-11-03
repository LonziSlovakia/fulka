-- FULka: zálohy dát (snímky všetkých tabuliek fulka_*) a návrat k zálohe.
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.
--
-- Prečo takto:
--   * Záloha je jeden riadok v fulka_backups = celý stav všetkých 8 tabuliek ako JSON (dnes ~25 kB).
--   * Admin zálohy vidí a vie vytvoriť, ale NIKTO cez web ich nevie zmeniť ani zmazať (nie je na to pravidlo).
--     Aj keby niekto ukradol prihlásenie admina, staré zálohy ostanú. Zmazať ich vie iba Lonzi tu v SQL Editore.
--   * Automatická záloha: pred prvou zmenou v každom 10-minútovom okne databáza sama uloží stav PRED zmenou
--     (spúšťač v databáze, nedá sa obísť z prehliadača). Takže vždy existuje stav tesne pred útokom / chybou.
--   * Návrat k zálohe (fulka_restore) najprv uloží aktuálny stav ako zálohu „pred obnovou“, potom naraz
--     (v jednej transakcii: buď všetko, alebo nič) nahradí obsah tabuliek. Návrat sa teda dá vrátiť.
--   * Fotky v buckete sa nezálohujú (v zálohe sú iba cesty k nim).

-- ---------- Tabuľka záloh ----------
create table if not exists public.fulka_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('auto', 'manual', 'restore', 'file')),  -- automatická / ručná / pred obnovou / pred nahratím zo súboru
  label text not null default '',
  summary jsonb not null default '{}'::jsonb,          -- počty riadkov (na zoznam v admine bez sťahovania celých dát)
  data jsonb not null,                                 -- { "format": "fulka-zaloha-1", "settings": [...], "seasons": [...], ... }
  created_by uuid default auth.uid()
);
create index if not exists fulka_backups_created on public.fulka_backups (created_at desc);

alter table public.fulka_backups enable row level security;
revoke all on public.fulka_backups from anon, authenticated;
grant select on public.fulka_backups to authenticated;
drop policy if exists "zalohy vidi admin" on public.fulka_backups;
create policy "zalohy vidi admin" on public.fulka_backups for select to authenticated using (public.is_admin('fulka'));
-- zámerne žiadne pravidlo na insert / update / delete: zapisuje iba funkcia nižšie

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

-- uloží zálohu (vnútorná funkcia, priamo ju volať nemožno)
create or replace function public.fulka_take_backup(p_kind text, p_label text)
returns bigint language plpgsql security definer set search_path = public as $$
declare s jsonb := fulka_state(); new_id bigint;
begin
  insert into fulka_backups (kind, label, summary, data) values (p_kind, left(coalesce(p_label, ''), 120), fulka_summary(s), s)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.fulka_take_backup(text, text) from public, anon, authenticated;

-- ---------- Ručná záloha (tlačidlo v admine) ----------
create or replace function public.fulka_backup(p_label text default '')
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  -- proti zahlteniu: najviac jedna ručná záloha za 30 sekúnd
  if exists (select 1 from fulka_backups where kind = 'manual' and created_at > now() - interval '30 seconds') then
    raise exception 'Záloha sa práve uložila, skús o chvíľu' using errcode = 'P0001';
  end if;
  return fulka_take_backup('manual', p_label);
end $$;
revoke execute on function public.fulka_backup(text) from public, anon;
grant execute on function public.fulka_backup(text) to authenticated;

-- ---------- Automatická záloha pred zmenou ----------
create or replace function public.fulka_auto_backup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('fulka_backups'));  -- dva súbežné zápisy neurobia dve zálohy
  if not exists (select 1 from fulka_backups where created_at > now() - interval '10 minutes') then
    perform fulka_take_backup('auto', 'Automaticky pred zmenou');
  end if;
  return null;
end $$;
revoke execute on function public.fulka_auto_backup() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['fulka_settings', 'fulka_seasons', 'fulka_teams', 'fulka_season_teams', 'fulka_players', 'fulka_roster', 'fulka_matches', 'fulka_goals'] loop
    execute format('drop trigger if exists fulka_zaloha_pred_zmenou on public.%I', t);
    execute format('create trigger fulka_zaloha_pred_zmenou before insert or update or delete on public.%I for each statement execute function public.fulka_auto_backup()', t);
  end loop;
end $$;

-- ---------- Návrat k stavu (spoločná vnútorná časť) ----------
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

-- návrat k zálohe z databázy (admin → Zálohy → „Vrátiť sa sem“)
create or replace function public.fulka_restore(p_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare d jsonb; before_id bigint;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  select data into d from fulka_backups where id = p_id;
  if d is null then raise exception 'Záloha neexistuje' using errcode = 'P0002'; end if;
  before_id := fulka_take_backup('restore', format('Pred návratom k zálohe č. %s', p_id));
  perform fulka_apply(d);
  return before_id;
end $$;
revoke execute on function public.fulka_restore(bigint) from public, anon;
grant execute on function public.fulka_restore(bigint) to authenticated;

-- návrat zo súboru stiahnutého do počítača (keby zálohy v databáze neboli)
create or replace function public.fulka_restore_file(p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare before_id bigint;
begin
  if not public.is_admin('fulka') then raise exception 'Iba admin FULky' using errcode = '42501'; end if;
  before_id := fulka_take_backup('file', 'Pred nahratím zálohy zo súboru');
  perform fulka_apply(p_data);
  return before_id;
end $$;
revoke execute on function public.fulka_restore_file(jsonb) from public, anon;
grant execute on function public.fulka_restore_file(jsonb) to authenticated;

-- prvá záloha hneď teraz
select public.fulka_take_backup('manual', 'Prvá záloha (spustenie 3-zalohy.sql)');

-- ---------- Kontrola ----------
-- 1) malo by vrátiť aspoň 1 riadok s počtami (seasons 1, teams 4, players 39 …):
--    select id, created_at, kind, label, summary from public.fulka_backups order by id desc limit 5;
-- 2) anonym zálohy nevidí (v termináli; má vrátiť []):
--    curl -s "https://anovkowkucidkutwghzx.supabase.co/rest/v1/fulka_backups?select=id" -H "apikey: <publishable key>"
--
-- ---------- Upratanie (iba ručne, keď bude záloh priveľa) ----------
-- automatické zálohy staršie ako 1 rok:
--    delete from public.fulka_backups where kind = 'auto' and created_at < now() - interval '1 year';
