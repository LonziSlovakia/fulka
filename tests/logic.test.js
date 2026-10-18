/* Testy výpočtov ligy. Spustenie: node --test tests/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

const TEAMS = ["gia", "bre", "ran", "sai"];
const PLAYERS = {
  a1: { name: "Adam Hrabovský" }, a2: { name: "Andrej Bartoš" }, b1: { name: "Bea Bystrá" },
  r1: { name: "Rado Rýchly" }, s1: { name: "Samo Svätý" },
};

// zápas základnej časti; goals = "hha" → domáci, domáci, hostia
let gid = 0;
function match(id, round, home, away, status, extra) {
  return Object.assign({ id, season_id: "z26", stage: "R", round, home_id: home, away_id: away, starts_at: null, window_from: null, window_to: null, moved: false, status: status || "plan" }, extra || {});
}
function goals(matchId, sides, scorer, assist) {
  return sides.split("").map((side, i) => ({ id: `g${gid++}`, match_id: matchId, seq: i + 1, side, scorer_id: scorer ? scorer(side, i) : null, assist_id: assist ? assist(side, i) : null }));
}
const po = () => ["SF1", "SF2", "B3", "F"].map((s) => ({ id: `z26-${s.toLowerCase()}`, season_id: "z26", stage: s, home_id: null, away_id: null, status: "plan", starts_at: null }));

test("skóre sa počíta z gólov", () => {
  assert.deepEqual(L.score(goals("x", "hhah")), { h: 3, a: 1 });
  assert.deepEqual(L.score([]), { h: 0, a: 0 });
  assert.deepEqual(L.score(undefined), { h: 0, a: 0 });
});

test("góly sa zoradia podľa seq", () => {
  const gm = L.goalsByMatch([{ match_id: "m", seq: 2, side: "a" }, { match_id: "m", seq: 1, side: "h" }]);
  assert.deepEqual(gm.m.map((g) => g.seq), [1, 2]);
});

test("tabuľka: body 3/1/0, Z V R P, skóre", () => {
  const ms = [match("m1", 1, "gia", "bre", "done"), match("m2", 1, "ran", "sai", "done"), match("m3", 2, "gia", "ran", "plan")];
  const gm = L.goalsByMatch([...goals("m1", "hha"), ...goals("m2", "ha"), ...goals("m3", "hhhhh")]);
  const t = L.standings(TEAMS, ms, gm, {});
  const by = Object.fromEntries(t.map((x) => [x.id, x]));
  assert.equal(by.gia.b, 3); assert.equal(by.gia.v, 1); assert.equal(by.gia.gf, 2); assert.equal(by.gia.ga, 1);
  assert.equal(by.bre.b, 0); assert.equal(by.bre.p, 1);
  assert.equal(by.ran.b, 1); assert.equal(by.ran.r, 1); assert.equal(by.sai.b, 1);
  assert.equal(by.gia.z, 1, "neodohraný zápas sa nepočíta");
  assert.equal(t[0].id, "gia"); assert.equal(t[0].pos, 1);
});

test("tabuľka: body z nastavení", () => {
  const ms = [match("m1", 1, "gia", "bre", "done")];
  const gm = L.goalsByMatch(goals("m1", "h"));
  const t = L.standings(TEAMS, ms, gm, { pointsWin: 2 });
  assert.equal(t.find((x) => x.id === "gia").b, 2);
});

test("tabuľka: poradie body → rozdiel → strelené góly → poradie tímov", () => {
  // gia a ran: 3 b, rozdiel +1; ran dal viac gólov → ran pred gia
  // bre a sai: 0 b, rozdiel −1; bre dal viac → bre pred sai
  const ms = [match("m1", 1, "gia", "sai", "done"), match("m2", 1, "ran", "bre", "done")];
  const gm = L.goalsByMatch([...goals("m1", "h"), ...goals("m2", "hhhaa")]);
  const t = L.standings(TEAMS, ms, gm, {});
  assert.deepEqual(t.map((x) => x.id), ["ran", "gia", "bre", "sai"]);
  // úplná zhoda (nikto nehral) → poradie tímov sezóny
  assert.deepEqual(L.standings(TEAMS, [], {}, {}).map((x) => x.id), TEAMS);
});

test("tabuľka: rozdiel skóre má prednosť pred strelenými gólmi", () => {
  // gia vyhrá 2:0 (+2, 2 góly), ran vyhrá 3:2 (+1, 3 góly) → gia pred ran, hoci dal menej gólov
  const ms = [match("m1", 1, "gia", "sai", "done"), match("m2", 1, "ran", "bre", "done")];
  const gm = L.goalsByMatch([...goals("m1", "hh"), ...goals("m2", "hhhaa")]);
  assert.deepEqual(L.standings(TEAMS, ms, gm, {}).map((x) => x.id).slice(0, 2), ["gia", "ran"]);
});

test("tabuľka: playoff zápasy sa do nej nepočítajú", () => {
  const ms = [Object.assign(match("f", null, "gia", "bre", "done"), { stage: "F" })];
  const gm = L.goalsByMatch(goals("f", "h"));
  assert.ok(L.standings(TEAMS, ms, gm, {}).every((x) => x.z === 0));
});

test("kanadské bodovanie: gól + asistencia, poradie body → góly → meno", () => {
  const ms = [match("m1", 1, "gia", "bre", "done"), match("m2", 2, "gia", "ran", "done")];
  // m1: a1 dá 2 (asist a2), b1 dá 1 bez asistencie
  // m2: a2 dá 1 (asist a1), r1 dá 1 (neznámy asistent → null)
  const gm = L.goalsByMatch([
    { match_id: "m1", seq: 1, side: "h", scorer_id: "a1", assist_id: "a2" },
    { match_id: "m1", seq: 2, side: "h", scorer_id: "a1", assist_id: "a2" },
    { match_id: "m1", seq: 3, side: "a", scorer_id: "b1", assist_id: null },
    { match_id: "m2", seq: 1, side: "h", scorer_id: "a2", assist_id: "a1" },
    { match_id: "m2", seq: 2, side: "a", scorer_id: "r1", assist_id: null },
    { match_id: "m2", seq: 3, side: "a", scorer_id: null, assist_id: "r1" },
  ]);
  const t = L.standings(TEAMS, ms, gm, {});
  const s = L.scorers(ms, gm, PLAYERS, t);
  assert.deepEqual(s.map((x) => [x.player_id, x.g, x.a, x.b]), [
    ["a1", 2, 1, 3], // 3 b, 2 góly
    ["a2", 1, 2, 3], // 3 b, 1 gól
    ["r1", 1, 1, 2],
    ["b1", 1, 0, 1],
  ]);
  assert.equal(s[0].z, 2, "zápasy tímu hráča");
  assert.equal(s[0].pos, 1);
});

test("kanadské bodovanie: rovnaké body aj góly → podľa mena (slovenská abeceda)", () => {
  const ms = [match("m1", 1, "gia", "bre", "done")];
  const gm = L.goalsByMatch([
    { match_id: "m1", seq: 1, side: "h", scorer_id: "a2" },
    { match_id: "m1", seq: 2, side: "h", scorer_id: "a1" },
  ]);
  assert.deepEqual(L.scorers(ms, gm, PLAYERS, []).map((x) => x.player_id), ["a1", "a2"]);
});

test("kanadské bodovanie: tím hráča podľa strany gólu, nie podľa súpisky", () => {
  // s1 dal gól za sai (hostia), potom bol presunutý a dal gól za gia (domáci) → tím = gia, body sa sčítajú
  const ms = [match("m1", 1, "ran", "sai", "done"), match("m2", 2, "gia", "bre", "done")];
  const gm = L.goalsByMatch([
    { match_id: "m1", seq: 1, side: "a", scorer_id: "s1" },
    { match_id: "m2", seq: 1, side: "h", scorer_id: "s1" },
  ]);
  const s = L.scorers(ms, gm, PLAYERS, []);
  assert.equal(s.length, 1); assert.equal(s[0].g, 2); assert.equal(s[0].team_id, "gia");
});

test("kanadské bodovanie: max. 10 hráčov, neodohrané zápasy sa nepočítajú", () => {
  const pl = {};
  const gs = [];
  for (let i = 0; i < 12; i++) { pl[`p${i}`] = { name: `Hráč ${String(i).padStart(2, "0")}` }; gs.push({ match_id: "m1", seq: i + 1, side: "h", scorer_id: `p${i}` }); }
  gs.push({ match_id: "m2", seq: 1, side: "h", scorer_id: "p0" });
  const ms = [match("m1", 1, "gia", "bre", "done"), match("m2", 1, "ran", "sai", "plan")];
  const s = L.scorers(ms, L.goalsByMatch(gs), pl, []);
  assert.equal(s.length, 10);
  assert.equal(s[0].g, 1, "gól z neodohraného zápasu sa nepočíta");
});

test("časová os gólov: priebežné skóre, neznámy hráč, asistencia", () => {
  const tl = L.goalTimeline([
    { seq: 1, side: "h", scorer_id: "a1", assist_id: "a2" },
    { seq: 2, side: "a", scorer_id: null, assist_id: null },
    { seq: 3, side: "h", scorer_id: "a2", assist_id: null },
  ], PLAYERS);
  assert.deepEqual(tl.map((g) => [g.score, g.scorer, g.assist]), [
    ["1:0", "Adam Hrabovský", "Andrej Bartoš"],
    ["1:1", "Neznámy hráč", ""],
    ["2:1", "Andrej Bartoš", ""],
  ]);
});

/* ---------- Playoff ---------- */
function fullSeason() {
  // gia 9 b, bre 6 b, ran 3 b, sai 0 b
  const ms = [
    match("m1", 1, "gia", "bre", "done"), match("m2", 1, "ran", "sai", "done"),
    match("m3", 2, "gia", "ran", "done"), match("m4", 2, "bre", "sai", "done"),
    match("m5", 3, "gia", "sai", "done"), match("m6", 3, "bre", "ran", "done"),
  ];
  const gs = ms.flatMap((m) => goals(m.id, "h"));
  return { ms, gs };
}

