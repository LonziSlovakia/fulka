# FULka web – pravidlá pre Claude Code

- **Najprv si prečítaj STAV.md** – aktuálny stav, dohodnuté rozhodnutia, ako testovať a nasadzovať. HANDOFF.md je pôvodné zadanie (pri rozpore platí STAV.md); čítaj z neho iba časť, ktorú potrebuješ.
- **STAV.md udržiavaj živý:** po každej dokončenej zmene, ktorá mení správanie alebo dohodu, ho uprav v tom istom commite. Neplatné veci zmaž, nič tam nedumpuj – iba to, čo by ďalšia konverzácia potrebovala vedieť.
- Hovor s Lonzim po slovensky, neformálne a krátko (max. 1–3 témy naraz). Nové pojmy vysvetli jednou vetou.
- **SET → GET**: po každej zmene stavu (zápis súboru, inštalácia, commit, push, nastavenie Pages…) hneď samostatné overenie a nahlás výsledok. Keď mu dávaš príkazy na ručné spustenie, vždy dvojicu SET + GET.
- **Nikdy** do kódu, commitu ani správy: `service_role` / `sb_secret_…` kľúč, heslo k databáze, heslá účtov. Publishable key a URL sú verejné a do kódu patria.
- Commity iba s `72870876+LonziSlovakia@users.noreply.github.com` (`git config user.email …` v tomto repozitári).
- Fotky a dáta patria do Supabase (bucket a tabuľky `fulka`), nie do repozitára.
- SQL skripty spúšťa Lonzi sám v Supabase → SQL Editor. Ty ich iba pripravíš a povieš, čo spustiť a ako to overiť.
- Statická stránka bez buildu, iba relatívne cesty, kód v malých samostatných funkciách.
- E-mail kontroluj iba vtedy, keď to Lonzi výslovne napíše.
- Pred commitom: `node --test tests/*.test.js`; vizuálne zmeny over cez `tools/shot.js` (desktop 1440 aj mobil 390), postup je v STAV.md.
