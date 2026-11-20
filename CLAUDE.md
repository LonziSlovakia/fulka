# FULka web – pravidlá a živý stav projektu

Všeobecné pravidlá o Lonzim sú v `~/.claude/CLAUDE.md`. Tu je iba to, čo platí pre FULka.
**Tento súbor udržiavaj živý:** po každej zmene, ktorá mení správanie alebo dohodu, ho uprav v tom istom commite.
Neplatné veci zmaž, históriu nedumpuj. (Pôvodné zadanie `HANDOFF.md` je zmazané 20. 11. 2026 – všetko podstatné je tu a v kóde.)
Stav k 19. 11. 2026.

## Pravidlá projektu

- Statická stránka: HTML/CSS/JS, **bez buildu, frameworku a servera**, bez `supabase-js` (iba `fetch`). **Iba relatívne cesty** (web beží na `ful.upcba.sk/`, lokálne v `/fulka/`).
- Kód v malých samostatných funkciách. Výpočty patria do `logic.js` (čisté funkcie + testy), vykresľovanie do `render.js` / `admin.js`.
- Fotky a dáta patria do Supabase (bucket a tabuľky `fulka`), nie do repozitára.
- SQL skripty (`supabase/N-nazov.sql`) iba pripravíš; Lonzi ich spustí v Supabase → SQL Editor. Povedz mu aj, ako to overiť.
- **Keď sa zmení JS alebo CSS: `bash tools/verzia.sh`** (dá `?v=<čas>` do `index.html` a `tabula.html`; admin a tabuľu `render.js` načíta s rovnakou verziou).
  Dôvod: Cloudflare na `ful.upcba.sk` necháva prehliadač pamätať si JS/CSS 4 hodiny (HTML iba 10 min) – bez novej verzie Lonzi vidí starý admin.
- Pred commitom: `node --test tests/*.test.js`; vizuálne zmeny over cez `tools/shot.js` (desktop 1440 aj mobil 390).
- **Commit + push na `main` hneď po otestovaní je OK** (Lonzi to tak chce) a potom over nasadenie (nižšie).
- Keď sa zmení niečo v spoločnej Supabase (`lonzi-weby`), uprav aj `~/projects/laura/mapalasky/supabase/PREHLAD-PRE-DALSIE-WEBY.md`.
- Publishable key a URL v `config.js` sú verejné a do kódu patria; tajné kľúče nikdy.

## Čo beží

- Web: **https://ful.upcba.sk/** (vlastná doména od 20. 11. 2026, súbor `CNAME`; stará https://lonzislovakia.github.io/fulka/ presmeruje) · admin: `…/?edit` (prihlásenie e-mail + heslo; admini sú dvaja, oba účty sú Lonziho: hlavný a sekundárny „Jozef“, pridaný ručne cez Add user + `public.admins`; registrácia je vypnutá).
- Repozitár `LonziSlovakia/fulka` (verejný), u Lonziho `~/projects/fulka`, vetva `main` = to, čo je na webe.
- Dáta, fotky, prihlásenie: Supabase projekt `lonzi-weby` (spoločný s `laura`), tabuľky `fulka_*`, bucket `fulka`.
  Zápis povoľuje RLS cez `public.is_admin('fulka')`. Budík proti uspaniu databázy beží v repozitári `laura`.
- Spustené SQL: `supabase/1-fulka.sql` (tabuľky, pravidlá, štartovacie dáta), `supabase/2-loga-webp.sql` (logá víťazov vo WebP),
  `supabase/3-zalohy.sql` (ručné zálohy + poistka; spustené a Lonzim otestované 3. 11. 2026), `supabase/4-terminy-sezony.sql` (termíny sezóny; spustené 19. 11. 2026).
  Demo tím Kuchynka Ants si Lonzi vytvorí sám v admine (SQL na to **nechce**); grafiku má v `design/ants/`.
