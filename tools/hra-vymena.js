/* Krok pre shot.js (hra /hra/?debug=vymena): otvorí denný balík (padne 6. kus karty), v zhrnutí klikne „Vymeniť 5 za balík“,
   preskočí odkrývanie a zavrie zhrnutie. window.HRA_STOP = 'sum' (zastaví na prvom zhrnutí) | 'side' (ponuka pri balíku) | iné = celé.
   Vráti počty karty pred / po výmene. */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cnt = () => (document.querySelector(".trade .cnt") || {}).textContent || "bez ponuky";
  document.querySelector("[data-act=open]").click();
  await wait(600);
  document.querySelector("[data-op=skip]").click();
  await wait(1500);
  const offer = (document.querySelector(".op-trade") || {}).textContent || "bez ponuky";
  if (window.HRA_STOP === "sum") return offer;
  if (window.HRA_STOP === "side") { document.querySelector("[data-op=close]").click(); await wait(900); document.getElementById("balik").scrollIntoView(); return cnt(); }
  document.querySelector("[data-op=trade]").click();
  await wait(700);
  document.querySelector("[data-op=skip]").click();
  await wait(1500);
  const h = document.querySelector(".op-h").textContent;
  const again = !!document.querySelector("[data-op=trade]");
  document.querySelector("[data-op=close]").click();
  await wait(900);
  return [offer, h, "ďalšia výmena: " + again, "ponuka pri balíku: " + cnt(), "denný balík: " + (document.querySelector(".pk-clock") ? "otvorený" : "čaká"), localStorage.getItem("fulka-hra-v1")];
})();
