/* Kalendár UPeCe: iCal z upcba.sk → malý JSON pre web (data/upece-kalendar.json).
   Spúšťa ho GitHub Action .github/workflows/kalendar.yml každé 3 hodiny (prehliadač iCal z upcba.sk načítať nesmie – chýba CORS).
   Použitie: node tools/kalendar.js <vstup.ics> <výstup.json>
   JSON obsahuje udalosti aj s pravidlami opakovania (nie rozpísané dni) → mení sa iba vtedy, keď sa zmení kalendár,
   rozpísanie na konkrétne dni robí web (upece.js calendarDays). Časy sú v čase Bratislavy. */
"use strict";
const fs = require("fs");

const SITE = "https://www.upcba.sk/";
const KEEP_DAYS = 7; // udalosti, ktoré skončili pred viac než týždňom, sa do JSON nedávajú

// riadky iCal: pokračovanie riadku začína medzerou (RFC 5545 „folding“)
const unfold = (ics) => String(ics).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
// „Akcie\, Akcie UPeCe“ → text bez únikových znakov
const unescape = (s) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

// čas v Bratislave z UTC času (… Z)
function bratislava(utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// „20261127T200000“ (+ Z) alebo „20261113“ → „2026-11-27T20:00“ / „2026-11-13“
function stamp(value, utc) {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return date;
  if (m[6] || utc) return bratislava(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return `${date}T${m[4]}:${m[5]}`;
}
// „FREQ=WEEKLY;UNTIL=20261225T235959Z;INTERVAL=2;BYDAY=TU,WE“ → { f, i, d, u, n }
function rule(value) {
  const r = Object.fromEntries(value.split(";").map((x) => x.split("=")));
  const out = { f: r.FREQ, i: Number(r.INTERVAL) || 1 };
  if (r.BYDAY) out.d = r.BYDAY.split(",").map((x) => x.slice(-2));
  if (r.UNTIL) out.u = `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}`; // deň konca (bez prepočtu času, „do konca dňa“)
  if (r.COUNT) out.n = Number(r.COUNT);
  return out;
}
// „Veľká sála UPeCe @ Staré Grunty 36. Bratislava“ → „Veľká sála“
const place = (s) => s.split("@")[0].replace(/\s*UPeCe\s*$/i, "").trim();

// celý iCal → zoznam udalostí { t: názov, s: začiatok, e: koniec, p: miesto, c: kategória, u: odkaz, r: opakovanie, x: vynechané dni }
function parse(ics) {
  const out = [];
  let ev = null;
  for (const line of unfold(ics)) {
    if (line === "BEGIN:VEVENT") { ev = { x: [] }; continue; }
    if (line === "END:VEVENT") { if (ev && ev.t && ev.s) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(";");
    const value = line.slice(i + 1);
    if (name === "SUMMARY") ev.t = unescape(value);
    else if (name === "DTSTART") ev.s = stamp(value);
    else if (name === "DTEND") ev.e = stamp(value);
    else if (name === "LOCATION" && value.trim()) ev.p = place(unescape(value));
    else if (name === "CATEGORIES" && value.trim()) ev.c = unescape(value).split(",")[0].trim();
    else if (name === "URL" && value.startsWith(SITE)) ev.u = value.trim();
    else if (name === "RRULE") ev.r = rule(value);
    else if (name === "EXDATE") value.split(",").forEach((v) => { const d = stamp(v.trim()); if (d) ev.x.push(d.slice(0, 10)); });
    else if (name === "RECURRENCE-ID") ev.rid = stamp(value);
    void params;
  }
  return out.map((e) => {
    const o = { t: e.t, s: e.s };
    if (e.e && e.e !== e.s) o.e = e.e;
    ["p", "c", "u", "r"].forEach((k) => { if (e[k]) o[k] = e[k]; });
    if (e.x.length) o.x = [...new Set(e.x)].sort();
    if (e.rid) o.rid = e.rid; // zmenený jeden výskyt opakovanej udalosti
    return o;
  });
}

// posledný deň udalosti (pri opakovaní koniec pravidla; bez konca = ďaleko v budúcnosti)
function lastDay(e) {
  if (e.r) return e.r.u || (e.r.n ? "9999-12-31" : "9999-12-31");
  return (e.e || e.s).slice(0, 10);
}
// iba udalosti, ktoré ešte prebiehajú alebo skončili nedávno; zoradené podľa začiatku
function keep(events, today) {
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - KEEP_DAYS)).toISOString().slice(0, 10);
  return events.filter((e) => lastDay(e) >= from).sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.t.localeCompare(b.t)));
}

// JSON s jednou udalosťou na riadok (prehľadné zmeny v gite); bez dátumu stiahnutia, aby sa súbor menil iba so zmenou kalendára
const toJson = (events) => `{"zdroj":"upcba.sk/kalendar (iCal)","udalosti":[\n${events.map((e) => JSON.stringify(e)).join(",\n")}\n]}\n`;

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error("Použitie: node tools/kalendar.js <vstup.ics> <výstup.json>"); process.exit(1); }
  const ics = fs.readFileSync(input, "utf8");
  if (!ics.includes("BEGIN:VCALENDAR")) { console.error("Vstup nie je iCal (upcba.sk asi vrátil chybovú stránku) – JSON sa nemení."); process.exit(1); }
  const today = bratislava(Date.now()).slice(0, 10);
  const events = keep(parse(ics), today);
  fs.writeFileSync(output, toJson(events));
  console.log(`${events.length} udalostí → ${output}`);
}

module.exports = { unfold, stamp, rule, place, parse, keep, toJson };