- Sezóny: Zimná 2026 `z26` (pilotná, skončená), Letná 2027 `l27` (pripravujeme). Tímy Veľká sála Giants, Libresso Brewers, Recepcia Rangers, Kaplnka Saints.

## Súbory

| Súbor | Čo robí |
|---|---|
| `index.html` | kostra; načíta `config.js`, `db.js`, `logic.js`, `upece.js`, `render.js` |
| `config.js` | URL + publishable key (verejné) |
| `db.js` | fetch klient: načítanie všetkých 8 tabuliek (sezóny `select=*`, aby fungovalo pred aj po pridaní stĺpcov) + cache v `localStorage` (`fulka-data-v1`), prihlásenie s obnovou tokenu (`fulka-session-v1`), `upsert(kind, rows, key)`, `remove(kind, where, maybe)` (where aj `{ seq: { gt: 3 } }`), `upload`, `photoUrl`, zálohy `backups/backupData/backup/restore/restoreFile` |
| `logic.js` | čisté výpočty (testované): skóre, tabuľka, bodovanie, playoff, dátumy v čase Bratislavy, draft zápasu ↔ riadok DB (`draftOf`/`rowOf`), `DEFAULTS` nastavení |
| `upece.js` | sekcia „Z UPeCe“: načítanie a čítanie týždenných oznamov a noviniek z upcba.sk (čisté funkcie + `load()` s cache `fulka-upece-v1`) |
| `render.js` | verejný web; s `?edit` sa nevykresľuje a načíta `admin.js` + `admin.css` |
| `admin.js` / `admin.css` | admin podľa `design/Admin.dc.html`; triedy admina majú predponu `a-` (napr. `.a-mid`), aby sa nebili so `styles.css` |
| `board.js` | výsledková tabuľa, čisté funkcie (testované): stav → nový stav (čas z časovej značky, tresty, góly, koniec) + uloženie do `localStorage` (`fulka-board-v1`) |
| `board-view.js` / `board.css` | vykreslenie tabule (plátno 16:9 v jednotkách kontajnera, premenná `--f` = veľkosť); používa ho `tabula.html` aj náhľad v admine |
| `board-admin.js` | admin → záložka „Tabuľa“ (ovládanie); načíta ho `render.js` s `?edit` pred `admin.js` |
| `tabula.html` | druhá obrazovka (bez prihlásenia a bez databázy, číta iba `localStorage`; `F` / dvojklik = celá obrazovka) |
| `styles.css` | vzhľad webu, tokeny ako CSS premenné, tímové farby cez `--c --d --ink`, layout cez container queries |
| `tests/*.test.js` | `node --test tests/*.test.js` (86 testov: `logic` 54, `upece` 7, `board` 25; `node --test tests/` na Node 22 nejde) |
| `tools/` | lokálne testovanie v prehliadači (nižšie) |
| `design/` | pôvodné návrhy webu a admina (predloha) |
| `assets/logos` | SVG logá tímov, FUL, `upece.png`, `supabase.svg` · `assets/anim` animované logá (WebP, bezstratovo z GIF) · `assets/gif` pôvodné GIF (zdroj pre `tools/webp-smooth.py`) · `design/ants/` logo Kuchynka Ants (`index.html` náhľad, `zdroj.html` kresba, `predloha/` Lonziho koncept) |

## Nastavenia (`fulka_settings.data`, admin → Nastavenia)

`bannerCount` 1–4 · `pointsWin/Draw/Loss` 3/1/0 · `defaultTime` "21:15" (po sv. omši) · `photos` true/false ·
`layout` "wide"/"narrow" (Lonzi má úzke) · `tableOrder` (predvolene `h2hPoints, h2hDiff, diff, gf`) ·
`scorerOrder` (predvolene `goals`) · `scorerTies` "shared"/"alpha"/"team" (predvolene shared) ·
`upece` true/false (sekcia Z UPeCe) · `upeceHours` text pod názvom UPeCe · `upeceOffer` zoznam `{t, d}` pre „Viac než florbal“.

