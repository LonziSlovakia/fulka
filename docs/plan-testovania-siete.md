# Plán testovania siete a Cloudflare (FULka)

Stav: **iba plán**, zatiaľ nič nie je automatizované. Spísané 20. 11. 2026.

## Ako to je zapojené (kvôli čomu testujeme)

```
prehliadač ──► Cloudflare (ful.upcba.sk, certifikát, cache) ──► GitHub Pages (súbory z vetvy main)
     │
     ├──► Supabase (anovkowkucidkutwghzx.supabase.co) – dáta, prihlásenie, fotky; NEJDE cez Cloudflare
     └──► upcba.sk WordPress API – sekcia „Z UPeCe“ (ide cez Cloudflare UPeCe)
```

- **Cloudflare** stojí pred webom: dáva certifikát (HTTPS) a pamätá si súbory (cache).
- **GitHub Pages** iba posiela súbory; vlastný certifikát pre `ful.upcba.sk` nemá (Cloudflare to nedovolí overiť),
  preto v GitHube nejde zapnúť „Enforce HTTPS“.
- Zistené 20. 11. 2026: HTML sa v prehliadači pamätá 10 min, JS/CSS **4 hodiny** (Cloudflare „Browser Cache TTL“)
  → preto `tools/verzia.sh` (`?v=` v adresách súborov).

## 1. Presmerovania a HTTPS

| Test | Príkaz | Má vyjsť |
|---|---|---|
| http → https | `curl -sI http://ful.upcba.sk/ \| grep -iE "^HTTP\|^location"` | `301` a `location: https://ful.upcba.sk/` (dnes **200** – treba v Cloudflare zapnúť „Always Use HTTPS“) |
| stará adresa | `curl -sI https://lonzislovakia.github.io/fulka/ \| grep -iE "^HTTP\|^location"` | `301` na `ful.upcba.sk` |
| certifikát | `echo \| openssl s_client -connect ful.upcba.sk:443 -servername ful.upcba.sk 2>/dev/null \| openssl x509 -noout -subject -enddate` | platný, `notAfter` v budúcnosti (Cloudflare ho obnovuje sám) |
| SSL režim | Cloudflare → SSL/TLS → Overview | „Full“ (nie „Flexible“, nie „Full (strict)“ – GitHub pre doménu certifikát nemá) |

## 2. Cache (či ľudia vidia novú verziu)

| Test | Príkaz | Má vyjsť |
|---|---|---|
| HTML sa nepamätá dlho | `curl -sI https://ful.upcba.sk/ \| grep -i cache-control` | `max-age=600` |
| JS/CSS | `curl -sI https://ful.upcba.sk/render.js \| grep -iE "cache-control\|cf-cache-status"` | `max-age=14400` (4 h) – preto verzie |
| verzia po pushi | `curl -s "https://ful.upcba.sk/?x=$(date +%s)" \| grep -o 'render.js?v=[0-9]*'` | to isté číslo ako v lokálnom `index.html` |
| verzovaný súbor je nový | `curl -s "https://ful.upcba.sk/admin.js?v=<číslo>" \| grep -c "<niečo nové>"` | ≥ 1 |
| ručne | otvoriť admin pred pushom, po pushi počkať 10 min, obnoviť **bez** Ctrl+F5 | vidno novú verziu |

Pozor: `tools/verzia.sh` treba spustiť pri **každej** zmene JS/CSS (je to v `CLAUDE.md`).
Keby Lonzi v Cloudflare nastavil „Browser Cache TTL = Respect Existing Headers“, JS/CSS by sa pamätali iba 10 min ako HTML.

## 3. Pripojenia z prehliadača

| Test | Ako | Má vyjsť |
|---|---|---|
| Supabase ide priamo | Chrome → F12 → Network → filter `supabase` | požiadavky na `*.supabase.co`, stav 200, nie cez `ful.upcba.sk` |
| Z UPeCe (CORS = povolenie čítať z inej domény) | Network → filter `upcba` na `ful.upcba.sk` | `wp-json/wp/v2/posts…` stav 200, v konzole žiadna chyba CORS |
| fotky a logá z bucketu | Network → filter `storage` | 200, obrázky sa ukážu |

## 4. Výpadky (čo uvidí človek, keď niečo nejde)

Simulácia: Chrome F12 → Network → **Offline** / „Block request URL“, alebo `tools/shot.js` s krokom, ktorý podvrhne `fetch`
(napr. `window.fetch = () => Promise.reject(new TypeError("offline"))`).

| Situácia | Má vyjsť |
|---|---|
| web offline po prvej návšteve | stránka sa ukáže z pamäte prehliadača (`fulka-data-v1`) |
| Supabase nedostupná | web ukáže posledné uložené dáta; admin pri uložení „Nepodarilo sa spojiť s databázou. Skontroluj internet a skús znova.“ |
| vypršané prihlásenie (401) | „Prihlásenie vypršalo. Prihlás sa znova.“ a odhlásenie |
| účet, ktorý nie je admin (403) | „Tento účet nemá právo zapisovať do FULky.“ |
| upcba.sk nedostupná | sekcia Z UPeCe: „Program sa teraz nepodarilo načítať.“ (zvyšok webu ide) |
| tabuľa bez internetu | ide ďalej (stav je v `localStorage`), „Ukončiť zápas“ ohlási chybu a výsledok sa dá uložiť neskôr |

## 5. Pomalá sieť a veľkosť

| Test | Ako | Cieľ |
|---|---|---|
| Slow 3G | F12 → Network → „Slow 3G“, obnoviť stránku | niečo zmysluplné do ~3 s (z pamäte hneď) |
| Lighthouse | F12 → Lighthouse → Mobile | Performance aj Accessibility ≥ 90 |
| veľkosť | Network → spodný riadok „transferred“ | prvá návšteva pod ~1,5 MB; animované logá ~200 kB/ks sú najväčšie |

## 6. Bezpečnostné hlavičky (dnes nie sú)

| Hlavička | Načo | Kde nastaviť |
|---|---|---|
| `X-Frame-Options: DENY` alebo CSP `frame-ancestors 'none'` | admin sa nedá vložiť do cudzej stránky (clickjacking) | Cloudflare → Rules → Transform Rules → Response headers |
| `Referrer-Policy: strict-origin-when-cross-origin` | neposielať celú adresu iným webom | to isté |
| `X-Content-Type-Options: nosniff` | prehliadač nehádá typ súboru | to isté |

Overenie: `curl -sI https://ful.upcba.sk/ | grep -iE "x-frame|frame-ancestors|referrer|nosniff"`.
GitHub Pages vlastné hlavičky nastaviť nevie – ide to iba cez Cloudflare (alebo `<meta>` v HTML, ale `frame-ancestors` v `<meta>` nefunguje).

## 7. Automatizácia (neskôr)

1. **`tools/siet.sh`** – body 1, 2 a 6 cez `curl`, vypíše `OK` / `CHYBA` pri každom riadku. Spúšťať po každom nasadení.
2. **GitHub Action raz denne** – ten istý skript; pri chybe založí issue (napr. vypršaný certifikát, zmena presmerovania, web nedostupný).
3. **Výpadky (bod 4)** ako krok pre `tools/shot.js` (`tools/vypadky.js`), podobne ako `tools/refactor-checks.js`.

## Kto čo robí

- Nastavenia Cloudflare (Always Use HTTPS, Browser Cache TTL, hlavičky) – **ten, kto spravuje Cloudflare pre `upcba.sk`** (Lonzi rozhodne neskôr).
- Skripty a testy (bod 7) – môže pripraviť Claude, nič z toho nemení web.
