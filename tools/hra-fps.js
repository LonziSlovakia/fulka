/* Krok pre shot.js (hra /hra/): zmeria snímky za sekundu (FPS) a najdlhšiu snímku počas 3 s.
   window.HRA_FPS = "kolekcia" (posunie na legendary karty) | "detail" (zväčšená legendary karta) | "balik" (otáčanie kariet).
   Použitie: THROTTLE=4 node tools/shot.js "http://127.0.0.1:8770/fulka/hra/" 390 /dev/null @tools/hra-all.js RELOAD "window.HRA_FPS='kolekcia'" @tools/hra-fps.js */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mode = window.HRA_FPS || "kolekcia";
  if (mode === "kolekcia") document.getElementById("kolekcia").scrollIntoView();
  if (mode === "detail") document.querySelector(".cl-card .r-legendary").closest(".cl-card").click();
  if (mode === "balik") {
    localStorage.removeItem("fulka-hra-v1");
    Math.random = () => 0.99;
    document.querySelector("[data-act=open]").removeAttribute("disabled");
    document.querySelector("[data-act=open]").click();
  }
  await wait(600);
  let frames = 0, worst = 0, last = performance.now();
  const t0 = last;
  let tapAt = 0;
  await new Promise((done) => {
    (function tick(now) {
      frames++; worst = Math.max(worst, now - last); last = now;
      if (mode === "balik" && now - tapAt > 700) { tapAt = now; const op = document.querySelector(".op"); if (op) op.click(); }
      if (now - t0 < 3000) requestAnimationFrame(tick); else done();
    })(t0);
  });
  return `${mode}: ${(frames / 3).toFixed(0)} fps, najdlhšia snímka ${worst.toFixed(0)} ms`;
})();