Prepnutie iba na pozretie, bez ukladania: `?fotky=ano|nie`, `?rozlozenie=uzke|siroke`, `?upece=ano|nie`.

## Rozhodnutia (dohodnuté s Lonzim)

- **Farby tímov ostávajú podľa návrhu**, nie odtiene z plagátov (raz som ich zle zmenil, Lonzi chcel pôvodné – „tie farby na webe by som nič nemenil“).
- **Písmo Saira.** Platené PP Monument Extended Lonzi zrušil (20. 11. 2026) – kód je z webu preč; súbory v `assets/fonts/` sú iba lokálne a v gitignore, nikdy ich necommitovať.
- Banner: najbližšie neodohrané zápasy (počet `bannerCount`); zápas ostáva, kým ho admin neoznačí ako odohraný (bez časovej tolerancie).
  Bez presného termínu ukáže týždeň (`window_from–to`) a „termín sa doplní“. Playoff na banneri až keď sú tímy isté (`fixed`); sezóna bez zápasov
  základnej časti nemá „dohranú“ základnú časť (inak by sa SF nasadilo abecedne). Strelec ≠ asistent v tom istom góle (kontrola pri uložení).
- Tabuľka: body → kritériá z `tableOrder` (nastaviteľné poradie, lebo pilotná sezóna). Vzájomné zápasy sa rátajú iba medzi tímami,
  ktoré sú dovtedy úplne rovnaké. Úplná zhoda → poradie tímov (abecedne). Pod tabuľkou je poznámka vygenerovaná z poradia kritérií.
- Kanadské bodovanie: základná časť **aj playoff**; tím hráča = strana gólu (nie súpiska). Rovnaké čísla → **rovnaká priečka** (1, 2, 2, 4…),
  voliteľne abecedne alebo podľa tímu + abecedy; zobrazuje sa do 10. priečky (pri zhode aj viac riadkov). Na mobile sa skryje ikonka tímu, aby sa mená neorezávali.
  Posledný riadok tabuľky „＋ Všetci hráči sezóny (N)“ rozbalí všetkých zo súpisky sezóny aj s 0 bodmi (`L.scorers(…, Infinity, settings, roster)`),
  „−“ zbalí späť na top 10 (aj v archíve; pri zmene sezóny sa zbalí, nepamätá sa).
- Playoff: „podľa tabuľky“ (SF1 = 1.–4., SF2 = 2.–3., isté až po celej základnej časti) alebo „ručne“ (tímy SF v zápase). B3/F sa dopĺňajú z výsledkov SF.
- Presun zápasu: pôvodný termín = ten, **z ktorého sa presúva**; pri ďalšom presune voľba posledný/prvý; dá sa aj skryť.
  Lonzi je s tým spokojný („presne tak, ako to chcem mať“) – nemeniť.
- Rozloženie „úzke“: obsah max. 1000 px, kompaktné tabuľky, rozpis vycentrovaný, tímy 2×2. Mená a logá tímov v rozpise väčšie v oboch režimoch.
- Fotky: bucket `hraci/<player_id>/full|head|face.webp?v=<čas>`. Hromadné nahratie v Tímy podľa mien súborov `<player_id>_full|_head|_face`.
  Jedna fotka → výrez hlavy a avatar sa vyrobia samé. Fotky kapitánov sú nahraté. Ukazujú sa pri kapitánoch v Tímoch a v bodovaní.
- Nové tímy: logo do bucketu `timy/<id>/logo.*` (bucket berie iba PNG/JPG/WebP, nie SVG).
- Admin: zápas, sezóna a nastavenia sa ukladajú tlačidlom; súpiska hneď. Po uložení sa všetko znova načíta z DB. Mazanie (zápas, hráč, tím zo sezóny)
  potvrdí vlastný dialóg s rozmazaným pozadím. Poradie v Nastaveniach: banner → náhľad banneru → fotky → rozloženie → Z UPeCe → kritériá → Uložiť dole.
