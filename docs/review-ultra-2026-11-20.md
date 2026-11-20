# Ultra review 20. 11. 2026 – nálezy (lokálne, necommitované)

Cloudové review na vetve `refactor` (PR #2 A dáta a logika, #3 B verejný web, #4 C admin).
Do PR sa komentáre **neuložili** (GitHub odmietol: pripojený účet nemôže komentovať), preto sú tu.
Stav: nič z toho ešte nie je opravené. Opravy pôjdu na `refactor`, do `main` až po schválení Lonzim.

## PR #2 – dáta a logika

| # | Súbor | Závažnosť | Nález | Oprava |
|---|---|---|---|---|
| A1 | `upece.js:16-19` | stredná | `decode` volá `String.fromCodePoint` aj pre číselnú entitu nad 0x10FFFF (napr. `&#99999999;`) → RangeError, spadne celý `render()`, cache `fulka-upece-v1` to zopakuje pri každej návšteve | dekódovať iba 0–0x10FFFF, inak nechať pôvodný text (+ test) |
| A2 | `logic.js:227-235`, `rowOf` 367-370 | stredná (**najdôležitejšie**) | tímy automaticky nasadeného SF/B3/F sa neukladajú, `playoff()` ich počíta z aktuálnej tabuľky → zmena `tableOrder`/`pointsWin` (globálne pre všetky sezóny), oprava výsledku základnej časti alebo nový zápas spätne zmení, kto hral odohrané semifinále, finále aj šampióna | odohrané SF zamraziť (uložiť tímy pri uložení SF alebo brať tímy z uloženého riadku, keď je zápas `done`) – rozhodnúť s Lonzim |
| A3 | `db.js:115-117`, `admin.js` `writeMatch` | stredná | počet starých gólov `had` sa berie z dát v admine, nie z DB → pri starých dátach (2 zariadenia) ostanú v DB góly navyše, alebo `remove` nič nezmaže a ohlási falošné „Tento účet nemá právo zapisovať“ | mazať `seq > počet` vždy (bez ohľadu na `had`), prázdny výsledok mazania nebrať ako chybu práv |
| A4 | `db.js:36-47` | stredná (o roky) | `load()` číta každú tabuľku jedným GET bez stránkovania; Supabase vráti max. 1000 riadkov → pri > 1000 góloch sa ticho stratia | čítať po stránkach (limit/offset alebo `Range`) kým nepríde kratšia stránka |
| A5 | `db.js:85-95` | drobnosť | dva taby admina dlhšie ako hodinu: obnova tokenu z jedného tabu zneplatní druhý, `forget()` zmaže spoločné prihlásenie | pred obnovou načítať novšiu reláciu z `localStorage` |
| A6 | `supabase/3-zalohy.sql:106-108` | drobnosť | poistka „záloha bez sezón“ nezachytí chýbajúci kľúč `seasons` (NULL) → obnova by vyprázdnila tabuľky (UI to blokuje, iba priame volanie RPC) | `coalesce(jsonb_typeof(...), '') <> 'array'` – nový SQL skript, spustí Lonzi |

## PR #3 – verejný web

| # | Súbor | Závažnosť | Nález | Oprava |
|---|---|---|---|---|
| B1 | `render.js:353` | drobnosť | `pointsWin`/`pointsDraw` z nastavení idú do HTML bez `esc()` | `esc()` alebo previesť na čísla v `settingsOf` |
| B2 | `board-view.js:29`, `board.css:30` | drobnosť | trieda `lose` koliduje so `styles.css` `.lose { opacity: 0.4 }` → porazený tím na projektore príliš tmavý | premenovať na `sb-lose` (ako `sb-goal`) |
| B3 | `board-view.js:58-61` | drobnosť | prekreslenie do 3,6 s po góle reštartuje animáciu gólu, potom ju odreže | zachovať uzly alebo záporný `animation-delay` od času gólu |
| B4 | `board-view.js:53` | výkon | `B.view` 3× za tik (každých 100 ms) | vypočítať raz a zdieľať |
| B5 | `render.js:58` | výkon | súpiska sezóny sa filtruje dvakrát | jedna premenná |

## PR #4 – admin

| # | Súbor | Závažnosť | Nález | Oprava |
|---|---|---|---|---|
| C1 | `board-admin.js:285-289`, `admin.js:178` | stredná (**najdôležitejšie v admine**) | okno „Ukončiť zápas?“ má fokus na „Ukončiť a uložiť“ a medzerník (štart/pauza tabule) ho potvrdí → rozohraný zápas sa uloží ako odohraný s polovičným skóre, späť sa nedá | fokus na „Zrušiť“ (`danger`) a/alebo `ask()` zje medzerník/Enter |
| C2 | `admin.js:114-126` `run()` | stredná | znovunačítanie po zápise je v tom istom `try` ako zápis → keď zápis prejde a načítanie spadne, hlási „skús znova“; opakovaný návrat k zálohe prepíše jedinú poistku, tabuľa ostane „neuložená“ | načítanie v samostatnom `try` („uložené, ale nepodarilo sa obnoviť dáta“), `after` sa spustí |
| C3 | `admin.js:229-232` `writeMatch` | stredná | to isté ako A3: mazanie gólov podľa `had` zo starých dát → góly navyše v DB alebo falošné „nemá právo“ | vždy zmazať `seq > počet` s `maybe=true` |
| C4 | `board-admin.js:252` | drobnosť | „Zrušiť tabuľu“ pri bežiacom čase bez gólu a trestu sa nepýta → stratí sa odohraný čas | „začaté“ aj podľa bežiaceho/ubehnutého času a trestov |
| C5 | `admin.js:426` | drobnosť | formulár nového tímu vo „Všetky tímy“ píše „Tím sa pridá do sezóny …“, hoci sa nepridá | text podľa `S.teamScope` |
| C6 | `admin.css:6-8, 19, 60` | drobnosť | triedy bez predpony `a-` (`.lbl`, `.muted`, `.small`, `.blank`, `.sq`) – môžu sa biť so `styles.css`/`board.css` | predpona `a-` alebo pod `.adm` |
| C7 | `board-admin.js:11-17` | upratanie | kópia `esc`, `STAGE`, `pressed` z `admin.js` (`A.esc` z `boardApi` sa nepoužíva) | použiť `A.esc` a poslať `STAGE`/`pressed` cez API |
| C8 | `admin.js:245` | upratanie | pravidlo „tímy uložené v zápase“ napísané dvakrát (`teamsFor` aj `draftFromBoard`) | jedna funkcia `ownTeams(m, s)` |

## Poradie opráv (návrh)

1. **C1** (medzerník uloží rozohraný zápas) a **A2** (spätná zmena playoff – rozhodnúť s Lonzim ako).
2. **A3 + C3** (góly pri starých dátach), **C2** (`run()`), **A1** (pád webu z upcba.sk).
3. Drobnosti A5, A6 (SQL – spustí Lonzi), B1–B3, C4–C6.
4. Upratanie a výkon: A4 (stránkovanie, kým je čas), B4, B5, C7, C8.
