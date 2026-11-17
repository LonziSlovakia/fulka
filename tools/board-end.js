// Koniec zápasu v adminovi (po board-flow.js; mock-db.js musí byť zapnutý): remíza v playoff sa nesmie uložiť, potom výhra a uloženie.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel, wait = 80) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(wait); };
  // skóre je 2:1 → pridáme gól hosťom (2:2 = remíza v playoff)
  await click('[data-b="goal"][data-side="a"]');
  await click('[data-b="scorer"][data-side="a"]');
  await click('[data-b="end"]');
  out.push("remíza: " + (document.querySelector(".a-error") || {}).textContent + " | dialóg: " + !!document.querySelector(".a-modal"));
  await click('[data-b="goalrm"][data-i="3"]');
  await click('[data-b="end"]');
  out.push("dialóg: " + !!document.querySelector(".a-modal"));
  await click('[data-m="ok"]', 400);
  const s = Board.load();
  out.push("ended=" + s.ended + " saved=" + s.saved);
  const w = __writes.filter((x) => x[0] === "upsert");
  out.push("zápisy: " + w.map((x) => x[1] + ":" + (Array.isArray(x[2]) ? x[2].length : 1)).join(", "));
  const m = __mem().matches.find((x) => x.id === s.matchId);
  out.push("zápas v db: status=" + m.status + " starts=" + m.starts_at + " góly=" + __mem().goals.filter((g) => g.match_id === s.matchId).map((g) => g.side + ":" + g.scorer_id).join(","));
  out.push("panel: " + (document.querySelector(".a-bd-ended") || {}).textContent.replace(/\s+/g, " "));
  return out.join("\n");
})()
