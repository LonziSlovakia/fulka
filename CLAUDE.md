# FULka web – pravidlá pre Claude Code

- Celé zadanie je v **HANDOFF.md**. Prečítaj ho celé pred prvou zmenou.
- Hovor s Lonzim po slovensky, neformálne a krátko (max. 1–3 témy naraz). Nové pojmy vysvetli jednou vetou.
- **SET → GET**: po každej zmene stavu (zápis súboru, inštalácia, commit, push, nastavenie Pages…) hneď samostatné overenie a nahlás výsledok. Keď mu dávaš príkazy na ručné spustenie, vždy dvojicu SET + GET.
- **Nikdy** do kódu, commitu ani správy: `service_role` / `sb_secret_…` kľúč, heslo k databáze, heslá účtov. Publishable key a URL sú verejné a do kódu patria.
- Commity iba s `72870876+LonziSlovakia@users.noreply.github.com` (`git config user.email …` v tomto repozitári).
- Fotky a dáta patria do Supabase (bucket a tabuľky `fulka`), nie do repozitára.
- SQL skripty spúšťa Lonzi sám v Supabase → SQL Editor. Ty ich iba pripravíš a povieš, čo spustiť a ako to overiť.
- Statická stránka bez buildu, iba relatívne cesty, kód v malých samostatných funkciách.
- E-mail kontroluj iba vtedy, keď to Lonzi výslovne napíše.
