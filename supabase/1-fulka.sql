-- FULka (Florbalová Upece Liga): tabuľky, pravidlá a priečinok na fotky.
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run.
-- Dá sa spustiť aj opakovane, nič sa nezduplikuje (ukážkové dáta majú "on conflict do nothing").
--
-- Predpoklad: v projekte už je public.admins a public.is_admin() zo skriptu
-- supabase/1-zaklad-a-laura.sql (repozitár laura) a Lonzi je admin pre 'fulka'.
--
-- Čo to spraví:
--   * fulka_settings      nastavenia webu (1 riadok, jsonb): koľko zápasov na banneri, body za výhru/remízu
--   * fulka_seasons       sezóny (pripravujeme / prebieha / skončená), naraz môže prebiehať len jedna
--   * fulka_teams         tímy (spoločné pre všetky sezóny): farby, logo, animované logo
--   * fulka_season_teams  ktoré tímy hrajú v ktorej sezóne
--   * fulka_players       hráči (meno, fotky)
--   * fulka_roster        súpiska: hráč → tím v danej sezóne, kapitán
--   * fulka_matches       zápasy základnej časti aj playoff (SF1, SF2, o 3. miesto, finále)
--   * fulka_goals         góly: poradie, strana, strelec, asistencia (skóre sa počíta z gólov)
--   * bucket "fulka" na fotky hráčov
--   * pravidlá: čítať môže ktokoľvek, zapisovať iba admin stránky 'fulka'
--   * ukážkové dáta: 4 tímy, Zimná sezóna 2026, súpisky z draftu a rozpis 12 zápasov (iba týždne, bez presných termínov)

