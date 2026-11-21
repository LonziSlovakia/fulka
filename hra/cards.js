/* Hra FULky (/hra/): zberateľské karty hráčov a tímov – čisté funkcie (testy: tests/hra.test.js).
   Karta = hráč v jednej sezóne alebo tím v jednej sezóne. Vzácnosť hráča = priečka v kanadskom bodovaní
   tej sezóny, tím má statickú epic kartu a trblietavú legendary s animovaným logom.
   V prehliadači sa ukladá iba málo: deň posledného balíka, ID kariet s počtom kusov a ID posledného balíka. */
(() => {
  "use strict";
  const L = typeof module !== "undefined" && module.exports ? require("../logic.js") : window.Logic;

  const RARITY = ["common", "rare", "epic", "legendary"]; // od najbežnejšej
  const RARITY_NAME = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
  const ODDS = { common: 56, rare: 28, epic: 12, legendary: 4 }; // šanca jednej karty v balíku (%)
  const TIERS = [[5, "legendary"], [10, "epic"], [20, "rare"]]; // priečka v bodovaní do … → trieda
  const PACK = 5;
  const MYTH_ODDS = 0.5; // tajná karta (%) v každom z prvých 4 slotov balíka; nikde sa neukazuje ani nepočíta

  // FNV-1a: z textu krátke číslo; ID karty = to číslo v sústave 36 (napr. "z26:p-urban-jozef" → "1k9x0q")
  function hash(text) {
    let h = 0x811c9dc5;
    for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const cardId = (key) => hash(key).toString(36);

  // priečka a body → trieda (bez bodu vždy common, aj keď majú všetci „1. miesto“ s nulou)
  const rarityOf = (pos, pts) => (pts > 0 && (TIERS.find(([max]) => pos <= max) || [])[1]) || "common";
  const rank = (r) => (r === "mythical" ? RARITY.length : RARITY.indexOf(r));

  // všetko o jednej sezóne, čo karty potrebujú: tímy, tabuľka, bodovanie, konečné poradie
  function seasonStats(d, s, P) {
    const inSeason = new Set(d.season_teams.filter((x) => x.season_id === s.id).map((x) => x.team_id));
    const teamIds = d.teams.map((t) => t.id).filter((id) => inSeason.has(id));
    const raw = d.matches.filter((m) => m.season_id === s.id);
    const ids = new Set(raw.map((m) => m.id));
    const gm = L.goalsByMatch(d.goals.filter((g) => ids.has(g.match_id)));
    const settings = L.settingsOf(d.settings);
    const table = L.standings(teamIds, raw, gm, settings);
    const matches = L.resolveMatches(s, raw, gm, table);
    const roster = d.roster.filter((r) => r.season_id === s.id);
    return { teamIds, table, roster, list: L.scorers(matches, gm, P, table, Infinity, settings, roster), places: L.places(matches, gm) };
  }

  const card = (key, rest) => Object.assign({ id: cardId(key), key }, rest);
  // tajná karta FULky (mythical): nie je v buildCards → nemení počty kariet, triedy ani chýbajúce karty
  const MYTHICAL = card("M:fulka", { kind: "myth", rarity: "mythical", name: "FULka", season: null, team_id: "" });

  function playerCards(s, st) {
    return st.list.map((x) => {
      const r = st.roster.find((y) => y.player_id === x.player_id) || {};
      return card(`p:${s.id}:${x.player_id}`, {
        kind: "player", rarity: rarityOf(x.pos, x.b), season: s, player_id: x.player_id, team_id: x.team_id,
        name: x.name, pos: x.pos, b: x.b, g: x.g, a: x.a, captain: !!r.captain, number: r.number == null ? null : r.number,
      });
    });
  }

  // tím: epic (statické logo) + legendary (animované logo), ak animované logo má
  function teamCards(team, s, st) {
    const row = st ? st.table.find((t) => t.id === team.id) : null;
    const place = st ? (st.places.find((p) => p.id === team.id) || {}).pos || null : null;
    const base = { kind: "team", season: s, team_id: team.id, name: team.name, pos: row && row.z ? row.pos : null, b: row ? row.b : 0, place };
    const sid = s ? s.id : "-";
    const out = [card(`t:${sid}:${team.id}`, Object.assign({ rarity: "epic", anim: false }, base))];
    if (team.logo_anim) out.push(card(`T:${sid}:${team.id}`, Object.assign({ rarity: "legendary", anim: true }, base)));
    return out;
  }

  // všetky karty z dát databázy; tím, ktorý nie je v žiadnej sezóne (napr. nový), má kartu bez sezóny
  function buildCards(d) {
    const P = Object.fromEntries(d.players.map((p) => [p.id, p]));
    const out = [];
    const inAny = new Set();
    d.seasons.forEach((s) => {
      const st = seasonStats(d, s, P);
      out.push(...playerCards(s, st));
      st.teamIds.forEach((id) => {
        inAny.add(id);
        out.push(...teamCards(d.teams.find((t) => t.id === id), s, st));
      });
    });
    d.teams.filter((t) => !inAny.has(t.id)).forEach((t) => out.push(...teamCards(t, null, null)));
    return out;
  }

  // poradie v kolekcii: vzácnosť → novšia sezóna (tím bez sezóny ako najnovší) → tímy pred hráčmi → priečka → meno
  function sortCards(cards) {
    const sortOf = (c) => (c.season ? c.season.sort || 0 : Infinity);
    return cards.slice().sort((x, y) => rank(y.rarity) - rank(x.rarity) || sortOf(y) - sortOf(x)
      || (x.kind === y.kind ? 0 : x.kind === "team" ? -1 : 1) || (x.pos || 99) - (y.pos || 99) || x.name.localeCompare(y.name, "sk"));
  }

  /* ---------- Balík ---------- */
  // trieda podľa šancí; minRank 1 = aspoň rare; prázdne triedy sa preskočia
  function rollRarity(pools, rng, minRank) {
    const opts = RARITY.slice(minRank || 0).filter((r) => pools[r].length);
    if (!opts.length) return null;
    let x = rng() * opts.reduce((sum, r) => sum + ODDS[r], 0);
    for (const r of opts) { x -= ODDS[r]; if (x < 0) return r; }
    return opts[opts.length - 1];
  }

  // 5 kariet (v jednom balíku sa karta neopakuje, kým je z čoho brať); aspoň jedna rare alebo lepšia;
  // zoradené od najbežnejšej, aby najlepšia prišla na koniec; myth = tajná karta (šanca MYTH_ODDS v prvých 4 slotoch)
  function openPack(cards, rng, myth) {
    const rnd = rng || Math.random;
    const pools = Object.fromEntries(RARITY.map((r) => [r, cards.filter((c) => c.rarity === r)]));
    const pick = [];
    for (let i = 0; i < PACK; i++) {
      if (myth && i < PACK - 1 && rnd() < MYTH_ODDS / 100) { pick.push(myth); continue; }
      const guarantee = i === PACK - 1 && pick.every((c) => c.rarity === "common");
      const r = (guarantee && rollRarity(pools, rnd, 1)) || rollRarity(pools, rnd, 0);
      if (!r) break;
      const unused = pools[r].filter((c) => !pick.includes(c));
      const from = unused.length ? unused : pools[r];
      pick.push(from[Math.floor(rnd() * from.length)]);
    }
    return pick.sort((x, y) => rank(x.rarity) - rank(y.rarity));
  }

  /* ---------- Uložený stav (localStorage) ---------- */
  // { d: "2026-11-21" deň posledného balíka, c: { idKarty: počet }, l: [ID kariet posledného balíka] }
  function readSave(raw) {
    const ok = raw && typeof raw === "object";
    const c = {};
    if (ok && raw.c && typeof raw.c === "object") Object.keys(raw.c).forEach((k) => { if (raw.c[k] > 0) c[k] = Math.floor(raw.c[k]); });
    return { d: ok && typeof raw.d === "string" ? raw.d : "", c, l: ok && Array.isArray(raw.l) ? raw.l.filter((x) => typeof x === "string") : [] };
  }
  const canOpen = (save, today) => save.d !== today;
  function addPack(save, ids, today) {
    const c = Object.assign({}, save.c);
    ids.forEach((id) => { c[id] = (c[id] || 0) + 1; });
    return { d: today, c, l: ids.slice() };
  }

  /* ---------- Hráč dňa ---------- */
  // dátum "2026-11-21" → poradové číslo dňa
  const dayNumber = (date) => { const [y, m, d] = date.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
  const nextDay = (date) => new Date((dayNumber(date) + 1) * 864e5).toISOString().slice(0, 10);

  // hráči v pevnom „zamiešanom“ poradí; každý deň ďalší → každý príde na rad raz za N dní, pre všetkých rovnako
  function playerOfDay(players, date) {
    if (!players.length) return null;
    const order = players.slice().sort((x, y) => hash(`fulka:${x.id}`) - hash(`fulka:${y.id}`) || (x.id < y.id ? -1 : 1));
    return order[dayNumber(date) % order.length];
  }

  // dnešná položka z n možností (napr. modlitba dňa): každý deň ďalšia, pre všetkých rovnaká
  const pick = (n, date) => (n > 0 ? dayNumber(date) % n : 0);

  // karta hráča dňa: z najnovšej sezóny, v ktorej hrá (pripravovaná sezóna až keď inej niet – ešte nemá body)
  function latestCard(cards, playerId) {
    const mine = cards.filter((c) => c.kind === "player" && c.player_id === playerId);
    const soon = (c) => (c.season.state === "soon" ? 1 : 0);
    return mine.sort((x, y) => soon(x) - soon(y) || (y.season.sort || 0) - (x.season.sort || 0))[0] || null;
  }

  const Cards = {
    RARITY, RARITY_NAME, ODDS, TIERS, PACK, MYTH_ODDS, MYTHICAL,
    hash, cardId, rarityOf, buildCards, sortCards, rollRarity, openPack,
    readSave, canOpen, addPack, dayNumber, nextDay, playerOfDay, latestCard, pick,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Cards;
  else window.Cards = Cards;
})();
