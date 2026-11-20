-- FULka: tri termíny sezóny (Prihlasovanie, Draft tímov, Prvý zápas), ktoré ukazuje stránka „Pripravujeme“.
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.
--
--   * Prázdny termín (null) = na webe „čoskoro“. Nastavuje sa v admine: Sezóny → sezóna → Termíny na webe.
--   * Stĺpce sú na konci tabuľky a smú byť prázdne, takže staré zálohy (fulka_restore) idú obnoviť ďalej
--     (chýbajúce termíny sa obnovia ako prázdne).
--   * Pravidlá (RLS) sa nemenia: čítať smie každý, zapisovať iba admin FULky.

alter table public.fulka_seasons add column if not exists signup_date date;  -- Prihlasovanie
alter table public.fulka_seasons add column if not exists draft_date date;   -- Draft tímov
alter table public.fulka_seasons add column if not exists start_date date;   -- Prvý zápas

-- Zimná sezóna 2026 (skončená, na webe sa termíny neukazujú): približne, iba pre úplnosť.
-- Prvý zápas = deň prvého zápasu v databáze (čas Bratislavy), draft o týždeň skôr, prihlasovanie o 3 týždne skôr.
update public.fulka_seasons s
set start_date = f.d, draft_date = f.d - 7, signup_date = f.d - 21
from (select (min(starts_at) at time zone 'Europe/Bratislava')::date as d from public.fulka_matches where season_id = 'z26') f
where s.id = 'z26' and f.d is not null and s.start_date is null;

-- Overenie: má vypísať obe sezóny, z26 s dátumami (2026-09-15, 2026-09-29, 2026-10-06), l27 zatiaľ prázdne.
select id, name, state, signup_date, draft_date, start_date from public.fulka_seasons order by sort;
