# FULka web: zadanie pre Claude Code

Stránka florbalovej ligy **FUL – Florbalová Upece Liga** („FULka“). Nasadenie na GitHub Pages
`https://lonzislovakia.github.io/fulka/`, dáta v spoločnej Supabase databáze `lonzi-weby`.

Vzhľad je hotový a schválený: návrh **„Shard“** z Claude Design (artefakt „FULka web — Shard s fotkami hráčov“).
Úloha: postaviť z neho skutočnú statickú stránku a admin, ktoré čítajú a zapisujú do Supabase.

Majiteľ: Lonzi (GitHub `LonziSlovakia`). Komunikácia po slovensky, neformálne, krátko, nové pojmy vysvetliť.
Pracovný princíp **SET → GET**: po každej zmene stavu (inštalácia, zápis súboru, push, SQL…) hneď samostatné overenie.

---

## 1. Čo je v tomto priečinku

```
HANDOFF.md            toto zadanie
CLAUDE.md             krátke pravidlá pre Claude Code
README.md             verejný popis repozitára
.nojekyll             GitHub Pages nebude súbory prehadzovať cez Jekyll
.gitignore
supabase/1-fulka.sql  tabuľky, pravidlá (RLS), bucket na fotky a štartovacie dáta (Lonzi spúšťa ručne)
assets/logos/         statické logá tímov (SVG), logo FUL (SVG s pozadím / bez pozadia, biela PNG značka)
assets/anim/          animované logá tímov a FUL vo WebP (víťaz zápasu / šampión); assets/gif/ = pôvodné GIF
design/               zdrojové súbory návrhu (.dc.html) + design/screens/*.jpg (screenshoty všetkých obrazoviek)
```

Fotky hráčov **nie sú** v repozitári (pravidlo: dáta a fotky patria do Supabase).
Pripravené výrezy 4 kapitánov sú u Lonziho v `C:\Users\lonzi\Downloads\liga\FULka Kapitáni\web\`
(z WSL `/mnt/c/Users/lonzi/Downloads/liga/FULka Kapitáni/web/`), nahrajú sa cez admin (pozri časť 7).

## 2. Pevné pravidlá (z `laura/supabase/PREHLAD-PRE-DALSIE-WEBY.md`)

- Statická stránka: HTML/CSS/JS, **bez buildu, bez frameworku, bez servera**. Bez `supabase-js`, iba `fetch`.
- Stránka beží v podpriečinku `/fulka/` → **iba relatívne cesty** (`app.js`, `assets/…`, nikdy `/app.js`).
- **Nikdy** do kódu ani do správ: `service_role` / `sb_secret_…` kľúč, heslo k databáze, heslá účtov.
- Verejné údaje (patria do kódu):
  - URL: `https://anovkowkucidkutwghzx.supabase.co`
  - Publishable key: `sb_publishable_Z7x71TnM4mW0G_xrniGZsQ_PVCtIjwM`
- Commity so skrytou adresou: `git config user.email "72870876+LonziSlovakia@users.noreply.github.com"` (pred prvým commitom).
- Vzor klienta: `db.js` v repozitári `laura` (u Lonziho `~/projects/laura/mapalasky/db.js`, alebo github.com/LonziSlovakia/laura).
  - Čítanie `GET /rest/v1/<t>?select=…` s hlavičkou `apikey`, výsledok do `localStorage` (stránka sa otvorí hneď aj offline).
  - Prihlásenie `POST /auth/v1/token?grant_type=password`, obnova cez `grant_type=refresh_token`.
  - Zápis s `apikey` + `Authorization: Bearer <access_token>`; upsert `POST /rest/v1/<t>?on_conflict=id`
    s `Prefer: resolution=merge-duplicates,return=representation`; prázdna odpoveď = RLS nepovolilo.
  - Fotky: `POST /storage/v1/object/fulka/<cesta>` s `x-upsert: true`, verejná adresa
    `…/storage/v1/object/public/fulka/<cesta>`.
