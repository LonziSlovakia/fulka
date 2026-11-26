/* Krok pre shot.js (hra /hra/?debug=vymena): otvorí denný balík (padne 6. kus karty) → v zhrnutí iba text o výmene → kolekcia →
   detail karty ×6 → „Vymeniť 5 za balík“ → balík za výmenu → späť v kolekcii ostane ×1.
   window.HRA_STOP = 'sum' (zastaví na zhrnutí) | 'detail' (detail karty s tlačidlom) | iné = celé. Vráti, čo sa stalo. */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  q("[data-act=open]").click();
  await wait(600);
  q("[data-op=skip]").click();
  await wait(1500);
  const offer = (q(".op-trade") || {}).textContent || "bez textu";
  const btnInSum = !!q("[data-op=trade]");
  if (window.HRA_STOP === "sum") return [offer, "tlačidlo v zhrnutí: " + btnInSum];
  q("[data-op=close]").click();
  await wait(900);
  const badge = q(".cnt.trade");
  if (!badge) return "v kolekcii nie je karta ×6";
  const id = badge.closest("[data-id]").dataset.id;
  badge.closest("[data-id]").click();
  await wait(700);
  if (window.HRA_STOP === "detail") return [offer, badge.textContent, (q(".op.detail .op-trade") || {}).textContent];
  q("[data-op=trade]").click();
  await wait(700);
  q("[data-op=skip]").click();
  await wait(1500);
  const h = q(".op-h").textContent;
  q("[data-op=close]").click();
  await wait(900);
  const after = q(`.cl-card[data-id="${id}"] .cnt`);
  return [offer, "tlačidlo v zhrnutí: " + btnInSum, h, "po výmene: " + (after ? after.textContent : "×1"), "denný balík: " + (q(".pk-clock") ? "otvorený" : "čaká"), localStorage.getItem("fulka-hra-v1")];
})();
