-- FULka: animované logá víťazov vo formáte WebP namiesto GIF.
-- Obraz je na pixel rovnaký, iba sa načíta rýchlejšie (spolu 1,3 MB → 0,5 MB). Farby tímov ostávajú.
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.

update public.fulka_teams set logo_anim = 'assets/anim/giants.webp', updated_at = now() where id = 'gia';
update public.fulka_teams set logo_anim = 'assets/anim/brewers.webp', updated_at = now() where id = 'bre';
update public.fulka_teams set logo_anim = 'assets/anim/rangers.webp', updated_at = now() where id = 'ran';
update public.fulka_teams set logo_anim = 'assets/anim/saints.webp', updated_at = now() where id = 'sai';

-- ---------- Kontrola (malo by vrátiť 4 riadky s .webp) ----------
-- select id, logo_anim from public.fulka_teams order by id;
