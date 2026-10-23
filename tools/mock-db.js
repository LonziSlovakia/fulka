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
    const hit = (r) => Object.entries(where).every(([k, v]) => r[k] === v);
    const gone = mem[kind].filter(hit);
    mem[kind] = mem[kind].filter((r) => !hit(r));
    return gone;
  };
  DB.upload = async (p) => { __writes.push(["upload", p]); return p; };
  DB.load = async () => JSON.parse(JSON.stringify(mem));
  window.__mem = () => mem;
  return "mock DB zapnutý";
})()
