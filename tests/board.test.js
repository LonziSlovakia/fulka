/* Testy výsledkovej tabule (board.js). Spustenie: node --test tests/*.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../board.js");

const H = { id: "gia", name: "Giants", abbr: "GIA", c: "#C9A15B", d: "#6B4F1F", ink: "#050505", logo: "x.svg" };
const A = { id: "bre", name: "Brewers", abbr: "BRE", c: "#8B5E34", d: "#3A2412", ink: "#FFFFFF", logo: "y.svg" };
const mk = (parts = 3, minutes = 15) => B.create({ matchId: "z26-07", seasonId: "z26", title: "Kolo 7", home: H, away: A }, { parts, minutes });
const T0 = 1_000_000;
const SEC = 1000;
const MIN = 60 * SEC;

test("názvy častí: polčasy, tretiny, štvrtiny, jedna časť bez názvu", () => {
  assert.equal(B.partLabel({ parts: 2 }, 1), "1. polčas");
  assert.equal(B.partLabel({ parts: 3 }, 2), "2. tretina");
  assert.equal(B.partLabel({ parts: 4 }, 4), "4. štvrtina");
  assert.equal(B.partLabel({ parts: 1 }, 1), "");
});

test("formát času: 3:42, zaokrúhľuje nahor, 0:00 je koniec", () => {
  assert.equal(B.fmt(222 * SEC), "3:42");
  assert.equal(B.fmt(221_100), "3:42");
  assert.equal(B.fmt(0), "0:00");
  assert.equal(B.fmt(15 * MIN), "15:00");
  assert.equal(B.fmt(-5), "0:00");
});

test("nový zápas: celá časť, stojí, 0:0, žiadne tresty", () => {
  const s = mk(3, 15);
  assert.equal(s.clock.ms, 15 * MIN);
  assert.equal(s.clock.running, false);
  assert.deepEqual(B.score(s), { h: 0, a: 0 });
  assert.equal(B.view(s, T0).label, "1. tretina");
});

test("konfigurácia sa ohraničí (1–4 časti, 1–60 minút)", () => {
  const s = B.create({ home: H, away: A }, { parts: 9, minutes: 500 });
  assert.deepEqual(s.cfg, { parts: 4, minutes: 60 });
});

test("čas beží z časovej značky, pauza ho zastaví", () => {
  let s = B.start(mk(), T0);
  assert.equal(B.view(s, T0 + 10 * SEC).ms, 15 * MIN - 10 * SEC);
  s = B.pause(s, T0 + 30 * SEC);
  assert.equal(s.clock.ms, 15 * MIN - 30 * SEC);
  assert.equal(B.view(s, T0 + 10 * MIN).ms, 15 * MIN - 30 * SEC); // po pauze sa nič nehýbe
  s = B.start(s, T0 + 60 * SEC);
  assert.equal(B.view(s, T0 + 70 * SEC).ms, 15 * MIN - 40 * SEC);
});

test("vypršanie času: settle zastaví na 0:00, predtým nič", () => {
  const s = B.start(mk(1, 1), T0);
  assert.equal(B.settle(s, T0 + 59 * SEC), null);
  const done = B.settle(s, T0 + 61 * SEC);
  assert.equal(done.clock.ms, 0);
  assert.equal(done.clock.running, false);
  assert.equal(B.view(s, T0 + 5 * MIN).ms, 0); // aj keď admin okno nikto neobnoví, druhá obrazovka ukáže 0:00
  assert.equal(B.view(s, T0 + 5 * MIN).running, false);
});

test("na nule sa štart nedá, kým sa nezačne ďalšia časť", () => {
  let s = B.adjust(mk(2, 10), -10 * MIN, T0);
  assert.equal(s.clock.ms, 0);
  assert.equal(B.start(s, T0).clock.running, false);
  s = B.nextPart(s, T0);
  assert.equal(s.part, 2);
  assert.equal(s.clock.ms, 10 * MIN);
  assert.equal(s.clock.running, false);
  assert.equal(B.view(s, T0).label, "2. polčas");
  assert.equal(B.nextPart(s, T0).part, 2); // viac častí nie je
});

test("posun času: korekcia hore aj dole, v rozsahu", () => {
  let s = B.adjust(mk(), 10 * SEC, T0);
  assert.equal(s.clock.ms, 15 * MIN + 10 * SEC);
  s = B.adjust(s, -2 * MIN, T0);
  assert.equal(s.clock.ms, 13 * MIN + 10 * SEC);
  assert.equal(B.adjust(s, -100 * MIN, T0).clock.ms, 0);
});

test("tresty: odpočítavajú sa iba keď beží čas", () => {
  let s = B.addPenalty(mk(), "h", 2 * MIN, { id: "p1", name: "Adam Novák", number: 7 }, T0);
  assert.equal(B.view(s, T0 + 30 * SEC).pens.h[0].ms, 2 * MIN); // čas stojí → trest tiež
  s = B.start(s, T0);
  assert.equal(B.view(s, T0 + 30 * SEC).pens.h[0].ms, 2 * MIN - 30 * SEC);
  s = B.pause(s, T0 + 45 * SEC);
  assert.equal(s.pens.h[0].ms, 2 * MIN - 45 * SEC);
  assert.equal(B.view(s, T0 + 5 * MIN).pens.h[0].ms, 2 * MIN - 45 * SEC);
  assert.equal(s.pens.h[0].name, "Adam Novák");
  assert.equal(s.pens.h[0].number, "7");
});

test("tresty: najviac 2 aktívne na tím, po vypršaní sa miesto uvoľní", () => {
  let s = mk();
  s = B.addPenalty(s, "h", 2 * MIN, null, T0);
  s = B.addPenalty(s, "h", 5 * MIN, null, T0);
  assert.equal(B.canPenalty(s, "h", T0), false);
  assert.equal(B.addPenalty(s, "h", 2 * MIN, null, T0).pens.h.length, 2); // tretí sa nepridá
  assert.equal(B.canPenalty(s, "a", T0), true); // druhý tím je nezávislý
  s = B.start(s, T0);
  assert.equal(B.canPenalty(s, "h", T0 + 2 * MIN + SEC), true); // 2-minútový trest vypršal
  const n = B.addPenalty(s, "h", MIN, null, T0 + 2 * MIN + SEC);
  assert.equal(n.pens.h.length, 2);
  assert.deepEqual(n.pens.h.map((p) => p.ms).sort((x, y) => x - y), [MIN, 3 * MIN - SEC]);
});

test("trest sa dá zrušiť (napr. súper dal gól), nulový trest sa nepridá", () => {
  let s = B.addPenalty(mk(), "a", 2 * MIN, null, T0);
  assert.equal(B.addPenalty(s, "a", 0, null, T0).pens.a.length, 1);
  s = B.removePenalty(s, "a", s.pens.a[0].id, T0);
  assert.equal(s.pens.a.length, 0);
});

test("trest ostáva aj pri prechode do ďalšej časti", () => {
  let s = B.addPenalty(mk(2, 10), "h", 2 * MIN, null, T0);
  s = B.start(s, T0);
  s = B.pause(s, T0 + 30 * SEC);
  s = B.nextPart(s, T0 + MIN);
  assert.equal(s.pens.h[0].ms, 2 * MIN - 30 * SEC);
});

test("trest nejde dlhšie ako hlavný čas: pri nule sa tresty zastavia", () => {
  let s = B.addPenalty(B.adjust(mk(1, 1), -MIN + 10 * SEC, T0), "h", 2 * MIN, null, T0); // zostáva 10 s
  s = B.start(s, T0);
  const done = B.settle(s, T0 + 20 * SEC);
  assert.equal(done.pens.h[0].ms, 2 * MIN - 10 * SEC);
});

test("minúty + sekundy trestu", () => {
  assert.equal(B.penaltyMs(2, 0), 120000);
  assert.equal(B.penaltyMs(0, 30), 30000);
  assert.equal(B.penaltyMs(1, 45), 105000);
  assert.equal(B.penaltyMs(0, 0), null);
  assert.equal(B.penaltyMs("", ""), null);
  assert.equal(B.penaltyMs(-1, 10), null);
});

test("góly: skóre, asistencia, zrušenie", () => {
  let s = mk();
  s = B.addGoal(s, "h", "p1");
  s = B.addGoal(s, "a", "p2");
  s = B.addGoal(s, "h", "");
  assert.deepEqual(B.score(s), { h: 2, a: 1 });
  assert.equal(s.goals[2].scorer, B.UNKNOWN);
  s = B.setAssist(s, 0, "p9");
  assert.equal(s.goals[0].assist, "p9");
  s = B.removeGoal(s, 1);
  assert.deepEqual(B.score(s), { h: 2, a: 0 });
  assert.deepEqual(s.goals.map((g) => g.scorer), ["p1", B.UNKNOWN]);
});

test("koniec zápasu zastaví čas a zamkne góly aj tresty; späť do zápasu ho odomkne", () => {
  let s = B.start(mk(), T0);
  s = B.addGoal(s, "h", "p1");
  s = B.end(s, T0 + 5 * SEC);
  assert.equal(s.ended, true);
  assert.equal(s.clock.running, false);
  assert.equal(B.addGoal(s, "a", "p2").goals.length, 1);
  assert.equal(B.removeGoal(s, 0).goals.length, 1);
  assert.equal(B.canPenalty(s, "h", T0), false);
  assert.equal(B.start(s, T0 + MIN).clock.running, false);
  s = B.reopen(s);
  assert.equal(s.ended, false);
  assert.equal(B.addGoal(s, "a", "p2").goals.length, 2);
});

test("veľkosť tabule je v rozsahu 50–150 %", () => {
  assert.equal(B.setScale(mk(), 90).scale, 90);
  assert.equal(B.setScale(mk(), 400).scale, 150);
  assert.equal(B.setScale(mk(), 1).scale, 50);
});

test("funkcie nemenia pôvodný stav", () => {
  const s = mk();
  const before = JSON.stringify(s);
  B.addGoal(s, "h", "p1"); B.start(s, T0); B.addPenalty(s, "h", MIN, null, T0); B.nextPart(s, T0); B.adjust(s, SEC, T0);
  assert.equal(JSON.stringify(s), before);
});

test("posun času: bez trestov iba hra, s trestami aj tresty", () => {
  const s = B.addPenalty(mk(), "h", 2 * MIN, null, T0);
  const only = B.adjust(s, 10 * SEC, T0);
  assert.equal(only.clock.ms, 15 * MIN + 10 * SEC);
  assert.equal(only.pens.h[0].ms, 2 * MIN);
  const both = B.adjust(s, 10 * SEC, T0, true);
  assert.equal(both.clock.ms, 15 * MIN + 10 * SEC);
  assert.equal(both.pens.h[0].ms, 2 * MIN + 10 * SEC);
  assert.equal(B.adjust(s, -MIN, T0, true).pens.h[0].ms, MIN);
  assert.equal(B.adjust(s, -3 * MIN, T0, true).pens.h.length, 0); // trest by klesol pod nulu → zmizne
});

test("späť o časť: vráti čas, kde sa skončilo; bez záznamu 0:00; v 1. časti nič", () => {
  assert.equal(B.hasPrevPart(mk()), false);
  let s = B.adjust(mk(2, 10), -10 * MIN + 7 * SEC, T0); // v 1. polčase zostáva 0:07
  s = B.nextPart(s, T0);
  assert.equal(s.part, 2);
  s = B.prevPart(s, T0);
  assert.equal(s.part, 1);
  assert.equal(s.clock.ms, 7 * SEC);
  assert.equal(s.clock.running, false);
  const manual = Object.assign(mk(3, 10), { part: 3 });
  const back = B.prevPart(manual, T0);
  assert.equal(back.part, 2);
  assert.equal(back.clock.ms, 0);
});

test("reset času vráti celú časť, skóre a tresty ostanú", () => {
  let s = B.addPenalty(B.addGoal(B.adjust(mk(2, 10), -4 * MIN, T0), "h", "p1"), "a", 2 * MIN, null, T0);
  s = B.resetClock(s, T0);
  assert.equal(s.clock.ms, 10 * MIN);
  assert.equal(s.goals.length, 1);
  assert.equal(s.pens.a.length, 1);
});

test("reset zápasu: všetko od nuly, tímy, strany a veľkosť ostanú", () => {
  let s = B.setScale(B.swapSides(B.nextPart(B.addPenalty(B.addGoal(mk(2, 10), "h", "p1"), "a", MIN, null, T0), T0)), 80);
  s = B.end(s, T0);
  const r = B.resetAll(s, T0);
  assert.equal(r.part, 1);
  assert.equal(r.ended, false);
  assert.equal(r.goals.length, 0);
  assert.equal(r.pens.a.length, 0);
  assert.equal(r.clock.ms, 10 * MIN);
  assert.equal(r.home.name, "Giants");
  assert.equal(r.scale, 80);
  assert.equal(r.flip, true);
});

test("výmena strán sa prepína tam a späť", () => {
  const s = mk();
  assert.equal(!!s.flip, false);
  assert.equal(B.swapSides(s).flip, true);
  assert.equal(B.swapSides(B.swapSides(s)).flip, false);
});

test("čitateľný text na tímovej farbe: tmavý na svetlej, biely na tmavej, kontrast aspoň 4,5", () => {
  assert.equal(B.contrastInk("#D9A252"), "#000000"); // Giants
  assert.equal(B.contrastInk("#D2AA79"), "#000000"); // Brewers
  assert.equal(B.contrastInk("#41CFDD"), "#000000"); // Rangers
  assert.equal(B.contrastInk("#E0262F"), "#FFFFFF"); // Saints
  assert.equal(B.contrastInk("#111111"), "#FFFFFF");
  ["#D9A252", "#D2AA79", "#41CFDD", "#E0262F", "#888888", "#333333"].forEach((c) => {
    assert.ok(B.contrast(B.contrastInk(c), c) >= 4.5, c);
  });
  assert.ok(B.contrast("#FFFFFF", "#000000") > 20);
});

test("gól spustí animáciu na krátky čas; zrušenie gólu ju vypne", () => {
  let s = B.addGoal(mk(), "a", "p1", T0);
  assert.equal(B.goalFx(s, T0 + 500), "a");
  assert.equal(B.goalFx(s, T0 + B.GOAL_FX_MS + 1), "");
  assert.equal(B.goalFx(B.addGoal(mk(), "h", "p1"), T0), ""); // bez času sa animácia nespustí
  s = B.removeGoal(s, 0);
  assert.equal(B.goalFx(s, T0 + 500), "");
});
