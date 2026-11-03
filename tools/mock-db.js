// Zápisy adminu iba do pamäte prehliadača (nič neodchádza do Supabase). __mem() = dáta po zmenách, __writes = zoznam zápisov.
(() => {
  window.__writes = [];
  let mem = JSON.parse(JSON.stringify(App.state.data));
  const keyOf = (key) => (r) => key.split(",").map((k) => r[k]).join("|");
  DB.upsert = async (kind, rows, key = "id") => {
    const list = Array.isArray(rows) ? rows : [rows];
    __writes.push(["upsert", kind, JSON.parse(JSON.stringify(list))]);
    if (kind === "settings") { mem.settings = list[0].data; return list; }
    const k = keyOf(key);
    list.forEach((r) => { const i = mem[kind].findIndex((x) => k(x) === k(r)); if (i >= 0) mem[kind][i] = Object.assign({}, mem[kind][i], r); else mem[kind].push(Object.assign({}, r)); });
    return list;
  };
  DB.saveSettings = (data) => DB.upsert("settings", { id: 1, data });
  DB.remove = async (kind, where) => {
    __writes.push(["remove", kind, where]);
    const ok = (x, v) => (v && typeof v === "object" ? ("gt" in v ? x > v.gt : "lt" in v ? x < v.lt : false) : x === v); // { seq: { gt: 3 } }
    const hit = (r) => Object.entries(where).every(([k, v]) => ok(r[k], v));
    const gone = mem[kind].filter(hit);
    mem[kind] = mem[kind].filter((r) => !hit(r));
    return gone;
  };
  DB.upload = async (p) => { __writes.push(["upload", p]); return p; };
  DB.load = async () => JSON.parse(JSON.stringify(mem));
  // zálohy v pamäti (ako supabase/3-zalohy.sql): snímka = riadky tabuliek, settings ako [{ id: 1, data }]
  const snap = () => Object.assign({ format: "fulka-zaloha-1" }, JSON.parse(JSON.stringify(mem)), { settings: [{ id: 1, data: JSON.parse(JSON.stringify(mem.settings)) }] });
  const sum = (d) => Object.fromEntries(["seasons", "teams", "season_teams", "players", "roster", "matches", "goals"].map((k) => [k, d[k].length]));
  const backups = [];
  const take = (kind, label, data) => { const d = data || snap(); const b = { id: backups.length + 1, created_at: new Date(Date.now() - (5 - backups.length) * 3600e3).toISOString(), kind, label, summary: sum(d), data: d }; backups.push(b); return b.id; };
  take("auto", "Automaticky pred zmenou");
  take("manual", "pred playoff");
  const apply = (d) => { mem = JSON.parse(JSON.stringify(d)); mem.settings = d.settings[0].data; delete mem.format; };
  DB.backups = async () => backups.slice().reverse().map(({ data, ...b }) => b);
  DB.backupData = async (id) => JSON.parse(JSON.stringify(backups.find((b) => String(b.id) === String(id)).data));
  DB.backup = async (label) => { __writes.push(["backup", label]); return take("manual", label); };
  DB.restore = async (id) => { __writes.push(["restore", id]); const b = take("restore", `Pred návratom k zálohe č. ${id}`); apply(backups.find((x) => String(x.id) === String(id)).data); return b; };
  DB.restoreFile = async (d) => { __writes.push(["restoreFile"]); const b = take("file", "Pred nahratím zálohy zo súboru"); apply(d); return b; };
  window.__backups = backups;
  window.__mem = () => mem;
  return "mock DB zapnutý";
})()
