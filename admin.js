/* Admin FULky (načíta sa iba s ?edit v adrese) – podľa design/Admin.dc.html.
   Zápasy, playoff, sezóny a nastavenia sa ukladajú tlačidlom „Uložiť“, súpiska (kapitán, presun,
   pridanie, fotka) hneď po kliknutí. Po každom uložení sa dáta znova načítajú z databázy,
   takže admin aj web ukazujú presne to, čo v nej je. */
(() => {
  "use strict";
  const L = window.Logic;
  const DB = window.DB;
  const app = document.getElementById("app");
  const S = {
    data: null, tab: "matches", season: null, filter: "all",
    sel: null, draft: null, pick: null, cal: null,
    teamSel: null, moving: null, newName: "",
    seasonSel: null, seasonDraft: null, setDraft: null,
    toast: "", error: "", busy: false, uploading: null, loginError: "",
  };

  /* ---------- Drobnosti ---------- */
  const STAGE = { SF1: "Semifinále 1", SF2: "Semifinále 2", B3: "O 3. miesto", F: "Finále" };
  const STAGE_SHORT = { SF1: "SF1", SF2: "SF2", B3: "3.M", F: "FIN" };
  const PLACEHOLDER = { F: ["Víťaz SF1", "Víťaz SF2"], B3: ["Porazený SF1", "Porazený SF2"] };
  const TIMES = ["19:00", "20:15", "21:00", "21:15"];
  const MONTHS = ["JANUÁR", "FEBRUÁR", "MAREC", "APRÍL", "MÁJ", "JÚN", "JÚL", "AUGUST", "SEPTEMBER", "OKTÓBER", "NOVEMBER", "DECEMBER"];
  const STATE = {
    live: { status: "Prebieha", chipBg: "#FFFFFF", chipFg: "#050505", chipBd: "#FFFFFF", line: "solid", dot: "#3DDC84", dotBd: "#3DDC84" },
    done: { status: "Skončená", chipBg: "transparent", chipFg: "#BDBDBD", chipBd: "#5A5A5A", line: "solid", dot: "#9A9A9A", dotBd: "#9A9A9A" },
    soon: { status: "Pripravujeme", chipBg: "transparent", chipFg: "#FFFFFF", chipBd: "#FFFFFF", line: "dashed", dot: "transparent", dotBd: "#FFFFFF" },
  };
  const NOTEAM = { id: "", name: "?", abbr: "?", pre: "", c: "#333333", d: "#111111", ink: "#FFFFFF", svg: "assets/logos/ful.svg", gif: "assets/logos/ful.svg" };
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const col = (c, fallback) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : fallback);
  const vars = (t) => `--c:${t.c};--d:${t.d};--ink:${t.ink}`;
  const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
  const pressed = (on) => `aria-pressed="${on ? "true" : "false"}"`;
  const today = () => L.localParts(Date.now()).date;
  const mobile = () => window.matchMedia("(max-width: 760px)").matches;
  const icon = {
    back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>',
    next: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>',
    plus: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
    x: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
    ok: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"></path></svg>',
    err: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5C5C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6M12 16.5v.5"></path></svg>',
    info: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16.5v.5"></path></svg>',
    cam: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>',
    arrow: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M14 6l6 6-6 6"></path></svg>',
    trash: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>',
    screen: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:2px"><rect x="3" y="4" width="18" height="14"></rect><path d="M8 21h8M12 18v3"></path></svg>',
    tbd: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><rect x="3" y="5" width="18" height="16"></rect><path d="M3 10h18M8 3v4M16 3v4M10 14.5a2 2 0 1 1 2.5 2c-.3.2-.5.5-.5.9M12 19.5v.1"></path></svg>',
  };

  /* ---------- Dáta vybranej sezóny ---------- */
  function teamsOf(d) {
    const T = {};
    d.teams.forEach((t) => {
      T[t.id] = { id: t.id, name: t.name, pre: t.venue, abbr: t.abbr || t.name.slice(0, 3).toUpperCase(),
        c: col(t.color, "#888888"), d: col(t.color_dark, "#333333"), ink: col(t.ink, "#FFFFFF"), svg: t.logo || NOTEAM.svg, gif: t.logo_anim || t.logo || NOTEAM.svg };
    });
    return T;
  }

  function seasonData(d, s, P) {
    const inSeason = new Set(d.season_teams.filter((x) => x.season_id === s.id).map((x) => x.team_id));
    const teamIds = d.teams.map((t) => t.id).filter((id) => inSeason.has(id));
    const raw = d.matches.filter((m) => m.season_id === s.id);
    const ids = new Set(raw.map((m) => m.id));
    const gm = L.goalsByMatch(d.goals.filter((g) => ids.has(g.match_id)));
    const settings = L.settingsOf(d.settings);
    const table = L.standings(teamIds, raw, gm, settings);
    return {
      s, teamIds, raw, gm, settings, table,
      po: L.playoff(s, raw, gm, table),
      resolved: L.resolveMatches(s, raw, gm, table),
      roster: d.roster.filter((r) => r.season_id === s.id),
      champ: L.champion(L.resolveMatches(s, raw, gm, table), gm),
    };
  }

  function ctx() {
    const d = S.data;
    const T = teamsOf(d);
    const P = Object.fromEntries(d.players.map((p) => [p.id, p]));
    const live = d.seasons.find((s) => s.state === "live");
    const s = d.seasons.find((x) => x.id === S.season) || live || d.seasons[0];
    if (s) S.season = s.id;
    return Object.assign({ d, T, P, live }, s ? seasonData(d, s, P) : { s: null });
  }

  // tímy zápasu v editore: vlastné pri základnej časti a ručnom SF, inak doplnené (iba keď sú isté)
  function teamsFor(m, c) {
    if (m.stage === "R" || (c.s.seed_mode === "manual" && (m.stage === "SF1" || m.stage === "SF2"))) return [m.home_id || null, m.away_id || null];
    const p = c.po[m.stage];
    return p && p.fixed ? [p.home_id, p.away_id] : [null, null];
  }
  const teamName = (c, id, stage, i) => (id ? (c.T[id] || NOTEAM).name : (PLACEHOLDER[stage] || ["Vyber tím", "Vyber tím"])[i]);
  const savedOf = (c, id) => c.raw.find((m) => m.id === id) || null;

  /* ---------- Ukladanie ---------- */
  function messageOf(e) {
    if (e.status === 401) { DB.signOut(); return "Prihlásenie vypršalo. Prihlás sa znova."; }
    if (e.status === 403 || e.code === "42501") return "Tento účet nemá právo zapisovať do FULky.";
    if (e instanceof TypeError) return "Nepodarilo sa spojiť s databázou. Skontroluj internet a skús znova.";
    return `Uloženie zlyhalo: ${e.message}`;
  }

  // spustí zápis, potom znova načíta dáta z databázy (admin aj web)
  async function run(fn, toast, after) {
    if (S.busy) return;
    S.busy = true; S.toast = ""; S.error = "";
    render();
    try {
      const result = await fn();
      const d = await DB.load();
      window.App.setData(d);
      if (after) after(result); // napr. znova vyberie zápas (to by hlášku zmazalo, preto je až potom)
      S.toast = typeof toast === "function" ? toast(result) : toast;
    } catch (e) {
      S.error = messageOf(e);
    } finally {
      S.busy = false;
      render();
    }
  }
  const fail = (msg) => { S.error = msg; S.toast = ""; render(); };

  /* ---------- Potvrdenie pred mazaním (vlastný dialóg v štýle webu, nie window.confirm) ---------- */
  function confirmDialog(title, text, ok = "Vymazať") {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const box = document.createElement("div");
      box.className = "a-modal";
      box.innerHTML = `<div class="a-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="a-modal-t" aria-describedby="a-modal-d">
        <div class="a-ed-head"><span class="sh" aria-hidden="true" style="background:linear-gradient(160deg, #FF5C5C, #5E0710);clip-path:polygon(30% 0, 100% 0, 100% 100%, 12% 100%)"></span>
          <span class="tt"><span class="lbl">Naozaj?</span><b id="a-modal-t">${esc(title)}</b></span></div>
        <div class="a-body"><p id="a-modal-d" class="muted" style="margin:0">${esc(text)}</p>
          <div class="a-actions"><button type="button" class="a-save danger" data-m="ok">${esc(ok)}</button><button type="button" class="a-ghost" data-m="no">Zrušiť</button></div></div></div>`;
      const close = (v) => {
        box.remove();
        document.removeEventListener("keydown", onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); close(false); }
        if (e.key === "Tab") { // zameranie ostáva v dialógu
          const btns = Array.from(box.querySelectorAll("button"));
          const i = btns.indexOf(document.activeElement);
          e.preventDefault();
          btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        }
      };
      box.addEventListener("click", (e) => {
        const m = e.target.closest("[data-m]");
        if (m) close(m.dataset.m === "ok");
        else if (e.target === box) close(false);
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(box);
      box.querySelector('[data-m="no"]').focus();
    });
  }

  /* ---------- Zápasy: výber a draft ---------- */
  function select(id) {
    const c = ctx();
    S.pick = null; S.toast = ""; S.error = "";
    if (id === null) { S.sel = null; S.draft = null; render(); return; }
    if (id === "new") {
      const ks = c.raw.filter((m) => m.stage === "R").map((m) => m.round);
      S.draft = { id: "new", season_id: c.s.id, stage: "R", round: ks.length ? Math.max(...ks) : 1, home_id: null, away_id: null, tbd: false, date: "",
        time: c.settings.defaultTime, status: "plan", note: "", moved: false, orig_starts_at: null, window_from: null, window_to: null, markMoved: true, goals: [] };
    } else {
      const m = savedOf(c, id);
      if (!m) { S.sel = null; S.draft = null; render(); return; }
      S.draft = L.draftOf(m, c.gm[id], c.settings.defaultTime);
    }
    S.sel = id;
    const ref = S.draft.date || S.draft.window_from || (S.draft.orig_starts_at ? L.localParts(S.draft.orig_starts_at).date : today());
    const [y, m] = ref.split("-").map(Number);
    S.cal = { y, m0: m - 1 };
    render();
  }
  function patch(p) { Object.assign(S.draft, p); S.toast = ""; S.error = ""; render(); }

  function newMatchId(c) {
    const ids = new Set(S.data.matches.map((m) => m.id));
    let n = c.raw.filter((m) => m.stage === "R").length + 1;
    while (ids.has(`${c.s.id}-${String(n).padStart(2, "0")}`)) n++;
    return `${c.s.id}-${String(n).padStart(2, "0")}`;
  }

  function saveMatch() {
    const c = ctx();
    const d = S.draft;
    const [h, a] = teamsFor(d, c);
    const err = L.validateMatch(Object.assign({}, d, { home_id: h, away_id: a }), c.s.seed_mode);
    if (err) return fail(err);
    const saved = d.id === "new" ? null : savedOf(c, d.id);
    const id = d.id === "new" ? newMatchId(c) : d.id;
    const row = L.rowOf(Object.assign({}, d, { id, season_id: c.s.id }), saved, c.s.seed_mode);
    const goals = L.goalRowsOf(d, id);
    const hadGoals = (c.gm[id] || []).length > 0;
    run(async () => {
      await DB.upsert("matches", row);
      if (hadGoals) await DB.remove("goals", { match_id: id }); // góly sa zapíšu nanovo v novom poradí
      if (goals.length) await DB.upsert("goals", goals);
    }, "Uložené. Web sa hneď aktualizuje — tabuľka aj štatistiky sa prepočítali.", () => select(id));
  }

  async function removeMatch() {
    const id = S.sel;
    if (!(await confirmDialog("Vymazať zápas?", "Zápas aj všetky jeho góly sa natrvalo vymažú z webu."))) return;
    run(() => DB.remove("matches", { id }), "Zápas je vymazaný.", () => { S.sel = null; S.draft = null; });
  }

  // góly: + pri tíme pridá gól a otvorí výber strelca, − uberie posledný gól tímu
  function addGoal(side) {
    S.draft.goals.push({ side, scorer: "", assist: "" });
    S.pick = { i: S.draft.goals.length - 1, f: "s" };
    S.toast = ""; S.error = "";
    render();
  }
  function dropGoal(side) {
    const gs = S.draft.goals;
    for (let i = gs.length - 1; i >= 0; i--) if (gs[i].side === side) { gs.splice(i, 1); break; }
    S.pick = null;
    render();
  }
  function choose(i, f, value) {
    S.draft.goals[i][f === "s" ? "scorer" : "assist"] = value;
    S.pick = f === "s" ? { i, f: "as" } : null;
    render();
  }

  /* ---------- Súpiska (ukladá sa hneď) ---------- */
  const rosterRow = (c, playerId) => c.roster.find((r) => r.player_id === playerId);
  const KEY = "season_id,player_id";

  function toggleCaptain(playerId) {
    const c = ctx();
    const r = rosterRow(c, playerId);
    const name = c.P[playerId].name;
    const on = !r.captain;
    const old = c.roster.find((x) => x.team_id === r.team_id && x.captain && x.player_id !== playerId);
    run(async () => {
      if (old) await DB.upsert("roster", Object.assign({}, old, { captain: false }), KEY); // naraz iba jeden kapitán v tíme
      await DB.upsert("roster", Object.assign({}, r, { captain: on }), KEY);
    }, on ? `${name} je kapitán.` : "Tím je zatiaľ bez kapitána.");
  }

  function movePlayer(playerId, to) {
    const c = ctx();
    const r = rosterRow(c, playerId);
    S.moving = null;
    run(() => DB.upsert("roster", Object.assign({}, r, { team_id: to, captain: false }), KEY),
      `${c.P[playerId].name} hrá odteraz za ${(c.T[to] || NOTEAM).name}.`);
  }

  async function removePlayer(playerId) {
    const c = ctx();
    const name = c.P[playerId].name;
    if (!(await confirmDialog(`Odstrániť ${name}?`, "Hráč zmizne zo súpisky tímu. Jeho góly a asistencie ostanú v štatistikách.", "Odstrániť"))) return;
    run(() => DB.remove("roster", { season_id: c.s.id, player_id: playerId }), `${name} je odstránený zo súpisky. Jeho góly ostávajú v štatistikách.`);
  }

  function addPlayer() {
    const c = ctx();
    const name = (S.newName || "").trim().replace(/\s+/g, " ");
    if (!name) return fail("Napíš meno a priezvisko hráča.");
    const same = S.data.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const inRoster = same && rosterRow(c, same.id);
    if (inRoster) return fail(`${same.name} už je v tíme ${(c.T[inRoster.team_id] || NOTEAM).name}. Ak ho chceš presunúť, klikni pri ňom na „Presunúť“.`);
    let id = same ? same.id : L.playerId(name);
    for (let n = 2; !same && c.P[id]; n++) id = `${L.playerId(name)}-${n}`; // iný hráč s rovnakým id
    const team = S.teamSel;
    run(async () => {
      if (!same) await DB.upsert("players", { id, name });
      await DB.upsert("roster", { season_id: c.s.id, player_id: id, team_id: team, captain: false }, KEY);
    }, `${name} je v tíme ${(c.T[team] || NOTEAM).name}.`, () => { S.newName = ""; });
  }

  /* ---------- Tímy: pridanie a úprava ---------- */
  const HEX = /^#[0-9a-f]{6}$/i;
  function startTeam(id) {
    const c = ctx();
    const t = id === "new" ? null : c.d.teams.find((x) => x.id === id);
    S.teamDraft = t
      ? { id: t.id, name: t.name, venue: t.venue, abbr: t.abbr, color: t.color, color_dark: t.color_dark, ink: t.ink, logo: t.logo, logo_anim: t.logo_anim, files: {} }
      : { id: "new", name: "", venue: "", abbr: "", color: "#888888", color_dark: "#333333", ink: "#FFFFFF", logo: "", logo_anim: "", files: {} };
    S.teamSel = id === "new" ? null : id;
    S.toast = ""; S.error = "";
    render();
  }

  function newTeamId(abbr, name) {
    const ids = new Set(S.data.teams.map((t) => t.id));
    const base = L.slug(abbr || name).replace(/-/g, "").slice(0, 6) || "tim";
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}${n}`;
    return id;
  }

  function saveTeam() {
    const c = ctx();
    const d = S.teamDraft;
    const name = (d.name || "").trim();
    const abbr = (d.abbr || "").trim().toUpperCase();
    if (!name) return fail("Napíš názov tímu, napr. „Giants“.");
    if (!/^[A-ZÁ-Ž0-9]{2,4}$/u.test(abbr)) return fail("Skratka tímu má 2 až 4 písmená, napr. „GIA“.");
    if (![d.color, d.color_dark, d.ink].every((x) => HEX.test(x))) return fail("Farby musia byť v tvare #RRGGBB.");
    const isNew = d.id === "new";
    const id = isNew ? newTeamId(abbr, name) : d.id;
    run(async () => {
      const v = Date.now().toString(36);
      const url = async (kind, file) => {
        const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
        const path = await DB.upload(`timy/${id}/${kind}.${ext}`, file);
        return `${DB.photoUrl(path)}?v=${v}`;
      };
      const row = { id, name, venue: (d.venue || "").trim(), abbr, color: d.color.toUpperCase(), color_dark: d.color_dark.toUpperCase(), ink: d.ink.toUpperCase(), logo: d.logo || "", logo_anim: d.logo_anim || "" };
      if (d.files.logo) row.logo = await url("logo", d.files.logo);
      if (d.files.anim) row.logo_anim = await url("anim", d.files.anim);
      await DB.upsert("teams", row);
      if (isNew) await DB.upsert("season_teams", { season_id: c.s.id, team_id: id }, "season_id,team_id");
    }, isNew ? `Tím ${name} je pridaný do sezóny ${c.s.name}. Teraz mu pridaj hráčov.` : `Tím ${name} je uložený.`,
    () => { S.teamDraft = null; S.teamSel = id; });
  }

  function teamForm(c) {
    const d = S.teamDraft;
    const isNew = d.id === "new";
    const prev = { logo: d.files.logo ? d.files.logoUrl : d.logo, anim: d.files.anim ? d.files.animUrl : d.logo_anim };
    const color = (key, label) => `<label class="a-field lbl">${label}<span class="a-color"><input type="color" data-tcolor="${key}" value="${esc(HEX.test(d[key]) ? d[key] : "#888888")}" aria-label="${label}"><code>${esc(d[key])}</code></span></label>`;
    const file = (kind, label, note) => `<div class="a-field"><span class="lbl">${label}</span><span class="a-filerow">
        ${prev[kind] ? `<img src="${esc(prev[kind])}" alt="">` : '<span class="blank" aria-hidden="true" style="width:56px;height:56px"></span>'}
        <label class="a-ghost w a-filebtn">${icon.cam}${prev[kind] ? "Zmeniť" : "Nahrať"}<input type="file" accept="image/png, image/webp${kind === "logo" ? ", image/jpeg" : ""}" data-tfile="${kind}"></label></span>
        <span class="small">${note}</span></div>`;
    const T = { c: HEX.test(d.color) ? d.color : "#888888", d: HEX.test(d.color_dark) ? d.color_dark : "#333333", ink: HEX.test(d.ink) ? d.ink : "#FFFFFF" };
    return `<div class="a-ed"><div class="a-team-head" style="min-height:120px">
        <span class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${T.c}, ${T.d});clip-path:polygon(0 0, 62% 0, 50% 100%, 0 100%)"></span>
        ${backBtn("cancelTeam", "Späť na tímy")}${prev.logo ? `<img class="logo" src="${esc(prev.logo)}" alt="">` : ""}
        <span class="tt"><small>${isNew ? "Nový tím" : "Úprava tímu"}${d.venue ? ` · ${esc(d.venue)}` : ""}</small><b>${esc(d.name || "Nový tím")}</b></span></div>
      ${msgs()}
      <div class="a-body">
        <fieldset class="a-fs"><legend>Názov</legend>
          <label class="a-field lbl">Názov tímu<input type="text" class="a-input big" data-in="tname" value="${esc(d.name)}" placeholder="napr. Giants" style="text-transform:none"></label>
          <div class="a-two"><label class="a-field lbl">Prvá časť názvu (miesto)<input type="text" class="a-input" data-in="tvenue" value="${esc(d.venue)}" placeholder="napr. Veľká sála" style="text-transform:none;letter-spacing:0"></label>
            <label class="a-field lbl">Skratka (2–4 písmená)<input type="text" class="a-input" data-in="tabbr" value="${esc(d.abbr)}" placeholder="GIA" maxlength="4" style="letter-spacing:0.08em"></label></div></fieldset>
        <fieldset class="a-fs"><legend>Farby</legend><div class="a-three">${color("color", "Hlavná")}${color("color_dark", "Tmavá (prechod)")}${color("ink", "Text na hlavnej farbe")}</div>
          <span class="a-colorprev" style="${vars(T)}"><span class="sc">2:1</span><b>${esc(d.abbr || "TÍM")}</b></span></fieldset>
        <fieldset class="a-fs"><legend>Logá</legend>
          ${file("logo", "Logo", "PNG alebo WebP s priehľadným pozadím, ideálne štvorec aspoň 512 × 512 px. SVG sa nahrať nedá.")}
          ${file("anim", "Animované logo (víťaz zápasu, nepovinné)", "Animovaný WebP. Keď chýba, víťaz má obyčajné logo.")}</fieldset>
        <div class="a-actions"><button type="button" class="a-save" data-a="saveTeam"${S.busy ? " disabled" : ""}>${S.busy ? "Ukladám…" : isNew ? "Pridať tím" : "Uložiť tím"}</button>
          <button type="button" class="a-ghost" data-a="cancelTeam">Zrušiť</button></div>
        ${isNew ? `<span class="small">Tím sa pridá do sezóny ${esc(c.s.name)}. Do iných sezón ho pridáš v záložke Sezóny.</span>` : ""}</div></div>`;
  }

  /* ---------- Fotky hráčov ----------
     Jedna fotka (najlepšie PNG s priehľadným pozadím): postava, výrez hlavy a avatar sa vyrobia samé.
     Pripravené súbory <id>_full / _head / _face sa dajú vybrať naraz a použijú sa bez orezu. */
  const SIZES = { full: [null, 900], head: [468, 600], face: [256, 256] };
  const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: Math.round(w), height: Math.round(h) });
  const encode = (cv) => new Promise((ok) => cv.toBlob(ok, "image/webp", 0.9));

  // obdĺžnik nepriehľadných pixelov a stred hlavy (horných 12 % postavy)
  function figureBox(img) {
    const k = Math.min(1, 300 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * k));
    const h = Math.max(1, Math.round(img.height * k));
    const x = canvas(w, h).getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data;
    const on = (i, j) => px[(j * w + i) * 4 + 3] > 24;
    let top = h, bottom = -1, left = w, right = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) { top = Math.min(top, j); bottom = j; left = Math.min(left, i); right = Math.max(right, i); }
    if (bottom < 0) return { top: 0, left: 0, width: img.width, height: img.height, cx: img.width / 2, headW: img.width / 3 };
    let hl = w, hr = -1;
    const band = top + Math.max(1, Math.round((bottom - top) * 0.12));
    for (let j = top; j <= band; j++) for (let i = 0; i < w; i++) if (on(i, j)) { hl = Math.min(hl, i); hr = Math.max(hr, i); }
    return { top: top / k, left: left / k, width: (right - left + 1) / k, height: (bottom - top + 1) / k, cx: ((hl + hr + 1) / 2) / k, headW: Math.max(hr - hl + 1, (right - left + 1) / 6) / k };
  }

  function crop(img, box, w, h) {
    const cv = canvas(w, h);
    cv.getContext("2d").drawImage(img, box.x, box.y, box.w, box.h, 0, 0, w, h);
    return encode(cv);
  }
  function scaled(img, kind) {
    const [mw, mh] = SIZES[kind];
    if (kind === "full") { const k = Math.min(1, mh / img.height); return crop(img, { x: 0, y: 0, w: img.width, h: img.height }, img.width * k, img.height * k); }
    const k = Math.max(mw / img.width, mh / img.height); // vyplniť a orezať na stred
    const w = mw / k;
    const h = mh / k;
    return crop(img, { x: (img.width - w) / 2, y: (img.height - h) / 2, w, h }, mw, mh);
  }
  function autoCrops(img) {
    const b = figureBox(img);
    const hw = Math.min(b.width, b.headW * 2.6);
    const hh = hw / (SIZES.head[0] / SIZES.head[1]);
    const fs = Math.min(b.width, b.headW * 1.4);
    return {
      head: crop(img, { x: b.cx - hw / 2, y: b.top - hh * 0.06, w: hw, h: hh }, ...SIZES.head),
      face: crop(img, { x: b.cx - fs / 2, y: b.top - fs * 0.08, w: fs, h: fs }, ...SIZES.face),
    };
  }

  async function photoBlobs(files) {
    const named = {};
    files.forEach((f) => { const m = /_(full|head|face)\.\w+$/i.exec(f.name); if (m) named[m[1].toLowerCase()] = f; });
    const out = {};
    if (Object.keys(named).length) {
      for (const kind of Object.keys(named)) {
        const f = named[kind];
        out[kind] = f.type === "image/webp" ? f : await scaled(await createImageBitmap(f), kind); // pripravené WebP bez ďalšej kompresie
      }
      if (named.full && (!named.head || !named.face)) {
        const auto = autoCrops(await createImageBitmap(named.full));
        out.head = out.head || await auto.head;
        out.face = out.face || await auto.face;
      }
      return out;
    }
    const img = await createImageBitmap(files[0]);
    const auto = autoCrops(img);
    return { full: await scaled(img, "full"), head: await auto.head, face: await auto.face };
  }

  // nahrá fotky jedného hráča do bucketu a zapíše cesty k nemu
  async function storePhotos(p, files) {
    const blobs = await photoBlobs(files);
    const v = Date.now().toString(36); // nová adresa, aby prehliadače nedržali starú fotku
    const row = { id: p.id, name: p.name };
    const FIELD = { full: "photo", head: "photo_head", face: "photo_face" };
    for (const kind of Object.keys(blobs)) {
      const b = blobs[kind];
      if (!b) continue;
      const ext = b.type === "image/webp" ? "webp" : "png";
      const path = await DB.upload(`hraci/${p.id}/${kind}.${ext}`, b);
      row[FIELD[kind]] = `${path}?v=${v}`;
    }
    await DB.upsert("players", row);
  }
  const notImage = (files) => files.some((f) => !/^image\/(png|jpeg|webp)$/.test(f.type));

  async function uploadPhoto(playerId, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (notImage(files)) return fail("Toto nie je obrázok — vyber PNG, JPG alebo WebP.");
    const p = ctx().P[playerId];
    S.uploading = playerId;
    await run(() => storePhotos(p, files), `Fotka hráča ${p.name} je nahratá. Na webe sa ukáže pri jeho mene.`);
    S.uploading = null;
    render();
  }

  // viac hráčov naraz: súbory <id_hráča>_full / _head / _face (napr. p-bartos-andrej_full.webp)
  async function uploadMany(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (notImage(files)) return fail("Niektorý súbor nie je obrázok — vyber PNG, JPG alebo WebP.");
    const c = ctx();
    const groups = {};
    files.forEach((f) => { const m = /^(.+)_(full|head|face)\.\w+$/i.exec(f.name); if (m) (groups[m[1]] = groups[m[1]] || []).push(f); });
    const ids = Object.keys(groups).filter((id) => c.P[id]);
    const unknown = Object.keys(groups).filter((id) => !c.P[id]);
    if (!ids.length) return fail("Súbory musia mať meno <id_hráča>_full / _head / _face, napr. p-bartos-andrej_full.webp.");
    S.uploading = "*";
    await run(async () => { for (const id of ids) await storePhotos(c.P[id], groups[id]); },
      `Nahraté fotky: ${ids.map((id) => c.P[id].name).join(", ")}.${unknown.length ? ` Neznámi hráči (preskočené): ${unknown.join(", ")}.` : ""}`);
    S.uploading = null;
    render();
  }

  /* ---------- Sezóny ---------- */
  function selectSeason(id) {
    const c = ctx();
    const src = id === "new" ? { id: "new", name: "", state: "soon", seed_mode: "auto", sort: 0, teams: c.d.teams.map((t) => t.id) }
      : Object.assign({}, c.d.seasons.find((x) => x.id === id));
    if (id !== "new") src.teams = c.d.season_teams.filter((x) => x.season_id === id).map((x) => x.team_id);
    S.seasonSel = id; S.seasonDraft = src; S.toast = ""; S.error = "";
    render();
  }

  function newSeasonId(name) {
    const ids = new Set(S.data.seasons.map((s) => s.id));
    const y = /(\d{4})/.exec(name);
    const base = y ? `${L.slug(name)[0]}${y[1].slice(2)}` : L.slug(name).slice(0, 12) || "sezona";
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  async function saveSeason() {
    const c = ctx();
    const d = S.seasonDraft;
    const name = (d.name || "").trim();
    if (!name) return fail("Daj sezóne názov, napr. „Jarná sezóna 2027“.");
    if (d.teams.length < 2) return fail("Sezóna potrebuje aspoň 2 tímy.");
    const isNew = d.id === "new";
    const id = isNew ? newSeasonId(name) : d.id;
    const sort = isNew ? Math.max(0, ...c.d.seasons.map((s) => s.sort)) + 10 : d.sort;
    const row = { id, name, short: L.shortName(name), state: d.state, seed_mode: d.seed_mode || "auto", sort };
    const otherLive = c.d.seasons.filter((x) => x.state === "live" && x.id !== id);
    const had = c.d.season_teams.filter((x) => x.season_id === id).map((x) => x.team_id);
    const dropped = had.filter((t) => !d.teams.includes(t));
    if (dropped.length && !(await confirmDialog("Odobrať tímy zo sezóny?",
      `${dropped.map((t) => (c.T[t] || NOTEAM).name).join(", ")} ${dropped.length === 1 ? "zmizne" : "zmiznú"} zo sezóny „${name}“. Zápasy a súpisky ostanú v databáze.`, "Odobrať"))) return;
    let note = isNew ? `Sezóna „${name}“ je vytvorená. Prepni sa na ňu hore a pridaj zápasy aj hráčov.` : "Sezóna je uložená.";
    if (d.state === "live" && otherLive.length) note = `Uložené. „${otherLive[0].name}“ je teraz skončená a web ukazuje „${name}“.`;
    run(async () => {
      // naraz môže prebiehať iba jedna sezóna: najprv staré na „done“, potom túto na „live“
      for (const x of otherLive) if (d.state === "live") await DB.upsert("seasons", Object.assign({}, x, { state: "done" }));
      await DB.upsert("seasons", row);
      const add = d.teams.filter((t) => !had.includes(t)).map((t) => ({ season_id: id, team_id: t }));
      if (add.length) await DB.upsert("season_teams", add, "season_id,team_id");
      for (const t of had.filter((t) => !d.teams.includes(t))) await DB.remove("season_teams", { season_id: id, team_id: t });
      if (isNew) await DB.upsert("matches", ["SF1", "SF2", "B3", "F"].map((st) => ({ id: `${id}-${st === "F" ? "fin" : st.toLowerCase()}`, season_id: id, stage: st })));
    }, note, () => selectSeason(id));
  }

  /* ---------- Vykreslenie: spoločné ---------- */
  const msgs = () => (S.toast ? `<div class="a-toast" role="status">${icon.ok}${esc(S.toast)}</div>` : "")
    + (S.error ? `<div class="a-error" role="alert">${icon.err}${esc(S.error)}</div>` : "");
  const sq = (st, selected) => `<i class="sq" aria-hidden="true" style="background:${selected && st === STATE.soon ? "transparent" : st.dot};border:1px ${st.line} ${selected ? "#050505" : st.dotBd}"></i>`;
  const backBtn = (act, label) => (mobile() ? `<button type="button" class="a-back" data-a="${act}" aria-label="${label}">${icon.back}</button>` : "");
  const logo = (t, size) => (t ? `<img src="${esc(t.svg)}" alt=""${size ? ` style="width:${size}px;height:${size}px"` : ""}>` : '<span class="blank" aria-hidden="true"></span>');

  function header(c) {
    const st = c.s ? STATE[c.s.state] : STATE.soon;
    const user = DB.user();
    return `<header class="a-top"><div class="wrap a-top-in">
      <a class="brand" href="./" aria-label="FULka — na hlavnú stránku webu"><img src="assets/logos/ful-mark-white.png" alt=""><span class="brand-name"><b>FULka</b><small>Florbalová Upece Liga</small></span></a>
      <span class="a-badge">Admin</span>
      ${c.s ? `<span class="a-season">${sq(st)}${esc(c.s.name)}</span>` : ""}
      <span class="a-links">${user ? `<button type="button" class="a-link" data-a="logout" title="${esc(user.email)}">Odhlásiť</button>` : ""}
        <a class="a-link" href="./">${icon.back}Na web</a></span>
    </div></header>`;
  }

  function nav(c) {
    const tabs = [["matches", "Zápasy"], ["playoff", "Playoff"], ["teams", "Tímy"], ["seasons", "Sezóny"], ["settings", "Nastavenia"]]
      .map(([id, label]) => `<button type="button" data-a="tab" data-id="${id}" ${pressed(S.tab === id)}>${label}</button>`).join("");
    let bar = "";
    if (S.tab !== "seasons" && S.tab !== "settings") {
      const chips = c.d.seasons.slice().sort((x, y) => x.sort - y.sort).map((x) =>
        `<button type="button" class="a-schip" data-a="season" data-id="${esc(x.id)}" ${pressed(x.id === c.s.id)}>${sq(STATE[x.state], x.id === c.s.id)}${esc(x.short || x.name)}</button>`).join("");
      const notice = { done: "Upravuješ skončenú sezónu — zmeny uvidia ľudia v archíve.", soon: "Táto sezóna sa len pripravuje — na webe je zatiaľ banner. Zápasy aj súpisky môžeš chystať dopredu.", live: "" }[c.s.state];
      bar = `<div class="a-seasonbar"><span class="lbl">Upravuješ sezónu</span>${chips}</div>${notice ? `<div class="a-notice${c.s.state === "done" ? " done" : ""}">${icon.info}${notice}</div>` : ""}`;
    }
    return `<div class="wrap a-nav"><div class="a-tabs" role="group" aria-label="Sekcia administrácie">${tabs}</div>${bar}</div>`;
  }

  /* ---------- Zoznam zápasov ---------- */
  function rowTag(m) {
    if (m.status === "done") return '<span class="a-tag">Odohraný</span>';
    if (!m.starts_at) return '<span class="a-tag tbd">Bez termínu</span>';
    if (m.moved) return '<span class="a-tag moved">Presunutý</span>';
    return '<span class="a-tag">Plán</span>';
  }
  function rowWhen(m) {
    const orig = m.orig_starts_at ? ` · pôvodne ${L.slot(m.orig_starts_at)}` : "";
    if (m.starts_at) return { t: L.slot(m.starts_at) + (m.moved ? orig : ""), warn: m.moved };
    if (m.window_from && m.window_to >= today()) return { t: `Týždeň ${L.weekLabel(m.window_from, m.window_to)}`, warn: false };
    return { t: `Termín sa hľadá${orig}`, warn: true };
  }

  function listRow(m, c) {
    const [h, a] = teamsFor(m, c);
    const H = h && (c.T[h] || NOTEAM);
    const A = a && (c.T[a] || NOTEAM);
    const done = m.status === "done";
    const sc = L.score(c.gm[m.id]);
    const w = rowWhen(m);
    const center = done ? `${sc.h}:${sc.a}` : m.starts_at ? L.matchTime(m) : "TBD";
    return `<button type="button" class="a-row" data-a="select" data-id="${esc(m.id)}" aria-current="${S.sel === m.id}">
      <span class="rail" aria-hidden="true" style="--hc:${H ? H.c : "#333333"};--ac:${A ? A.c : "#333333"}"></span>
      <span class="k">${m.stage === "R" ? `K${m.round}` : STAGE_SHORT[m.stage]}</span>
      <span class="a-mid"><span class="a-teams">${logo(H)}${H ? esc(H.abbr) : "?"}<span class="ctr${done ? " done" : ""}">${center}</span>${A ? esc(A.abbr) : "?"}${logo(A)}</span>
        <span class="when${w.warn ? " warn" : ""}">${esc(w.t)}</span></span>${rowTag(m)}</button>`;
  }

  function matchList(c) {
    const pass = (m) => S.filter === "all" || (S.filter === "done" ? m.status === "done" : S.filter === "tbd" ? !m.starts_at && m.status !== "done" : m.status !== "done" && !!m.starts_at);
    const counts = {
      all: c.raw.length, plan: c.raw.filter((m) => m.status !== "done" && m.starts_at).length,
      done: c.raw.filter((m) => m.status === "done").length, tbd: c.raw.filter((m) => !m.starts_at && m.status !== "done").length,
    };
    const filters = [["all", "Všetky"], ["plan", "Naplánované"], ["done", "Odohrané"], ["tbd", "Bez termínu"]]
      .map(([id, label]) => `<button type="button" data-a="filter" data-id="${id}" ${pressed(S.filter === id)}>${label} <span>${counts[id]}</span></button>`).join("");
    const groups = L.rounds(c.raw).map((r) => {
      const rows = r.matches.filter(pass);
      if (!rows.length) return "";
      const sub = r.date ? (r.exact ? L.shortDate(r.date) : `týždeň ${L.dShort(r.date)}`) : "";
      return `<div class="a-gtitle"><span>Kolo ${r.round}</span><span>${sub}</span></div>${rows.map((m) => listRow(m, c)).join("")}`;
    });
    const po = ["SF1", "SF2", "B3", "F"].map((st) => c.raw.find((m) => m.stage === st)).filter((m) => m && pass(m));
    if (po.length) groups.push(`<div class="a-gtitle"><span>Playoff</span><span></span></div>${po.map((m) => listRow(m, c)).join("")}`);
    const body = groups.join("") || `<p class="a-empty">${!c.raw.some((m) => m.stage === "R") && S.filter === "all" ? "Táto sezóna zatiaľ nemá zápasy základnej časti. Pridaj prvý cez „Nový zápas“." : "V tomto filtri nie je žiadny zápas."}</p>`;
    return `<div class="a-panel"><div class="a-panel-head"><h1 class="a-h1">Zápasy</h1><button type="button" class="a-new" data-a="select" data-id="new">${icon.plus}Nový zápas</button></div>
      <div class="a-filters" role="group" aria-label="Filter">${filters}</div>${body}</div>`;
  }

  /* ---------- Playoff vľavo ---------- */
  function playoffLeft(c) {
    const auto = c.s.seed_mode !== "manual";
    const seg = [["auto", "Podľa tabuľky"], ["manual", "Ručne"]].map(([id, label]) => `<button type="button" data-a="seed" data-id="${id}" ${pressed(c.s.seed_mode === id || (id === "auto" && auto))}>${label}</button>`).join("");
    const mini = auto ? `<div class="a-mini">${c.table.map((s) => {
      const t = c.T[s.id] || NOTEAM;
      return `<div style="${vars(t)}"><span class="pos">${s.pos}</span><img src="${esc(t.svg)}" alt=""><span class="nm">${esc(t.name)}</span><span class="b">${s.b} b</span></div>`;
    }).join("")}</div>` : "";
    const cards = ["SF1", "SF2", "B3", "F"].map((st) => {
      const m = c.raw.find((x) => x.stage === st);
      if (!m) return "";
      const t = teamsFor(m, c);
      const done = m.status === "done";
      const sc = L.score(c.gm[m.id]);
      const w = done && t[0] && t[1] ? L.winner(Object.assign({}, m, { home_id: t[0], away_id: t[1] }), c.gm[m.id]) : null;
      const sides = [0, 1].map((i) => {
        const T = t[i] && (c.T[t[i]] || NOTEAM);
        return `<span class="sd">${T ? `<img src="${esc(T.svg)}" alt="">` : '<span class="blank" aria-hidden="true"></span>'}<span class="n${w && w !== t[i] ? " lost" : ""}">${esc(teamName(c, t[i], st, i))}</span><span class="s">${done ? (i ? sc.a : sc.h) : ""}</span></span>`;
      }).join("");
      return `<button type="button" class="a-bcard${st === "F" ? " f" : ""}" data-a="select" data-id="${esc(m.id)}" aria-current="${S.sel === m.id}">
        <span><b>${STAGE[st]}</b><br><span class="w">${esc(m.starts_at ? L.slot(m.starts_at) : "Termín sa hľadá")}</span></span>${sides}</button>`;
    }).join("");
    return `<div class="a-panel a-po"><h1 class="a-h1">Playoff</h1>
      <div class="a-field"><span class="lbl">Kto s kým hrá semifinále</span><div class="a-seg" role="group" aria-label="Nasadenie">${seg}</div>
        <span class="muted" style="font-size:13px">${auto ? "Semifinále: 1. vs 4. a 2. vs 3. — mení sa samo podľa tabuľky." : "Klikni na semifinále a vyber tímy ručne."}</span></div>
      ${mini}<div class="a-bracket">${cards}</div>
      <span class="small">Finále a zápas o 3. miesto sa doplnia samé, keď zapíšeš výsledky semifinále.</span></div>`;
  }

  /* ---------- Editor zápasu ---------- */
  function teamPicker(c, d) {
    const row = (label, side) => {
      const mine = side === "h" ? d.home_id : d.away_id;
      const other = side === "h" ? d.away_id : d.home_id;
      const opts = c.teamIds.map((id) => {
        const t = c.T[id];
        return `<button type="button" class="a-tp${other === id ? " dim" : ""}" data-a="team" data-side="${side}" data-id="${esc(id)}" ${pressed(mine === id)}><img src="${esc(t.svg)}" alt="">${esc(t.name)}</button>`;
      }).join("");
      return `<div class="a-field"><span class="lbl">${label}</span><div class="a-teams-pick">${opts}</div></div>`;
    };
    let kolo = "";
    if (d.id === "new") {
      const ks = c.raw.filter((m) => m.stage === "R").map((m) => m.round);
      const maxK = ks.length ? Math.max(...ks) : 0;
      const btns = [];
      for (let k = 1; k <= maxK + 1; k++) btns.push(`<button type="button" data-a="round" data-id="${k}" ${pressed(d.round === k)}>${k > maxK ? `Nové ${k}.` : k}</button>`);
      kolo = `<div class="a-field"><span class="lbl">Kolo</span><div class="a-kolo">${btns.join("")}</div></div>`;
    }
    return `<fieldset class="a-fs"><legend>Tímy</legend>${row("Domáci", "h")}${row("Hostia", "a")}${kolo}</fieldset>`;
  }

  function fixedTeams(c, d, t) {
    const done = d.status === "done" && t[0] && t[1];
    const sc = L.score(d.goals);
    const side = (id, i) => {
      const T = id && (c.T[id] || NOTEAM);
      return `<span class="side">${T ? `<img src="${esc(T.svg)}" alt="">` : '<span class="blank" aria-hidden="true"></span>'}
        <span class="nm">${esc(teamName(c, id, d.stage, i))}</span><span class="role" style="color:${T ? T.ink : "#FFFFFF"}">${i ? "Hostia" : "Domáci"}</span></span>`;
    };
    const H = t[0] && (c.T[t[0]] || NOTEAM);
    const A = t[1] && (c.T[t[1]] || NOTEAM);
    const sub = d.status === "done" ? "Odohraný" : d.tbd ? "Termín sa hľadá" : d.date ? `${L.shortDate(d.date)} · ${d.time}` : "—";
    return `<div class="a-fixed">
      <span class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${H ? H.c : "#1A1A1A"}, ${H ? H.d : "#0E0E0E"});clip-path:polygon(0 0, 57% 0, 43% 100%, 0 100%)"></span>
      <span class="fill" aria-hidden="true" style="background:linear-gradient(210deg, ${A ? A.c : "#1A1A1A"}, ${A ? A.d : "#0E0E0E"});clip-path:polygon(57% 0, 100% 0, 100% 100%, 43% 100%)"></span>
      <span class="fill" aria-hidden="true" style="background:repeating-linear-gradient(115deg, rgba(0,0,0,0) 0 14px, rgba(0,0,0,0.07) 14px 15px)"></span>
      ${side(t[0], 0)}<span class="vs"><b style="font-size:${done ? "clamp(40px, 5cqi, 64px)" : "30px"}">${done ? `${sc.h}:${sc.a}` : "VS"}</b><span>${esc(sub)}</span></span>${side(t[1], 1)}</div>`;
  }

  function calendar(c, d) {
    const { y, m0 } = S.cal;
    const busy = new Set(c.raw.filter((m) => m.starts_at && m.id !== d.id).map((m) => L.matchDate(m)));
    const now = today();
    const days = L.monthDays(y, m0).map((iso) => {
      const [, mm, dd] = iso.split("-").map(Number);
      const inMonth = mm === m0 + 1;
      const sel = !d.tbd && d.date === iso;
      const tue = new Date(`${iso}T12:00:00Z`).getUTCDay() === 2;
      const cls = [inMonth ? "" : "out", tue && inMonth ? "tue" : "", iso === now ? "today" : ""].filter(Boolean).join(" ");
      return `<button type="button"${cls ? ` class="${cls}"` : ""} data-a="day" data-id="${iso}" aria-label="${L.longDate(iso)}" ${pressed(sel)}>${dd}${busy.has(iso) ? "<i></i>" : ""}</button>`;
    }).join("");
    const wd = ["PO", "UT", "ST", "ŠT", "PI", "SO", "NE"].map((w) => `<span class="wd${w === "UT" ? " tue" : ""}">${w}</span>`).join("");
    return `<div class="a-cal"><div class="a-cal-head"><button type="button" class="a-sq" data-a="cal" data-id="-1" aria-label="Predchádzajúci mesiac">${icon.back}</button>
        <b>${MONTHS[m0]} ${y}</b><button type="button" class="a-sq" data-a="cal" data-id="1" aria-label="Ďalší mesiac">${icon.next}</button></div>
      <div class="a-days">${wd}${days}</div>
      <span class="a-legend"><span><i style="width:10px;height:10px;background:#222222"></i>utorky</span><span><i style="width:6px;height:6px;background:#9A9A9A"></i>iný zápas v ten deň</span><span><i style="width:10px;height:10px;border:1px solid #9A9A9A"></i>dnes</span></span></div>`;
  }

  function termSection(c, d, saved) {
    const tabs = [[false, "Presný termín"], [true, "Termín neznámy"]].map(([v, label]) => `<button type="button" data-a="tbd" data-id="${v ? 1 : 0}" ${pressed(d.tbd === v)}>${label}</button>`).join("");
    let body = "";
    if (!d.tbd) {
      const chips = TIMES.map((tm) => `<button type="button" data-a="time" data-id="${tm}" ${pressed(d.time === tm)}>${tm}</button>`).join("");
      const savedDate = saved && saved.starts_at ? L.matchDate(saved) : null;
      const changed = !!savedDate && (d.date !== savedDate || d.time !== L.matchTime(saved));
      body = `<div class="a-term">${calendar(c, d)}<div class="a-time"><span class="lbl">Čas začiatku</span><div class="a-chips2">${chips}</div>
          <div class="a-step"><button type="button" data-a="shift" data-id="-15" aria-label="O 15 minút skôr">−</button><output aria-label="Zvolený čas">${esc(d.time || "--:--")}</output>
            <button type="button" class="plus" data-a="shift" data-id="15" aria-label="O 15 minút neskôr">+</button></div>
          <span class="small">Tlačidlá posúvajú čas po 15 minútach.</span>
          <div class="a-sum"><span class="lbl">Na webe sa zobrazí</span><b${d.date ? "" : ' class="warn"'}>${d.date ? `${L.longDate(d.date)} · ${esc(d.time)}` : "Vyber dátum v kalendári"}</b></div></div></div>
        ${changed ? `<div class="a-changed"><span>Termín sa mení z <s>${esc(L.slot(saved.starts_at))}</s> na <strong>${esc(`${L.shortDate(d.date)} · ${d.time}`)}</strong>.</span>
          <button type="button" class="a-switch" data-a="markMoved" ${pressed(d.markMoved)}><i aria-hidden="true"></i>Ukázať na webe ako „Presunutý“</button></div>` : ""}`;
    } else {
      const orig = saved && saved.starts_at ? L.slot(saved.starts_at) : d.orig_starts_at ? L.slot(d.orig_starts_at) : "";
      const week = d.window_from && d.window_to >= today() ? ` Kým nie je termín, web ukazuje týždeň ${L.weekLabel(d.window_from, d.window_to)}.` : "";
      body = `<div class="a-info">${icon.tbd}<span><strong>Na webe: „Termín sa hľadá“</strong><small>${orig ? `Pôvodný termín ${esc(orig)} ostane na webe prečiarknutý. ` : ""}Keď sa dohodnete, prepni späť na „Presný termín“${orig ? "" : " a vyber deň"}.${week}</small></span></div>`;
    }
    return `<fieldset class="a-fs"><legend>Termín</legend><div class="a-seg" role="group" aria-label="Typ termínu">${tabs}</div>${body}
      <label class="a-field lbl">Poznámka k zápasu (nepovinné, uvidia ju všetci)
        <input type="text" class="a-input" data-in="note" value="${esc(d.note)}" placeholder="napr. hrá sa v malej telocvični" style="letter-spacing:0;text-transform:none"></label></fieldset>`;
  }

  function goalRows(c, d, t) {
    let h = 0;
    let a = 0;
    const roster = (teamId) => c.roster.filter((r) => r.team_id === teamId).map((r) => c.P[r.player_id]).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name, "sk"));
    const nameOf = (id) => (id === L.UNKNOWN ? "Neznámy hráč" : c.P[id] ? c.P[id].name : "");
    return d.goals.map((g, i) => {
      if (g.side === "h") h++; else a++;
      const T = c.T[g.side === "h" ? t[0] : t[1]] || NOTEAM;
      const picking = S.pick && S.pick.i === i ? S.pick.f : null;
      let pick = "";
      if (picking) {
        const pool = roster(T.id).filter((p) => picking === "s" || p.id !== g.scorer);
        const cur = picking === "s" ? g.scorer : g.assist;
        const opts = pool.map((p) => `<button type="button" data-a="choose" data-i="${i}" data-f="${picking}" data-id="${esc(p.id)}" ${pressed(cur === p.id)}>${esc(p.name)}</button>`);
        opts.push(picking === "s"
          ? `<button type="button" class="spec" data-a="choose" data-i="${i}" data-f="s" data-id="${L.UNKNOWN}" ${pressed(g.scorer === L.UNKNOWN)}>Neznámy hráč</button>`
          : `<button type="button" class="spec" data-a="choose" data-i="${i}" data-f="as" data-id="" ${pressed(!g.assist)}>Bez asistencie</button>`);
        pick = `<div class="a-pick"><b>${picking === "s" ? `Kto dal gól? (${esc(T.name)})` : "Kto asistoval?"}</b><div>${opts.join("")}</div></div>`;
      }
      const sName = nameOf(g.scorer);
      const aName = g.assist ? nameOf(g.assist) : "";
      return `<div class="a-goal${picking ? " picking" : ""}"><div class="a-goal-row" style="${vars(T)}"><span class="sc">${h}:${a}</span><img src="${esc(T.svg)}" alt="${esc(T.name)}">
        <button type="button" class="a-who${picking === "s" ? " on" : sName ? "" : " miss"}" data-a="pick" data-i="${i}" data-f="s"><span class="lbl">Gól</span><b>${esc(sName || "Vyber strelca")}</b></button>
        <button type="button" class="a-who${picking === "as" ? " on" : aName ? "" : " none"}" data-a="pick" data-i="${i}" data-f="as"><span class="lbl">Asistencia</span><b>${esc(aName || "bez asistencie")}</b></button>
        <button type="button" class="a-x" data-a="delGoal" data-i="${i}" aria-label="Vymazať gól ${i + 1}">${icon.x}</button></div>${pick}</div>`;
    }).join("");
  }

  function statusSection(c, d, t) {
    const tabs = [["plan", "Naplánovaný"], ["done", "Odohraný"]].map(([v, label]) => `<button type="button" data-a="status" data-id="${v}" ${pressed(d.status === v)}>${label}</button>`).join("");
    let body = "";
    const known = t[0] && t[1];
    if (d.status === "done" && !known) body = '<span class="a-lock">Výsledok sa dá zapísať, až keď sú známe oba tímy.</span>';
    if (d.status === "done" && known) {
      const sc = L.score(d.goals);
      const box = (side, id) => {
        const T = c.T[id] || NOTEAM;
        const mine = side === "h" ? sc.h : sc.a;
        const theirs = side === "h" ? sc.a : sc.h;
        return `<div style="${vars(T)}"><span class="tm"><img src="${esc(T.svg)}" alt=""><b>${esc(T.name)}</b></span><span class="ctl">
          <button type="button" data-a="goalMinus" data-id="${side}" aria-label="Uber gól ${esc(T.name)}">−</button><output class="${mine < theirs ? "less" : ""}" aria-label="Góly ${esc(T.name)}">${mine}</output>
          <button type="button" class="plus" data-a="goalPlus" data-id="${side}" aria-label="Pridaj gól ${esc(T.name)}">+</button></span></div>`;
      };
      const draw = d.stage !== "R" && sc.h === sc.a && sc.h + sc.a > 0;
      body = `<div class="a-score">${box("h", t[0])}${box("a", t[1])}</div>
        ${draw ? '<span class="a-warn">Playoff zápas nemôže skončiť remízou — zapíš aj gól z predĺženia alebo nájazdov.</span>' : ""}
        <div class="a-goals"><span class="lbl">Góly v poradí · klikni na meno a zmeň ho</span>
          ${d.goals.length ? goalRows(c, d, t) : '<span class="a-lock">Zatiaľ žiadny gól. Pridaj ho tlačidlom + pri tíme.</span>'}</div>`;
    }
    return `<fieldset class="a-fs"><legend>Stav zápasu</legend><div class="a-seg" role="group" aria-label="Stav">${tabs}</div>${body}</fieldset>`;
  }

  function matchEditor(c) {
    const d = S.draft;
    if (!d) {
      return `<div class="a-placeholder">${S.toast ? `<span style="padding:8px 12px;border:1px solid #FFFFFF;font-weight:600">${esc(S.toast)}</span>` : ""}
        <b>Vyber zápas</b><span class="muted">Klikni na zápas v zozname — budúci aj odohraný. Alebo pridaj nový.</span></div>`;
    }
    const saved = d.id === "new" ? null : savedOf(c, d.id);
    const t = teamsFor(d, c);
    const isNew = d.id === "new";
    const manualSF = c.s.seed_mode === "manual" && (d.stage === "SF1" || d.stage === "SF2");
    const picker = d.stage === "R" ? isNew : manualSF;
    const H = t[0] && (c.T[t[0]] || NOTEAM);
    const A = t[1] && (c.T[t[1]] || NOTEAM);
    const vs = `${teamName(c, t[0], d.stage, 0)} vs ${teamName(c, t[1], d.stage, 1)}`;
    const title = isNew ? (t[0] && t[1] ? vs : "Vyber tímy") : d.stage === "R" ? vs : STAGE[d.stage];
    const kicker = isNew ? "Nový zápas" : d.stage === "R" ? `Kolo ${d.round}` : `Playoff · ${STAGE[d.stage]}`;
    const clean = (x) => JSON.stringify(Object.assign({}, x, { markMoved: undefined }));
    const dirty = isNew || !saved || clean(d) !== clean(L.draftOf(saved, c.gm[d.id], c.settings.defaultTime));
    const note = d.stage === "SF1" || d.stage === "SF2"
      ? (c.s.seed_mode === "manual" ? "" : "Dvojica sa berie z tabuľky (1.–4., 2.–3.), keď je odohraná celá základná časť. Ak ju chceš určiť sám, prepni vľavo na „Ručne“.")
      : d.stage === "F" || d.stage === "B3" ? "Tímy sa doplnia samé po zapísaní výsledkov semifinále." : "";
    return `<div class="a-ed"><div class="a-ed-head">
        <span class="sh" aria-hidden="true" style="background:linear-gradient(160deg, ${H ? H.c : "#1A1A1A"}, ${H ? H.d : "#0E0E0E"});clip-path:polygon(30% 0, 64% 0, 46% 100%, 12% 100%)"></span>
        <span class="sh" aria-hidden="true" style="background:linear-gradient(160deg, ${A ? A.c : "#1A1A1A"}, ${A ? A.d : "#0E0E0E"});clip-path:polygon(70% 0, 100% 0, 100% 100%, 52% 100%)"></span>
        ${backBtn("back", "Späť na zoznam")}<span class="tt"><span class="lbl">${esc(kicker)}</span><b>${esc(title)}</b></span>
        ${dirty && !S.toast ? '<span class="a-dirty">Neuložené zmeny</span>' : ""}</div>
      ${msgs()}
      <div class="a-body">${picker ? teamPicker(c, d) : fixedTeams(c, d, t)}${note ? `<span class="muted" style="font-size:13px">${note}</span>` : ""}
        ${termSection(c, d, saved)}${statusSection(c, d, t)}
        <div class="a-actions"><button type="button" class="a-save" data-a="saveMatch"${S.busy ? " disabled" : ""}>${S.busy ? "Ukladám…" : isNew ? "Pridať zápas" : "Uložiť zmeny"}</button>
          <button type="button" class="a-ghost" data-a="cancel">Zahodiť zmeny</button>
          ${!isNew && d.stage === "R" ? `<button type="button" class="a-del" data-a="delMatch">${icon.trash}Vymazať zápas</button>` : ""}</div></div></div>`;
  }

  /* ---------- Tímy a hráči ---------- */
  function teamList(c) {
    const n = c.roster.length;
    const rows = c.teamIds.map((id) => {
      const t = c.T[id];
      const rs = c.roster.filter((r) => r.team_id === id);
      const cap = rs.find((r) => r.captain);
      const info = rs.length ? `${rs.length} ${plural(rs.length, "hráč", "hráči", "hráčov")} · ${cap && c.P[cap.player_id] ? `kapitán ${c.P[cap.player_id].name}` : "bez kapitána"}` : "Súpiska je prázdna";
      return `<button type="button" class="a-trow" data-a="team-sel" data-id="${esc(id)}" aria-current="${S.teamSel === id}" style="${vars(t)}"><span class="shard" aria-hidden="true"></span>
        <span class="txt"><span class="lbl">${esc(t.pre)}</span><span class="nm">${esc(t.name)}</span><span class="info${rs.length ? "" : " warn"}">${esc(info)}</span></span><img src="${esc(t.svg)}" alt=""></button>`;
    }).join("");
    return `<div class="a-panel"><div class="a-panel-head"><span><h1 class="a-h1">Tímy a hráči</h1>
      <span class="small" style="font-size:13px">${c.teamIds.length} ${plural(c.teamIds.length, "tím", "tímy", "tímov")} · ${n} ${plural(n, "hráč", "hráči", "hráčov")}</span></span>
      <button type="button" class="a-new" data-a="newTeam">${icon.plus}Nový tím</button></div>${rows}
      <div class="a-bulk"><label class="a-ghost w${S.uploading === "*" ? " busy" : ""}">${icon.cam}${S.uploading === "*" ? "Nahrávam…" : "Nahrať fotky viacerých hráčov naraz"}
          <input type="file" accept="image/png, image/jpeg, image/webp" multiple data-photos-bulk="1"${S.uploading === "*" ? " disabled" : ""}></label>
        <span class="small">Súbory pomenované <code>id-hráča_full</code>, <code>_head</code>, <code>_face</code> (napr. <code>p-bartos-andrej_full.webp</code>) — priradia sa samé.</span></div></div>`;
  }

  function teamEditor(c) {
    const id = S.teamSel;
    const t = c.T[id] || NOTEAM;
    const stats = {};
    c.resolved.filter(L.isPlayed).forEach((m) => (c.gm[m.id] || []).forEach((g) => {
      if (g.scorer_id) { stats[g.scorer_id] = stats[g.scorer_id] || { g: 0, a: 0 }; stats[g.scorer_id].g++; }
      if (g.assist_id) { stats[g.assist_id] = stats[g.assist_id] || { g: 0, a: 0 }; stats[g.assist_id].a++; }
    }));
    const rs = c.roster.filter((r) => r.team_id === id).map((r) => ({ r, p: c.P[r.player_id] })).filter((x) => x.p)
      .sort((a, b) => (b.r.captain - a.r.captain) || a.p.name.localeCompare(b.p.name, "sk"));
    const cap = rs.find((x) => x.r.captain);
    const capFull = cap && cap.p.photo ? DB.photoUrl(cap.p.photo) : "";
    const others = c.teamIds.filter((x) => x !== id);
    const players = rs.map(({ r, p }) => {
      const st = stats[p.id] || { g: 0, a: 0 };
      const moving = S.moving === p.id;
      const face = p.photo_face ? DB.photoUrl(p.photo_face) : "";
      const busy = S.uploading === p.id;
      const targets = moving ? `<div class="a-targets"><span class="muted" style="margin-right:4px;font-size:13px">Presunúť do:</span>${others.map((o) => {
        const ot = c.T[o];
        return `<button type="button" data-a="moveTo" data-id="${esc(p.id)}" data-to="${esc(o)}" style="${vars(ot)}"><img src="${esc(ot.svg)}" alt="">${esc(ot.name)}</button>`;
      }).join("")}</div>` : "";
      return `<div class="a-pl${moving ? " moving" : ""}"><div class="a-pl-row">
        <span class="av" style="${vars(t)}">${face ? `<img src="${esc(face)}" alt="">` : `<span>${esc(L.initials(p.name))}</span>`}</span>
        <span class="who"><b>${esc(p.name)}</b><small>${st.g} G · ${st.a} A v tejto sezóne${r.captain ? " · kapitán" : ""}</small></span>
        <span class="ctl"><label class="a-cam${p.photo ? " has" : ""}${busy ? " busy" : ""}" title="${p.photo ? "Zmeniť fotku" : "Nahrať fotku"}">${icon.cam}
            <input type="file" accept="image/png, image/jpeg, image/webp" multiple data-photo="${esc(p.id)}" aria-label="${p.photo ? "Zmeniť fotku" : "Nahrať fotku"}: ${esc(p.name)}"${busy ? " disabled" : ""}></label>
          <button type="button" class="a-cap" data-a="cap" data-id="${esc(p.id)}" ${pressed(r.captain)} aria-label="Kapitán: ${esc(p.name)}">C</button>
          <button type="button" class="a-move" data-a="moving" data-id="${esc(p.id)}" aria-expanded="${moving}">${icon.arrow}Presunúť</button>
          <button type="button" class="a-x" data-a="rmPlayer" data-id="${esc(p.id)}" aria-label="Odstrániť: ${esc(p.name)}">${icon.x}</button></span></div>${targets}</div>`;
    }).join("");
    return `<div class="a-ed"><div class="a-team-head">
        <span class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${t.c}, ${t.d});clip-path:polygon(0 0, 62% 0, 50% 100%, 0 100%)"></span>
        <span class="fill" aria-hidden="true" style="background:repeating-linear-gradient(115deg, rgba(0,0,0,0) 0 14px, rgba(0,0,0,0.07) 14px 15px)"></span>
        ${capFull ? `<span aria-hidden="true" style="position:absolute;top:0;right:0;bottom:0;width:30%;background:linear-gradient(200deg, ${t.c}, ${t.d});clip-path:polygon(34% 0, 100% 0, 100% 100%, 0 100%);opacity:0.6"></span>
          <img class="capt" src="${esc(capFull)}" alt="${esc(cap.p.name)}, kapitán">` : ""}
        ${backBtn("teamBack", "Späť na tímy")}<img class="logo" src="${esc(t.svg)}" alt="">
        <span class="tt"><small>Tím · ${esc(t.pre)}</small><span>${rs.length} ${plural(rs.length, "hráč", "hráči", "hráčov")} · ${esc(c.s.name)}</span><b>${esc(t.name)}</b></span>
        <button type="button" class="a-ghost w a-edteam" data-a="editTeam" data-id="${esc(id)}">Upraviť tím</button></div>
      ${msgs()}
      <div class="a-body"><fieldset class="a-fs" style="gap:8px"><legend>Súpiska · ${esc(c.s.name)}</legend>
          <span class="muted" style="font-size:13px">Klikni na „C“ a nastavíš kapitána. „Presunúť“ pošle hráča do iného tímu. Tlačidlo s fotoaparátom nahrá fotku — najlepšie PNG s priehľadným pozadím, postava od pása hore (pripravené súbory <code>_full</code>, <code>_head</code>, <code>_face</code> môžeš vybrať naraz). Zmeny sa ukladajú hneď.</span>
          ${players || '<span class="a-lock">Súpiska je zatiaľ prázdna — pridaj hráčov, keď bude po drafte.</span>'}</fieldset>
        <fieldset class="a-fs" style="gap:10px"><legend>Pridať hráča</legend><div class="a-add">
          <input type="text" class="a-input" data-in="newName" aria-label="Meno nového hráča" value="${esc(S.newName)}" placeholder="Meno a priezvisko">
          <button type="button" data-a="addPlayer">Pridať do tímu</button></div>
          <span class="small">Nový hráč sa hneď objaví v súpiske na webe aj pri výbere strelca.</span></fieldset></div></div>`;
  }

  /* ---------- Sezóny ---------- */
  function seasonList(c) {
    const rows = c.d.seasons.map((x) => {
      const st = STATE[x.state];
      const ms = c.d.matches.filter((m) => m.season_id === x.id);
      const reg = ms.filter((m) => m.stage === "R").length;
      const sd = x.state === "done" ? seasonData(c.d, x, c.P) : null;
      const ch = sd && sd.champ ? c.T[sd.champ] : null;
      const info = (reg ? `${reg} zápasov · ${ms.filter((m) => m.status === "done").length} odohraných` : "Zatiaľ bez zápasov") + (x.id === c.s.id ? " · práve upravuješ" : "");
      return `<button type="button" class="a-trow a-srow" data-a="season-sel" data-id="${esc(x.id)}" aria-current="${S.seasonSel === x.id}">
        <span class="txt" style="gap:5px"><span class="a-schip-state" style="background:${st.chipBg};color:${st.chipFg};border:1px ${st.line} ${st.chipBd}"><i aria-hidden="true" style="background:${st.dot}"></i>${st.status}</span>
          <span class="nm">${esc(x.name)}</span><span class="info">${esc(info)}</span></span>
        ${ch ? `<span class="champ"><img src="${esc(ch.svg)}" alt="">šampión</span>` : ""}</button>`;
    }).join("");
    return `<div class="a-panel"><div class="a-panel-head"><h1 class="a-h1">Sezóny</h1><button type="button" class="a-new" data-a="season-sel" data-id="new">${icon.plus}Nová sezóna</button></div>${rows}</div>`;
  }

  function seasonEditor(c) {
    const d = S.seasonDraft;
    const isNew = d.id === "new";
    const st = STATE[d.state];
    const sd = isNew ? null : seasonData(c.d, Object.assign({}, c.d.seasons.find((x) => x.id === d.id)), c.P);
    const ch = sd && sd.champ ? c.T[sd.champ] : null;
    const shard = { live: "linear-gradient(160deg, #FFFFFF, #6A6A6A)", done: ch ? `linear-gradient(160deg, ${ch.c}, ${ch.d})` : "linear-gradient(160deg, #6A6A6A, #1A1A1A)", soon: "repeating-linear-gradient(115deg, #2E2E2E 0 6px, #141414 6px 12px)" }[d.state];
    const tabs = [["soon", "Pripravujeme"], ["live", "Prebieha"], ["done", "Skončená"]].map(([v, label]) =>
      `<button type="button" data-a="sstate" data-id="${v}" ${pressed(d.state === v)}>${sq(STATE[v], d.state === v)}${label}</button>`).join("");
    const title = { soon: "Na webe: banner „Pripravujeme“", live: "Na webe: hlavná sezóna", done: "Na webe: archív" }[d.state];
    const help = { soon: "Ľudia uvidia len logo FULky a nápis, že sezóna sa chystá.", live: "Web ju ukazuje ako hlavnú — výsledky, rozpis, tabuľku, hráčov aj playoff.", done: "Ľudia si pozrú šampióna, konečné poradie, tabuľku, playoff a všetky výsledky." }[d.state];
    const otherLive = c.d.seasons.find((x) => x.state === "live" && x.id !== d.id);
    const chips = c.d.teams.map((t) => {
      const T = c.T[t.id];
      const on = d.teams.includes(t.id);
      return `<button type="button" class="a-tp${on ? "" : " dim"}" data-a="steam" data-id="${esc(t.id)}" ${pressed(on)}><img src="${esc(T.svg)}" alt="">${esc(T.name)}</button>`;
    }).join("");
    const ms = isNew ? [] : c.d.matches.filter((m) => m.season_id === d.id);
    const nPlayers = isNew ? 0 : c.d.roster.filter((r) => r.season_id === d.id).length;
    const stats = [[ms.filter((m) => m.stage === "R").length, "zápasov v základnej časti"], [ms.filter((m) => m.status === "done").length, "odohraných zápasov"], [nPlayers, "hráčov na súpiskách"]]
      .map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
    return `<div class="a-ed"><div class="a-ed-head"><span class="sh" aria-hidden="true" style="background:${shard};clip-path:polygon(30% 0, 100% 0, 100% 100%, 12% 100%)"></span>
        ${backBtn("seasonBack", "Späť na sezóny")}<span class="tt"><span class="lbl">${isNew ? "Nová sezóna" : `Sezóna · ${st.status}`}</span><b>${esc(d.name || "Nová sezóna")}</b></span></div>
      ${msgs()}
      <div class="a-body"><label class="a-field lbl">Názov sezóny<input type="text" class="a-input big" data-in="seasonName" value="${esc(d.name)}" placeholder="napr. Jarná sezóna 2027" style="text-transform:none"></label>
        <fieldset class="a-fs" style="gap:12px"><legend>Stav na webe</legend><div class="a-seg" role="group" aria-label="Stav sezóny">${tabs}</div>
          <div class="a-info solid">${icon.screen}<span><strong>${title}</strong><small>${help}</small></span></div>
          ${d.state === "live" && otherLive ? `<span class="a-warn" style="background:rgba(255,176,32,0.08)">„${esc(otherLive.name)}“ sa po uložení prepne na Skončená — naraz môže prebiehať len jedna sezóna.</span>` : ""}</fieldset>
        <fieldset class="a-fs" style="gap:10px"><legend>Tímy v sezóne</legend><div class="a-teams-pick" style="grid-template-columns:repeat(auto-fit, minmax(130px, 1fr))">${chips}</div></fieldset>
        ${ch ? `<div class="a-champ" style="${vars(ch)}"><span class="shard" aria-hidden="true"></span><img src="${esc(ch.gif)}" alt=""><span style="position:relative"><span class="lbl">Šampión (z výsledku finále)</span><b>${esc(ch.name)}</b></span></div>` : ""}
        <div class="a-stats">${stats}</div>
        <div class="a-actions"><button type="button" class="a-save" data-a="saveSeason"${S.busy ? " disabled" : ""}>${S.busy ? "Ukladám…" : isNew ? "Vytvoriť sezónu" : "Uložiť sezónu"}</button>
          ${isNew ? "" : `<button type="button" class="a-ghost w" data-a="openSeason" data-id="${esc(d.id)}">Upravovať zápasy tejto sezóny${icon.next}</button>`}</div></div></div>`;
  }

  /* ---------- Nastavenia ---------- */
  // rozpracované nastavenia (banner, fotky, písmo); null = také, aké sú uložené
  const savedSet = (c) => ({ bannerCount: c.settings.bannerCount, photos: c.settings.photos !== false, headFont: "saira" /* Monument zatiaľ nie (licencia), prepínač je skrytý */, layout: c.settings.layout === "narrow" ? "narrow" : "wide" });
  const setDraftOf = (c) => S.setDraft || savedSet(c);

  function settingsPanel(c) {
    const sd = setDraftOf(c);
    const n = sd.bannerCount;
    const unit = (k) => (k === 1 ? "zápas" : "zápasy");
    const tabs = [1, 2, 3, 4].map((k) => `<button type="button" data-a="count" data-id="${k}" ${pressed(n === k)}><b>${k}</b><span>${unit(k)}</span></button>`).join("");
    const live = c.live ? seasonData(c.d, c.live, c.P) : null;
    const shown = live ? L.nextMatches(live.resolved, n) : [];
    const cards = shown.map((m) => {
      const H = c.T[m.home_id] || NOTEAM;
      const A = c.T[m.away_id] || NOTEAM;
      const day = m.starts_at ? `${L.shortDate(L.matchDate(m))} · ${m.stage === "R" ? `K${m.round}` : STAGE_SHORT[m.stage]}` : `týždeň ${L.dShort(m.window_from)}`;
      return `<div class="a-prev-card"><span class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${H.c}, ${H.d})"></span>
        <span class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${A.c}, ${A.d});clip-path:polygon(60% 0, 100% 0, 100% 100%, 40% 100%)"></span>
        <img src="${esc(H.svg)}" alt=""><span class="t"><b>${m.starts_at ? L.matchTime(m) : "vs"}</b><span>${esc(day)}</span></span><img src="${esc(A.svg)}" alt=""></div>`;
    }).join("");
    const pn = shown.length < n ? `Naplánovaných zápasov je teraz len ${shown.length}, viac ich na banneri nebude.` : n === 1 ? "Jeden veľký zápas cez celý banner." : "Na počítači budú zápasy vedľa seba, na mobile pod sebou.";
    const dirty = JSON.stringify(sd) !== JSON.stringify(savedSet(c));
    const seg = (act, opts, cur) => `<div class="a-seg" role="group">${opts.map(([v, label]) => `<button type="button" data-a="${act}" data-id="${v}" ${pressed(String(cur) === v)}>${label}</button>`).join("")}</div>`;
    const look = (q, label) => `<a class="a-ghost w" href="./?${q}" target="_blank" rel="noopener">${label}${icon.next}</a>`;
    return `<div class="a-ed"><div class="a-ed-head"><span class="sh" aria-hidden="true" style="width:30%;background:repeating-linear-gradient(115deg, #2E2E2E 0 6px, #141414 6px 12px);clip-path:polygon(30% 0, 100% 0, 100% 100%, 12% 100%)"></span>
        <span class="tt"><span class="lbl">Nastavenia webu</span><b>Hlavná stránka</b></span>${dirty ? '<span class="a-dirty">Neuložené zmeny</span>' : ""}</div>
      ${msgs()}
      <div class="a-body"><fieldset class="a-fs" style="gap:12px"><legend>Banner — najbližšie zápasy</legend>
          <span class="muted" style="font-size:14px">Koľko najbližších zápasov ukázať hore na hlavnej stránke. Hrajú sa dva zápasy za kolo, takže „2“ ukáže celé najbližšie kolo.</span>
          <div class="a-count" role="group" aria-label="Počet zápasov na banneri">${tabs}</div>
          <div class="a-field" style="gap:8px"><span class="lbl">Takto bude vyzerať banner</span>
            <div class="a-prev"><span class="kicker sm" style="font-size:14px;padding:3px 12px">${shown.length === 1 ? "Najbližší zápas" : "Najbližšie zápasy"}</span><div class="a-prev-grid">${cards}</div></div>
            <span class="small">${pn}</span></div></fieldset>
        <fieldset class="a-fs" style="gap:12px"><legend>Fotky hráčov</legend>
          <span class="muted" style="font-size:14px">Bez fotiek ukáže web iniciály a siluety. Nahraté fotky ostanú uložené, dajú sa kedykoľvek znova zapnúť.</span>
          ${seg("sphotos", [["true", "Ukazovať fotky"], ["false", "Bez fotiek"]], sd.photos)}
          <div class="a-actions">${look("fotky=ano", "Pozrieť s fotkami")}${look("fotky=nie", "Pozrieť bez fotiek")}</div></fieldset>
        <fieldset class="a-fs" style="gap:12px"><legend>Rozloženie</legend>
          <span class="muted" style="font-size:14px">Úzke: užšia stránka, štatistiky v tabuľkách hneď pri menách a v rozpise termín pod zápasom v strede.</span>
          ${seg("slayout", [["wide", "Široké (ako návrh)"], ["narrow", "Úzke"]], sd.layout)}
          <div class="a-actions">${look("rozlozenie=siroke", "Pozrieť široké")}${look("rozlozenie=uzke", "Pozrieť úzke")}</div></fieldset>
        <div class="a-actions"><button type="button" class="a-save" data-a="saveSettings"${S.busy ? " disabled" : ""}>${S.busy ? "Ukladám…" : "Uložiť nastavenia"}</button>
          <button type="button" class="a-ghost" data-a="resetSettings">Zahodiť zmeny</button></div></div></div>`;
  }

  /* ---------- Prihlásenie ---------- */
  function loginView() {
    return `<header class="a-top"><div class="wrap a-top-in"><a class="brand" href="./" aria-label="FULka — na hlavnú stránku webu"><img src="assets/logos/ful-mark-white.png" alt="">
      <span class="brand-name"><b>FULka</b><small>Florbalová Upece Liga</small></span></a><span class="a-badge">Admin</span>
      <span class="a-links"><a class="a-link" href="./">${icon.back}Na web</a></span></div></header>
      <main class="wrap"><div class="a-ed a-login"><div class="a-ed-head"><span class="sh" aria-hidden="true" style="background:linear-gradient(160deg, #FFFFFF, #6A6A6A);clip-path:polygon(30% 0, 100% 0, 100% 100%, 12% 100%)"></span>
        <span class="tt"><span class="lbl">Admin FULky</span><b>Prihlásenie</b></span></div>
        ${S.loginError ? `<div class="a-error" role="alert">${icon.err}${esc(S.loginError)}</div>` : ""}
        <form data-form="login"><label class="a-field lbl">E-mail<input class="a-input" type="email" name="email" autocomplete="username" required style="text-transform:none;letter-spacing:0"></label>
          <label class="a-field lbl">Heslo<input class="a-input" type="password" name="password" autocomplete="current-password" required style="text-transform:none;letter-spacing:0"></label>
          <button type="submit" class="a-save"${S.busy ? " disabled" : ""}>${S.busy ? "Prihlasujem…" : "Prihlásiť"}</button></form></div></main>`;
  }

  /* ---------- Hlavné vykreslenie ---------- */
  function render() {
    if (!DB.user()) { app.innerHTML = `<div class="adm">${loginView()}</div>`; document.title = "FULka – admin"; return; }
    if (!S.data) { app.innerHTML = '<p class="msg">Načítavam…</p>'; return; }
    const c = ctx();
    if (!c.s) { app.innerHTML = `<div class="adm">${header(c)}<p class="msg">V databáze nie je žiadna sezóna.</p></div>`; return; }
    if (S.tab === "teams" && !S.teamSel && !S.teamDraft && !mobile()) S.teamSel = c.teamIds[0] || null;
    if (S.tab === "seasons" && !S.seasonDraft && !mobile()) { selectSeason(c.s.id); return; }
    const isMP = S.tab === "matches" || S.tab === "playoff";
    const detail = isMP ? !!S.draft : S.tab === "teams" ? !!(S.teamSel || S.teamDraft) : S.tab === "seasons" ? !!S.seasonDraft : true;
    const showLeft = S.tab !== "settings" && !(mobile() && detail);
    const showRight = S.tab === "settings" || !mobile() || detail;
    const left = { matches: matchList, playoff: playoffLeft, teams: teamList, seasons: seasonList }[S.tab];
    const right = isMP ? matchEditor(c) : S.tab === "teams" ? (S.teamDraft ? teamForm(c) : S.teamSel ? teamEditor(c) : "") : S.tab === "seasons" ? (S.seasonDraft ? seasonEditor(c) : "") : settingsPanel(c);
    const focus = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-a]");
    const key = focus ? `[data-a="${focus.dataset.a}"]${focus.dataset.id !== undefined ? `[data-id="${CSS.escape(focus.dataset.id)}"]` : ""}${focus.dataset.i !== undefined ? `[data-i="${focus.dataset.i}"]` : ""}` : null;
    app.innerHTML = `<div class="adm">${header(c)}${nav(c)}<main class="wrap a-main">
      ${showLeft && left ? `<section class="a-left" aria-label="Zoznam">${left(c)}</section>` : ""}
      ${showRight ? `<section class="a-right" aria-label="Úprava">${right}</section>` : ""}</main></div>`;
    document.title = `FULka – admin · ${c.s.name}`;
    if (key) { const el = app.querySelector(key); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- Udalosti ---------- */
  const ACTIONS = {
    logout: () => { DB.signOut(); render(); },
    tab: (el) => { S.tab = el.dataset.id; S.toast = ""; S.error = ""; S.moving = null; S.teamDraft = null; if (S.tab !== "matches" && S.tab !== "playoff") { S.sel = null; S.draft = null; } if (S.tab === "settings") S.setDraft = null; render(); },
    season: (el) => { S.season = el.dataset.id; S.teamDraft = null; S.sel = null; S.draft = null; S.teamSel = null; S.moving = null; S.filter = "all"; S.toast = ""; S.error = ""; render(); },
    filter: (el) => { S.filter = el.dataset.id; render(); },
    select: (el) => select(el.dataset.id),
    back: () => select(null),
    cancel: () => select(S.sel),
    team: (el) => patch(el.dataset.side === "h"
      ? { home_id: el.dataset.id, away_id: S.draft.away_id === el.dataset.id ? null : S.draft.away_id }
      : { away_id: el.dataset.id, home_id: S.draft.home_id === el.dataset.id ? null : S.draft.home_id }),
    round: (el) => patch({ round: Number(el.dataset.id) }),
    tbd: (el) => patch({ tbd: el.dataset.id === "1" }),
    day: (el) => patch({ date: el.dataset.id, tbd: false }),
    cal: (el) => { const k = S.cal.m0 + Number(el.dataset.id); S.cal = { y: S.cal.y + Math.floor(k / 12), m0: ((k % 12) + 12) % 12 }; render(); },
    time: (el) => patch({ time: el.dataset.id }),
    shift: (el) => patch({ time: L.shiftTime(S.draft.time, Number(el.dataset.id)) }),
    markMoved: () => patch({ markMoved: !S.draft.markMoved }),
    status: (el) => patch({ status: el.dataset.id }),
    goalPlus: (el) => addGoal(el.dataset.id),
    goalMinus: (el) => dropGoal(el.dataset.id),
    pick: (el) => { const i = Number(el.dataset.i); S.pick = S.pick && S.pick.i === i && S.pick.f === el.dataset.f ? null : { i, f: el.dataset.f }; render(); },
    choose: (el) => choose(Number(el.dataset.i), el.dataset.f, el.dataset.id),
    delGoal: (el) => { S.draft.goals.splice(Number(el.dataset.i), 1); S.pick = null; render(); },
    saveMatch: () => saveMatch(),
    delMatch: () => removeMatch(),
    seed: (el) => {
      const c = ctx();
      if (c.s.seed_mode === el.dataset.id) return;
      run(() => DB.upsert("seasons", Object.assign({}, c.s, { seed_mode: el.dataset.id })),
        el.dataset.id === "auto" ? "Semifinále sa teraz určí podľa tabuľky." : "Semifinále určuješ ručne — klikni na zápas a vyber tímy.", () => { if (S.sel) select(S.sel); });
    },
    newTeam: () => startTeam("new"),
    editTeam: (el) => startTeam(el.dataset.id),
    cancelTeam: () => { S.teamDraft = null; S.error = ""; render(); },
    saveTeam: () => saveTeam(),
    "team-sel": (el) => { S.teamDraft = null; S.teamSel = el.dataset.id; S.moving = null; S.newName = ""; S.toast = ""; S.error = ""; render(); },
    teamBack: () => { S.teamSel = null; S.moving = null; render(); },
    cap: (el) => toggleCaptain(el.dataset.id),
    moving: (el) => { S.moving = S.moving === el.dataset.id ? null : el.dataset.id; S.toast = ""; S.error = ""; render(); },
    moveTo: (el) => movePlayer(el.dataset.id, el.dataset.to),
    rmPlayer: (el) => removePlayer(el.dataset.id),
    addPlayer: () => addPlayer(),
    "season-sel": (el) => selectSeason(el.dataset.id),
    seasonBack: () => { S.seasonSel = null; S.seasonDraft = null; render(); },
    sstate: (el) => { S.seasonDraft.state = el.dataset.id; render(); },
    steam: (el) => { const t = S.seasonDraft.teams; const i = t.indexOf(el.dataset.id); if (i >= 0) t.splice(i, 1); else t.push(el.dataset.id); render(); },
    saveSeason: () => saveSeason(),
    openSeason: (el) => { S.season = el.dataset.id; S.tab = "matches"; S.sel = null; S.draft = null; S.toast = ""; S.error = ""; render(); },
    count: (el) => { S.setDraft = Object.assign(setDraftOf(ctx()), { bannerCount: Number(el.dataset.id) }); S.toast = ""; render(); },
    sphotos: (el) => { S.setDraft = Object.assign(setDraftOf(ctx()), { photos: el.dataset.id === "true" }); S.toast = ""; render(); },
    slayout: (el) => { S.setDraft = Object.assign(setDraftOf(ctx()), { layout: el.dataset.id }); S.toast = ""; render(); },
    resetSettings: () => { S.setDraft = null; render(); },
    saveSettings: () => {
      const sd = setDraftOf(ctx());
      run(() => DB.saveSettings(Object.assign({}, S.data.settings, sd)),
        `Uložené. Banner ukazuje ${sd.bannerCount} ${sd.bannerCount === 1 ? "zápas" : "zápasy"}, ${sd.photos ? "fotky sú zapnuté" : "fotky sú vypnuté"}, rozloženie ${sd.layout === "narrow" ? "úzke" : "široké"}.`,
        () => { S.setDraft = null; });
    },
  };

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-a]");
    if (!el || !app.contains(el) || el.disabled) return;
    const fn = ACTIONS[el.dataset.a];
    if (fn) { e.preventDefault(); fn(el); }
  });
  // písanie do polí neprekresľuje stránku (aby sa nestratil kurzor), iba si pamätá hodnotu
  app.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.in;
    if (k === "note" && S.draft) S.draft.note = e.target.value;
    if (k === "newName") S.newName = e.target.value;
    if (k === "seasonName" && S.seasonDraft) S.seasonDraft.name = e.target.value;
    if (S.teamDraft && k === "tname") S.teamDraft.name = e.target.value;
    if (S.teamDraft && k === "tvenue") S.teamDraft.venue = e.target.value;
    if (S.teamDraft && k === "tabbr") S.teamDraft.abbr = e.target.value.toUpperCase();
    if (S.teamDraft && e.target.dataset.tcolor) { S.teamDraft[e.target.dataset.tcolor] = e.target.value.toUpperCase(); const code = e.target.nextElementSibling; if (code) code.textContent = e.target.value.toUpperCase(); }
  });
  app.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.in === "newName") { e.preventDefault(); addPlayer(); }
  });
  app.addEventListener("change", (e) => {
    const id = e.target.dataset && e.target.dataset.photo;
    if (id) uploadPhoto(id, e.target.files);
    if (e.target.dataset && e.target.dataset.photosBulk) uploadMany(e.target.files);
    if (S.teamDraft && e.target.dataset && e.target.dataset.tcolor) render(); // farba vybraná → prekresliť náhľad
    const kind = e.target.dataset && e.target.dataset.tfile;
    if (S.teamDraft && kind) {
      const f = e.target.files[0];
      if (!f) return;
      if (!/^image\/(png|webp|jpeg)$/.test(f.type)) return fail("Logo musí byť PNG, WebP alebo JPG (SVG sa nahrať nedá).");
      S.teamDraft.files[kind] = f;
      S.teamDraft.files[`${kind}Url`] = URL.createObjectURL(f);
      render();
    }
  });
  app.addEventListener("submit", async (e) => {
    if (e.target.dataset.form !== "login") return;
    e.preventDefault();
    const f = new FormData(e.target);
    S.busy = true; S.loginError = ""; render();
    try {
      await DB.signIn(String(f.get("email")).trim(), String(f.get("password")));
    } catch (err) {
      S.loginError = err.status === 400 ? "Nesprávny e-mail alebo heslo." : "Prihlásenie sa nepodarilo. Skontroluj internet a skús znova.";
    }
    S.busy = false;
    render();
  });
  let wasMobile = mobile();
  window.addEventListener("resize", () => { if (mobile() !== wasMobile) { wasMobile = mobile(); render(); } });

  /* ---------- Štart ---------- */
  window.Admin = { setData(d) { S.data = d; if (!S.busy) render(); }, state: S, render };
  if (window.App && window.App.state.data) S.data = window.App.state.data;
  render();
})();
