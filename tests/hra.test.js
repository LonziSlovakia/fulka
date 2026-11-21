// Testy zberateľských kariet (hra/cards.js). Spustenie: node --test tests/*.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../hra/cards.js");

// malá liga: 2 tímy, 1 zápas, Ana dala 2 góly (Bob asistoval pri jednom), Cyril bez bodu
const D = {
  settings: {},
  seasons: [
    { id: "s1", name: "Sezóna 1", short: "S1", state: "done", sort: 10 },
    { id: "s2", name: "Sezóna 2", short: "S2", state: "soon", sort: 20 },
  ],
  teams: [
    { id: "aaa", name: "Ants", logo: "a.svg", logo_anim: "" },
    { id: "bbb", name: "Bees", logo: "b.svg", logo_anim: "b.webp" },
    { id: "ccc", name: "Cats", logo: "c.svg", logo_anim: "c.webp" },
  ],
  season_teams: [{ season_id: "s1", team_id: "aaa" }, { season_id: "s1", team_id: "bbb" }],
  players: [{ id: "p-ana", name: "Ana" }, { id: "p-bob", name: "Bob" }, { id: "p-cyril", name: "Cyril" }],
  roster: [
    { season_id: "s1", player_id: "p-ana", team_id: "aaa", captain: true },
    { season_id: "s1", player_id: "p-bob", team_id: "aaa" },
    { season_id: "s1", player_id: "p-cyril", team_id: "bbb" },
    { season_id: "s2", player_id: "p-ana", team_id: "aaa" },
  ],
  matches: [{ id: 1, season_id: "s1", stage: "R", round: 1, home_id: "aaa", away_id: "bbb", status: "done", starts_at: "2026-10-06T19:15:00Z" }],
  goals: [
    { id: 1, match_id: 1, seq: 1, side: "h", scorer_id: "p-ana", assist_id: "p-bob" },
    { id: 2, match_id: 1, seq: 2, side: "h", scorer_id: "p-ana", assist_id: null },
  ],
};
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test("ID karty je krátke a stále rovnaké", () => {
  assert.equal(C.cardId("p:s1:p-ana"), C.cardId("p:s1:p-ana"));
  assert.notEqual(C.cardId("p:s1:p-ana"), C.cardId("p:s2:p-ana"));
  assert.ok(C.cardId("p:z26:p-stefanak-jakub").length <= 7);
});

test("vzácnosť podľa priečky; bez bodu vždy common", () => {
  assert.equal(C.rarityOf(1, 13), "legendary");
  assert.equal(C.rarityOf(5, 10), "legendary");
  assert.equal(C.rarityOf(6, 8), "epic");
  assert.equal(C.rarityOf(10, 7), "epic");
  assert.equal(C.rarityOf(11, 7), "rare");
  assert.equal(C.rarityOf(20, 1), "rare");
  assert.equal(C.rarityOf(21, 1), "common");
  assert.equal(C.rarityOf(1, 0), "common");
});

test("karty z dát: hráči každej sezóny, tímy epic + legendary s animovaným logom, tím bez sezóny", () => {
  const cards = C.buildCards(D);
  const by = (key) => cards.find((c) => c.key === key);
  assert.equal(by("p:s1:p-ana").rarity, "legendary"); // 2 b, 1. miesto
  assert.equal(by("p:s1:p-ana").captain, true);
  assert.equal(by("p:s1:p-bob").rarity, "legendary"); // 1 b, 2. miesto
  assert.equal(by("p:s1:p-cyril").rarity, "common"); // 0 b
  assert.equal(by("p:s2:p-ana").rarity, "common"); // pripravovaná sezóna bez gólov
  assert.equal(by("t:s1:aaa").rarity, "epic");
  assert.equal(by("T:s1:aaa"), undefined); // Ants nemá animované logo
  assert.equal(by("T:s1:bbb").rarity, "legendary");
  assert.equal(by("t:s1:aaa").pos, 1);
  assert.equal(by("t:-:ccc").season, null); // Cats nie sú v žiadnej sezóne
  assert.equal(by("T:-:ccc").anim, true);
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
});

test("kolekcia: najvzácnejšie hore, tímy pred hráčmi", () => {
  const list = C.sortCards(C.buildCards(D));
  assert.equal(list[0].rarity, "legendary");
  assert.equal(list[0].kind, "team");
  assert.equal(list[list.length - 1].rarity, "common");
});

test("balík: 5 kariet od najbežnejšej, bez opakovania a vždy aspoň rare", () => {
  const cards = C.RARITY.flatMap((r) => [1, 2, 3, 4, 5, 6].map((i) => ({ id: `${r}${i}`, rarity: r })));
  const pack = C.openPack(cards, seq(0.1, 0.2, 0.3, 0.4, 0.5, 0.15, 0.25, 0.35, 0.45, 0.05));
  assert.equal(pack.length, 5);
  assert.equal(new Set(pack.map((c) => c.id)).size, 5);
  const ranks = pack.map((c) => C.RARITY.indexOf(c.rarity));
  assert.deepEqual(ranks, ranks.slice().sort((a, b) => a - b));
  // „smola“: náhoda stále 0 → common, ale posledná karta musí byť aspoň rare
  const bad = C.openPack(cards, () => 0);
  assert.ok(bad.some((c) => c.rarity !== "common"));
});

test("šance: z 10 000 balíkov sedí podiel legendary okolo 4 %", () => {
  const cards = C.buildCards(D);
  let s = 7;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let leg = 0, all = 0;
  for (let i = 0; i < 10000; i++) C.openPack(cards, rng).forEach((c) => { all++; if (c.rarity === "legendary") leg++; });
  assert.ok(leg / all > 0.03 && leg / all < 0.07, `legendary ${leg / all}`);
});

test("uložený stav: pokazené dáta → prázdny, pridanie balíka zvýši počty", () => {
  assert.deepEqual(C.readSave(null), { d: "", c: {}, l: [] });
  assert.deepEqual(C.readSave({ d: 5, c: { a: "x", b: 2 }, l: [1, "b"] }), { d: "", c: { b: 2 }, l: ["b"] });
  const s = C.addPack({ d: "2026-11-20", c: { a: 1 }, l: [] }, ["a", "b", "a"], "2026-11-21");
  assert.deepEqual(s, { d: "2026-11-21", c: { a: 3, b: 1 }, l: ["a", "b", "a"] });
  assert.equal(C.canOpen(s, "2026-11-21"), false);
  assert.equal(C.canOpen(s, "2026-11-22"), true);
});

test("hráč dňa: rovnaký pre všetkých, každý príde na rad raz za N dní", () => {
  assert.equal(C.nextDay("2026-12-31"), "2027-01-01");
  const p = C.playerOfDay(D.players, "2026-11-21");
  assert.equal(C.playerOfDay(D.players.slice().reverse(), "2026-11-21").id, p.id);
  const three = ["2026-11-21", "2026-11-22", "2026-11-23"].map((d) => C.playerOfDay(D.players, d).id);
  assert.equal(new Set(three).size, 3);
  assert.equal(C.playerOfDay([], "2026-11-21"), null);
});

test("karta hráča dňa: najnovšia odohraná sezóna pred pripravovanou", () => {
  const c = C.latestCard(C.buildCards(D), "p-ana");
  assert.equal(c.season.id, "s1");
});