test("playoff auto: SF1 = 1. vs 4., SF2 = 2. vs 3., kým základná časť nie je dohraná, nie je isté", () => {
  const { ms, gs } = fullSeason();
  ms[5].status = "plan";
  const all = [...ms, ...po()];
  const gm = L.goalsByMatch(gs);
  const t = L.standings(TEAMS, all, gm, {});
  const p = L.playoff({ seed_mode: "auto" }, all, gm, t);
  assert.equal(p.SF1.seedH, 1); assert.equal(p.SF1.seedA, 4);
  assert.equal(p.SF1.fixed, false);
  assert.equal(p.F.home_id, null);
});

test("playoff auto: po základnej časti tímy, B3 = porazení, F = víťazi, šampión a poradie", () => {
  const { ms, gs } = fullSeason();
  const all = [...ms, ...po()];
  let gm = L.goalsByMatch(gs);
  const t = L.standings(TEAMS, all, gm, {});
  assert.deepEqual(t.map((x) => x.id), ["gia", "bre", "ran", "sai"]);
  let p = L.playoff({ seed_mode: "auto" }, all, gm, t);
  assert.deepEqual([p.SF1.home_id, p.SF1.away_id, p.SF1.fixed], ["gia", "sai", true]);
  assert.deepEqual([p.SF2.home_id, p.SF2.away_id], ["bre", "ran"]);
  assert.equal(p.F.fixed, false, "finále bez odohraných SF nemá tímy");

  // SF1: sai vyhrá 1:2, SF2: bre vyhrá 1:0
  all.find((m) => m.stage === "SF1").status = "done";
  all.find((m) => m.stage === "SF2").status = "done";
  gs.push(...goals("z26-sf1", "haa"), ...goals("z26-sf2", "h"));
  gm = L.goalsByMatch(gs);
  p = L.playoff({ seed_mode: "auto" }, all, gm, t);
  assert.deepEqual([p.F.home_id, p.F.away_id], ["sai", "bre"]);
  assert.deepEqual([p.B3.home_id, p.B3.away_id], ["gia", "ran"]);

  // finále 0:1 → bre šampión; o 3. miesto 2:1 → gia tretí
  all.find((m) => m.stage === "F").status = "done";
  all.find((m) => m.stage === "B3").status = "done";
  gs.push(...goals("z26-f", "a"), ...goals("z26-b3", "hah"));
  gm = L.goalsByMatch(gs);
  const resolved = L.resolveMatches({ seed_mode: "auto" }, all, gm, t);
  assert.equal(L.champion(resolved, gm), "bre");
  assert.deepEqual(L.places(resolved, gm), [{ pos: 1, id: "bre" }, { pos: 2, id: "sai" }, { pos: 3, id: "gia" }, { pos: 4, id: "ran" }]);
  assert.equal(resolved.length, all.length);
  assert.equal(resolved.find((m) => m.id === "m1").home_id, "gia", "základná časť ostáva");
});

