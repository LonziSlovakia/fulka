/* Krok pre shot.js (hra /hra/?debug=veniec): otvorí balík, preskočí odkrývanie a zastaví sa na oslave venca
   (window.HRA_STOP='ach') alebo ju potvrdí a zavrie zhrnutie (iné) → hlavička s vencom. */
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector("[data-act=open]").click();
  await wait(600);
  document.querySelector("[data-op=skip]").click();
  await wait(1500);
  const ach = document.querySelector(".ach-h");
  if (window.HRA_STOP === "ach") return ach ? ach.textContent : "bez venca";
  document.querySelector("[data-op=ach]").click();
  await wait(900);
  const tags = [...document.querySelectorAll(".sum-card .op-tag")].map((e) => e.textContent).join(",");
  document.querySelector("[data-op=close]").click();
  await wait(900);
  scrollTo(0, 0);
  return [tags, document.querySelector(".brand").className, localStorage.getItem("fulka-hra-v1")];
})();
