-- FULka: demo tím Kuchynka Ants + 2 hráči, pridaný do pripravovanej Letnej sezóny 2027 (l27).
-- Spustiť v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane (nič sa nezdvojí).
--
--   * Logo je zatiaľ prázdne → web ukáže logo FULky. Vybraté logo nahraj v admine: Tímy → Ants → Logo (PNG) a Animované (WebP)
--     (súbory sú v design/ants/, náhľad: http://127.0.0.1:8770/fulka/design/ants/).
--   * Farba zelená ako v návrhoch loga; zmeniť sa dá v admine (Tímy → Ants).
--   * Úplné zmazanie demo dát je dole (zakomentované).

insert into public.fulka_teams (id, name, venue, abbr, color, color_dark, ink, logo, logo_anim)
values ('ant', 'Ants', 'Kuchynka', 'ANT', '#74BC3C', '#1F4D16', '#111111', '', '')
on conflict (id) do nothing;

insert into public.fulka_players (id, name) values
  ('p-mrkvicka-jozko', 'Jožko Mrkvička'),
  ('p-petrzlenova-anna', 'Anna Petržlenová')
on conflict (id) do nothing;

insert into public.fulka_season_teams (season_id, team_id) values ('l27', 'ant')
on conflict do nothing;

insert into public.fulka_roster (season_id, player_id, team_id) values
  ('l27', 'p-mrkvicka-jozko', 'ant'),
  ('l27', 'p-petrzlenova-anna', 'ant')
on conflict do nothing;

-- Overenie: má vypísať tím Ants a pod ním 2 hráčov v sezóne l27.
select t.id, t.venue || ' ' || t.name as tim, p.name as hrac, r.season_id
from public.fulka_teams t
left join public.fulka_roster r on r.team_id = t.id
left join public.fulka_players p on p.id = r.player_id
where t.id = 'ant';

-- Zmazať demo úplne (tím aj hráčov, aj zo všetkých sezón) – odkomentuj a spusti iba ak treba:
-- delete from public.fulka_teams where id = 'ant';
-- delete from public.fulka_players where id in ('p-mrkvicka-jozko', 'p-petrzlenova-anna');