test("kanadské bodovanie: rátajú sa góly zo základnej časti aj z playoff", () => {
  const { ms, gs } = fullSeason();
  const all = [...ms, ...po()];
  all.find((m) => m.stage === "SF1").status = "done";
  const pg = [...gs, { match_id: "m1", seq: 9, side: "h", scorer_id: "a1" }, { match_id: "z26-sf1", seq: 1, side: "a", scorer_id: "s1", assist_id: "a1" }];
  const gm = L.goalsByMatch(pg);
  const t = L.standings(TEAMS, all, gm, {});
  const s = L.scorers(L.resolveMatches({ seed_mode: "auto" }, all, gm, t), gm, PLAYERS, t);
  const by = Object.fromEntries(s.map((x) => [x.player_id, x]));
  assert.deepEqual([by.a1.g, by.a1.a, by.a1.b], [1, 1, 2], "gól v základnej časti + asistencia v SF");
  assert.equal(by.s1.team_id, "sai", "tím z doplneného playoff zápasu (SF1 = gia vs sai)");
});

test("playoff manual: tímy SF z uložených home_id/away_id", () => {
  const { ms, gs } = fullSeason();
  const all = [...ms, ...po()];
  Object.assign(all.find((m) => m.stage === "SF1"), { home_id: "ran", away_id: "gia" });
  const gm = L.goalsByMatch(gs);
  const t = L.standings(TEAMS, all, gm, {});
  const p = L.playoff({ seed_mode: "manual" }, all, gm, t);
  assert.deepEqual([p.SF1.home_id, p.SF1.away_id, p.SF1.fixed, p.SF1.seedH], ["ran", "gia", true, null]);
  assert.equal(p.SF2.fixed, false, "SF2 bez tímov");
});