- Editor (admin) sa načíta **iba s `?edit`** v adrese a ukladá každú zmenu hneď.
- Budík proti uspaniu databázy už beží v repozitári `laura` → pre `fulka` **netreba** ďalší.
- Kód písať v malých, samostatných funkciách (Lonzi to tak chce).

## 3. Databáza (`supabase/1-fulka.sql`)

Skript je overený na lokálnom Postgres 16 so simuláciou Supabase: prebehne aj dvakrát po sebe bez chyby,
anonym aj Laura majú zápis zakázaný, Lonzi (admin `fulka`) môže zapisovať aj nahrávať fotky.
**Spúšťa ho Lonzi sám** (Supabase → SQL Editor). Ty ho nespúšťaj, iba ho prípadne uprav a povedz mu.

| Tabuľka | Význam |
|---|---|
| `fulka_settings` | 1 riadok, `data` jsonb: `bannerCount` (2), `pointsWin` (3), `pointsDraw` (1), `pointsLoss` (0) |
| `fulka_seasons` | `id`, `name`, `short`, `state` soon/live/done, `seed_mode` auto/manual, `sort`. Naraz max. 1 `live` (unikátny index) |
| `fulka_teams` | `id` gia/bre/ran/sai, `name`, `venue`, `abbr`, `color`, `color_dark`, `ink`, `logo`, `logo_anim` |
| `fulka_season_teams` | ktoré tímy hrajú v sezóne |
| `fulka_players` | `id`, `name`, `photo` (postava), `photo_head` (hlava+plecia), `photo_face` (štvorec) |
| `fulka_roster` | `season_id`, `player_id`, `team_id`, `captain`, `number`. Max. 1 kapitán na tím a sezónu |
| `fulka_matches` | `stage` R/SF1/SF2/B3/F, `round`, `home_id`, `away_id`, `window_from/to` (týždeň), `starts_at` (null = bez termínu), `orig_starts_at`, `moved`, `status` plan/done, `note` |
| `fulka_goals` | `match_id`, `seq`, `side` h/a, `scorer_id` (null = neznámy), `assist_id` (null = bez asistencie) |

Štartovacie dáta: 4 tímy, sezóna `z26` „Zimná sezóna 2026“ (live), 39 hráčov zo súpisiek draftu (kapitán prvý),
12 zápasov základnej časti podľa oficiálneho rozpisu (iba týždne, bez dňa a času) a 4 prázdne playoff zápasy.

**Nič sa neukladá dvakrát** – všetko ostatné sa počíta v JS:
- skóre zápasu = počet gólov `h` / `a`;
- tabuľka: body podľa `fulka_settings` (výhra 3, remíza 1), poradie: body → kritériá z `tableOrder` (predvolene vzájomné zápasy – body, – rozdiel, rozdiel skóre, strelené góly; nastaviteľné v admine);
- kanadské bodovanie: gól + asistencia, poradie: body → kritériá z `scorerOrder` (predvolene góly) → pri úplnej zhode `scorerTies` (predvolene rovnaká priečka); do 10. priečky; tím hráča = strana gólu v zápase
  (nie aktuálna súpiska – vyradený hráč si góly necháva);
- playoff pri `seed_mode = 'auto'`: SF1 = 1. vs 4., SF2 = 2. vs 3. z tabuľky; B3 = porazení SF, F = víťazi SF;
  pri `manual` sú tímy SF uložené v `home_id`/`away_id`;
- šampión skončenej sezóny = víťaz finále; poradie 1–4 z finále a zápasu o 3. miesto.

Časy: `starts_at` je `timestamptz`, zobrazovať a zadávať v časovom pásme **Europe/Bratislava**.
Pri presune zápasu admin uloží pôvodný termín do `orig_starts_at` a `moved = true` (na webe prečiarknutý pôvodný čas).

## 4. Web (verejná časť)

Zdroj pravdy pre vzhľad: `design/Main.dc.html` (desktop aj mobil sú ten istý komponent, kontajnerové dotazy `cqi`)
a screenshoty `design/screens/01–07`. Dáta v návrhu sú **ukážkové** (vymyslené výsledky, iné dvojice zápasov) –
na skutočnom webe všetko z databázy.

