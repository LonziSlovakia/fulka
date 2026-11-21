/* Krok pre shot.js: otvorí balík v hre (/hra/) a zastaví sa vo fáze HRA_STOP (pack | back | front | sum).
   Šťastie sa dá vynútiť: HRA_LUCK = číslo 0–1 pre Math.random (0.99 = samé legendary).
   Použitie: node tools/shot.js "http://127.0.0.1:8770/fulka/hra/" 1440 /tmp/x.png "window.HRA_STOP='front';window.HRA_LUCK=0.99" @tools/hra-pack.js */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (window.HRA_LUCK != null) Math.random = () => window.HRA_LUCK;
  document.querySelector("[data-act=open]").click();
  await wait(700);
  const stop = window.HRA_STOP || "sum";
  const tap = () => document.querySelector(".op").click();
  const hideApp = () => { document.getElementById("app").style.display = "none"; };
  if (stop === "pack") { hideApp(); return "pack"; }
  tap(); await wait(2200); // roztrhnutie → prvá karta rubom
  if (stop === "back") { hideApp(); return "back"; }
  // preskoč na poslednú kartu (najvzácnejšiu)
  for (let i = 0; i < 4; i++) { tap(); await wait(1300); tap(); await wait(1000); }
  tap(); await wait(1200);
  if (stop === "front") { hideApp(); return document.querySelector(".op-cap").textContent; }
  tap(); await wait(1500);
  hideApp();
  return document.querySelectorAll(".sum-card").length + " kariet v zhrnutí";
})();