test("bez playoff zápasov a bez finále: žiadny šampión", () => {
  const { ms, gs } = fullSeason();
  const gm = L.goalsByMatch(gs);
  assert.deepEqual(L.playoff({ seed_mode: "auto" }, ms, gm, L.standings(TEAMS, ms, gm, {})), {});
  assert.equal(L.champion(ms, gm), null);
  assert.deepEqual(L.places(ms, gm), []);
});

test("remíza nemá víťaza", () => {
  const m = match("m", 1, "gia", "bre", "done");
  assert.equal(L.winner(m, goals("m", "ha")), null);
  assert.equal(L.loser(m, goals("m", "ha")), null);
  assert.equal(L.winner(match("m", 1, "gia", "bre", "plan"), goals("m", "h")), null);
});

/* ---------- Dátumy ---------- */
test("čas sa ukazuje v Bratislave (zima aj leto)", () => {
  assert.deepEqual(L.localParts("2026-10-06T18:15:00Z"), { date: "2026-10-06", time: "20:15" }); // letný čas +2
  assert.deepEqual(L.localParts("2026-11-03T19:15:00Z"), { date: "2026-11-03", time: "20:15" }); // zimný čas +1
  assert.deepEqual(L.localParts("2026-10-06T22:30:00Z"), { date: "2026-10-07", time: "00:30" }); // cez polnoc
});

