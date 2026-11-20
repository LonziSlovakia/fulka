/* Admin → záložka „Tabuľa“: ovládanie výsledkovej tabule zápasu (výber zápasu, časti a minúty, čas, góly, tresty, koniec).
   Stav tabule žije v board.js (localStorage); druhá obrazovka tabula.html ho iba číta. Góly sa držia v pamäti prehliadača
   a do databázy idú až na konci zápasu (tlačidlo „Ukončiť zápas“) – databáza nemá „rozohraný zápas“, takže polovičné
   výsledky by sa na webe ukázali ako hotové a pri výpadku internetu by sa stratili.
   Panel sa prekresľuje iba po akciách; čas a tresty sa v behu prepisujú po 0,2 s (nemení sa DOM, takže nezmizne otvorený výber). */
(() => {
  "use strict";
  const B = window.Board;
  const V = window.BoardView;
  const L = window.Logic;
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const STAGE = { SF1: "Semifinále 1", SF2: "Semifinále 2", B3: "O 3. miesto", F: "Finále" };
  const MINUTES = [10, 12, 15, 20];
  const PEN_PRESETS = [[2, 0], [5, 0], [10, 0]];
  const ADJUST = [["−1:00", -60000], ["−0:10", -10000], ["+0:10", 10000], ["+1:00", 60000]];
  const pressed = (on) => `aria-pressed="${on ? "true" : "false"}"`;
  const now = () => Date.now();
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const PLAY = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"></path></svg>';
  const PAUSE = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"></path></svg>';

  // U = čo je práve vybrané v paneli (nie je to stav tabule); cur = stav tabule z localStorage (null = ešte nie je pripravená)
  const U = { pick: null, teams: { h: null, a: null }, parts: 2, minutes: 20, two: false, open: null, penOpen: null, pen: { min: 2, sec: 0, player: "" }, adjPens: false, err: "" };
  let cur = B.load();
  let A = null; // API z admin.js (dáta, zoznam zápasov, ukladanie)
  let timer = 0;
  let bound = null;
  if (cur) { U.two = cur.twoScreens; }

  /* ---------- Pomocné ---------- */
  const link = () => new URL("tabula.html", location.href).href;
  const nameOf = (c, id) => (id === B.UNKNOWN ? "Neznámy hráč" : (c.P[id] || {}).name || "?");
  const sideOf = (s, side) => (side === "h" ? s.home : s.away);
  const penSig = (s, t) => { const v = B.view(s, t); return `${v.pens.h.map((p) => p.id)}|${v.pens.a.map((p) => p.id)}`; };
  // hráči tímu na súpiske sezóny (podľa mena)
  function rosterOf(c, s, side) {
    return c.d.roster.filter((r) => r.season_id === s.seasonId && r.team_id === sideOf(s, side).id)
      .map((r) => ({ id: r.player_id, name: (c.P[r.player_id] || {}).name || "?", number: r.number }))
      .sort((x, y) => x.name.localeCompare(y.name, "sk"));
  }
  const labelOf = (p) => `${p.number ? `#${p.number} ` : ""}${p.name}`;
  const teamOf = (c, id) => { const t = c.T[id]; return { id: t.id, name: t.name, abbr: t.abbr, c: t.c, d: t.d, ink: t.ink, logo: t.svg, anim: t.gif }; };
  const vars = (t) => `--c:${esc(t.c)};--d:${esc(t.d)};--ink:${B.contrastInk(t.c)}`;

  function commit(s) { cur = B.save(s); redraw(); }
  function redraw() {
    const h = document.getElementById("bd-host");
    if (!h) return;
    h.innerHTML = inner();
    h._sig = cur ? penSig(cur, now()) : "";
    mountView();
  }
  function mountView() {
    const el = document.getElementById("bd-sb");
    if (el) V.render(el, cur, now());
  }

  /* ---------- Výber zápasu a nastavenie ---------- */
  function pickable(c) {
    const open = (m) => m.status !== "done"; // aj finále / o 3. miesto, kým nie sú známe tímy – tie sa vyberú nižšie
    const rounds = L.rounds(c.raw).map((r) => ({ title: `Kolo ${r.round}`, sub: r.date ? (r.exact ? L.shortDate(r.date) : `týždeň ${L.dShort(r.date)}`) : "", list: r.matches.filter(open) }));
    const po = ["SF1", "SF2", "B3", "F"].map((st) => c.raw.find((m) => m.stage === st)).filter((m) => m && open(m));
    return rounds.concat([{ title: "Playoff", sub: "", list: po }]).filter((g) => g.list.length);
  }

  function matchPicker(c) {
    const groups = pickable(c);
    if (!groups.length) return `<p class="a-empty">V tejto sezóne nie je žiadny neodohraný zápas. Pridaj ho v záložke Zápasy.</p>`;
    return `<div class="a-bd-list">${groups.map((g) => `<div class="a-gtitle"><span>${g.title}</span><span>${g.sub}</span></div>${g.list.map((m) => A.listRow(m, c, "pick", U.pick)).join("")}`).join("")}</div>`;
  }

  // tímy vybraného zápasu: známe sú pevné, neznáme (finále, o 3. miesto…) sa vyberú tu
  const knownTeams = (c, id) => { const m = c.raw.find((x) => x.id === id); return m ? A.teamsFor(m, c) : [null, null]; };
  const chosen = (c) => { const k = knownTeams(c, U.pick); return { h: k[0] || U.teams.h, a: k[1] || U.teams.a }; };
  function teamsPicker(c) {
    const k = knownTeams(c, U.pick);
    const t = chosen(c);
    const side = (key, i, label) => {
      const chips = c.teamIds.map((id) => {
        const T = c.T[id];
        const other = t[key === "h" ? "a" : "h"] === id;
        return `<button type="button" class="a-tp${!t[key] || t[key] === id ? "" : " dim"}" data-b="tpick" data-side="${key}" data-id="${esc(id)}" ${pressed(t[key] === id)}${k[i] || other ? " disabled" : ""}><img src="${esc(T.svg)}" alt="">${esc(T.name)}</button>`;
      }).join("");
      return `<div class="a-bd-tside"><span class="lbl">${label}${k[i] ? " (určený)" : ""}</span><div class="a-bd-tchips">${chips}</div></div>`;
    };
    return `<fieldset class="a-fs"><legend>Tímy zápasu</legend>${side("h", 0, "Domáci")}${side("a", 1, "Hostia")}
      <span class="muted">Tímy tohto zápasu ešte nie sú v databáze určené. Vyber ich tu – výsledok sa do databázy uloží až keď budú známe aj tam (finále a zápas o 3. miesto sa dopĺňajú z výsledkov semifinále).</span></fieldset>`;
  }

  function partsPicker() {
    const seg = [1, 2, 3, 4].map((n) => `<button type="button" data-b="parts" data-id="${n}" ${pressed(U.parts === n)}>${B.PART_NAME[n]}</button>`).join("");
    const chips = MINUTES.map((m) => `<button type="button" data-b="minset" data-id="${m}" ${pressed(U.minutes === m)}>${m}</button>`).join("");
    const word = U.parts === 1 ? "jedna časť bez prestávky" : `${U.parts} × ${U.minutes} min`;
    return `<div class="a-seg" role="group" aria-label="Počet častí">${seg}</div>
      <div class="a-bd-mins"><span class="lbl">Minút v jednej časti</span>
        <button type="button" class="a-bd-step" data-b="mins" data-d="-1" aria-label="O minútu menej">−</button>
        <input type="number" class="a-input big" data-bi="mins" min="1" max="60" value="${U.minutes}" aria-label="Minút v jednej časti">
        <button type="button" class="a-bd-step" data-b="mins" data-d="1" aria-label="O minútu viac">+</button>
        <span class="a-chips-row" role="group" aria-label="Rýchla voľba">${chips}</span></div>
      <span class="muted">Hrací čas: <b>${word}</b>${U.parts > 1 ? ` (spolu ${U.parts * U.minutes} min)` : ""}. Čas sa odpočítava, tresty bežia iba kým beží čas.</span>`;
  }

  function screensPicker(two) {
    return `<div class="a-seg" role="group" aria-label="Počet obrazoviek">
      <button type="button" data-b="screens" data-id="1" ${pressed(!two)}>Jedna obrazovka</button>
      <button type="button" data-b="screens" data-id="2" ${pressed(two)}>Dve obrazovky</button></div>`;
  }

  function setupView(c) {
    const picked = pickable(c).some((g) => g.list.some((m) => m.id === U.pick));
    const t = picked ? chosen(c) : { h: null, a: null };
    const needTeams = picked && knownTeams(c, U.pick).some((x) => !x);
    const ok = picked && !!t.h && !!t.a;
    return `<div class="a-ed-head"><span class="tt"><span class="lbl">Výsledková tabuľa</span><b>Nový zápas na tabuli</b></span></div>
      ${A.msgs()}${U.err ? `<div class="a-error" role="alert">${A.icon.err}${esc(U.err)}</div>` : ""}
      <div class="a-body">
        <fieldset class="a-fs"><legend>1 · Ktorý zápas</legend>${matchPicker(c)}</fieldset>
        ${needTeams ? teamsPicker(c) : ""}
        <fieldset class="a-fs"><legend>2 · Časti a čas</legend>${partsPicker()}</fieldset>
        <fieldset class="a-fs"><legend>3 · Obrazovky</legend>${screensPicker(U.two)}
          <span class="muted">${U.two ? "Tabuľu uvidíš v novom okne, ktoré presunieš na druhú obrazovku (Win + P → Rozšíriť). Tu ostanú iba ovládacie prvky." : "Tabuľa aj ovládanie sú na tejto jednej obrazovke."}</span></fieldset>
        <div class="a-actions"><button type="button" class="a-save" data-b="prepare"${ok ? "" : " disabled"}>Pripraviť tabuľu</button>
          ${ok ? "" : `<span class="muted">${picked ? "Vyber oba tímy." : "Najprv vyber zápas."}</span>`}</div></div>`;
  }

  /* ---------- Ovládanie zápasu ---------- */
  function goalPicker(c, side) {
    const list = rosterOf(c, cur, side).map((p) => `<button type="button" data-b="scorer" data-side="${side}" data-id="${esc(p.id)}">${esc(labelOf(p))}</button>`).join("");
    return `<div class="a-bd-pick" role="group" aria-label="Kto dal gól">${list}
      <button type="button" class="spec" data-b="scorer" data-side="${side}" data-id="${B.UNKNOWN}">Neznámy hráč</button>
      <button type="button" class="no" data-b="goalclose">Zrušiť</button></div>`;
  }

  function goalLog(c, side) {
    const rows = cur.goals.map((g, i) => ({ g, i })).filter((x) => x.g.side === side).map(({ g, i }) => {
      const opts = rosterOf(c, cur, side).filter((p) => p.id !== g.scorer)
        .map((p) => `<option value="${esc(p.id)}"${g.assist === p.id ? " selected" : ""}>${esc(labelOf(p))}</option>`).join("");
      return `<li><span class="n">${i + 1}.</span><b>${esc(nameOf(c, g.scorer))}</b>
        <select class="a-input" data-bi="assist" data-i="${i}" aria-label="Asistencia k gólu ${i + 1}"><option value="">asistencia</option>${opts}</select>
        <button type="button" class="a-bd-x" data-b="goalrm" data-i="${i}" aria-label="Zrušiť gól ${i + 1}">${A.icon.x}</button></li>`;
    }).join("");
    return rows ? `<ol class="a-bd-goals" aria-label="Góly">${rows}</ol>` : "";
  }

  function penForm(c, side) {
    const chips = PEN_PRESETS.map(([m, s]) => `<button type="button" data-b="penpreset" data-min="${m}" data-sec="${s}" ${pressed(U.pen.min === m && U.pen.sec === s)}>${m}:${String(s).padStart(2, "0")}</button>`).join("");
    const players = rosterOf(c, cur, side).map((p) => `<option value="${esc(p.id)}"${U.pen.player === p.id ? " selected" : ""}>${esc(labelOf(p))}</option>`).join("");
    return `<div class="a-bd-penform"><div class="a-chips-row" role="group" aria-label="Dĺžka trestu">${chips}</div>
      <div class="a-bd-time"><label class="a-field lbl">Minút<input type="number" class="a-input" data-bi="penmin" min="0" max="59" value="${U.pen.min}"></label>
        <label class="a-field lbl">Sekúnd<input type="number" class="a-input" data-bi="pensec" min="0" max="59" value="${U.pen.sec}"></label></div>
      <label class="a-field lbl">Hráč<select class="a-input" data-bi="penplayer"><option value="">— bez mena —</option>${players}</select></label>
      <div class="a-actions"><button type="button" class="a-new" data-b="penadd">Pridať trest</button><button type="button" class="a-ghost" data-b="pencancel">Zrušiť</button></div></div>`;
  }

  function penalties(c, side) {
    const v = B.view(cur, now());
    const rows = v.pens[side].map((p) => `<li><span>${esc([p.number ? `#${p.number}` : "", V.shortPlayer(p.name)].filter(Boolean).join(" ") || "Trest")}</span><b data-pen="${p.id}">${B.fmt(p.ms)}</b>
      <button type="button" class="a-bd-x" data-b="penrm" data-side="${side}" data-id="${p.id}" aria-label="Zrušiť trest">${A.icon.x}</button></li>`).join("");
    const full = v.pens[side].length >= B.MAX_PENS;
    const add = full ? `<span class="muted">Najviac ${B.MAX_PENS} tresty naraz.</span>` : U.penOpen === side ? "" : `<button type="button" class="a-ghost w" data-b="penopen" data-side="${side}">${A.icon.plus}Trest</button>`;
    return `<div class="a-bd-pens"><span class="lbl">Tresty</span>${rows ? `<ul>${rows}</ul>` : ""}${add}${U.penOpen === side && !full ? penForm(c, side) : ""}</div>`;
  }

  function teamCol(c, side) {
    const t = sideOf(cur, side);
    const sc = B.score(cur)[side];
    return `<section class="a-bd-team" style="${vars(t)}" aria-label="${esc(t.name)}">
      <div class="a-bd-tname"><i class="sh" aria-hidden="true"></i><img src="${esc(t.logo)}" alt=""><b>${esc(t.name)}</b><span class="sc">${sc}</span></div>
      <button type="button" class="a-bd-goal" data-b="goal" data-side="${side}" aria-expanded="${U.open === side}">${A.icon.plus}Gól</button>
      ${U.open === side ? goalPicker(c, side) : ""}${goalLog(c, side)}${penalties(c, side)}</section>`;
  }

  function centerCol() {
    const v = B.view(cur, now());
    const over = v.ms <= 0;
    const go = v.running ? `<button type="button" class="a-bd-go" data-b="toggle">${PAUSE}Pauza</button>`
      : `<button type="button" class="a-bd-go" data-b="toggle"${over ? " disabled" : ""}>${PLAY}${over ? "Čas vypršal" : "Štart"}</button>`;
    const adj = ADJUST.map(([l, d]) => `<button type="button" data-b="adj" data-d="${d}">${l}</button>`).join("");
    const next = B.hasNextPart(cur) ? `<button type="button" class="${over ? "a-new" : "a-ghost w"}" data-b="next">Ďalšia časť · ${esc(B.partLabel(cur.cfg, cur.part + 1))}</button>` : "";
    const prev = B.hasPrevPart(cur) ? `<button type="button" class="a-ghost" data-b="prev">← ${esc(B.partLabel(cur.cfg, cur.part - 1))}</button>` : "";
    return `<section class="a-bd-center" aria-label="Čas">
      <div class="a-bd-clock"><b data-clock>${B.fmt(v.ms)}</b><span>${esc(v.label) || "&nbsp;"}</span></div>${go}
      <span class="muted" style="text-align:center;font-size:12px">Medzerník = štart / pauza</span>
      <div class="a-bd-adj" role="group" aria-label="Posun času">${adj}</div>
      <label class="a-bd-chk"><input type="checkbox" data-bi="adjpens"${U.adjPens ? " checked" : ""}> Posunúť aj tresty</label>
      ${next}
      <div class="a-bd-two">${prev}<button type="button" class="a-ghost w" data-b="swap">⇄ Vymeniť strany</button></div>
      <div class="a-bd-fix"><span class="lbl">Opravy</span><div class="a-bd-two">
        <button type="button" class="a-ghost" data-b="resetclock">Čas časti od začiatku</button><button type="button" class="a-ghost" data-b="resetall">Vynulovať zápas</button></div></div>
      <button type="button" class="a-ghost a-bd-end" data-b="end">Ukončiť zápas</button></section>`;
  }

  function endedView() {
    const sc = B.score(cur);
    const status = cur.saved ? `<span class="muted">Výsledok je uložený na webe. Na druhej obrazovke ostane KONIEC, kým tabuľu nezavrieš.</span>`
      : `<span class="muted">${A.busy() ? "Ukladám výsledok…" : "Výsledok zatiaľ nie je uložený na webe."}</span>`;
    const btns = cur.saved
      ? `<button type="button" class="a-save" data-b="close">Zavrieť tabuľu</button>`
      : `<button type="button" class="a-save" data-b="save"${A.busy() ? " disabled" : ""}>${A.busy() ? "Ukladám…" : "Uložiť výsledok na web"}</button>
         <button type="button" class="a-ghost" data-b="back"${A.busy() ? " disabled" : ""}>Späť do zápasu</button>`;
    return `<div class="a-bd-ended"><b>Koniec: ${esc(cur.home.name)} ${sc.h} : ${sc.a} ${esc(cur.away.name)}</b>${status}<div class="a-actions">${btns}</div></div>`;
  }

  function linkBox() {
    return `<fieldset class="a-fs a-bd-link"><legend>Druhá obrazovka</legend>
      <span class="muted">Otvor tabuľu v novom okne, presuň ho na druhú obrazovku a stlač <b>F</b> (celá obrazovka). Funguje iba v tomto prehliadači na tomto počítači.</span>
      <div class="a-actions"><button type="button" class="a-new" data-b="open">Otvoriť tabuľu v novom okne</button>
        <button type="button" class="a-ghost" data-b="copy">Kopírovať odkaz</button>
        <span class="a-bd-conn" data-conn></span></div><code>${esc(link())}</code></fieldset>`;
  }

  function controlView(c) {
    const t = `${cur.title ? `${esc(cur.title)} · ` : ""}${esc(cur.home.name)} – ${esc(cur.away.name)}`;
    const body = cur.ended ? endedView() : `<div class="a-bd-ctl">${teamCol(c, cur.flip ? "a" : "h")}${centerCol()}${teamCol(c, cur.flip ? "h" : "a")}</div>`;
    return `<div class="a-ed-head"><span class="tt"><span class="lbl">Výsledková tabuľa</span><b>${t}</b></span>
        <button type="button" class="a-ghost" data-b="${cur.saved ? "close" : "cancel"}"${cur.ended && !cur.saved ? " disabled" : ""}>${cur.ended ? "Zavrieť" : "Zrušiť tabuľu"}</button></div>
      ${A.msgs()}${U.err ? `<div class="a-error" role="alert">${A.icon.err}${esc(U.err)}</div>` : ""}
      <div class="a-body">
        <div class="a-bd-tools">${screensPicker(cur.twoScreens)}
          <label class="a-bd-scale">Veľkosť <input type="range" min="60" max="125" step="5" value="${cur.scale}" data-bi="scale" aria-label="Veľkosť textu na tabuli"><output>${cur.scale} %</output></label></div>
        ${cur.twoScreens ? linkBox() : ""}
        <div class="a-bd-view${cur.twoScreens ? " small" : ""}"><div id="bd-sb" role="img" aria-label="Náhľad tabule"></div></div>
        ${body}</div>`;
  }

  function inner() {
    const c = A.ctx();
    return cur ? controlView(c) : setupView(c);
  }

  /* ---------- Akcie ---------- */
  const edit = (fn) => { U.err = ""; if (cur) commit(fn(cur)); };
  const ACT = {
    pick: (el) => { U.pick = el.dataset.id; U.teams = { h: null, a: null }; U.err = ""; redraw(); },
    tpick: (el) => { U.teams[el.dataset.side] = el.dataset.id; redraw(); },
    parts: (el) => { U.parts = Number(el.dataset.id); redraw(); },
    mins: (el) => { U.minutes = clamp(U.minutes + Number(el.dataset.d), 1, 60); redraw(); },
    minset: (el) => { U.minutes = Number(el.dataset.id); redraw(); },
    screens: (el) => { U.two = el.dataset.id === "2"; if (cur) commit(B.setTwoScreens(cur, U.two)); else redraw(); },
    prepare: () => {
      const c = A.ctx();
      const m = c.raw.find((x) => x.id === U.pick);
      if (!m) return;
      const { h, a } = chosen(c);
      if (!h || !a) return;
      const stage = m.stage === "R" ? `Kolo ${m.round}` : STAGE[m.stage];
      A.clearMsg();
      commit(B.create({ matchId: m.id, seasonId: c.s.id, title: `${stage} · ${c.s.name}`, home: teamOf(c, h), away: teamOf(c, a) }, { parts: U.parts, minutes: U.minutes }, { twoScreens: U.two }));
    },
    cancel: async () => {
      const started = cur.ended || cur.goals.length || cur.part > 1 || cur.clock.ms !== B.partMs(cur.cfg);
      if (started && !(await A.ask({ title: "Zrušiť tabuľu?", text: "Skóre, čas aj tresty sa zahodia. Do databázy sa nič neuloží.", ok: "Zrušiť tabuľu", danger: true }))) return;
      closeBoard();
    },
    close: () => closeBoard(),
    toggle: () => edit((s) => (s.clock.running ? B.pause(s, now()) : B.start(s, now()))),
    adj: (el) => edit((s) => B.adjust(s, Number(el.dataset.d), now(), U.adjPens)),
    swap: () => edit((s) => B.swapSides(s)),
    prev: () => edit((s) => B.prevPart(s, now())),
    resetclock: () => edit((s) => B.resetClock(s, now())),
    resetall: async () => {
      if (!(await A.ask({ title: "Vynulovať celý zápas?", text: "Skóre, góly, tresty aj čas sa vrátia na začiatok (1. časť, celý čas). Tímy a nastavenie ostanú. Do databázy sa nič neuloží.", ok: "Vynulovať", danger: true }))) return;
      U.open = null; U.penOpen = null;
      edit((s) => B.resetAll(s, now()));
    },
    next: () => edit((s) => B.nextPart(s, now())),
    goal: (el) => { U.open = U.open === el.dataset.side ? null : el.dataset.side; U.penOpen = null; redraw(); },
    goalclose: () => { U.open = null; redraw(); },
    scorer: (el) => { U.open = null; edit((s) => B.addGoal(s, el.dataset.side, el.dataset.id, now())); },
    goalrm: (el) => edit((s) => B.removeGoal(s, Number(el.dataset.i))),
    penopen: (el) => { U.penOpen = el.dataset.side; U.open = null; redraw(); },
    pencancel: () => { U.penOpen = null; redraw(); },
    penpreset: (el) => { U.pen.min = Number(el.dataset.min); U.pen.sec = Number(el.dataset.sec); redraw(); },
    penadd: () => {
      const ms = B.penaltyMs(U.pen.min, U.pen.sec);
      if (!ms) { U.err = "Zadaj dĺžku trestu (minúty alebo sekundy)."; redraw(); return; }
      const c = A.ctx();
      const p = rosterOf(c, cur, U.penOpen).find((x) => x.id === U.pen.player);
      const side = U.penOpen;
      U.penOpen = null;
      edit((s) => B.addPenalty(s, side, ms, p || null, now()));
    },
    penrm: (el) => edit((s) => B.removePenalty(s, el.dataset.side, Number(el.dataset.id), now())),
    end: async () => {
      const err = A.checkBoard(cur);
      if (err) { U.err = err; redraw(); return; }
      const sc = B.score(cur);
      const ok = await A.ask({ title: "Ukončiť zápas?", text: `${cur.home.name} ${sc.h} : ${sc.a} ${cur.away.name}. Zápas sa označí ako odohraný a výsledok aj góly sa uložia na web.`, ok: "Ukončiť a uložiť" });
      if (!ok) return;
      U.err = "";
      cur = B.save(B.end(cur, now()));
      saveResult();
    },
    save: () => saveResult(),
    back: () => edit((s) => B.reopen(s)),
    open: () => { window.open(link(), "fulka-tabula", "popup,width=1280,height=720"); },
    copy: async () => {
      try { await navigator.clipboard.writeText(link()); A.clearMsg(); U.err = ""; flash("Odkaz je skopírovaný."); } catch (e) { window.prompt("Skopíruj odkaz:", link()); }
    },
  };

  function flash(text) {
    const el = document.querySelector("#bd-host [data-conn]");
    if (el) { el.textContent = text; setTimeout(updateConn, 2500); }
  }
  function closeBoard() { B.clear(); cur = null; U.pick = null; U.open = null; U.penOpen = null; U.err = ""; A.clearMsg(); redraw(); }
  // výsledok do databázy (A.saveFromBoard spustí zápis, po úspechu označí tabuľu ako uloženú)
  function saveResult() {
    const err = A.saveFromBoard(cur, () => { cur = B.save(B.markSaved(cur)); });
    if (err) { U.err = err; redraw(); }
  }

  /* ---------- Udalosti (raz na celý admin) ---------- */
  function bind(app) {
    if (bound === app) return;
    bound = app;
    app.addEventListener("click", (e) => {
      const el = e.target.closest("[data-b]");
      if (!el || !app.contains(el) || el.disabled) return;
      e.preventDefault();
      const fn = ACT[el.dataset.b];
      if (fn) fn(el);
    });
    app.addEventListener("input", (e) => {
      const k = e.target.dataset && e.target.dataset.bi;
      if (k === "penmin") U.pen.min = Number(e.target.value);
      if (k === "pensec") U.pen.sec = Number(e.target.value);
      if (k === "scale" && cur) { // iba náhľad a číslo, panel sa neprekresľuje (ťahanie posuvníka by sa prerušilo)
        cur = B.save(B.setScale(cur, Number(e.target.value)));
        e.target.nextElementSibling.textContent = `${cur.scale} %`;
        mountView();
      }
    });
    app.addEventListener("change", (e) => {
      const k = e.target.dataset && e.target.dataset.bi;
      if (k === "mins") { U.minutes = clamp(Math.round(Number(e.target.value)) || U.minutes, 1, 60); redraw(); }
      if (k === "penplayer") U.pen.player = e.target.value;
      if (k === "adjpens") U.adjPens = e.target.checked;
      if (k === "assist") edit((s) => B.setAssist(s, Number(e.target.dataset.i), e.target.value));
    });
    // medzerník = štart / pauza (keď nie je kurzor v poli ani na tlačidle)
    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (e.code !== "Space" || !cur || cur.ended || !document.getElementById("bd-host") || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(tag)) return;
      e.preventDefault();
      ACT.toggle();
    });
    B.subscribe((s) => { cur = s; redraw(); }); // zmena v inom okne admina
    B.onPing(updateConn);
  }

  /* ---------- Tikanie: čas, tresty, koniec časti ---------- */
  function updateConn() {
    const el = document.querySelector("#bd-host [data-conn]");
    if (!el) return;
    const on = B.pingAge() < 5000;
    el.textContent = on ? "Druhá obrazovka je pripojená" : "Druhá obrazovka nie je otvorená";
    el.classList.toggle("on", on);
  }
  function tick() {
    const h = document.getElementById("bd-host");
    if (!h) { clearInterval(timer); timer = 0; return; }
    if (!cur) return;
    const t = now();
    const done = B.settle(cur, t); // čas vypršal → zastaví sa
    if (done) { commit(done); return; }
    if (h._sig !== penSig(cur, t)) { redraw(); return; } // trest vypršal → uvoľní sa miesto
    const v = B.view(cur, t);
    h.querySelectorAll("[data-clock]").forEach((el) => { el.textContent = B.fmt(v.ms); });
    v.pens.h.concat(v.pens.a).forEach((p) => { const el = h.querySelector(`.a-bd-pens [data-pen="${p.id}"]`); if (el) el.textContent = B.fmt(p.ms); });
    const sb = document.getElementById("bd-sb");
    if (sb) V.update(sb, cur, t);
    updateConn();
  }

  window.BoardAdmin = {
    html(api) { A = api; return `<div class="a-ed a-bd" id="bd-host">${inner()}</div>`; },
    after(app, api) {
      A = api;
      bind(app);
      const h = document.getElementById("bd-host");
      if (h) h._sig = cur ? penSig(cur, now()) : "";
      mountView();
      updateConn();
      if (!timer) timer = setInterval(tick, 200);
    },
  };
})();
