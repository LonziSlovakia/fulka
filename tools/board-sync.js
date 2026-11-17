// Prenos medzi oknami: do admina vloží iframe s tabula.html a po kliknutiach v admine číta, čo vidí „druhá obrazovka“.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const click = async (sel, wait = 150) => { const el = document.querySelector(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(wait); };
  await click('[data-a="tab"][data-id="board"]');
  await click('[data-b="pick"]');
  await click('[data-b="screens"][data-id="2"]');
  await click('[data-b="prepare"]');
  const f = document.createElement("iframe");
  f.src = "tabula.html"; f.style.cssText = "position:fixed;right:0;bottom:0;width:640px;height:360px;border:2px solid #3ddc84;z-index:99";
  document.body.appendChild(f);
  await sleep(1500);
  const see = () => { const d = f.contentDocument; return `čas ${(d.querySelector("[data-clock]") || {}).textContent} | skóre ${[...d.querySelectorAll(".sb-score")].map((x) => x.textContent).join(":")} | časť ${(d.querySelector(".sb-part") || {}).textContent.trim()} | tresty ${d.querySelectorAll(".sb-pens li").length}`; };
  out.push("štart: " + see());
  await click('[data-b="toggle"]'); await sleep(2200);
  out.push("beží 2 s: " + see());
  await click('[data-b="goal"][data-side="a"]'); await click('[data-b="scorer"][data-side="a"]');
  await click('[data-b="penopen"][data-side="h"]'); await click('[data-b="penpreset"][data-min="2"]'); await click('[data-b="penadd"]');
  out.push("gól + trest: " + see());
  await click('[data-b="toggle"]'); const a = see(); await sleep(1500);
  out.push("pauza stojí: " + (a === see()) + " (" + see() + ")");
  out.push("pripojená: " + document.querySelector("[data-conn]").textContent);
  await click('[data-b="screens"][data-id="1"]');
  return out.join("\n");
})()
