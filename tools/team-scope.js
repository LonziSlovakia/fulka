// Admin → Tímy → „Všetky tímy“: vyberie tím, ktorý nie je v upravovanej sezóne, a pridá ho do nej (po fake-login.js, RELOAD, mock-db.js).
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(120); };
  await click('[data-a="tab"][data-id="teams"]');
  const inSeason = [...document.querySelectorAll('[data-a="team-sel"]')].map((b) => b.dataset.id);
  await click('[data-a="teamScope"][data-id="all"]');
  const all = [...document.querySelectorAll('[data-a="team-sel"]')].map((b) => b.dataset.id);
  const outside = all.find((id) => !inSeason.includes(id));
  out.push(`sezóna: ${inSeason.join(",")} | všetky: ${all.join(",")}`);
  if (outside) {
    await click(`[data-a="team-sel"][data-id="${outside}"]`);
    out.push("detail: " + (document.querySelector('[data-a="teamToSeason"]') ? "tlačidlo Pridať do sezóny" : "bez tlačidla"));
    window.__shot = window.scrollY;
    if (location.hash === "#pridat") {
      await click('[data-a="teamToSeason"]');
      await sleep(500);
      out.push("zápis: " + JSON.stringify(__writes.filter((w) => w[1] === "season_teams").pop()));
      out.push("súpiska viditeľná: " + !!document.querySelector('[data-a="addPlayer"]'));
    }
  }
  return out.join(" | ");
})()