-- ---------- Nastavenia ----------
create table if not exists public.fulka_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Sezóny ----------
create table if not exists public.fulka_seasons (
  id text primary key,                                   -- napr. 'z26'
  name text not null,                                    -- 'Zimná sezóna 2026'
  short text not null default '',                        -- 'Zima 2026' (na tlačidlá v admine)
  state text not null default 'soon' check (state in ('soon', 'live', 'done')),
  seed_mode text not null default 'auto' check (seed_mode in ('auto', 'manual')),  -- semifinále podľa tabuľky / ručne
  sort int not null default 0,                           -- poradie v menu (väčšie = novšie)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- naraz môže prebiehať iba jedna sezóna (pri prepnutí najprv starú daj na 'done', potom novú na 'live')
create unique index if not exists fulka_seasons_one_live on public.fulka_seasons (state) where state = 'live';

-- ---------- Tímy ----------
create table if not exists public.fulka_teams (
  id text primary key,                                   -- 'gia', 'bre', 'ran', 'sai'
  name text not null,                                    -- 'Giants'
  venue text not null default '',                        -- 'Veľká sála' (prvá časť názvu tímu)
  abbr text not null default '',                         -- 'GIA'
  color text not null default '#888888',                 -- hlavná farba tímu
  color_dark text not null default '#333333',            -- tmavší odtieň do prechodu
  ink text not null default '#FFFFFF',                   -- farba textu na hlavnej farbe
  logo text not null default '',                         -- statické logo (cesta v repozitári alebo URL)
  logo_anim text not null default '',                    -- animované logo (WebP) pre víťaza
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fulka_season_teams (
  season_id text not null references public.fulka_seasons (id) on delete cascade,
  team_id text not null references public.fulka_teams (id) on delete cascade,
  primary key (season_id, team_id)
);

-- ---------- Hráči a súpisky ----------
create table if not exists public.fulka_players (
  id text primary key,                                   -- napr. 'p-stefanak-jakub'
  name text not null,
  photo text not null default '',                        -- celá postava, priehľadné pozadie (cesta v buckete fulka)
  photo_head text not null default '',                   -- výrez hlavy a pliec (kanadské bodovanie)
  photo_face text not null default '',                   -- malý štvorec na avatar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fulka_roster (
  season_id text not null references public.fulka_seasons (id) on delete cascade,
  player_id text not null references public.fulka_players (id) on delete cascade,
  team_id text not null references public.fulka_teams (id) on delete cascade,
  captain boolean not null default false,
  number int,
  primary key (season_id, player_id)                     -- hráč je v jednej sezóne len v jednom tíme
);
create unique index if not exists fulka_roster_one_captain on public.fulka_roster (season_id, team_id) where captain;

-- ---------- Zápasy ----------
create table if not exists public.fulka_matches (
  id text primary key,                                   -- napr. 'z26-01', 'z26-sf1'
  season_id text not null references public.fulka_seasons (id) on delete cascade,
  stage text not null default 'R' check (stage in ('R', 'SF1', 'SF2', 'B3', 'F')),
  round int,                                             -- kolo / týždeň (len základná časť)
  home_id text references public.fulka_teams (id),       -- pri playoff "podľa tabuľky" ostáva prázdne
  away_id text references public.fulka_teams (id),
  window_from date,                                      -- týždeň, keď sa má hrať (kým nie je presný termín)
  window_to date,
  starts_at timestamptz,                                 -- presný termín; null = "termín sa hľadá"
  orig_starts_at timestamptz,                            -- pôvodný termín pri presune (na webe prečiarknutý)
  moved boolean not null default false,                  -- ukázať na webe ako "Presunutý"
  status text not null default 'plan' check (status in ('plan', 'done')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_id is null or away_id is null or home_id <> away_id)
);
create index if not exists fulka_matches_season on public.fulka_matches (season_id);

-- ---------- Góly ----------
create table if not exists public.fulka_goals (
  id text primary key,
  match_id text not null references public.fulka_matches (id) on delete cascade,
  seq int not null,                                      -- poradie gólu v zápase: 1, 2, 3…
  side text not null check (side in ('h', 'a')),         -- domáci / hostia
  scorer_id text references public.fulka_players (id) on delete set null,  -- null = neznámy hráč
  assist_id text references public.fulka_players (id) on delete set null,  -- null = bez asistencie
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, seq)
);
create index if not exists fulka_goals_match on public.fulka_goals (match_id);

-- ---------- Práva: čítať každý, zapisovať admin 'fulka' ----------
do $$
declare t text;
begin
  foreach t in array array['fulka_settings', 'fulka_seasons', 'fulka_teams', 'fulka_season_teams', 'fulka_players', 'fulka_roster', 'fulka_matches', 'fulka_goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "citat moze kazdy" on public.%I', t);
    execute format('create policy "citat moze kazdy" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "pridavat moze admin" on public.%I', t);
    execute format('create policy "pridavat moze admin" on public.%I for insert to authenticated with check (public.is_admin(''fulka''))', t);
    execute format('drop policy if exists "menit moze admin" on public.%I', t);
    execute format('create policy "menit moze admin" on public.%I for update to authenticated using (public.is_admin(''fulka'')) with check (public.is_admin(''fulka''))', t);
    execute format('drop policy if exists "mazat moze admin" on public.%I', t);
    execute format('create policy "mazat moze admin" on public.%I for delete to authenticated using (public.is_admin(''fulka''))', t);
  end loop;
end $$;

-- ---------- Fotky ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fulka', 'fulka', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fulka fotky: admin vidi zoznam" on storage.objects;
create policy "fulka fotky: admin vidi zoznam" on storage.objects for select to authenticated
  using (bucket_id = 'fulka' and public.is_admin('fulka'));
drop policy if exists "fulka fotky: admin nahrava" on storage.objects;
create policy "fulka fotky: admin nahrava" on storage.objects for insert to authenticated
  with check (bucket_id = 'fulka' and public.is_admin('fulka'));
drop policy if exists "fulka fotky: admin meni" on storage.objects;
create policy "fulka fotky: admin meni" on storage.objects for update to authenticated
  using (bucket_id = 'fulka' and public.is_admin('fulka'));
drop policy if exists "fulka fotky: admin maze" on storage.objects;
create policy "fulka fotky: admin maze" on storage.objects for delete to authenticated
  using (bucket_id = 'fulka' and public.is_admin('fulka'));

-- ---------- Ukážkové / štartovacie dáta ----------
insert into public.fulka_settings (id, data) values (1, '{"bannerCount": 2, "pointsWin": 3, "pointsDraw": 1, "pointsLoss": 0}'::jsonb)
on conflict (id) do nothing;

insert into public.fulka_seasons (id, name, short, state, seed_mode, sort) values
  ('z26', 'Zimná sezóna 2026', 'Zima 2026', 'live', 'auto', 10)
on conflict (id) do nothing;

-- oficiálne farby z plagátov kapitánov (hlavná / tmavá / text na hlavnej farbe)
insert into public.fulka_teams (id, name, venue, abbr, color, color_dark, ink, logo, logo_anim) values
  ('gia', 'Giants', 'Veľká sála', 'GIA', '#B27F34', '#261C0D', '#261C0D', 'assets/logos/giants.svg', 'assets/anim/giants.webp'),
  ('bre', 'Brewers', 'Libresso', 'BRE', '#D2AA79', '#3F2010', '#3F2010', 'assets/logos/brewers.svg', 'assets/anim/brewers.webp'),
  ('ran', 'Rangers', 'Recepcia', 'RAN', '#008599', '#002C33', '#FFFFFF', 'assets/logos/rangers.svg', 'assets/anim/rangers.webp'),
  ('sai', 'Saints', 'Kaplnka', 'SAI', '#B3001E', '#330009', '#FFFFFF', 'assets/logos/saints.svg', 'assets/anim/saints.webp')
on conflict (id) do nothing;

insert into public.fulka_season_teams (season_id, team_id) values
  ('z26', 'gia'),
  ('z26', 'bre'),
  ('z26', 'ran'),
  ('z26', 'sai')
on conflict do nothing;

-- súpisky podľa obrázkov DraftResult*.png (kapitán je prvý)
insert into public.fulka_players (id, name) values
  ('p-stefanak-jakub', 'Jakub Štefaňák'),
  ('p-urban-jozef', 'Jozef Urban'),
  ('p-horvath-marek', 'Marek Horváth'),
  ('p-motyl-gracjan', 'Gracjan Motýľ'),
  ('p-muller-frantisek', 'František Müller'),
  ('p-kuba-simon', 'Šimon Kuba'),
  ('p-kasakova-miroslava', 'Miroslava Kasáková'),
  ('p-sochulak-simon', 'Šimon Sochuľák'),
  ('p-jaduda-matus', 'Matúš Jaďuďa'),
  ('p-mikundova-kristina', 'Kristína Mikundová'),
  ('p-bartos-andrej', 'Andrej Bartoš'),
  ('p-kohut-samuel', 'Samuel Kohút'),
  ('p-slavkov-tomas', 'Tomáš Slavkov'),
  ('p-slavkov-michal', 'Michal Slavkov'),
  ('p-majercik-tomas', 'Tomáš Majerčík'),
  ('p-skrinar-marek', 'Marek Škrinár'),
  ('p-drab-matej', 'Matej Dráb'),
  ('p-filippova-dominika', 'Dominika Filippová'),
  ('p-nazarej-matus', 'Matúš Nazarej'),
  ('p-mucha-patrik', 'Patrik Mucha'),
  ('p-kliment-pavol', 'Pavol Kliment'),
  ('p-babinsky-vojtech', 'Vojtech Babinský'),
  ('p-stofko-marek', 'Marek Štofko'),
  ('p-kacmar-adam', 'Adam Kačmár'),
  ('p-mikulova-veronika', 'Veronika Mikulová'),
  ('p-styrak-damian', 'Damián Štyrák'),
  ('p-bunca-david', 'Dávid Bunca'),
  ('p-bolekova-ema', 'Ema Boleková'),
  ('p-klein-miroslav', 'Miroslav Klein'),
  ('p-drobnak-stefan', 'Štefan Drobňák'),
  ('p-stieber-damian', 'Damián Štieber'),
  ('p-hrabovsky-adam', 'Adam Hrabovský'),
  ('p-hlubik-martin', 'Martin Hlúbik'),
  ('p-okal-jan', 'Ján Okál'),
  ('p-paradeiser-oliver', 'Oliver Paradeiser'),
  ('p-adamko-tomas', 'Tomáš Adamko'),
  ('p-kostolnik-martin', 'Martin Kostolník'),
  ('p-kadukova-karolina', 'Karolína Kaduková'),
  ('p-tunys-milan', 'Milan Tunys')
on conflict (id) do nothing;

insert into public.fulka_roster (season_id, player_id, team_id, captain) values
  ('z26', 'p-stefanak-jakub', 'gia', true),
  ('z26', 'p-urban-jozef', 'gia', false),
  ('z26', 'p-horvath-marek', 'gia', false),
  ('z26', 'p-motyl-gracjan', 'gia', false),
  ('z26', 'p-muller-frantisek', 'gia', false),
  ('z26', 'p-kuba-simon', 'gia', false),
  ('z26', 'p-kasakova-miroslava', 'gia', false),
  ('z26', 'p-sochulak-simon', 'gia', false),
  ('z26', 'p-jaduda-matus', 'gia', false),
  ('z26', 'p-mikundova-kristina', 'gia', false),
  ('z26', 'p-bartos-andrej', 'bre', true),
  ('z26', 'p-kohut-samuel', 'bre', false),
  ('z26', 'p-slavkov-tomas', 'bre', false),
  ('z26', 'p-slavkov-michal', 'bre', false),
  ('z26', 'p-majercik-tomas', 'bre', false),
  ('z26', 'p-skrinar-marek', 'bre', false),
  ('z26', 'p-drab-matej', 'bre', false),
  ('z26', 'p-filippova-dominika', 'bre', false),
  ('z26', 'p-nazarej-matus', 'bre', false),
  ('z26', 'p-mucha-patrik', 'bre', false),
  ('z26', 'p-kliment-pavol', 'ran', true),
  ('z26', 'p-babinsky-vojtech', 'ran', false),
  ('z26', 'p-stofko-marek', 'ran', false),
  ('z26', 'p-kacmar-adam', 'ran', false),
  ('z26', 'p-mikulova-veronika', 'ran', false),
  ('z26', 'p-styrak-damian', 'ran', false),
  ('z26', 'p-bunca-david', 'ran', false),
  ('z26', 'p-bolekova-ema', 'ran', false),
  ('z26', 'p-klein-miroslav', 'ran', false),
  ('z26', 'p-drobnak-stefan', 'ran', false),
  ('z26', 'p-stieber-damian', 'sai', true),
  ('z26', 'p-hrabovsky-adam', 'sai', false),
  ('z26', 'p-hlubik-martin', 'sai', false),
  ('z26', 'p-okal-jan', 'sai', false),
  ('z26', 'p-paradeiser-oliver', 'sai', false),
  ('z26', 'p-adamko-tomas', 'sai', false),
  ('z26', 'p-kostolnik-martin', 'sai', false),
  ('z26', 'p-kadukova-karolina', 'sai', false),
  ('z26', 'p-tunys-milan', 'sai', false)
on conflict do nothing;

-- rozpis podľa obrázka "Rozpis Regular Season.png": iba týždne, presný deň a čas sa doplní v admine
insert into public.fulka_matches (id, season_id, stage, round, home_id, away_id, window_from, window_to) values
  ('z26-01', 'z26', 'R', 1, 'gia', 'sai', '2026-10-05', '2026-10-11'),
  ('z26-02', 'z26', 'R', 1, 'ran', 'bre', '2026-10-05', '2026-10-11'),
  ('z26-03', 'z26', 'R', 2, 'gia', 'ran', '2026-10-12', '2026-10-18'),
  ('z26-04', 'z26', 'R', 2, 'sai', 'bre', '2026-10-12', '2026-10-18'),
  ('z26-05', 'z26', 'R', 3, 'gia', 'bre', '2026-10-19', '2026-10-25'),
  ('z26-06', 'z26', 'R', 3, 'ran', 'sai', '2026-10-19', '2026-10-25'),
  ('z26-07', 'z26', 'R', 4, 'sai', 'gia', '2026-10-26', '2026-11-01'),
  ('z26-08', 'z26', 'R', 4, 'ran', 'bre', '2026-10-26', '2026-11-01'),
  ('z26-09', 'z26', 'R', 5, 'ran', 'gia', '2026-11-09', '2026-11-15'),
  ('z26-10', 'z26', 'R', 5, 'bre', 'sai', '2026-11-09', '2026-11-15'),
  ('z26-11', 'z26', 'R', 6, 'bre', 'gia', '2026-11-16', '2026-11-22'),
  ('z26-12', 'z26', 'R', 6, 'sai', 'ran', '2026-11-16', '2026-11-22')
on conflict (id) do nothing;

-- playoff: tímy sa doplnia samé podľa tabuľky (seed_mode = 'auto'), termíny doplníš v admine
insert into public.fulka_matches (id, season_id, stage) values
  ('z26-sf1', 'z26', 'SF1'),
  ('z26-sf2', 'z26', 'SF2'),
  ('z26-b3', 'z26', 'B3'),
  ('z26-fin', 'z26', 'F')
on conflict (id) do nothing;

-- ---------- Kontrola (spusti samostatne po skripte, malo by vrátiť 4 / 1 / 39 / 16) ----------
-- select (select count(*) from public.fulka_teams) as timy,
--        (select count(*) from public.fulka_seasons) as sezony,
--        (select count(*) from public.fulka_roster) as hraci_v_supiskach,
--        (select count(*) from public.fulka_matches) as zapasy;

-- ---------- Zrušenie (NESPÚŠŤAJ, iba pre prípad potreby) ----------
-- drop table if exists public.fulka_goals, public.fulka_matches, public.fulka_roster, public.fulka_players,
--   public.fulka_season_teams, public.fulka_teams, public.fulka_seasons, public.fulka_settings;
-- delete from storage.objects where bucket_id = 'fulka';
-- delete from storage.buckets where id = 'fulka';
