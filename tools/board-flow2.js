// Druhý tok (po fake-login.js, RELOAD, mock-db.js): finále bez určených tímov, výmena strán, späť o časť, resety, posun času aj s trestom.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel, wait = 80) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(wait); };
  const rows = () => [...document.querySelectorAll('[data-b="pick"]')].map((x) => x.dataset.id);
  await click('[data-a="tab"][data-id="board"]');
  out.push("zápasy v zozname: " + rows().join(","));
  const fin = rows().find((id) => /-fin$/.test(id));
  await click(`[data-b="pick"][data-id="${fin}"]`);
  out.push("výber tímov viditeľný: " + !!document.querySelector(".a-bd-tside") + ", prepare vypnutý: " + document.querySelector('[data-b="prepare"]').disabled);
  await click('[data-b="tpick"][data-side="h"][data-id="gia"]');
  await click('[data-b="tpick"][data-side="a"][data-id="gia"]');
  out.push("rovnaký tím na oboch stranách zakázaný: " + document.querySelector('[data-b="tpick"][data-side="a"][data-id="gia"]').disabled);
  await click('[data-b="tpick"][data-side="a"][data-id="sai"]');
  await click('[data-b="parts"][data-id="2"]');
  await click('[data-b="minset"][data-id="10"]');
  await click('[data-b="prepare"]');
  let s = Board.load();
  out.push("tabuľa: " + s.home.name + " – " + s.away.name + " | " + s.title);
  await click('[data-b="swap"]');
  out.push("flip: " + Board.load().flip + " | ľavý panel na displeji: " + document.querySelector("#bd-sb .sb-team.l").dataset.side + " | ľavý stĺpec v ovládaní: " + document.querySelector(".a-bd-team .a-bd-tname b").textContent);
  await click('[data-b="goal"][data-side="h"]'); await click('[data-b="scorer"][data-side="h"]');
  await click('[data-b="penopen"][data-side="h"]'); await click('[data-b="penpreset"][data-min="2"]'); await click('[data-b="penadd"]');
  await click('[data-b="adj"][data-d="10000"]');
  out.push("posun +10 s len hra: čas " + B_(Board.load()) + " trest " + Board.load().pens.h[0].ms);
  document.querySelector('[data-bi="adjpens"]').click(); await sleep(50);
  await click('[data-b="adj"][data-d="10000"]');
  out.push("posun +10 s aj tresty: čas " + B_(Board.load()) + " trest " + Board.load().pens.h[0].ms);
  await click('[data-b="adj"][data-d="-60000"]');
  await click('[data-b="adj"][data-d="-60000"]'); // čas 10:20 → 8:20 (tresty 2:20 → 0:20)
  await click('[data-b="next"]');
  out.push("2. časť: " + Board.load().part + " čas " + B_(Board.load()));
  await click('[data-b="prev"]');
  out.push("späť: časť " + Board.load().part + " čas " + B_(Board.load()));
  await click('[data-b="resetclock"]');
  out.push("čas od začiatku: " + B_(Board.load()) + " góly " + Board.load().goals.length);
  await click('[data-b="resetall"]'); await click('[data-m="ok"]', 150);
  s = Board.load();
  out.push("reset zápasu: góly " + s.goals.length + " tresty " + s.pens.h.length + " flip " + s.flip + " čas " + B_(s));
  await click('[data-b="end"]'); await click('[data-m="ok"]', 400);
  out.push("koniec (finále bez tímov v DB): " + ((document.querySelector(".a-error") || {}).textContent || "bez chyby").slice(0, 150) + " | uložené: " + Board.load().saved);
  return out.join("\n");
  function B_(st) { return Board.fmt(Board.view(st, Date.now()).ms); }
})()
