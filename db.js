/* Napojenie na databázu (Supabase) cez obyčajný fetch – podľa laura/mapalasky/db.js.
   Čítať smie každý, zapisovať iba prihlásený admin. Posledné stiahnuté dáta sú v prehliadači,
   takže stránka sa ukáže hneď (aj bez internetu) a čerstvé dáta sa dotiahnu na pozadí. */
(() => {
  "use strict";
  const CFG = window.CONFIG;
  const TABLES = ["settings", "seasons", "teams", "season_teams", "players", "roster", "matches", "goals"];
  const T = Object.fromEntries(TABLES.map((k) => [k, `${CFG.site}_${k}`]));
  const HAS_UPDATED = new Set(["settings", "seasons", "teams", "players", "matches", "goals"]); // spojovacie tabuľky nemajú updated_at
  const CACHE_KEY = `${CFG.site}-data-v1`;
  const SESSION_KEY = `${CFG.site}-session-v1`;
  const PUBLIC = `${CFG.url}/storage/v1/object/public/${CFG.bucket}/`;
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  async function check(res) {
    if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
    const j = await res.json().catch(() => ({}));
    const err = new Error(j.message || j.msg || j.error_description || j.error || res.statusText);
    err.status = res.status;
    err.code = j.code || j.error_code || j.error;
    throw err;
  }
  function rest(path, { method = "GET", body, token, prefer } = {}) {
    const headers = { apikey: CFG.key };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    return fetch(`${CFG.url}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }).then(check);
  }

  /* ---------- Čítanie ---------- */
  const QUERIES = {
    settings: "select=data&id=eq.1",
    seasons: "select=id,name,short,state,seed_mode,sort&order=sort.desc",
    teams: "select=id,name,venue,abbr,color,color_dark,ink,logo,logo_anim&order=name",
    season_teams: "select=season_id,team_id",
    players: "select=id,name,photo,photo_head,photo_face&order=name",
    roster: "select=season_id,player_id,team_id,captain,number",
    matches: "select=id,season_id,stage,round,home_id,away_id,window_from,window_to,starts_at,orig_starts_at,moved,status,note&order=id",
    goals: "select=id,match_id,seq,side,scorer_id,assist_id&order=match_id,seq",
  };
  function load() {
    return Promise.all(TABLES.map((k) => rest(`${T[k]}?${QUERIES[k]}`))).then((rows) => {
      const d = Object.fromEntries(TABLES.map((k, i) => [k, rows[i]]));
      d.settings = (d.settings[0] && d.settings[0].data) || {};
      ls.set(CACHE_KEY, d);
      return d;
    });
  }
  const cached = ls.get(CACHE_KEY);
  const fresh = load();
  fresh.catch(() => {});

  /* ---------- Prihlásenie (iba admin) ---------- */
  let session = ls.get(SESSION_KEY);
  const auth = (path, body, token) =>
    fetch(`${CFG.url}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: CFG.key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body || {}),
    }).then(check);
  function keep(s) {
    session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      user: { id: s.user.id, email: s.user.email },
    };
    ls.set(SESSION_KEY, session);
  }
  function forget() { session = null; ls.del(SESSION_KEY); }
  async function signIn(email, password) {
    keep(await auth("token?grant_type=password", { email, password }));
    return session.user;
  }
  function signOut() {
    const t = session && session.access_token;
    forget();
    if (t) auth("logout", {}, t).catch(() => {});
  }
  let refreshing = null;
  async function token() {
    if (!session) throw Object.assign(new Error("Nie si prihlásený"), { status: 401 });
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    refreshing = refreshing || auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(keep)
      .catch((e) => { if (e.status >= 400 && e.status < 500) forget(); throw e; })
      .finally(() => { refreshing = null; });
    await refreshing;
    return session.access_token;
  }

  /* ---------- Zápis ---------- */
  const write = async (path, opts) => rest(path, { ...opts, token: await token() });
  const now = () => new Date().toISOString();
  const noRights = () => Object.assign(new Error("Tento účet nemá právo zapisovať"), { status: 403 });
  const filter = (where) => Object.entries(where).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");

  // jeden riadok alebo pole; key = stĺpce, podľa ktorých sa pozná existujúci riadok
  async function upsert(kind, rows, key = "id") {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => (HAS_UPDATED.has(kind) ? { ...r, updated_at: now() } : r));
    const r = await write(`${T[kind]}?on_conflict=${key}`, { method: "POST", body: list, prefer: "resolution=merge-duplicates,return=representation" });
    if (!r || r.length !== list.length) throw noRights(); // prázdna odpoveď = RLS nepovolilo
    return r;
  }
  // where = { id: "…" } alebo { season_id: "…", player_id: "…" }
  async function remove(kind, where) {
    const r = await write(`${T[kind]}?${filter(where)}`, { method: "DELETE", prefer: "return=representation" });
    if (!r || !r.length) throw noRights(); // RLS potichu nezmaže nič, ak účet nie je admin
    return r;
  }
  const saveSettings = (data) => upsert("settings", { id: 1, data });

  /* ---------- Fotky ---------- */
  async function upload(path, blob) {
    const res = await fetch(`${CFG.url}/storage/v1/object/${CFG.bucket}/${path}`, {
      method: "POST",
      headers: { apikey: CFG.key, Authorization: `Bearer ${await token()}`, "Content-Type": blob.type || "image/webp", "cache-control": "max-age=31536000", "x-upsert": "true" },
      body: blob,
    });
    await check(res);
    return path;
  }
  // cesta v buckete (hraci/…/head.webp) alebo celá adresa → adresa na zobrazenie
  const photoUrl = (p) => (!p ? "" : /^https?:\/\//.test(p) ? p : PUBLIC + p);

  window.DB = {
    cached,
    fresh,
    load,
    saveCache: (d) => ls.set(CACHE_KEY, d),
    user: () => (session ? session.user : null),
    signIn,
    signOut,
    upsert,
    remove,
    saveSettings,
    upload,
    photoUrl,
  };
})();