Hlavička (všetky stavy):
- logo FUL + „FULka / Florbalová Upece Liga“ vľavo = odkaz na úvod (`#top`, prebiehajúca sezóna);
- tlačidlo sezóny (názov + stav), rozbalí výber sezón (karty so stavom Prebieha / Skončená / Pripravujeme, pri skončenej logo šampióna);
- navigácia na sekcie podľa stavu sezóny.

**Prebiehajúca sezóna** (`screens/01-Main.jpg`, mobil `05-Mobile.jpg`):
1. Banner „Najbližšie zápasy“: najbližších **N** zápasov (`bannerCount`, 1–4, predvolene 2), karty s farebným „shard“ prechodom,
   logá, čas, kolo; ak sú v jeden deň → spoločný dátum hore a „1. zápas / 2. zápas“, inak dátum na karte. Presun/poznámka pod kartou.
   Ak zápasy ešte nemajú presný termín, ukázať najbližší týždeň (`window_from–window_to`) a „termín sa doplní“.
2. **Výsledky**: odohrané zápasy (najnovšie prvé) ako karty; víťaz farebne + animované GIF logo, porazený sivý.
   Klik na kartu rozbalí časovú os gólov (priebežné skóre, strelec, asistencia v zátvorke, „Neznámy hráč“).