- Časy v admine: rýchle voľby 19:00 / 20:15 / 21:00 / 21:15 a ±15 min.
- Admin → Tímy: v riadku sezón je navyše čip **„Všetky tímy (N)“** (`S.teamScope`; Lonzi ho chcel tam, nie v zozname). „Všetky tímy“ = všetky z DB aj s menami sezón; tím mimo upravovanej sezóny
  sa dá upraviť („Upraviť tím“) a tlačidlom „Pridať do sezóny …“ pridať (súpiska patrí k sezóne). Vyžiadal Lonzi 20. 11. 2026 – tím odobratý zo všetkých sezón sa inak nedal upraviť.
  „Nový tím“ v režime „Všetky tímy“ sa **nepridá do žiadnej sezóny** (nie je vybratá). Po pridaní tímu do sezóny a pri otvorení záložky Sezóny sa editor sezóny postaví nanovo (`S.seasonDraft = null`).
- Tlačidlo „hore“: plávajúce vpravo dole (biely štvorec so šípkou, zrezaný roh), ukáže sa po odscrollovaní o 400 px, iba na verejnom webe (nie v `?edit`).
  Je mimo `.page`, lebo `container-type` by inak bral `position: fixed` voči kontajneru.
- **Sekcia „Z UPeCe“** (nad pätou, podľa návrhu z Claude Design, ktorý Lonzi poslal iba ako screenshot): tri stĺpce podpora → kalendár → ponuka, na úzkej obrazovke pod sebou.
  - Podpora: logo `assets/logos/upece-512.png` (z upcba.sk, čierne na bielom → na webe `invert` + `mix-blend-mode: screen`), „Zisti viac“ → upcba.sk.
  - Kalendár naživo z WordPress REST API upcba.sk (CORS povolený): posledné 2 príspevky kategórie **Oznamy (174)**, z tabuľky
    `td.day/.liturgy/.mass/.events` sa skladá program na 7 dní od dnes (max 7 riadkov). iCal export kalendára CORS nemá, preto sa nepoužíva.
  - **Výnimočná akcia** (zvýraznená tyrkysovou) = má v tom týždni vlastný oznam s dátumom (`notice-title` „Názov D. M.“). Oznam s dátumom a časom,
    ktorý nie je v tabuľke, sa doplní ako riadok. „… do D. M.“ je uzávierka, nie akcia.
  - Novinky: 2 posledné príspevky z **Aktuality (165)** bez Oznamov. Odkazy iba na `https://www.upcba.sk/…`, texty sa escapujú.
  - „Celý kalendár“ → upcba.sk/kalendar/ (curl dostane 403 od Cloudflare, prehliadač je OK) · „Všetko, čo ponúkame“ → upcba.sk/o-upece/.
  - Ponuka: zoznam z nastavení (`upeceOffer`) + **všetky tímy z databázy** (aj tie, ktoré ešte nie sú v žiadnej sezóne), s menom miesta (`venue`), poradie podľa mena.
  - Ak sa zmení šablóna oznamov na upcba.sk, program sa ukáže prázdny („ešte nie je zverejnený“) – oprava v `upece.js` + test.
