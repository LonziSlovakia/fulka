-- FULka: oficiálne farby tímov z plagátov kapitánov (hlavná / tmavá; farba textu na hlavnej farbe)
-- a animované logá vo formáte WebP (bezstratovo, rovnaký obraz ako GIF, spolu 1,3 MB → 0,5 MB).
-- Spustiť raz v Supabase: SQL Editor → New query → vložiť celé → Run. Dá sa spustiť aj opakovane.
--
-- Farba textu (ink) je z palety tímu, ak je na hlavnej farbe dosť čitateľná; pri Rangers a Saints je biela.

update public.fulka_teams set color = '#B27F34', color_dark = '#261C0D', ink = '#261C0D', logo_anim = 'assets/anim/giants.webp', updated_at = now() where id = 'gia';
update public.fulka_teams set color = '#D2AA79', color_dark = '#3F2010', ink = '#3F2010', logo_anim = 'assets/anim/brewers.webp', updated_at = now() where id = 'bre';
update public.fulka_teams set color = '#008599', color_dark = '#002C33', ink = '#FFFFFF', logo_anim = 'assets/anim/rangers.webp', updated_at = now() where id = 'ran';
update public.fulka_teams set color = '#B3001E', color_dark = '#330009', ink = '#FFFFFF', logo_anim = 'assets/anim/saints.webp', updated_at = now() where id = 'sai';

-- ---------- Kontrola (malo by vrátiť 4 riadky s farbami vyššie) ----------
-- select id, color, color_dark, ink, logo_anim from public.fulka_teams order by id;
