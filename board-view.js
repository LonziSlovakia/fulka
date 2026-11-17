/* Vykreslenie výsledkovej tabule (druhá obrazovka tabula.html aj náhľad v admine) zo stavu z board.js.
   `render(root, stav)` poskladá celú tabuľu, `update(root, stav)` v behu iba prepisuje čas a tresty
   (a prekreslí, keď sa zmenilo niečo iné – góly, časť, koniec, tresty pribudli/zmizli). Texty sa escapujú. */
(() => {
  "use strict";
  const B = window.Board;
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const col = (c, fallback) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : fallback);
  // text na tímovej farbe sa počíta z farby (čierna / biela podľa kontrastu), nie z „ink“ v databáze – kvôli slabým projektorom
  const inkOf = (t) => B.contrastInk(col(t.c, "#888888"));
  const vars = (t) => `--c:${col(t.c, "#888888")};--d:${col(t.d, "#333333")};--ink:${inkOf(t)}`;
  // „Adam Novák“ → „A. Novák“
  const shortPlayer = (name) => {
    const p = String(name || "").trim().split(/\s+/);
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(" ")}` : p[0] || "";
  };

  function pens(list) {
    const rows = list.map((p) => {
      const who = [p.number ? `#${esc(p.number)}` : "", esc(shortPlayer(p.name))].filter(Boolean).join(" ");
      return `<li><span class="sb-pn">${who || "Trest"}</span><b data-pen="${esc(p.id)}">${B.fmt(p.ms)}</b></li>`;
    });
    return `<ul class="sb-pens" aria-label="Tresty">${rows.join("")}</ul>`;
  }

  // pos = "l" / "r" (strana na obrazovke), side = "h" / "a" (domáci / hostia – podľa toho sa počítajú góly)
  function team(t, side, pos, v, lose) {
    return `<section class="sb-team ${pos}${inkOf(t) === "#FFFFFF" ? " lt" : ""}${lose ? " lose" : ""}" data-side="${side}" style="${vars(t)}">
      <i class="sb-bg" aria-hidden="true"></i><i class="sb-stripes" aria-hidden="true"></i>
      <div class="sb-head"><img class="sb-logo" src="${esc(t.logo)}" alt=""><span class="sb-name"><b>${esc(t.name)}</b></span></div>
      <b class="sb-score">${v.score[side]}</b>${pens(v.pens[side])}</section>`;
  }

  function board(s, now) {
    const v = B.view(s, now);
    const lose = s.ended && v.score.h !== v.score.a ? (v.score.h < v.score.a ? "h" : "a") : "";
    const mid = s.ended
      ? `<b class="sb-end">KONIEC</b>`
      : `<b class="sb-clock" data-clock>${B.fmt(v.ms)}</b>${v.label ? `<span class="sb-part"><i class="sb-dot${v.running ? " on" : ""}" aria-hidden="true"></i>${esc(v.label)}</span>` : `<span class="sb-part sb-dotonly"><i class="sb-dot${v.running ? " on" : ""}" aria-hidden="true"></i></span>`}`;
    return `<div class="sb-bar"><img src="assets/logos/ful-mark-white.png" alt=""><b>FULka</b><span>${esc(s.title)}</span></div>
      <div class="sb-grid">${s.flip ? team(s.away, "a", "l", v, lose === "a") : team(s.home, "h", "l", v, lose === "h")}<section class="sb-mid">${mid}</section>${s.flip ? team(s.home, "h", "r", v, lose === "h") : team(s.away, "a", "r", v, lose === "a")}</div>`;
  }

  function waiting() {
    return `<div class="sb-wait"><img src="assets/logos/ful-mark-white.png" alt=""><b>FULka</b><span class="sb-part">Čaká sa na zápas</span></div>`;
  }

  const sigOf = (s, now) => (s ? `${s.rev}|${B.view(s, now).pens.h.map((p) => p.id)}|${B.view(s, now).pens.a.map((p) => p.id)}` : "none");

  function render(root, s, now) {
    now = now || Date.now();
    root.classList.add("sb");
    root.innerHTML = `<div class="sb-in" style="--f:${s ? s.scale / 100 : 1}">${s ? board(s, now) : waiting()}</div>`;
    root._sig = sigOf(s, now);
  }

  // volať často (napr. 10× za sekundu): prekreslí iba keď treba, inak prepíše čas
  function update(root, s, now) {
    now = now || Date.now();
    if (root._sig !== sigOf(s, now)) { render(root, s, now); return; }
    if (!s) return;
    const v = B.view(s, now);
    const clock = root.querySelector("[data-clock]");
    if (clock) clock.textContent = B.fmt(v.ms);
    const dot = root.querySelector(".sb-dot");
    if (dot) dot.classList.toggle("on", v.running);
    ["h", "a"].forEach((k) => v.pens[k].forEach((p) => {
      const el = root.querySelector(`[data-pen="${CSS.escape(String(p.id))}"]`);
      if (el) el.textContent = B.fmt(p.ms);
    }));
  }

  window.BoardView = { render, update, shortPlayer };
})();
