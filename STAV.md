# FULka – aktuálny stav projektu

Živý dokument pre ďalšie konverzácie s Claude Code. Čo tu je, platí **teraz**; čo prestane platiť, zmaž.
Pôvodné zadanie je v `HANDOFF.md` (pri rozpore platí tento súbor). Stav k 23. 10. 2026.

## Čo beží

- Web: https://lonzislovakia.github.io/fulka/ · admin: `…/fulka/?edit` (prihlásenie e-mail + heslo, účet Lonzi).
- Repozitár `LonziSlovakia/fulka` (verejný), u Lonziho `~/projects/fulka`, vetva `main` = to, čo je na webe.
- Dáta, fotky, prihlásenie: Supabase projekt `lonzi-weby` (spoločný s mapou `laura`), tabuľky `fulka_*`, bucket `fulka`.
- Spustené SQL: `supabase/1-fulka.sql` (tabuľky, pravidlá, štartovacie dáta), `supabase/2-loga-webp.sql` (logá víťazov vo WebP).

## Súbory

| Súbor | Čo robí |
|---|---|
| `index.html` | kostra; načíta `config.js`, `db.js`, `logic.js`, `render.js` |
| `config.js` | URL + publishable key (verejné) |
| `db.js` | fetch klient: načítanie všetkého + cache v `localStorage`, prihlásenie, `upsert(kind, rows, key)`, `remove(kind, where)`, `upload`, `photoUrl` |
| `logic.js` | čisté výpočty (testované): skóre, tabuľka, bodovanie, playoff, dátumy v Bratislave, draft zápasu ↔ riadok DB |
| `render.js` | verejný web; s `?edit` sa nevykresľuje a načíta `admin.js` + `admin.css` |
| `admin.js` / `admin.css` | admin podľa `design/Admin.dc.html` |
| `styles.css` | vzhľad webu, tokeny ako CSS premenné, tímové farby cez `--c --d --ink` |
| `tests/logic.test.js` | `node --test tests/*.test.js` (39 testov) |
| `tools/` | lokálne testovanie v prehliadači (nižšie) |
| `assets/logos` | SVG logá tímov, FUL, `upece.png`, `supabase.svg` · `assets/anim` animované logá (WebP) · `assets/gif` pôvodné GIF |

## Nastavenia (`fulka_settings.data`, admin → Nastavenia)

`bannerCount` 1–4 · `pointsWin/Draw/Loss` 3/1/0 · `defaultTime` "21:15" (po sv. omši) · `photos` true/false ·
`layout` "wide"/"narrow" (Lonzi má úzke) · `tableOrder` (predvolene `h2hPoints, h2hDiff, diff, gf`) ·
`scorerOrder` (predvolene `goals`) · `scorerTies` "shared"/"alpha"/"team" (predvolene shared) · `headFont` sa ignoruje.

Prepnutie iba na pozretie, bez ukladania: `?fotky=ano|nie`, `?rozlozenie=uzke|siroke`, `?pismo=monument` (iba lokálne).

## Rozhodnutia (dohodnuté s Lonzim)

- **Farby tímov ostávajú podľa návrhu** (nie odtiene z plagátov). **Písmo Saira**, Monument nie (platená licencia, súbory len lokálne v `assets/fonts/`, gitignore).
- Banner: najbližšie neodohrané zápasy; zápas ostáva, kým ho admin neoznačí ako odohraný. Bez presného termínu ukáže týždeň (`window_from–to`) a „termín sa doplní“.
- Tabuľka: body → kritériá z `tableOrder`. Vzájomné zápasy sa rátajú iba medzi tímami, ktoré sú dovtedy úplne rovnaké. Úplná zhoda → poradie tímov (abecedne).
- Kanadské bodovanie: základná časť **aj playoff**; tím hráča = strana gólu (nie súpiska). Rovnaké čísla → **rovnaká priečka** (1, 2, 2, 4…); zobrazuje sa do 10. priečky (pri zhode aj viac riadkov).
- Playoff: „podľa tabuľky“ (SF1 = 1.–4., SF2 = 2.–3., isté až po celej základnej časti) alebo „ručne“ (tímy SF v zápase). B3/F sa dopĺňajú z výsledkov SF.
- Presun zápasu: pôvodný termín = ten, **z ktorého sa presúva**; pri druhom presune voľba posledný/prvý; dá sa aj skryť.
- Fotky: bucket `hraci/<player_id>/full|head|face.webp?v=<čas>`. Hromadné nahratie v Tímy podľa mien súborov `<player_id>_full|_head|_face`. Jedna fotka → výrez hlavy a avatar sa vyrobia samé. Fotky kapitánov sú nahraté.
- Nové tímy: logo do bucketu `timy/<id>/logo.*` (bucket berie iba PNG/JPG/WebP, nie SVG).
- Admin: zápas, sezóna a nastavenia sa ukladajú tlačidlom; súpiska hneď. Po uložení sa všetko znova načíta z DB. Mazanie potvrdí vlastný dialóg.
- Päta: odkaz na UPeCe Bratislava (upcba.sk) a Supabase (supabase.com).

## Ako testovať (bez zápisu do databázy)

```bash
node --test tests/*.test.js                 # logika
bash tools/setup.sh                         # knižnice pre headless Chromium + server http://127.0.0.1:8770/fulka/
node tools/shot.js "http://127.0.0.1:8770/fulka/" 390 /tmp/m.png            # screenshot mobil + chyby z konzoly
node tools/shot.js "http://127.0.0.1:8770/fulka/?edit" 1440 /tmp/a.png @tools/fake-login.js RELOAD @tools/mock-db.js "<JS kroky>"
```
Admin: `fake-login.js` podvrhne prihlásenie, `mock-db.js` presmeruje zápisy do pamäte (`__mem()`, `__writes`).
Port 8765 používa iný projekt – nezabíjať.

## Nasadenie

`git add` + `git commit` + `git push` na `main` → GitHub Pages postaví web sám (1–2 min).
Overenie: `gh api repos/LonziSlovakia/fulka/pages/builds/latest --jq .status` → `built`, potom
`curl -s "https://lonzislovakia.github.io/fulka/<súbor>?x=$(date +%s)"`. Pri výpadku GitHubu (githubstatus.com) treba počkať.

## Bezpečnosť (kontrola 18. 10. 2026)

Anonym nevie zapisovať do tabuliek ani do bucketu, registrácia je vypnutá, podvrhnutý token je odmietnutý, v histórii nie sú tajné kľúče,
texty z DB sa escapujú. Otvorené (nízke riziko): ochrana admina pred vložením do cudzej stránky (clickjacking) – zatiaľ nerobené.

## Nápady / otvorené

- Clickjacking ochrana v `admin.js` (ak Lonzi bude chcieť).
