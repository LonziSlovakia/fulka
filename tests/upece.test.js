// Testy čítania programu a noviniek z upcba.sk (upece.js). Spustenie: node --test tests/*.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../upece.js");

// zmenšená kópia šablóny týždenných „UPeCe oznamov“
const row = (day, liturgy, mass, events, cls = "") => `<tr${cls}> <td class="day">${day}</td> <td class="liturgy">${liturgy}</td> <td class="mass">${mass}</td> <td class="events">${events}</td> </tr>`;
const notice = (title, body) => `<div class="notice"> <div class="notice-title">${title}</div> <p class="notice-text"> ${body} </p> </div>`;
const week = (title, rows, notes = []) => ({
  title: { rendered: title },
  content: { rendered: `<style>.x{}</style><div class="doc-content"><table class="calendar"><thead><tr><th>Deň</th></tr></thead><tbody>${rows.join("")}</tbody></table>
    <div class="section-title">Aktuálne oznamy</div>${notes.join("")}</div>` },
});

const W1 = week("UPeCe oznamy 19.10.2026 &#8211; 25.10.2026", [
  row("20. 10.<br>Utorok", "", "<strong>20:00</strong><br>kaplnka", "<strong>ranná modlitba 6:45</strong><br><strong>tance a športy 21:15</strong>"),
  row("22. 10.<br>Štvrtok", "Sv. Jána Pavla II.", "<strong>20:00</strong><br>kaplnka", ""),
  row("23. 10.<br>Piatok", "", "<strong>20:00</strong><br>kaplnka", "<strong>Nikodémova noc</strong>"),
  row("24. 10.<br>Sobota", "", "–", "<strong>sme zatvorení</strong>"),
  row("25. 10.<br>Nedeľa", "30. nedeľa", " <strong>8:00</strong> (kaplnka)<br> <strong>10:00</strong> (Veľká Sála)<br> <strong>22:00</strong> (kaplnka) ", "", ' class="sunday"'),
], [
  notice("Nikodémova noc 23. 10.", "V piatok po svätej omši pozývame…"),
  notice("Súťaž o návrh merchu do 4. 11.", "Chystáme merch."),
]);

test("dátum dňa z tabuľky aj cez Nový rok", () => {
  assert.equal(U.dateOf("20. 10.", U.weekStart("UPeCe oznamy 19.10.2026 – 25.10.2026")), "2026-10-20");
  assert.equal(U.dateOf("2. 1.", U.weekStart("UPeCe oznamy 28.12.2026 – 3.1.2027")), "2027-01-02");
});

test("omša: čas, miesto, viac omší v nedeľu, liturgický deň ako podnadpis", () => {
  const days = U.parseWeek(W1);
  const thu = days.find((d) => d.date === "2026-10-22").rows[0];
  assert.deepEqual([thu.title, thu.time, thu.place, thu.sub], ["Sv. omša", "20:00", "Kaplnka", "Sv. Jána Pavla II."]);
  const sun = days.find((d) => d.date === "2026-10-25").rows[0];
  assert.deepEqual([sun.title, sun.time, sun.place], ["Sv. omše", "8:00 · 10:00 · 22:00", "Kaplnka a Veľká sála"]);
});

test("akcie: čas sa vyberie z textu, riadky sú zoradené podľa času", () => {
  const tue = U.parseWeek(W1).find((d) => d.date === "2026-10-20").rows;
  assert.deepEqual(tue.map((r) => [r.time, r.title]), [["6:45", "Ranná modlitba"], ["20:00", "Sv. omša"], ["21:15", "Tance a športy"]]);
});

test("výnimočná akcia = má v týždni vlastný oznam s dátumom; uzávierka „do …“ nie je akcia", () => {
  const fri = U.parseWeek(W1).find((d) => d.date === "2026-10-23").rows;
  assert.equal(fri.find((r) => r.title === "Nikodémova noc").kind, "special");
  assert.equal(U.noticeHead("Súťaž o návrh merchu do 4. 11.", { y: 2026, m: 10 }).date, null);
  assert.deepEqual(U.noticeHead("Jesenný víkend na horách 6. – 8. 11.", { y: 2026, m: 11 }), { name: "Jesenný víkend na horách", date: "2026-11-06" });
});

test("akcia iba v oznamoch (nie v tabuľke) sa doplní, ak má čas", () => {
  const w = week("UPeCe oznamy 2.11.2026 – 8.11.2026", [
    row("4. 11.<br>Streda", "", "<strong>20:00</strong><br>kaplnka", "<strong>adorácia po sv. omši</strong>"),
  ], [
    notice("Večer UPeCe 4. 11.", "Príď v stredu <strong>po svätej omši</strong> na Večer UPeCe!"),
    notice("Vizitácia z Ríma 4. 11.", "V stredu <strong>4. novembra o 20:00</strong> bude sláviť omšu…"),
    notice("Jesenný víkend na horách 6. – 8. 11.", "Dve túry."),
  ]);
  const wed = U.parseWeek(w)[0].rows;
  assert.deepEqual(wed.map((r) => [r.time, r.title, r.kind]), [
    ["20:00", "Sv. omša", "mass"], ["20:00", "Vizitácia z Ríma", "special"], ["", "Adorácia po sv. omši", "event"], ["po sv. omši", "Večer UPeCe", "special"],
  ]);
});

test("program: od dnes na 7 dní, výnimočné akcie sa neodrežú", () => {
  const rows = U.program([W1], "2026-10-22", 3);
  assert.equal(rows[0].date, "2026-10-22");
  assert.ok(rows.some((r) => r.title === "Nikodémova noc"));
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0].dn, rows[0].dd], ["Št", 22]);
  assert.equal(U.program([W1], "2026-11-01").length, 0);
});

test("novinky: dátum, nadpis s entitami, skrátený úvod, odkazy iba na upcba.sk", () => {
  const n = U.news([
    { date: "2026-10-25T17:28:06", link: "https://www.upcba.sk/3da/", title: { rendered: "41. 3DA &#8211; Žijem" }, excerpt: { rendered: "<p>Ako sa máš? Ako zvládaš každodenný život a odpovedz si úprimne, možno sa ti práve podarilo niečo [&hellip;]</p>" } },
    { date: "2026-10-20T12:00:00", link: "https://zly.example/", title: { rendered: "X" }, excerpt: { rendered: "" } },
  ]);
  assert.equal(n[0].date, "25. 10. 2026");
  assert.equal(n[0].title, "41. 3DA – Žijem");
  assert.ok(n[0].sub.endsWith("…") && n[0].sub.length <= 81);
  assert.equal(n[1].link, "https://www.upcba.sk/");
});