test("zadaný čas v Bratislave → UTC (aj okolo zmeny času)", () => {
  assert.equal(L.toUtc("2026-10-06", "20:15"), "2026-10-06T18:15:00.000Z");
  assert.equal(L.toUtc("2026-11-03", "20:15"), "2026-11-03T19:15:00.000Z");
  assert.equal(L.toUtc("2026-10-25", "12:00"), "2026-10-25T11:00:00.000Z"); // deň zmeny času
  assert.equal(L.toUtc("2026-03-29", "12:00"), "2026-03-29T10:00:00.000Z");
  for (const iso of ["2026-10-24T20:00:00.000Z", "2026-12-31T23:30:00.000Z"]) {
    const p = L.localParts(iso);
    assert.equal(L.toUtc(p.date, p.time), iso, "tam a späť");
  }
});

test("formáty dátumov", () => {
  assert.equal(L.shortDate("2026-10-06"), "Ut 6. 10.");
  assert.equal(L.dayName("2026-10-06"), "Utorok");
  assert.equal(L.dShort("2026-10-06"), "6.10.");
  assert.equal(L.slot("2026-10-06T18:15:00Z"), "Ut 6. 10. · 20:15");
  assert.equal(L.slot(null), "");
  assert.equal(L.weekLabel("2026-10-19", "2026-10-25"), "19.10. – 25.10.");
});

/* ---------- Najbližšie zápasy a rozpis ---------- */
test("najbližšie zápasy: presné termíny, odohrané preč, počet 1–4", () => {
  const ms = [
    match("a", 3, "gia", "bre", "plan", { starts_at: "2026-10-20T19:00:00Z" }),
    match("b", 3, "ran", "sai", "plan", { starts_at: "2026-10-20T18:15:00Z" }),
    match("c", 2, "gia", "ran", "done", { starts_at: "2026-10-13T18:15:00Z" }),
    match("d", 4, "sai", "gia", "plan", { starts_at: "2026-10-27T19:15:00Z" }),
  ];
  const now = "2026-10-18T10:00:00Z";
  assert.deepEqual(L.nextMatches(ms, 2, now).map((m) => m.id), ["b", "a"]);
  assert.deepEqual(L.nextMatches(ms, 9, now).map((m) => m.id), ["b", "a", "d"]);
  assert.deepEqual(L.nextMatches(ms, 0, now).map((m) => m.id), ["b", "a"], "neplatný počet → predvolené 2");
  assert.deepEqual(L.nextMatches(ms, 1, "2026-10-22T20:00:00Z").map((m) => m.id), ["b"], "ostáva, kým nie je odohraný");
});

test("najbližšie zápasy: bez presného termínu podľa týždňa, ktorý ešte neskončil", () => {
  const ms = [
    match("w2", 2, "gia", "ran", "plan", { window_from: "2026-10-12", window_to: "2026-10-18" }),
    match("w3", 3, "gia", "bre", "plan", { window_from: "2026-10-19", window_to: "2026-10-25" }),
    match("w1", 1, "gia", "sai", "plan", { window_from: "2026-10-05", window_to: "2026-10-11" }),
    { id: "z26-sf1", stage: "SF1", home_id: null, away_id: null, status: "plan", window_to: "2026-12-01" },
  ];
  assert.deepEqual(L.nextMatches(ms, 4, "2026-10-18T10:00:00Z").map((m) => m.id), ["w2", "w3"]);
});

test("stav zápasu v rozpise", () => {
  assert.equal(L.matchState({ status: "done" }, null), "done");
  assert.equal(L.matchState({ id: "x", status: "plan", starts_at: null }, "y"), "tbd");
  assert.equal(L.matchState({ id: "x", status: "plan", starts_at: null }, "x"), "next", "najbližší, hoci má iba týždeň");
  assert.equal(L.matchState({ id: "x", status: "plan", starts_at: "2026-10-20T18:15:00Z", moved: true }, "x"), "moved");
  assert.equal(L.matchState({ id: "x", status: "plan", starts_at: "2026-10-20T18:15:00Z" }, "x"), "next");
  assert.equal(L.matchState({ id: "y", status: "plan", starts_at: "2026-10-20T18:15:00Z" }, "x"), "plan");
});

