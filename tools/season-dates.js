// Admin → Sezóny → pripravovaná sezóna: termíny + uloženie bez tímov (po fake-login.js, RELOAD, mock-db.js). Vráti, čo sa zapísalo.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(80); };
  const mem = __mem();
  mem.seasons.forEach((s) => Object.assign(s, { signup_date: null, draft_date: null, start_date: null })); // ako po spustení 4-terminy-sezony.sql
  App.state.data.seasons.forEach((s) => Object.assign(s, { signup_date: null, draft_date: null, start_date: null }));
  Admin.render();
  await click('[data-a="tab"][data-id="seasons"]');
  const soon = App.state.data.seasons.find((s) => s.state === "soon");
  await click(`[data-a="season-sel"][data-id="${soon.id}"]`);
  const set = (key, v) => { const el = document.querySelector(`[data-in="sdate"][data-key="${key}"]`); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  set("signup_date", "2027-02-01"); await sleep(50);
  set("draft_date", "2027-02-22"); await sleep(50);
  for (let b; (b = document.querySelector('[data-a="steam"][aria-pressed="true"]'));) { b.click(); await sleep(30); } // po kliknutí sa prekreslí
  const shot = window.scrollY;
  await click('[data-a="saveSeason"]');
  await sleep(300);
  await click('[data-m="ok"]'); // potvrdenie „Odobrať tímy zo sezóny?“
  await sleep(600);
  const row = __writes.filter((w) => w[0] === "upsert" && w[1] === "seasons").pop();
  out.push(JSON.stringify(row && row[2][0]));
  out.push("tímy v sezóne: " + __mem().season_teams.filter((x) => x.season_id === soon.id).length);
  out.push("chyba: " + ((document.querySelector(".a-error") || {}).textContent || "žiadna"));
  window.scrollTo(0, 0);
  return out.join(" | ");
})()