- **Výsledková tabuľa** (admin → Tabuľa, súbory `board*.js`, `tabula.html`; vyžiadal Lonzi 17. 11. 2026, nasadené 17. 11. 2026):
  - Tok: vybrať neodohraný zápas (iba s oboma známymi tímami) → počet častí (1 / 2 polčasy / 3 tretiny / 4 štvrtiny) × minúty → jedna alebo dve obrazovky → ovládanie.
    Čas sa **odpočítava** (`3:42`, pod ním „2. tretina“; pri jednej časti bez názvu). Tresty (max. 2 aktívne na tím, minúty + sekundy, hráč zo súpisky) bežia iba kým beží čas a prechádzajú aj do ďalšej časti.
    Ovládanie: štart/pauza (aj medzerník), korekcia ±10 s / ±1 min, ďalšia časť, ＋ Gól → zoznam hráčov tímu (jedno kliknutie = zapísané; asistenciu možno doplniť v zozname gólov), zrušenie gólu/trestu.
  - Ďalšie dohody (17. 11.): **kontrast pre slabé projektory** – text na tímovej farbe je čierny/biely podľa kontrastu (`B.contrastInk`, nie `ink` z DB), čas biely na čiernej, tresty na čiernom štítku, panel drží farbu tímu bez tmavého prechodu pod skóre.
    **Výmena strán** (`flip`: mení iba stranu na obrazovke aj v ovládaní, góly ostávajú domáci/hostia). **Späť o časť** (vráti čas, kde sa skončilo), **Čas časti od začiatku** a **Vynulovať zápas** (s potvrdením; tímy, strany a veľkosť ostanú).
    **Posun času** ±10 s / ±1 min je predvolene iba hra, checkbox „Posunúť aj tresty“ posúva aj aktívne tresty.
    V zozname zápasov sú aj finále a zápas o 3. miesto bez určených tímov – tímy sa vyberú v nastavení tabule. Uložiť ich do DB nejde (dopĺňajú sa z výsledkov SF), preto „Ukončiť zápas“ ohlási chybu, kým SF nie sú v DB; tabuľa ostane, po zapísaní SF sa dá uložiť znova.
  - **Animácia gólu** (`board.js` `goalFx`, `board.css` `.sb-goal`): po góle (3,6 s) logo strany, ktorá dala gól, trikrát pulzuje so žiarou, hrá animované logo (`logo_anim` tímu = `assets/anim/*.webp`, v stave tabule `anim`), skóre „vyskočí“ a panel zasvieti. Trieda je `sb-goal`, nie `goal` (kolízia so `styles.css`). Zrušenie gólu animáciu vypne.
  - **Prenos na druhú obrazovku**: cez `localStorage` + udalosť `storage` → funguje iba v tom istom prehliadači na tom istom PC (Win + P a presunúť okno). Admin ukazuje „druhá obrazovka pripojená“ (ping každé 2 s). Na iné zariadenie by treba Supabase realtime – zatiaľ nerobené.
  - **Góly sa do databázy posielajú až na konci** (tlačidlo „Ukončiť zápas“ → potvrdenie → `writeMatch` v `admin.js`, rovnaký zápis ako „Uložiť zmeny“ zápasu). Dôvod: v DB nie je „rozohraný zápas“ (polovičný výsledok by sa na webe ukázal ako hotový) a pri výpadku internetu by sa nič nestratilo – stav je v `localStorage`.
    Remíza v playoff sa neuloží (rovnaká kontrola ako v editore). Zápas bez termínu dostane dnešný dátum a čas. Po neúspešnom uložení ostane „Uložiť výsledok na web“ / „Späť do zápasu“.
  - Potvrdenie pri „Ukončiť zápas“ je zámerné (zverejňuje výsledok); pri bežných akciách tabule žiadne potvrdenie nie je. Po uložení „Zavrieť“ zavrie bez otázky.
  - Uloženie z tabule ide do **sezóny zápasu na tabuli** (`ctx(st.seasonId)`), aj keď je admin medzitým prepnutý na inú sezónu.
  - Lonzi **nechce** zvukovú sirénu ani realtime na iné zariadenia. Nie je (nápady): počítanie času nahor, predĺženie, čas gólu v DB.