3. **Rozpis**: po kolách, vľavo dátum kola; riadky zápasov so stavom Koniec / Najbližší / Naplánovaný / Presunutý (oranžová #FFB020) / Bez termínu (prerušovaný rámik).
4. **Tabuľka**: poradie, Z, V, R, P, skóre, rozdiel, body; pod ňou „Výhra 3 b · remíza 1 b · do playoff idú všetky štyri tímy…“.
5. **Hráči**: pódium top 3 (veľká fotka hlavy `photo_head` v tímovom „shard“ pozadí, inak iniciály) + tabuľka do 10. miesta s malým avatarom.
6. **Playoff**: pavúk SF1, SF2, o 3. miesto, finále; kým nie sú tímy, ukázať „1. tabuľky vs 4. tabuľky“.
7. **Tímy**: 4 karty – ľavá tretina čierna, farebný „shard“ vpravo, fotka kapitána (`photo`), súpiska s avatarmi, „C“ pri kapitánovi.

**Skončená sezóna** (`03-MainArchiv.jpg`, `06-MobileArchiv.jpg`): Šampión (veľké GIF logo, výsledok finále), Poradie 1–4,
Tabuľka, Playoff, Výsledky po kolách (zápasy klikateľné, rozbalia góly), Hráči.

**Pripravovaná sezóna** (`04-MainBuduca.jpg`, `07-MobileBuduca.jpg`): plagát „Pripravujeme“ + kroky Prihlasovanie → Draft tímov → Prvý zápas, tlačidlo späť na prebiehajúcu.

## 5. Admin (`?edit`)

Zdroj: `design/Admin.dc.html`, screenshoty `08–14`. Najprv prihlasovací formulár (e-mail + heslo, účet Lonzi už existuje).
Hore výber sezóny, ktorú upravuješ (Jar 2026 / Zima 2026 / …), záložky:

- **Zápasy**: zoznam s filtrom (všetky / naplánované / odohrané / bez termínu), editor zápasu:
  tímy, dátum + čas alebo „Termín neznámy“, „Označiť ako presunutý“ (zapamätá pôvodný termín), poznámka,
  stav Naplánovaný/Odohraný, góly (poradie, strana, strelec zo súpisky alebo „Neznámy hráč“, asistencia), pridať / vymazať zápas.
  Kontroly (hlášky presne z návrhu): oba tímy, nie ten istý tím, dátum alebo „neznámy“, odohraný potrebuje dátum aj oba tímy,
  každý gól má strelca, **playoff nemôže skončiť remízou**.
- **Playoff**: prepínač „Podľa tabuľky“ / „Ručne“ (`seed_mode`), termíny SF, o 3. miesto a finále.
- **Tímy**: zoznam tímov, súpiska vybraného tímu: „C“ = kapitán, „Presunúť“ do iného tímu, odstrániť (góly ostávajú),
  tlačidlo s fotoaparátom = nahrať fotku hráča, pridať hráča.
- **Sezóny**: vytvoriť / upraviť sezónu (názov, stav, tímy). Pri prepnutí sezóny na „Prebieha“ najprv starú daj na `done`, potom novú na `live` (unikátny index).
- **Nastavenia**: koľko zápasov ukazuje banner (1–4) s náhľadom.
- Mobilná verzia adminu: `13-AdminMobilSezony.jpg`, `14-AdminMobilTimy.jpg`.

Každá zmena sa uloží hneď a ukáže krátku hlášku („Uložené…“). Po uložení prepočítať web (tabuľka, štatistiky).

## 6. Vzhľad – hlavné tokeny

- Písma (Google Fonts): **Saira** 400–700 (text), **Saira Extra Condensed** 600–900 (nadpisy, čísla, VEĽKÉ písmená, `skewX(-8deg)` pri nadpisoch).
  Znak kapitána „C“ písať v Saira 800 (v Condensed vyzerá ako „(“).
- Pozadie `#050505`, karty `#0E0E0E`, rámiky `#1E1E1E` / `#2A2A2A` / `#3A3A3A`, text `#FFFFFF` / `#BDBDBD` / `#9A9A9A` / `#5A5A5A`.
  Presunutý `#FFB020`, „prebieha“ bodka `#3DDC84`.
- Tímy (`color` / `color_dark` / `ink`) podľa návrhu: Giants `#D9A252 / #6E4518 / #111111`, Brewers `#D2AA79 / #3F2010 / #3F2010`,
  Rangers `#41CFDD / #024F57 / #111111`, Saints `#E0262F / #5E0710 / #FFFFFF` (Lonzi ich chce ponechať, nie meniť na odtiene z plagátov).
- „Shard“ = farebný prechod `linear-gradient(150–160deg, color, color_dark)` orezaný `clip-path` polygónom so zlomom, napr.
  - banner: `polygon(58% 0, 100% 0, 100% 100%, 42% 100%, 51% 63%, 45.5% 59%, 55% 28%, 49.5% 24%)`
  - karta tímu: `polygon(42% 0, 100% 0, 100% 100%, 24% 100%, 36% 54%, 28% 50%)`
  - pódium hráča: `polygon(38% 0, 100% 0, 100% 100%, 0 100%, 22% 52%, 10% 48%)`
  - šikmé čipy/tlačidlá: `polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)`
- Ostatné presné hodnoty (veľkosti, medzery, `clamp()`) sú priamo v `design/*.dc.html` – inline štýly sa dajú prevziať takmer 1:1.

**Ako čítať `.dc.html`**: šablóna v `<x-dc>`; `{{x}}` = hodnota, `<sc-for list=… as=…>` = cyklus,
`<sc-if value=…>` = podmienka; logika je v triede `Component` → `renderVals()` vracia hodnoty pre šablónu
(funkcie `standings`, `scorers`, `rounds`, `bannerVals`, `goalTimeline`, `statusTag`… sa dajú prepísať do obyčajného JS).
Súbory nejdú otvoriť priamo v prehliadači (potrebujú runtime Claude Design) – na vzhľad použi `design/screens/`.

## 7. Fotky hráčov

- Bucket `fulka` (verejný, max 8 MB, jpeg/png/webp). Cesty: `hraci/<player_id>/full.webp`, `head.webp`, `face.webp`.
- Fotky majú **priehľadné pozadie** → v prehliadači zmenšiť do **WebP** (nie JPEG, stratila by sa priehľadnosť):
  postava max. 900 px výška, hlava 468×600, avatar 256×256; bez EXIF.
- Admin: tlačidlo s fotoaparátom pri hráčovi → nahrať postavu; výrez hlavy a avatar buď vyrobiť automaticky
  (horná časť obrázka), alebo druhé tlačidlo na vlastný výrez hlavy. Na webe: pódium = `photo_head`, karta tímu = `photo`, avatar = `photo_face`; bez fotky iniciály.
- Pripravené súbory (u Lonziho v `…/liga/FULka Kapitáni/web/`): `<player_id>_full|head|face.webp` pre
  `p-stefanak-jakub` (Giants), `p-bartos-andrej` (Brewers), `p-kliment-pavol` (Rangers), `p-stieber-damian` (Saints).
  Nahrá ich Lonzi cez hotový admin (prvý ostrý test nahrávania).

## 8. Navrhovaná štruktúra kódu

```
index.html     kostra stránky, sekcie, <noscript>
styles.css     tokeny (CSS premenné), komponenty
config.js      URL + publishable key + site 'fulka' + bucket 'fulka'
db.js          fetch klient (podľa laura/mapalasky/db.js): load, cache, login, refresh, upsert, remove, upload
logic.js       čisté funkcie: score, standings, scorers, playoffPairs, champion, nextMatches, formatDate…
render.js      vykreslenie sekcií webu z dát
admin.js       editor (načíta sa iba pri ?edit)
```

## 9. Postup (každý krok SET → GET)

1. Repozitár: `~/projects/fulka` (klon `LonziSlovakia/fulka`), skopírovať obsah tohto priečinka, noreply e-mail,
   commit, push. GET: `git log -1 --format='%ae %s'`, `gh api repos/LonziSlovakia/fulka/contents --jq '.[].name'`.
2. Lonzi spustí `supabase/1-fulka.sql`. GET: `curl` na `…/rest/v1/fulka_teams?select=id` s `apikey` → 4 tímy;
   `fulka_matches?select=id` → 16; `fulka_roster?select=player_id` → 39.
3. Postaviť `logic.js` + jednoduché testy (Node, bez knižníc) na tabuľku, bodovanie a playoff. GET: testy prejdú.
4. Postaviť verejný web (`index.html`, `styles.css`, `render.js`, `db.js`). GET: lokálne `python3 -m http.server`,
   porovnať so screenshotmi (desktop 1440 px aj mobil 390 px), konzola bez chýb.
5. Postaviť admin (`?edit`). GET: prihlásenie, uloženie zápasu s gólmi, presun zápasu, kapitán, fotka – každé overiť
   načítaním z REST a pohľadom na web. Testovacie zmeny potom vrátiť.
6. GitHub Pages: `gh api -X POST repos/LonziSlovakia/fulka/pages -f "source[branch]=main" -f "source[path]=/"`.
   GET: `gh api repos/LonziSlovakia/fulka/pages --jq .status` → `built`, potom otvoriť `https://lonzislovakia.github.io/fulka/`.
7. Aktualizovať `laura/supabase/PREHLAD-PRE-DALSIE-WEBY.md` (fulka beží) – iba ak Lonzi súhlasí.

## 10. Otvorené otázky (spýtať sa Lonziho, kým sa nerozhodne, nechať ako v návrhu)

1. Presné dni a časy zápasov – oficiálny rozpis má iba týždne (návrh počítal s utorkom 20:15 a 21:00 „po sv. omši“).
2. Výsledky už odohraných zápasov (týždeň 1 a 2) – zadá ich Lonzi v admine, alebo ich pošle.
3. ~~Farby tímov~~ – ostávajú podľa návrhu webu (Lonzi rozhodol).
4. Body 3 / 1 / 0 a poradie v tabuľke (body → rozdiel → góly) – potvrdiť. Playoff: predĺženie/nájazdy stačí zapísať ako gól?
5. Staršie sezóny (návrh má ukážkovú „Jarnú sezónu 2026“) – existovali naozaj? Ak nie, výber sezón ukáže iba Zimnú 2026.
6. ~~GIF logá~~ – prevedené bezstratovo do WebP v `assets/anim/` (1,3 MB → 0,5 MB, obraz zhodný na pixel); v databáze ich prepne `supabase/2-loga-webp.sql`.
