// Prejde celý tok tabule v adminovi (po fake-login.js, RELOAD, mock-db.js): vráti stručný výpis stavu po krokoch.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(60); };
  await click('[data-a="tab"][data-id="board"]');
  await click('[data-b="pick"]');
  await click('[data-b="parts"][data-id="3"]');
  await click('[data-b="minset"][data-id="10"]');
  await click('[data-b="screens"][data-id="1"]');
  await click('[data-b="prepare"]');
  out.push("po prepare: " + JSON.stringify(Board.load().cfg) + " " + Board.load().title);
  await click('[data-b="toggle"]');
  await click('[data-b="goal"][data-side="h"]');
  const first = document.querySelector('[data-b="scorer"][data-side="h"]');
  out.push("hráči v zozname: " + document.querySelectorAll('.a-bd-pick [data-b="scorer"]').length);
  await click('[data-b="scorer"][data-side="h"]');
  await click('[data-b="goal"][data-side="a"]');
  await click('[data-b="scorer"][data-side="a"]');
  await click('[data-b="goal"][data-side="h"]');
  await click('[data-b="scorer"][data-side="h"]');
  await click('[data-b="penopen"][data-side="a"]');
  await click('[data-b="penpreset"][data-min="5"]');
  await click('[data-b="penadd"]');
  const s = Board.load();
  out.push("skóre " + JSON.stringify(Board.score(s)) + " tresty a: " + s.pens.a.length + " beží: " + s.clock.running);
  return out.join("\n");
})()