- **Stránka „Pripravujeme“** (sezóna `soon`, vyžiadal Lonzi 19. 11. 2026): tri termíny Prihlasovanie / Draft tímov / Prvý zápas = stĺpce `signup_date`, `draft_date`, `start_date`
  (typ `date`, prázdne = „čoskoro“, vyplnený = „Po 1. 2. 2027“ v tyrkysovej UPeCe `--teal`; **najbližší termín od dnes pulzuje** (`L.nextStep`, v ten deň ešte pulzuje, potom ďalší), prešlé stlmené). V admine Sezóny → sezóna → „Termíny na webe“ (iba pri stave Pripravujeme; × vymaže).
  Pod banerom sekcia „Tímy“ (nadpis so zigzagom) s kartami vybratých tímov: logo na tímovej farbe, pod ním miesto menším, názov väčším; vedľa seba, na mobile pod sebou.
  Pripravovaná sezóna smie mať **0 tímov** (`L.seasonTeamsError`; prebieha/skončená aspoň 2) a nová sezóna začína bez tímov – pribúdajú postupne.
  Animované logo FULky (`assets/anim/ful.webp`, iba tu): pomalšie a plynulé – medzi každé 2 pôvodné snímky je dopočítaná 1 medzisnímka (prelínanie), 32 ms na snímku
  (~64 ms na pôvodný krok, pôvodne 40), úvod 440 ms, posledná snímka 2,5 s. Vyrobené: `python3 tools/webp-smooth.py assets/gif/ful.gif assets/anim/ful.webp 1 32 440 2500`
  (pôvodné snímky bezstratovo, medzisnímky stratovo → 232 kB; 2 medzisnímky po 22 ms = 336 kB). Iba časy bez medzisnímok: `tools/webp-timing.py`.
- **Finále v archíve** (karta v Playoff): po odohraní vo farbe víťaza – prechod z `--c` do dopočítaného tmavšieho odtieňa (`color-mix`, nie `color_dark`), text `ink`,
  porazený riadok tmavý a stlmený ako v ostatných kartách (Lonzimu sa nepáčila biela karta). Neodohrané finále = tmavá karta s bielym rámom.
- **Odobratie tímu zo sezóny** zmaže iba riadok `fulka_season_teams` – tím, hráči aj súpiska (`fulka_roster`) ostanú v DB a po opätovnom pridaní sa súpiska vráti.
  Tím sa dá pridať do akejkoľvek sezóny. Varovanie pri odobratí ostáva (Lonzi: „je pekné“).
- **Logá tímov** (štýl): hranaté plochy, čierna linka, krémový obrys `#FCF6E8`, animácia = pauza → efekt → pauza (napr. oči Giants, odlesk + zvonček Rangers).
  **Kuchynka Ants** (20. 11. 2026): podľa Lonziho predlohy `design/ants/predloha/koncepty.png` (koncept vpravo hore) – hlava mravca z profilu, kusadlá, tykadlá,
  **bez šesťuholníka/emblému** a bez spodného pravého dielika (verzie 1–2) alebo s ním zlúčeným do hlavy (3–4), vedľa obracačka (1, 3) alebo valček (2, 4) ako zvonček pri Rangers.
  Farba z predlohy: `#EE6A12` / tmavá `#6E2A05` / text `#111111`. Prvé zelené návrhy Lonzi zamietol – nevracať.
  Verzie 1–2: mravec ručne obkreslený (Lonzi ich chce nechať). **Verzie 3–4: mravec prevedený do vektora priamo z predlohy** (Lonzi: 1–2 sa predlohe nepodobali):
  `python3 tools/trace-logo.py design/ants/predloha/koncepty.png 40 105 280 310 3 design/ants/traced-zlucene.js design/ants/zlucit.json`
  (farby → vrstvy → potrace; `zlucit.json` prefarbí čiernu medzeru pod hlavou = zlúčený dielik). Tykadlá a kusadlá sú výrezy (`TPARTS` v `zdroj.html`)
  otáčané okolo kĺbu; obrys verzií 3–4 robí SVG filter (rozšírenie celého tvaru), aby sa pri pohybe neroztrhol. Kusadlá sa iba zatvárajú (pri otvorení diera).
  Kreslí sa v `design/ants/zdroj.html` (funkcia času, logo sa samo zmenší, aby sa zmestilo vo všetkých polohách) a `node tools/logo-render.js [1,2,3,4]`
  vyrobí `ants-N.png` + `ants-N.webp` (32 × 50 ms; tykadlá → kusadlá → predmet idú po sebe; ~180–200 kB).
