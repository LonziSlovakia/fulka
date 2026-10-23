# FULka web – pravidlá a živý stav projektu

Všeobecné pravidlá o Lonzim sú v `~/.claude/CLAUDE.md`. Tu je iba to, čo platí pre FULka.
**Tento súbor udržiavaj živý:** po každej zmene, ktorá mení správanie alebo dohodu, ho uprav v tom istom commite.
Neplatné veci zmaž, históriu nedumpuj. `HANDOFF.md` je pôvodné zadanie (pri rozpore platí tento súbor) – čítaj z neho iba časť, ktorú potrebuješ.
Stav k 23. 10. 2026.

## Pravidlá projektu

- Statická stránka: HTML/CSS/JS, **bez buildu, frameworku a servera**, bez `supabase-js` (iba `fetch`). **Iba relatívne cesty** (web beží v `/fulka/`).
- Kód v malých samostatných funkciách. Výpočty patria do `logic.js` (čisté funkcie + testy), vykresľovanie do `render.js` / `admin.js`.
- Fotky a dáta patria do Supabase (bucket a tabuľky `fulka`), nie do repozitára.
- SQL skripty (`supabase/N-nazov.sql`) iba pripravíš; Lonzi ich spustí v Supabase → SQL Editor. Povedz mu aj, ako to overiť.
- Pred commitom: `node --test tests/*.test.js`; vizuálne zmeny over cez `tools/shot.js` (desktop 1440 aj mobil 390).
- **Commit + push na `main` hneď po otestovaní je OK** (Lonzi to tak chce) a potom over nasadenie (nižšie).
- Keď sa zmení niečo v spoločnej Supabase (`lonzi-weby`), uprav aj `~/projects/laura/mapalasky/supabase/PREHLAD-PRE-DALSIE-WEBY.md`.
- Publishable key a URL v `config.js` sú verejné a do kódu patria; tajné kľúče nikdy.

## Čo beží

- Web: https://lonzislovakia.github.io/fulka/ · admin: `…/fulka/?edit` (prihlásenie e-mail + heslo, účet Lonzi; registrácia je vypnutá).
- Repozitár `LonziSlovakia/fulka` (verejný), u Lonziho `~/projects/fulka`, vetva `main` = to, čo je na webe.
- Dáta, fotky, prihlásenie: Supabase projekt `lonzi-weby` (spoločný s `laura`), tabuľky `fulka_*`, bucket `fulka`.
  Zápis povoľuje RLS cez `public.is_admin('fulka')`. Budík proti uspaniu databázy beží v repozitári `laura`.
- Spustené SQL: `supabase/1-fulka.sql` (tabuľky, pravidlá, štartovacie dáta), `supabase/2-loga-webp.sql` (logá víťazov vo WebP).
- Sezóna: Zimná 2026 (pilotná), tímy Veľká sála Giants, Libresso Brewers, Recepcia Rangers, Kaplnka Saints.

## Súbory

| Súbor | Čo robí |
|---|---|
| `index.html` | kostra; načíta `config.js`, `db.js`, `logic.js`, `render.js` |
| `config.js` | URL + publishable key (verejné) |
| `db.js` | fetch klient: načítanie všetkých 8 tabuliek + cache v `localStorage` (`fulka-data-v1`), prihlásenie s obnovou tokenu (`fulka-session-v1`), `upsert(kind, rows, key)`, `remove(kind, where)`, `upload`, `photoUrl` |
| `logic.js` | čisté výpočty (testované): skóre, tabuľka, bodovanie, playoff, dátumy v čase Bratislavy, draft zápasu ↔ riadok DB (`draftOf`/`rowOf`), `DEFAULTS` nastavení |
| `render.js` | verejný web; s `?edit` sa nevykresľuje a načíta `admin.js` + `admin.css` |
| `admin.js` / `admin.css` | admin podľa `design/Admin.dc.html`; triedy admina majú predponu `a-` (napr. `.a-mid`), aby sa nebili so `styles.css` |
| `styles.css` | vzhľad webu, tokeny ako CSS premenné, tímové farby cez `--c --d --ink`, layout cez container queries |
| `tests/logic.test.js` | `node --test tests/*.test.js` (39 testov; `node --test tests/` na Node 22 nejde) |
| `tools/` | lokálne testovanie v prehliadači (nižšie) |
| `design/` | pôvodné návrhy webu a admina (predloha) |
| `assets/logos` | SVG logá tímov, FUL, `upece.png`, `supabase.svg` · `assets/anim` animované logá (WebP, bezstratovo z GIF) · `assets/gif` pôvodné GIF |

## Nastavenia (`fulka_settings.data`, admin → Nastavenia)

`bannerCount` 1–4 · `pointsWin/Draw/Loss` 3/1/0 · `defaultTime` "21:15" (po sv. omši) · `photos` true/false ·
`layout` "wide"/"narrow" (Lonzi má úzke) · `tableOrder` (predvolene `h2hPoints, h2hDiff, diff, gf`) ·
`scorerOrder` (predvolene `goals`) · `scorerTies` "shared"/"alpha"/"team" (predvolene shared) · `headFont` sa ignoruje.

Prepnutie iba na pozretie, bez ukladania: `?fotky=ano|nie`, `?rozlozenie=uzke|siroke`, `?pismo=monument` (iba lokálne).

## Rozhodnutia (dohodnuté s Lonzim)

- **Farby tímov ostávajú podľa návrhu**, nie odtiene z plagátov (raz som ich zle zmenil, Lonzi chcel pôvodné – „tie farby na webe by som nič nemenil“).
- **Písmo Saira.** PP Monument Extended je platený (na dafonte iba na osobné použitie) → súbory sú iba lokálne v `assets/fonts/` (gitignore),
  prepína sa iba cez `?pismo=monument` a použije sa až po úspešnom načítaní písma. Prepínač písma v admine je skrytý.
