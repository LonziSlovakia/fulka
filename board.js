/* Výsledková tabuľa zápasu: čisté funkcie (stav → nový stav) + uloženie do localStorage.
   Stav je jeden objekt `s`; každá zmena vráti NOVÝ objekt (nič sa nemení na mieste) a čas `now` (ms) dostane ako parameter,
   takže sa to dá testovať bez hodín. Ovládací panel (board-admin.js) a druhá obrazovka (tabula.html) čítajú ten istý stav
   z localStorage – tak sa medzi oknami v jednom prehliadači prenáša skóre, čas aj tresty.

   Čas sa neodpočítava po sekundách, ale z časovej značky: clock = { ms zostáva v čase `at`, running }.
   Zostávajúci čas = ms − (now − at), keď beží. Preto je tabuľa presná aj po obnovení stránky a obe okná ukazujú to isté. */
(() => {
  "use strict";
  const KEY = "fulka-board-v1";
  const PING_KEY = "fulka-board-ping";
  const PART_WORD = { 2: "polčas", 3: "tretina", 4: "štvrtina" };
  const PART_NAME = { 1: "1 časť", 2: "2 polčasy", 3: "3 tretiny", 4: "4 štvrtiny" };
  const MAX_PENS = 2; // naraz aktívne tresty jedného tímu
  const MAX_CLOCK = 99 * 60000;
  const UNKNOWN = "?"; // strelec „Neznámy hráč“ (rovnako ako v logic.js)

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // názov časti: „2. tretina“; pri jednej časti nič
  const partLabel = (cfg, part) => (cfg.parts === 1 ? "" : `${part}. ${PART_WORD[cfg.parts]}`);
  const partMs = (cfg) => cfg.minutes * 60000;
  // 222000 → „3:42“ (zaokrúhľuje nahor, takže 0:00 je naozaj koniec)
  function fmt(ms) {
    const t = Math.ceil(Math.max(0, ms) / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  }
  // minúty + sekundy z formulára → ms (alebo null, keď je to nula / nezmysel)
  function penaltyMs(min, sec) {
    const m = Math.floor(Number(min) || 0);
    const s = Math.floor(Number(sec) || 0);
    const t = m * 60 + s;
    return t > 0 && t <= 3599 && m >= 0 && s >= 0 ? t * 1000 : null;
  }

  /* ---------- Vytvorenie ---------- */
  // info = { matchId, seasonId, title, home, away } (tím = { id, name, abbr, c, d, ink, logo }), cfg = { parts, minutes }
  function create(info, cfg, opts) {
    const c = { parts: clamp(Math.round(cfg.parts) || 2, 1, 4), minutes: clamp(Math.round(cfg.minutes) || 15, 1, 60) };
    return {
      v: 1, rev: 0, next: 1, matchId: info.matchId, seasonId: info.seasonId, title: info.title || "",
      home: info.home, away: info.away, cfg: c, part: 1,
      clock: { ms: partMs(c), running: false, at: 0 },
      goals: [], pens: { h: [], a: [] }, ended: false, saved: false,
      scale: 100, twoScreens: !!(opts && opts.twoScreens), flip: false, back: null,
    };
  }

  /* ---------- Farby: čitateľný text na tímovej farbe ---------- */
  // relatívna svetlosť farby (WCAG) a kontrast dvoch farieb (1–21)
  function luminance(hex) {
    const h = String(hex || "").replace("#", "");
    const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    if (!/^[0-9a-f]{6}/i.test(full)) return 0.2;
    const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // text na tímovej farbe: čierna alebo biela podľa toho, čo má väčší kontrast (projektory majú slabý obraz, preto nie „ink“ z databázy)
  const contrastInk = (bg) => (contrast("#000000", bg) >= contrast("#FFFFFF", bg) ? "#000000" : "#FFFFFF");

  /* ---------- Čas ---------- */
  const elapsed = (s, now) => (s.clock.running ? Math.max(0, now - s.clock.at) : 0);

  // „zafixuje“ stav v čase now: odpočítaný čas aj tresty sa zapíšu do ms, `at` = now.
  // Tresty sa odpočítavajú iba kým beží hlavný čas; hotové tresty zmiznú.
  function snap(s, now) {
    const n = clone(s);
    const e = elapsed(s, now);
    const used = Math.min(e, s.clock.ms);
    n.clock.ms = Math.max(0, s.clock.ms - e);
    n.clock.at = now;
    if (n.clock.ms <= 0) n.clock.running = false;
    ["h", "a"].forEach((k) => { n.pens[k] = n.pens[k].map((p) => Object.assign(p, { ms: p.ms - used })).filter((p) => p.ms > 0); });
    return n;
  }

  // to, čo sa ukazuje v čase now (nič sa nemení): čas, tresty, skóre
  function view(s, now) {
    const e = elapsed(s, now);
    const used = Math.min(e, s.clock.ms);
    const ms = Math.max(0, s.clock.ms - e);
    const pens = {};
    ["h", "a"].forEach((k) => { pens[k] = s.pens[k].map((p) => Object.assign({}, p, { ms: p.ms - used })).filter((p) => p.ms > 0); });
    return { ms, running: s.clock.running && ms > 0, pens, score: score(s), label: partLabel(s.cfg, s.part) };
  }

  // beží a čas už vypršal → vráti zastavený stav (inak null = netreba nič ukladať)
  function settle(s, now) {
    if (!s.clock.running || elapsed(s, now) < s.clock.ms) return null;
    return snap(s, now);
  }

  function start(s, now) {
    if (s.ended || s.clock.running || s.clock.ms <= 0) return s;
    const n = snap(s, now);
    n.clock.running = true;
    return n;
  }
  function pause(s, now) {
    const n = snap(s, now);
    n.clock.running = false;
    return n;
  }
  // posun času (korekcia časomerača): delta v ms, môže byť záporná
  // withPens = posunie sa aj každý aktívny trest o to isté (trest, ktorý by klesol na nulu, zmizne)
  function adjust(s, delta, now, withPens) {
    const n = snap(s, now);
    n.clock.ms = clamp(n.clock.ms + delta, 0, MAX_CLOCK);
    if (n.clock.ms <= 0) n.clock.running = false;
    if (withPens) ["h", "a"].forEach((k) => { n.pens[k] = n.pens[k].map((p) => Object.assign(p, { ms: Math.min(3599000, p.ms + delta) })).filter((p) => p.ms > 0); });
    return n;
  }
  const hasNextPart = (s) => s.part < s.cfg.parts;
  const hasPrevPart = (s) => s.part > 1 && !s.ended;
  // ďalšia časť: čas sa nastaví na celú časť, stojí; tresty ostávajú. Zapamätá si, kde sa skončilo, aby sa dalo vrátiť
  function nextPart(s, now) {
    if (!hasNextPart(s) || s.ended) return s;
    const n = snap(s, now);
    n.back = { part: n.part, ms: n.clock.ms };
    n.part += 1;
    n.clock = { ms: partMs(n.cfg), running: false, at: now };
    return n;
  }
  // späť o časť (keď sa omylom klikne na „Ďalšia časť“): čas predchádzajúcej časti sa vráti tam, kde bol (inak 0:00)
  function prevPart(s, now) {
    if (!hasPrevPart(s)) return s;
    const n = snap(s, now);
    n.part -= 1;
    n.clock = { ms: n.back && n.back.part === n.part ? n.back.ms : 0, running: false, at: now };
    n.back = null;
    return n;
  }
  // čas aktuálnej časti od začiatku (skóre a tresty ostanú)
  function resetClock(s, now) {
    const n = snap(s, now);
    n.clock = { ms: partMs(n.cfg), running: false, at: now };
    return n;
  }
  // všetko na nulu: 1. časť, celý čas, 0:0, bez trestov; tímy, nastavenie, veľkosť a strany ostanú
  function resetAll(s, now) {
    const n = create({ matchId: s.matchId, seasonId: s.seasonId, title: s.title, home: s.home, away: s.away }, s.cfg, { twoScreens: s.twoScreens });
    n.rev = s.rev; n.scale = s.scale; n.flip = !!s.flip; n.clock.at = now;
    return n;
  }
  const swapSides = (s) => Object.assign(clone(s), { flip: !s.flip });

  /* ---------- Tresty ---------- */
  const activePens = (s, side, now) => view(s, now).pens[side];
  const canPenalty = (s, side, now) => !s.ended && activePens(s, side, now).length < MAX_PENS;
  // player = { id, name, number } (alebo null = bez mena)
  function addPenalty(s, side, ms, player, now) {
    if (!canPenalty(s, side, now) || !(ms > 0)) return s;
    const n = snap(s, now);
    const p = player || {};
    n.pens[side].push({ id: n.next++, ms, player: p.id || "", name: p.name || "", number: p.number == null ? "" : String(p.number) });
    return n;
  }
  function removePenalty(s, side, id, now) {
    const n = snap(s, now);
    n.pens[side] = n.pens[side].filter((p) => p.id !== id);
    return n;
  }

  /* ---------- Góly ---------- */
  const score = (s) => ({ h: s.goals.filter((g) => g.side === "h").length, a: s.goals.filter((g) => g.side === "a").length });
  function addGoal(s, side, scorer) {
    if (s.ended) return s;
    const n = clone(s);
    n.goals.push({ side, scorer: scorer || UNKNOWN, assist: "" });
    return n;
  }
  function setAssist(s, i, assist) {
    if (!s.goals[i]) return s;
    const n = clone(s);
    n.goals[i].assist = assist || "";
    return n;
  }
  function removeGoal(s, i) {
    if (s.ended || !s.goals[i]) return s;
    const n = clone(s);
    n.goals.splice(i, 1);
    return n;
  }

  /* ---------- Koniec a ostatné ---------- */
  function end(s, now) {
    const n = snap(s, now);
    n.clock.running = false;
    n.ended = true;
    return n;
  }
  const reopen = (s) => Object.assign(clone(s), { ended: false, saved: false });
  const markSaved = (s) => Object.assign(clone(s), { saved: true });
  const setScale = (s, pct) => Object.assign(clone(s), { scale: clamp(Math.round(pct) || 100, 50, 150) });
  const setTwoScreens = (s, on) => Object.assign(clone(s), { twoScreens: !!on });

  /* ---------- Uloženie a prenos medzi oknami (localStorage) ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  }
  // uloží nový stav (zvýši rev, aby sa dali odlíšiť zmeny); druhé okno ho dostane cez udalosť `storage`
  function save(s) {
    const n = Object.assign({}, s, { rev: (s.rev || 0) + 1 });
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* plné / zablokované úložisko: stav ostane aspoň v okne */ }
    return n;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* nič */ } }
  // fn(stav alebo null) sa zavolá pri každej zmene v inom okne; vráti funkciu na odhlásenie
  function subscribe(fn) {
    const on = (e) => { if (e.key === KEY || e.key === null) fn(load()); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }
  // druhá obrazovka si každé 2 s zapíše čas, admin podľa toho ukáže „pripojená“
  function ping() { try { localStorage.setItem(PING_KEY, String(Date.now())); } catch (e) { /* nič */ } }
  function pingAge() {
    try { const t = Number(localStorage.getItem(PING_KEY)); return t ? Date.now() - t : Infinity; } catch (e) { return Infinity; }
  }
  function onPing(fn) {
    const on = (e) => { if (e.key === PING_KEY) fn(); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }

  const Board = {
    MAX_PENS, PART_NAME, UNKNOWN, partLabel, partMs, fmt, penaltyMs,
    create, view, snap, settle, start, pause, adjust, nextPart, prevPart, hasNextPart, hasPrevPart, resetClock, resetAll, swapSides, contrastInk, contrast,
    activePens, canPenalty, addPenalty, removePenalty,
    score, addGoal, setAssist, removeGoal, end, reopen, markSaved, setScale, setTwoScreens,
    load, save, clear, subscribe, ping, pingAge, onPing,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Board;
  else window.Board = Board;
})();