- Potvrdzovacie okno (`ask()` v `admin.js`) je **iba pri mazaní, pri zálohách a pri ukončení zápasu na tabuli**. Potvrdenie pred každou bežnou úpravou Lonzi **nechce**
  (raz som ho pridal, vrátil som to) – nepridávať.
- Góly sa ukladajú bez mazania vopred: upsert podľa `match_id,seq`, potom zmazať iba `seq > počet` (predtým sa najprv všetko zmazalo → pri výpadku by góly zmizli).
- **Zálohy** (`supabase/3-zalohy.sql`, admin → Zálohy): **iba ručné** tlačidlom „Uložiť zálohu“ (Lonzi si zálohuje po kolách; automatické
  zálohy nechce – „spam“). Snímka všetkých 8 tabuliek v `fulka_backups` (~25 kB), vidí/vytvára/maže ich iba admin (zmazať sa dá v admine).
  Fotky sa nezálohujú (Lonzi: netreba).
  Návrat: okno 1 = diff po tabuľkách (`L.compareData`, ignoruje `created_at`/`updated_at`) → „Pokračovať“ → okno 2 „Naozaj?“ + napísať **OBNOVIŤ** → až potom `fulka_restore`
  (v jednej transakcii, `fulka_apply`). Stav pred návratom = **jediná poistka** (`kind = 'undo'`, prepíše sa pri ďalšom návrate, nedá sa zmazať),
  tlačidlo „Vrátiť späť“ (`fulka_undo`) vymení aktuálny stav s poistkou. Stiahnutie do počítača (JSON `format: fulka-zaloha-1`) a návrat zo súboru.
- Päta: odkaz na UPeCe Bratislava (upcba.sk, biele logo) a Supabase (supabase.com, „Dáta, fotky a prihlásenie bežia na Supabase“).

## Ako testovať (bez zápisu do databázy)

```bash
node --test tests/*.test.js                 # logika
bash tools/setup.sh                         # knižnice pre headless Chromium + server http://127.0.0.1:8770/fulka/
node tools/shot.js "http://127.0.0.1:8770/fulka/" 390 /tmp/m.png            # screenshot mobil + chyby z konzoly
node tools/shot.js "http://127.0.0.1:8770/fulka/?edit" 1440 /tmp/a.png @tools/fake-login.js RELOAD @tools/mock-db.js "<JS kroky>"
```
- `shot.js <url> <šírka> <out.png> [kroky]` – krok `RELOAD`, `@súbor.js` alebo JS kód; `CLIP=x,y,w,h` oreže obrázok.
- Admin: `fake-login.js` podvrhne prihlásenie, `mock-db.js` presmeruje zápisy do pamäte (`__mem()`, `__writes`, zálohy `__backups()` s 2 ukážkovými).
  Potvrdzovacie okno je `.a-modal`: potvrdiť `[data-m=ok]`, zrušiť `[data-m=no]`, slovo do `[data-m=word]`.