test("rozpis po kolách, deň kola z nepresunutého zápasu", () => {
  const ms = [
    match("b", 2, "ran", "bre", "plan", { starts_at: "2026-10-15T17:00:00Z", moved: true }),
    match("a", 2, "gia", "sai", "plan", { starts_at: "2026-10-13T18:15:00Z" }),
    match("c", 1, "gia", "bre", "plan", { window_from: "2026-10-05", window_to: "2026-10-11" }),
    { id: "z26-f", stage: "F", status: "plan" },
  ];
  const r = L.rounds(ms);
  assert.deepEqual(r.map((x) => [x.round, x.date, x.exact, x.matches.map((m) => m.id)]), [
    [1, "2026-10-05", false, ["c"]],
    [2, "2026-10-13", true, ["a", "b"]],
  ]);
});

/* ---------- Kontrola zápasu v admine ---------- */
test("kontrola zápasu: hlášky z návrhu", () => {
  const ok = { stage: "R", home_id: "gia", away_id: "bre", tbd: false, date: "2026-10-20", status: "done", goals: [{ side: "h", scorer: "a1" }] };
  assert.equal(L.validateMatch(ok, "auto"), "");
  assert.equal(L.validateMatch({ ...ok, away_id: null }, "auto"), "Vyber oba tímy.");
  assert.equal(L.validateMatch({ ...ok, away_id: "gia" }, "auto"), "Tím nemôže hrať sám so sebou — vyber dva rôzne tímy.");
  assert.equal(L.validateMatch({ ...ok, date: "" }, "auto"), "Vyber dátum v kalendári alebo prepni na „Termín neznámy“.");
  assert.equal(L.validateMatch({ ...ok, tbd: true, date: "" }, "auto"), "Odohraný zápas potrebuje dátum — prepni na „Presný termín“.");
  assert.equal(L.validateMatch({ ...ok, tbd: true, date: "", status: "plan" }, "auto"), "");
  assert.equal(L.validateMatch({ ...ok, goals: [{ side: "h", scorer: "a1" }, { side: "a", scorer: "" }] }, "auto"),
    "Pri góle č. 2 chýba strelec (môžeš dať aj „Neznámy hráč“).");
  assert.equal(L.validateMatch({ ...ok, goals: [{ side: "h", scorer: L.UNKNOWN }] }, "auto"), "", "neznámy hráč je v poriadku");
  assert.equal(L.validateMatch({ ...ok, goals: [{ side: "h", scorer: "a1" }, { side: "a", scorer: "b1" }] }, "auto"), "", "remíza v základnej časti OK");
});

test("kontrola zápasu: playoff", () => {
  const sf = { stage: "SF1", home_id: null, away_id: null, tbd: false, date: "2026-11-24", status: "plan", goals: [] };
  assert.equal(L.validateMatch(sf, "auto"), "", "auto: tímy netreba vyberať");
  assert.equal(L.validateMatch(sf, "manual"), "Vyber oba tímy.");
  assert.equal(L.validateMatch({ ...sf, status: "done" }, "auto"), "Výsledok sa dá zapísať, až keď sú známe oba tímy.");
  const played = { ...sf, home_id: "gia", away_id: "sai", status: "done", goals: [{ side: "h", scorer: "a1" }, { side: "a", scorer: "s1" }] };
  assert.equal(L.validateMatch(played, "auto"), "V playoff musí byť víťaz — výsledok nemôže byť remíza.");
  assert.equal(L.validateMatch({ ...played, goals: [...played.goals, { side: "a", scorer: L.UNKNOWN }] }, "auto"), "");
  assert.equal(L.validateMatch({ ...played, stage: "F", goals: [] }, "auto"), "V playoff musí byť víťaz — výsledok nemôže byť remíza.", "0:0");
});

test("iniciály a nastavenia", () => {
  assert.equal(L.initials("Jakub Štefaňák"), "JŠ");
  assert.equal(L.initials("Ema"), "E");
  assert.deepEqual(L.settingsOf({ bannerCount: 3 }), { bannerCount: 3, pointsWin: 3, pointsDraw: 1, pointsLoss: 0, defaultTime: "21:15" });
  assert.deepEqual(L.settingsOf(null), L.DEFAULTS);
});