- Banner: najbližšie neodohrané zápasy (počet `bannerCount`); zápas ostáva, kým ho admin neoznačí ako odohraný (bez časovej tolerancie).
  Bez presného termínu ukáže týždeň (`window_from–to`) a „termín sa doplní“.
- Tabuľka: body → kritériá z `tableOrder` (nastaviteľné poradie, lebo pilotná sezóna). Vzájomné zápasy sa rátajú iba medzi tímami,
  ktoré sú dovtedy úplne rovnaké. Úplná zhoda → poradie tímov (abecedne). Pod tabuľkou je poznámka vygenerovaná z poradia kritérií.
- Kanadské bodovanie: základná časť **aj playoff**; tím hráča = strana gólu (nie súpiska). Rovnaké čísla → **rovnaká priečka** (1, 2, 2, 4…),
  voliteľne abecedne alebo podľa tímu + abecedy; zobrazuje sa do 10. priečky (pri zhode aj viac riadkov). Na mobile sa skryje ikonka tímu, aby sa mená neorezávali.
- Playoff: „podľa tabuľky“ (SF1 = 1.–4., SF2 = 2.–3., isté až po celej základnej časti) alebo „ručne“ (tímy SF v zápase). B3/F sa dopĺňajú z výsledkov SF.
- Presun zápasu: pôvodný termín = ten, **z ktorého sa presúva**; pri ďalšom presune voľba posledný/prvý; dá sa aj skryť.
  Lonzi je s tým spokojný („presne tak, ako to chcem mať“) – nemeniť.
- Rozloženie „úzke“: obsah max. 1000 px, kompaktné tabuľky, rozpis vycentrovaný, tímy 2×2. Mená a logá tímov v rozpise väčšie v oboch režimoch.
- Fotky: bucket `hraci/<player_id>/full|head|face.webp?v=<čas>`. Hromadné nahratie v Tímy podľa mien súborov `<player_id>_full|_head|_face`.
  Jedna fotka → výrez hlavy a avatar sa vyrobia samé. Fotky kapitánov sú nahraté. Ukazujú sa pri kapitánoch v Tímoch a v bodovaní.
- Nové tímy: logo do bucketu `timy/<id>/logo.*` (bucket berie iba PNG/JPG/WebP, nie SVG).
- Admin: zápas, sezóna a nastavenia sa ukladajú tlačidlom; súpiska hneď. Po uložení sa všetko znova načíta z DB. Mazanie (zápas, hráč, tím zo sezóny)
  potvrdí vlastný dialóg s rozmazaným pozadím. Poradie v Nastaveniach: banner → náhľad banneru → fotky → rozloženie → kritériá → Uložiť dole.
- Časy v admine: rýchle voľby 19:00 / 20:15 / 21:00 / 21:15 a ±15 min.
- Päta: odkaz na UPeCe Bratislava (upcba.sk, biele logo) a Supabase (supabase.com, „Dáta, fotky a prihlásenie bežia na Supabase“).

## Ako testovať (bez zápisu do databázy)

```bash
node --test tests/*.test.js                 # logika
bash tools/setup.sh                         # knižnice pre headless Chromium + server http://127.0.0.1:8770/fulka/
node tools/shot.js "http://127.0.0.1:8770/fulka/" 390 /tmp/m.png            # screenshot mobil + chyby z konzoly
node tools/shot.js "http://127.0.0.1:8770/fulka/?edit" 1440 /tmp/a.png @tools/fake-login.js RELOAD @tools/mock-db.js "<JS kroky>"
```
- `shot.js <url> <šírka> <out.png> [kroky]` – krok `RELOAD`, `@súbor.js` alebo JS kód; `CLIP=x,y,w,h` oreže obrázok.
- Admin: `fake-login.js` podvrhne prihlásenie, `mock-db.js` presmeruje zápisy do pamäte (`__mem()`, `__writes`).
- Chromium je Playwright headless shell; chýbajúce knižnice sú v `tools/.cache/libroot` (bez sudo, gitignore).
- Port 8765 používa iný projekt – nezabíjať.

## Nasadenie

- GitHub Pages: repozitár → Settings → Pages → „Deploy from a branch: `main` / root“. `.nojekyll` = nič negenerovať, iba skopírovať.
- `git push` na `main` → workflow „pages build and deployment“ (záložka Actions) nahrá web za 1–2 min.
- Overenie: `gh api repos/LonziSlovakia/fulka/pages/builds/latest --jq .status` → `built`, potom
  `curl -s "https://lonzislovakia.github.io/fulka/<súbor>?x=$(date +%s)"`.
- Pri výpadku GitHubu (githubstatus.com) iba počkať, build nespúšťať znova.

## Bezpečnosť (kontrola 18. 10. 2026)

Anonym nevie zapisovať do tabuliek ani do bucketu, registrácia je vypnutá, podvrhnutý token je odmietnutý, v histórii nie sú tajné kľúče,
texty z DB sa escapujú. Nízke riziká: hádanie hesla, prihlásenie uložené v `localStorage`, spoločná DB s `laura`,
ochrana admina pred vložením do cudzej stránky (clickjacking) – zatiaľ nerobené.

## Otvorené / nápady

- Clickjacking ochrana v `admin.js` (ak Lonzi bude chcieť).
- Text pri Supabase v päte prípadne zmeniť na „Vybudované s pomocou Supabase“ (ak Lonzi bude chcieť).