- Tabuľa: `tools/board-demo.html` (http://127.0.0.1:8770/fulka/tools/board-demo.html) otvorí admin s podvrhnutým prihlásením a zápismi iba do pamäte – dá sa skúšať bez zásahu do Supabase.
  Opravy z code review 20. 11. 2026: `tools/refactor-checks.js` (`#sezona`, `#novytim`, `#tabula`, `#zatvorit` v URL; po `fake-login.js RELOAD mock-db.js`).
  Tímy mimo sezóny: `tools/team-scope.js` (krok pre `shot.js` po `fake-login.js RELOAD mock-db.js`; s `#pridat` v URL aj pridá tím do sezóny).
  Screenshoty/testy: `tools/board-demo.js` (ukážkový stav → `tabula.html`), `board-flow.js`, `board-flow2.js`, `board-end.js`, `board-sync.js` (kroky pre `shot.js` po `fake-login.js RELOAD mock-db.js`).
- Pripravujeme: `tools/future-demo.html` (http://127.0.0.1:8770/fulka/tools/future-demo.html, `?timy=1` = iba 1 tím) ukáže pripravovanú sezónu s 2 ukážkovými termínmi bez zápisu;
  krok `tools/future-demo.js` pre `shot.js`, admin tok termínov `tools/season-dates.js` (po `fake-login.js RELOAD mock-db.js`).
- Chromium je Playwright headless shell; chýbajúce knižnice sú v `tools/.cache/libroot` (bez sudo, gitignore).
- Nástroje WebP (`img2webp`, `anim_dump`, `webpmux`…) sú v `tools/.cache/webproot` (gitignore): `apt-get -o Acquire::ForceIPv4=true download webp libwebp7 libwebpmux3 libwebpdemux2 libsharpyuv0 libjpeg8 libjpeg-turbo8 libtiff6 libgif7 libpng16-16t64`
  do `tools/.cache/webp-debs` a `dpkg -x` každého do `webproot` (aj `potrace libpotrace0` pre `tools/trace-logo.py`); spúšťať s `LD_LIBRARY_PATH=tools/.cache/webproot/usr/lib/x86_64-linux-gnu`. Zmazanie = celý `tools/.cache`.
- Port 8765 používa iný projekt – nezabíjať.

## Nasadenie

- GitHub Pages: repozitár → Settings → Pages → „Deploy from a branch: `main` / root“. `.nojekyll` = nič negenerovať, iba skopírovať.
- `git push` na `main` → workflow „pages build and deployment“ (záložka Actions) nahrá web za 1–2 min.
- Overenie: `gh api repos/LonziSlovakia/fulka/pages/builds/latest --jq .status` → `built`, potom
  `curl -s "https://ful.upcba.sk/<súbor>?x=$(date +%s)"`. `CNAME` nemazať (inak doména prestane fungovať).
- Pri výpadku GitHubu (githubstatus.com) iba počkať, build nespúšťať znova.

## Bezpečnosť (kontrola 18. 10. 2026)

Anonym nevie zapisovať do tabuliek ani do bucketu, registrácia je vypnutá, podvrhnutý token je odmietnutý, v histórii nie sú tajné kľúče,
texty z DB sa escapujú. Nízke riziká: hádanie hesla, prihlásenie uložené v `localStorage`, spoločná DB s `laura`,
ochrana admina pred vložením do cudzej stránky (clickjacking) – zatiaľ nerobené.

## Otvorené / nápady


- Budík proti uspaniu (`keepalive.yml` v repozitári `laura`) pinguje iba raz za 3 dni, kým docs Supabase uvádzajú „niekoľko požiadaviek denne“. Lonzi ho zatiaľ nechce meniť, lebo to funguje.
  Ak príde varovný e-mail od Supabase alebo sa projekt uspí: zmeniť cron na každých 6 hodín (`17 */6 * * *`, 4× denne).
- **Vetva `refactor` (táto) – čo ešte treba:** 19 nálezov z ultra review v `docs/review-ultra-2026-11-20.md` (aj s poradím; A2 = spätná zmena playoff –
  spýtať sa Lonziho, ako to chce) opraviť tu, otestovať, potom na Lonziho „áno“ zlúčiť do `main` (`tools/verzia.sh`, push, overiť web).
  Po zlúčení zatvoriť PR #2–#4 (pomocné na review, „NEZLUČOVAŤ“) a zmazať vetvy `review/*` lokálne aj na GitHube.
  Demo loga Ants je na lokálnej vetve `demo-ants` (kópia `tools/.cache/demo`), nepushovať.
- **Testovanie siete a Cloudflare**: plán v `docs/plan-testovania-siete.md` (presmerovania/HTTPS, cache, pripojenia, výpadky, bezpečnostné hlavičky, automatizácia) – zatiaľ iba plán.
- Clickjacking ochrana (ak Lonzi bude chcieť) – cez Cloudflare hlavičky, pozri plán vyššie.
- Text pri Supabase v päte prípadne zmeniť na „Vybudované s pomocou Supabase“ (ak Lonzi bude chcieť).
