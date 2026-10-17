# Návrh „Shard“ (Claude Design)

Schválený vzhľad webu a adminu. Slúži iba ako predloha – skutočná stránka je v koreni repozitára.

- `screens/*.jpg` – screenshoty všetkých obrazoviek (desktop 1440 px, mobil 390 px). Číslovanie podľa plátna:
  01 web prebieha · 02 výber sezóny · 03 skončená sezóna · 04 pripravovaná sezóna · 05–07 mobil ·
  08 admin zápasy · 09 admin sezóny · 10 admin tímy a hráči · 11 admin skončenej sezóny · 12 nastavenia · 13–14 admin mobil
- `Main.dc.html` – celý web (všetky stavy sezóny); `Admin.dc.html` – celý admin.
  Ostatné `*.dc.html` sú iba rámy, ktoré vložia `Main` alebo `Admin` s inými nastaveniami (napr. `season="j26"`).
- `canvas.json` – rozloženie plátna (veľkosti obrazoviek, názvy).
- Súbory potrebujú runtime Claude Design (`support.js`), preto sa v prehliadači priamo nezobrazia.
- Cesty `../assets/…` vedú na logá a GIFy v tomto repozitári.
- Cesty `../photos/…` (fotky kapitánov) v repozitári **nie sú** – fotky patria do Supabase.
  Mapovanie: `gia_*` = Jakub Štefaňák, `bre_*` = Andrej Bartoš, `ran_*` = Pavol Kliment, `sai_*` = Damián Štieber.
- Všetky výsledky, dátumy a góly v návrhu sú ukážkové.
