-- FULka: roly – zálohy smie robiť iba VLASTNÍK (owner), ostatné v admine ďalej každý admin.
-- Spustiť v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.
-- Pozor: keby si niekedy znova spustil 3-zalohy.sql, vráti zálohy všetkým adminom → potom spusti znova aj tento skript.
--
-- Úrovne:
--   návštevník (anon)  = iba číta web
--   admin               = public.admins / public.is_admin('fulka') – spoločné s laura, tento skript ich NEMENÍ
--   vlastník (owner)    = admin + riadok v public.fulka_roles s rolou 'owner' → navyše zálohy
-- Ďalšie roly do budúcna (napr. 'zapisovac' = iba zápasy a góly): pridať do zoznamu v check nižšie
-- a v pravidlách/funkciách použiť public.fulka_has_role('…').
--
-- E-mail v tomto súbore nie je (repozitár je verejný) – vlastníka si pridáš v kroku 2 dole.

-- ---------- Tabuľka rolí ----------
create table if not exists public.fulka_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.fulka_roles drop constraint if exists fulka_roles_role_check;
alter table public.fulka_roles add constraint fulka_roles_role_check check (role in ('owner'));
alter table public.fulka_roles enable row level security;
revoke all on public.fulka_roles from anon, authenticated; -- meniť ju dá iba SQL Editor (nie web), čítať iba cez funkcie nižšie

-- má prihlásený používateľ danú rolu? (musí byť aj admin FULky)
create or replace function public.fulka_has_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.is_admin('fulka')
    and exists (select 1 from fulka_roles r where r.user_id = auth.uid() and r.role = p_role)
$$;
revoke execute on function public.fulka_has_role(text) from public, anon;
grant execute on function public.fulka_has_role(text) to authenticated;

create or replace function public.fulka_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.fulka_has_role('owner')
$$;
revoke execute on function public.fulka_is_owner() from public, anon;
grant execute on function public.fulka_is_owner() to authenticated;

-- roly prihláseného (admin podľa nich skryje záložku Zálohy), napr. {owner}; admin bez roly = {}
create or replace function public.fulka_my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.role order by r.role), '{}') from fulka_roles r
  where r.user_id = auth.uid() and public.is_admin('fulka')
$$;
revoke execute on function public.fulka_my_roles() from public, anon;
grant execute on function public.fulka_my_roles() to authenticated;

-- ---------- Zálohy iba pre vlastníka (pravidlá a funkcie z 3-zalohy.sql, iba iná kontrola) ----------
drop policy if exists "zalohy vidi admin" on public.fulka_backups;
drop policy if exists "zalohy vidi vlastnik" on public.fulka_backups;
create policy "zalohy vidi vlastnik" on public.fulka_backups for select to authenticated using (public.fulka_is_owner());
drop policy if exists "zalohy maze admin" on public.fulka_backups;
drop policy if exists "zalohy maze vlastnik" on public.fulka_backups;
create policy "zalohy maze vlastnik" on public.fulka_backups for delete to authenticated using (public.fulka_is_owner() and kind = 'manual');

create or replace function public.fulka_backup(p_label text default '')
returns bigint language plpgsql security definer set search_path = public as $$
declare s jsonb; new_id bigint;
begin
  if not public.fulka_is_owner() then raise exception 'Zálohy robí iba vlastník FULky' using errcode = '42501'; end if;
  if exists (select 1 from fulka_backups where kind = 'manual' and created_at > now() - interval '30 seconds') then
    raise exception 'Záloha sa práve uložila, skús o chvíľu' using errcode = 'P0001';
  end if;
  s := fulka_state();
  insert into fulka_backups (kind, label, summary, data) values ('manual', left(coalesce(p_label, ''), 120), fulka_summary(s), s)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.fulka_restore(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare d jsonb; before jsonb;
begin
  if not public.fulka_is_owner() then raise exception 'Zálohy robí iba vlastník FULky' using errcode = '42501'; end if;
  select data into d from fulka_backups where id = p_id and kind = 'manual';
  if d is null then raise exception 'Záloha neexistuje' using errcode = 'P0002'; end if;
  before := fulka_state();
  perform fulka_apply(d);
  perform fulka_keep_undo(before, format('Stav pred návratom k zálohe č. %s', p_id));
end $$;

create or replace function public.fulka_restore_file(p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare before jsonb;
begin
  if not public.fulka_is_owner() then raise exception 'Zálohy robí iba vlastník FULky' using errcode = '42501'; end if;
  before := fulka_state();
  perform fulka_apply(p_data);
  perform fulka_keep_undo(before, 'Stav pred nahratím zálohy zo súboru');
end $$;

create or replace function public.fulka_undo()
returns void language plpgsql security definer set search_path = public as $$
declare u jsonb; before jsonb;
begin
  if not public.fulka_is_owner() then raise exception 'Zálohy robí iba vlastník FULky' using errcode = '42501'; end if;
  select data into u from fulka_backups where kind = 'undo';
  if u is null then raise exception 'Nie je čo vrátiť späť' using errcode = 'P0002'; end if;
  before := fulka_state();
  perform fulka_apply(u);
  perform fulka_keep_undo(before, 'Stav pred „Vrátiť späť“');
end $$;

-- ---------- Krok 2: seba ako vlastníka (prepíš e-mail na svoj hlavný účet, potom označ iba tento riadok a Run) ----------
-- insert into public.fulka_roles (user_id, role) select id, 'owner' from auth.users where email = 'SEM-TVOJ-EMAIL' on conflict do nothing;

-- ---------- Kontrola ----------
-- 1) kto je vlastník (má vrátiť 1 riadok s tvojím e-mailom):
--    select u.email, r.role from public.fulka_roles r join auth.users u on u.id = r.user_id;
-- 2) admini a či sú vlastníci (tvoj hlavný účet: true, druhý účet: false):
--    (celý dotaz je na jednom riadku – odkomentuj ho celý, inak chyba „missing FROM-clause entry“)
--    select u.email, exists (select 1 from public.fulka_roles r where r.user_id = u.id and r.role = 'owner') as vlastnik from public.admins a join auth.users u on u.id = a.user_id where a.site = 'fulka';
-- 3) na webe: prihlásený hlavný účet vidí v admine záložku Zálohy, druhý účet ju nevidí.
