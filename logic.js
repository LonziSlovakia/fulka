/* Výpočty ligy: skóre, tabuľka, kanadské bodovanie, playoff, najbližšie zápasy, dátumy.
   Iba čisté funkcie nad riadkami z databázy (nič nečítajú ani nezapisujú), takže sa dajú
   testovať v Node (tests/logic.test.js) a rovnako ich používa web aj admin.
   Nič z toho sa neukladá do databázy – všetko sa vždy prepočíta z gólov a zápasov. */
(() => {
  "use strict";
  const TZ = "Europe/Bratislava";
  const UNKNOWN = "?"; // v admine: strelec vybraný ako „Neznámy hráč“ (v databáze null)
  const STAGES = ["SF1", "SF2", "B3", "F"];
  const DEFAULTS = { bannerCount: 2, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };

  /* ---------- Dátumy a časy (vždy v čase Bratislavy) ---------- */
  const DAYS = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  const DAYS_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  // okamih (ISO text alebo ms) → { date: "2026-10-06", time: "20:15" } v Bratislave
  function localParts(when) {
    const p = {};
    fmt.formatToParts(new Date(when)).forEach((x) => { p[x.type] = x.value; });
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }

  // dátum a čas zadaný v Bratislave → ISO v UTC (na uloženie do starts_at); rieši aj letný čas
  function toUtc(date, time) {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const wanted = Date.UTC(y, m - 1, d, hh, mm);
    let t = wanted;
    for (let i = 0; i < 2; i++) {
      const p = localParts(t);
      const [py, pm, pd] = p.date.split("-").map(Number);
      const [ph, pmin] = p.time.split(":").map(Number);
      t += wanted - Date.UTC(py, pm - 1, pd, ph, pmin);
    }
    return new Date(t).toISOString();
  }

  function dow(date) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  const dayName = (date) => DAYS[dow(date)];
  const dShort = (date) => { const [, m, d] = date.split("-").map(Number); return `${d}.${m}.`; };
  const shortDate = (date) => { const [, m, d] = date.split("-").map(Number); return `${DAYS_SHORT[dow(date)]} ${d}. ${m}.`; };
  const slot = (iso) => { if (!iso) return ""; const p = localParts(iso); return `${shortDate(p.date)} · ${p.time}`; };
  const weekLabel = (from, to) => (from && to ? `${dShort(from)} – ${dShort(to)}` : "");
  const matchDate = (m) => (m.starts_at ? localParts(m.starts_at).date : null);
  const matchTime = (m) => (m.starts_at ? localParts(m.starts_at).time : "");

  /* ---------- Góly a skóre ---------- */
  // góly → { match_id: [góly zoradené podľa seq] }
  function goalsByMatch(goals) {
    const out = {};
    goals.forEach((g) => { (out[g.match_id] = out[g.match_id] || []).push(g); });
    Object.keys(out).forEach((id) => out[id].sort((x, y) => x.seq - y.seq));
    return out;
  }

  function score(goals) {
    const list = goals || [];
    return { h: list.filter((g) => g.side === "h").length, a: list.filter((g) => g.side === "a").length };
  }

  // odohraný zápas so známymi tímami (iba také sa počítajú do tabuľky a štatistík)
  const isPlayed = (m) => m.status === "done" && !!m.home_id && !!m.away_id;

  // víťaz / porazený odohraného zápasu (null pri remíze alebo neodohranom)
  function winner(m, goals) {
    if (!isPlayed(m)) return null;
    const s = score(goals);
    return s.h > s.a ? m.home_id : s.a > s.h ? m.away_id : null;
  }
  function loser(m, goals) {
    const w = winner(m, goals);
    return w ? (w === m.home_id ? m.away_id : m.home_id) : null;
  }

  // priebežné skóre po každom góle; meno strelca/asistenta podľa players { id: hráč }
  function goalTimeline(goals, players) {
    let h = 0;
    let a = 0;
    const name = (id) => (id && players[id] ? players[id].name : "");
    return (goals || []).map((g) => {
      if (g.side === "h") h++; else a++;
      return { seq: g.seq, side: g.side, score: `${h}:${a}`, scorer: name(g.scorer_id) || "Neznámy hráč", assist: name(g.assist_id) };
    });
  }

  /* ---------- Tabuľka ---------- */
  // teamIds = tímy sezóny (ich poradie rozhoduje, keď je všetko ostatné rovnaké)
  function standings(teamIds, matches, gm, settings) {
    const pts = Object.assign({}, DEFAULTS, settings);
    const st = {};
    teamIds.forEach((id) => { st[id] = { id, z: 0, v: 0, r: 0, p: 0, gf: 0, ga: 0 }; });
    matches.filter((m) => m.stage === "R" && isPlayed(m) && st[m.home_id] && st[m.away_id]).forEach((m) => {
      const s = score(gm[m.id]);
      const h = st[m.home_id];
      const a = st[m.away_id];
      h.z++; a.z++;
      h.gf += s.h; h.ga += s.a; a.gf += s.a; a.ga += s.h;
      if (s.h > s.a) { h.v++; a.p++; } else if (s.h < s.a) { a.v++; h.p++; } else { h.r++; a.r++; }
    });
    return teamIds
      .map((id, i) => {
        const t = st[id];
        return Object.assign(t, { order: i, diff: t.gf - t.ga, b: t.v * pts.pointsWin + t.r * pts.pointsDraw + t.p * pts.pointsLoss });
      })
      .sort((x, y) => y.b - x.b || y.diff - x.diff || y.gf - x.gf || x.order - y.order)
      .map((t, i) => Object.assign(t, { pos: i + 1 }));
  }

  /* ---------- Kanadské bodovanie ---------- */
  // tím hráča = strana jeho posledného gólu/asistencie (nie aktuálna súpiska – vyradený hráč si body necháva)
  function scorers(matches, gm, players, table, limit) {
    const played = {};
    (table || []).forEach((t) => { played[t.id] = t.z; });
    const p = {};
    const add = (id, key, teamId) => {
      if (!id || !players[id]) return;
      if (!p[id]) p[id] = { player_id: id, name: players[id].name, team_id: teamId, g: 0, a: 0 };
      p[id][key]++;
      p[id].team_id = teamId;
    };
    matches.filter(isPlayed).forEach((m) => {
      (gm[m.id] || []).forEach((g) => {
        const teamId = g.side === "h" ? m.home_id : m.away_id;
        add(g.scorer_id, "g", teamId);
        add(g.assist_id, "a", teamId);
      });
    });
    return Object.values(p)
      .map((x) => Object.assign(x, { b: x.g + x.a, z: played[x.team_id] || 0 }))
      .sort((x, y) => y.b - x.b || y.g - x.g || x.name.localeCompare(y.name, "sk"))
      .slice(0, limit || 10)
      .map((x, i) => Object.assign(x, { pos: i + 1 }));
  }

  /* ---------- Playoff ---------- */
  const byStage = (matches, stage) => matches.find((m) => m.stage === stage) || null;
  const regularDone = (matches) => matches.filter((m) => m.stage === "R").every((m) => m.status === "done");

  /* Doplní tímy do playoff zápasov. Vráti { SF1, SF2, B3, F }, každý = kópia zápasu s home_id/away_id
     a seedH/seedA (1–4 = miesto v tabuľke, kým tímy ešte nie sú isté).
     auto: SF1 = 1. vs 4., SF2 = 2. vs 3. z tabuľky (tímy sú isté, až keď je odohraná celá základná časť);
     manual: tímy SF sú uložené v zápase. B3 = porazení SF, F = víťazi SF. */
  function playoff(season, matches, gm, table) {
    const auto = season.seed_mode !== "manual";
    const fixed = regularDone(matches);
    const at = (pos) => (table[pos - 1] ? table[pos - 1].id : null);
    const out = {};
    [["SF1", 1, 4], ["SF2", 2, 3]].forEach(([stage, sh, sa]) => {
      const m = byStage(matches, stage);
      if (!m) return;
      const teams = auto ? { home_id: at(sh), away_id: at(sa) } : { home_id: m.home_id, away_id: m.away_id };
      out[stage] = Object.assign({}, m, teams, { seedH: auto ? sh : null, seedA: auto ? sa : null, fixed: auto ? fixed : !!(m.home_id && m.away_id) });
    });
    const sf = (stage, fn) => (out[stage] && out[stage].fixed ? fn(out[stage], gm[out[stage].id]) : null);
    [["B3", loser], ["F", winner]].forEach(([stage, fn]) => {
      const m = byStage(matches, stage);
      if (!m) return;
      const home = sf("SF1", fn);
      const away = sf("SF2", fn);
      out[stage] = Object.assign({}, m, { home_id: home, away_id: away, seedH: null, seedA: null, fixed: !!(home && away) });
    });
    return out;
  }

  // zápasy sezóny s doplnenými tímami playoff (základná časť ostáva, ako je)
  function resolveMatches(season, matches, gm, table) {
    const po = playoff(season, matches, gm, table);
    return matches.map((m) => (m.stage !== "R" && po[m.stage] ? po[m.stage] : m));
  }

  // šampión = víťaz odohraného finále (null, kým nie je)
  function champion(resolved, gm) {
    const f = byStage(resolved, "F");
    return f ? winner(f, gm[f.id]) : null;
  }

  // konečné poradie 1–4 z finále a zápasu o 3. miesto (iba známe miesta)
  function places(resolved, gm) {
    const f = byStage(resolved, "F");
    const b3 = byStage(resolved, "B3");
    const list = [
      [1, f && winner(f, gm[f.id])],
      [2, f && loser(f, gm[f.id])],
      [3, b3 && winner(b3, gm[b3.id])],
      [4, b3 && loser(b3, gm[b3.id])],
    ];
    return list.filter((x) => x[1]).map(([pos, id]) => ({ pos, id }));
  }

  /* ---------- Rozpis ---------- */
  // kolá základnej časti: [{ round, matches, date }] – date = deň kola (z presného termínu, inak začiatok týždňa)
  function rounds(matches) {
    const reg = matches.filter((m) => m.stage === "R");
    const ks = Array.from(new Set(reg.map((m) => m.round))).sort((a, b) => a - b);
    return ks.map((k) => {
      const ms = reg.filter((m) => m.round === k).sort(byTime);
      const ref = ms.find((m) => m.starts_at && !m.moved) || ms.find((m) => m.starts_at);
      return { round: k, matches: ms, date: ref ? matchDate(ref) : ms[0].window_from || null, exact: !!ref };
    });
  }

  // zoradenie podľa termínu; bez termínu podľa týždňa, potom podľa id
  function sortKey(m) {
    if (m.starts_at) return new Date(m.starts_at).toISOString();
    return m.window_from ? `${m.window_from}T99` : "9999";
  }
  function byTime(x, y) { return sortKey(x).localeCompare(sortKey(y)) || x.id.localeCompare(y.id); }

  /* ---------- Najbližšie zápasy (banner) ----------
     Neodohrané zápasy so známymi tímami: s presným termínom vždy (zápas ostane na banneri,
     kým ho admin neoznačí ako odohraný), bez termínu iba ak ich týždeň ešte neskončil.
     Zoradené podľa času, prvých `count`. */
  function nextMatches(resolved, count, now) {
    const today = localParts(now === undefined ? Date.now() : now).date;
    return resolved
      .filter((m) => m.status !== "done" && m.home_id && m.away_id)
      .filter((m) => !!m.starts_at || (!!m.window_to && m.window_to >= today))
      .sort(byTime)
      .slice(0, Math.max(1, Math.min(4, Number(count) || DEFAULTS.bannerCount)));
  }

  // stav zápasu v rozpise: done / tbd (bez termínu) / moved / next / plan
  function matchState(m, nextId) {
    if (m.status === "done") return "done";
    if (!m.starts_at) return "tbd";
    if (m.moved) return "moved";
    if (m.id === nextId) return "next";
    return "plan";
  }

  /* ---------- Kontrola zápasu pred uložením (hlášky z návrhu adminu) ----------
     d = { stage, home_id, away_id, tbd, date, status, goals: [{ side, scorer }] },
     scorer = id hráča, UNKNOWN ("?") pre „Neznámy hráč“, prázdne = nevybraný.
     Pri playoff „podľa tabuľky“ sa do d dávajú už doplnené tímy. Vráti text chyby alebo "". */
  function validateMatch(d, seedMode) {
    const needTeams = d.stage === "R" || (seedMode === "manual" && (d.stage === "SF1" || d.stage === "SF2"));
    const both = !!d.home_id && !!d.away_id;
    if (needTeams && !both) return "Vyber oba tímy.";
    if (both && d.home_id === d.away_id) return "Tím nemôže hrať sám so sebou — vyber dva rôzne tímy.";
    if (!d.tbd && !d.date) return "Vyber dátum v kalendári alebo prepni na „Termín neznámy“.";
    if (d.status === "done" && d.tbd) return "Odohraný zápas potrebuje dátum — prepni na „Presný termín“.";
    if (d.status === "done" && !both) return "Výsledok sa dá zapísať, až keď sú známe oba tímy.";
    const goals = d.goals || [];
    const missing = goals.findIndex((g) => !g.scorer);
    if (d.status === "done" && missing >= 0) return `Pri góle č. ${missing + 1} chýba strelec (môžeš dať aj „Neznámy hráč“).`;
    const s = score(goals);
    if (d.status === "done" && d.stage !== "R" && s.h === s.a) return "V playoff musí byť víťaz — výsledok nemôže byť remíza.";
    return "";
  }

  /* ---------- Drobnosti ---------- */
  const initials = (name) => name.split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const settingsOf = (data) => Object.assign({}, DEFAULTS, data || {});

  const Logic = {
    TZ, UNKNOWN, STAGES, DEFAULTS,
    localParts, toUtc, dayName, dShort, shortDate, slot, weekLabel, matchDate, matchTime,
    goalsByMatch, score, isPlayed, winner, loser, goalTimeline,
    standings, scorers,
    playoff, resolveMatches, champion, places, regularDone,
    rounds, byTime, nextMatches, matchState,
    validateMatch, initials, settingsOf,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  else window.Logic = Logic;
})();
