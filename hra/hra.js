/* Hra FULky (/hra/, iba cez priamu adresu): hráč dňa s modlitbou, denný balík 5 kariet a kolekcia.
   Dáta ligy sa iba čítajú (db.js), výpočty kariet sú v cards.js. Do localStorage ide iba malý stav
   (`fulka-hra-v1`: deň posledného balíka, ID kariet s počtom, ID posledného balíka). */
(() => {
  "use strict";
  const L = window.Logic;
  const C = window.Cards;
  const DB = window.DB;
  const app = document.getElementById("app");
  const layer = document.getElementById("layer");
  const KEY = "fulka-hra-v1";
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const S = { data: null, cards: [], byId: {}, T: {}, P: {}, save: C.readSave(ls.get(KEY)), prayer: "otce", filter: "all", season: "all", busy: false };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Modlitby ---------- */
  const PRAYERS = [
    { id: "otce", name: "Otče náš", text: [
      "Otče náš, ktorý si na nebesiach,", "posväť sa meno tvoje,", "príď kráľovstvo tvoje,", "buď vôľa tvoja ako v nebi, tak i na zemi.",
      "Chlieb náš každodenný daj nám dnes", "a odpusť nám naše viny,", "ako i my odpúšťame svojim vinníkom,", "a neuveď nás do pokušenia,", "ale zbav nás zlého.", "Amen."] },
    { id: "zdravas", name: "Zdravas Mária", text: [
      "Zdravas, Mária, milosti plná, Pán s tebou.", "Požehnaná si medzi ženami", "a požehnaný je plod života tvojho, Ježiš.",
      "Svätá Mária, Matka Božia,", "pros za nás hriešnych", "teraz i v hodinu smrti našej.", "Amen."] },
    { id: "slava", name: "Sláva Otcu", text: [
      "Sláva Otcu i Synu i Duchu Svätému,", "ako bolo na počiatku, tak nech je i teraz i vždycky", "i na veky vekov.", "Amen."] },
    { id: "ochrana", name: "Pod tvoju ochranu", text: [
      "Pod tvoju ochranu sa utiekame, svätá Božia Rodička.", "Neodmietni naše prosby v našich potrebách,", "ale zbav nás vždy všetkých nebezpečenstiev,",
      "Panna slávna a požehnaná.", "Naša Pani, naša Prostrednica, naša Orodovnica,", "so svojím Synom nás zmier,", "svojmu Synovi nás odporúčaj,",
      "k svojmu Synovi nás priveď.", "Amen."] },
    { id: "verim", name: "Verím v Boha", text: [
      "Verím v Boha, Otca všemohúceho, Stvoriteľa neba i zeme.", "I v Ježiša Krista, jeho jediného Syna, nášho Pána,",
      "ktorý sa počal z Ducha Svätého, narodil sa z Márie Panny,", "trpel za Poncia Piláta, bol ukrižovaný, umrel a bol pochovaný.",
      "Zostúpil k zosnulým, tretieho dňa vstal z mŕtvych,", "vystúpil na nebesia, sedí po pravici Boha Otca všemohúceho.",
      "Odtiaľ príde súdiť živých i mŕtvych.", "Verím v Ducha Svätého, svätú Cirkev katolícku,", "spoločenstvo svätých, odpustenie hriechov,",
      "vzkriesenie tela a večný život.", "Amen."] },
  ];

  /* ---------- Drobnosti ---------- */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const col = (c, fallback) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : fallback);
  const vars = (t) => `--c:${t.c};--d:${t.d};--ink:${t.ink}`;
  const asset = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : `../${u}`); // cesty v DB sú od koreňa webu
  const today = () => L.localParts(Date.now()).date;
  const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
  const sleep = (ms) => new Promise((r) => setTimeout(r, REDUCED ? Math.min(ms, 60) : ms));
  const FUL = { id: "", name: "FULka", pre: "", c: "#0A3A8C", d: "#02235E", ink: "#FFFFFF", svg: "../assets/logos/ful_bez_pozadia.svg", gif: "../assets/logos/ful_bez_pozadia.svg" };
  const ZIG = '<svg aria-hidden="true" width="132" height="18" viewBox="0 0 132 18"><polyline points="0,15 11,3 22,15 33,3 44,15 55,3 66,15 77,3 88,15 99,3 110,15 121,3 132,15" fill="none" stroke="#FFFFFF" stroke-width="3"></polyline></svg>';
  const ARROW = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>';
  const CLOSE = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M5 5l14 14M19 5L5 19"></path></svg>';
  const RNAME = C.RARITY_NAME;
  const RLONG = { legendary: "Top 5 hráčov sezóny + trblietavé tímy s animovaným logom", epic: "6. – 10. hráč + tímové karty",
    rare: "11. – 20. hráč v kanadskom bodovaní", common: "Ostatní hráči zo súpisky" };

  function teamsOf(d) {
    const T = {};
    d.teams.forEach((t) => {
      T[t.id] = { id: t.id, name: t.name, pre: t.venue || "", c: col(t.color, "#888888"), d: col(t.color_dark, "#333333"), ink: col(t.ink, "#FFFFFF"),
        svg: asset(t.logo) || FUL.svg, gif: asset(t.logo_anim || t.logo) || FUL.svg };
    });
    return T;
  }
  const teamOf = (c) => S.T[c.team_id] || FUL;
  const owned = (id) => S.save.c[id] || 0;
  const store = () => ls.set(KEY, S.save);

  /* ---------- Karta ---------- */
  // trblietky na legendary (pozície sú v CSS cez --x/--y/--t)
  const SPARKS = [[14, 22, 0], [78, 14, 0.7], [64, 48, 1.4], [22, 62, 2.1], [86, 70, 0.4], [40, 30, 1.8], [52, 80, 1.1]]
    .map(([x, y, t]) => `<i class="sp" style="--x:${x}%;--y:${y}%;--t:${t}s"></i>`).join("");

  function stats(c) {
    if (c.kind === "player") return `<span class="fc-stats"><b>${c.b}</b><small>B</small><span>${c.g} G · ${c.a} A</span></span>`;
    const place = c.place === 1 ? "Víťaz sezóny" : c.place ? `${c.place}. miesto` : c.pos ? `${c.pos}. v tabuľke` : c.season ? "Sezóna pred nami" : "Nový tím";
    return `<span class="fc-stats team">${c.place === 1 ? '<i class="cup" aria-hidden="true"></i>' : ""}<span>${place}</span></span>`;
  }

  function front(c) {
    const t = teamOf(c);
    const p = c.kind === "player" ? S.P[c.player_id] : null;
    const pic = p && p.photo ? DB.photoUrl(p.photo) : "";
    const season = c.season ? c.season.short || c.season.name : "Nový tím";
    const art = c.kind === "team"
      ? `<img class="fc-art logo" src="${esc(c.anim ? t.gif : t.svg)}" alt="" loading="lazy">`
      : pic ? `<img class="fc-art photo" src="${esc(pic)}" alt="" loading="lazy"><div class="fill fc-fade"></div>` : `<img class="fc-art mark" src="${esc(t.svg)}" alt="" loading="lazy">`;
    const top = c.kind === "player"
      ? `<span class="fc-pos">${c.rarity !== "common" ? `#${c.pos}` : ""}</span><img class="fc-team" src="${esc(t.svg)}" alt="">`
      : `<span class="fc-pos">${c.anim ? "★" : ""}</span>`;
    const sub = c.kind === "player" ? `${esc(t.name)} · ${esc(season)}` : `${esc(t.pre || "Tím")} · ${esc(season)}`;
    return `<div class="fc-face fc-front"><div class="fill grad"></div><div class="fill stripes"></div><div class="fc-shard"></div>${art}
      <div class="fc-top"><span class="fc-rar">${RNAME[c.rarity]}</span>${top}</div>
      <div class="fc-info">${c.captain ? '<span class="fc-cap">Kapitán</span>' : ""}<b class="fc-name">${esc(c.name)}</b><span class="fc-sub">${sub}</span>${stats(c)}</div>
      ${c.rarity === "legendary" ? `<i class="fc-holo"></i>${SPARKS}` : c.rarity === "epic" ? '<i class="fc-sheen"></i>' : ""}</div>`;
  }

  const BACK = `<div class="fc-face fc-back"><div class="bk-shard a"></div><div class="bk-shard b"></div><div class="bk-zig top"></div><div class="bk-zig bot"></div>
    <span class="bk-logo"><img src="../assets/logos/ful.svg" alt=""></span><b class="bk-name">FULka</b><span class="bk-sub">Florbalová UPeCe liga</span></div>`;

  // karta: lícom (front), rubom (back) alebo chýbajúca v kolekcii (missing)
  function cardHtml(c, side, extra) {
    const t = teamOf(c);
    const face = side === "back" ? BACK : side === "missing"
      ? `<div class="fc-face fc-miss"><span class="q">?</span><span class="fc-rar">${RNAME[c.rarity]}</span></div>` : front(c);
    return `<div class="fc r-${c.rarity} ${side === "front" ? `k-${c.kind}` : side}${extra ? ` ${extra}` : ""}" style="${vars(t)}" data-id="${esc(c.id)}"><div class="fc-in">${face}</div></div>`;
  }

  /* ---------- Hlavička a päta ---------- */
  function header() {
    return `<header class="top"><div class="wrap top-in">
      <a class="brand" href="../" aria-label="FULka – späť na web"><img src="../assets/logos/ful-mark-white.png" alt="">
        <span class="brand-name"><b>FULka</b><small>Hra · karty a modlitba</small></span></a>
      <nav class="nav" aria-label="Hra"><a href="#dnes">Hráč dňa</a><a href="#balik">Balík</a><a href="#kolekcia">Kolekcia</a></nav></div></header>`;
  }
  function footer() {
    return `<footer class="foot"><div class="wrap foot-in"><img src="../assets/logos/ful-mark-white.png" alt="">
      <span class="t">FULka · Hra · karty sa ukladajú iba v tomto prehliadači</span>
      <a class="admin" href="../">Späť na web ${ARROW}</a></div></footer>`;
  }

  /* ---------- Hráč dňa ---------- */
  function dayCard(p) {
    return C.latestCard(S.cards, p.id) || { id: "", kind: "player", rarity: "common", season: null, player_id: p.id, team_id: "", name: p.name, pos: 0, b: 0, g: 0, a: 0 };
  }
  function prayerBox() {
    const pr = PRAYERS.find((x) => x.id === S.prayer) || PRAYERS[0];
    const tabs = PRAYERS.map((x) => `<button type="button" class="pr-tab" data-act="prayer" data-id="${x.id}" aria-pressed="${x.id === pr.id}">${esc(x.name)}</button>`).join("");
    return `<div class="pr"><div class="pr-tabs" role="group" aria-label="Modlitba">${tabs}</div>
      <div class="pr-text" aria-live="polite"><h3>${esc(pr.name)}</h3>${pr.text.map((l) => `<p${l === "Amen." ? ' class="amen"' : ""}>${esc(l)}</p>`).join("")}</div></div>`;
  }
  function daySec() {
    const date = today();
    const p = C.playerOfDay(S.data.players, date);
    if (!p) return "";
    const c = dayCard(p);
    const t = teamOf(c);
    return `<section id="dnes" class="day" style="${vars(t)}"><div class="fill day-shard grad"></div><div class="fill stripes"></div><div class="teeth"></div>
      <div class="wrap day-in">
        <div class="day-card">${cardHtml(c, "front", "big tilt")}</div>
        <div class="day-txt">
          <span class="kicker">${esc(L.dayName(date))} ${esc(L.dShort(date).replace(".", ". "))}</span>
          <h1>Hráč dňa</h1>
          <p class="day-for">Dnes sa modlíme za</p>
          <p class="day-name">${esc(p.name)}</p>
          <p class="day-team"><img src="${esc(t.svg)}" alt="">${esc(t.name)}${t.pre ? ` · ${esc(t.pre)}` : ""}</p>
          <p class="day-lead">Každý deň jeden hráč FULky. Vyber si modlitbu a venuj ju jemu – za zdravie, rodinu, štúdium aj za fair play na ihrisku i mimo neho.</p>
          ${prayerBox()}
          <p class="day-next">Zajtra o polnoci príde ďalší hráč.</p>
        </div></div></section>`;
  }

  /* ---------- Denný balík ---------- */
  function countdown() {
    const ms = Date.parse(L.toUtc(C.nextDay(today()), "00:00")) - Date.now();
    const s = Math.max(0, Math.floor(ms / 1000));
    const two = (n) => String(n).padStart(2, "0");
    return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
  }
  const PACK_ART = `<div class="pk-crimp top"></div><div class="pk-body"><div class="bk-shard a"></div><div class="bk-shard b"></div><i class="pk-shine"></i>
    <span class="bk-logo"><img src="../assets/logos/ful.svg" alt=""></span><b class="pk-title">Karty FULky</b><span class="pk-sub">5 kariet · raz denne</span></div><div class="pk-crimp bot"></div>`;

  function odds() {
    return C.RARITY.slice().reverse().map((r) => `<li class="r-${r}"><i></i><b>${RNAME[r]}</b><span>${RLONG[r]}</span><em>${C.ODDS[r]} %</em></li>`).join("");
  }
  function packSec() {
    const open = C.canOpen(S.save, today());
    const last = S.save.l.map((id) => S.byId[id]).filter(Boolean);
    const side = open
      ? `<p class="pk-lead">Dnešný balík čaká. Päť kariet, aspoň jedna je <b class="t-rare">Rare</b> alebo lepšia.</p>
         <button type="button" class="btn-white big" data-act="open">Otvoriť balík</button>`
      : `<p class="pk-lead">Dnešný balík je otvorený. Ďalší bude o</p><p class="pk-clock" data-clock>${countdown()}</p>
         ${last.length ? `<div class="pk-last">${last.map((c) => `<button type="button" class="mini" data-act="show" data-id="${esc(c.id)}" aria-label="${esc(c.name)}">${cardHtml(c, "front")}</button>`).join("")}</div>` : ""}`;
    return `<section id="balik" class="sec"><div class="wrap">
      <div class="sec-head"><h2>Denný balík</h2>${ZIG}<span class="sec-hint">Vzácnosť hráča = priečka v kanadskom bodovaní sezóny</span></div>
      <div class="pk-grid"><button type="button" class="pack${open ? "" : " used"}" data-act="open" ${open ? "" : "disabled"} aria-label="Otvoriť balík">${PACK_ART}</button>
        <div class="pk-side">${side}<ul class="odds">${odds()}</ul></div></div></div></section>`;
  }

  /* ---------- Kolekcia ---------- */
  function collectionSec() {
    const all = C.sortCards(S.cards);
    const have = all.filter((c) => owned(c.id));
    const seasons = S.data.seasons.filter((s) => S.cards.some((c) => c.season && c.season.id === s.id));
    const bySeason = (c) => S.season === "all" || (S.season === "-" ? !c.season : c.season && c.season.id === S.season);
    const shown = all.filter((c) => (S.filter === "all" || c.rarity === S.filter) && bySeason(c));
    const bars = C.RARITY.slice().reverse().map((r) => {
      const n = all.filter((c) => c.rarity === r).length;
      const h = have.filter((c) => c.rarity === r).length;
      return `<button type="button" class="cl-bar r-${r}" data-act="filter" data-id="${r}" aria-pressed="${S.filter === r}">
        <span><b>${RNAME[r]}</b><em>${h} / ${n}</em></span><i style="--p:${n ? (h / n) * 100 : 0}%"></i></button>`;
    }).join("");
    const chip = (id, name) => `<button type="button" class="cl-chip" data-act="season" data-id="${esc(id)}" aria-pressed="${S.season === id}">${esc(name)}</button>`;
    const chips = [chip("all", "Všetky sezóny")].concat(seasons.map((s) => chip(s.id, s.short || s.name)),
      S.cards.some((c) => !c.season) ? [chip("-", "Nové tímy")] : []).join("");
    const grid = shown.map((c) => (owned(c.id)
      ? `<button type="button" class="cl-card" data-act="show" data-id="${esc(c.id)}" aria-label="${esc(c.name)}">${cardHtml(c, "front")}${owned(c.id) > 1 ? `<span class="cnt">×${owned(c.id)}</span>` : ""}</button>`
      : `<div class="cl-card off" aria-label="Chýbajúca karta ${RNAME[c.rarity]}">${cardHtml(c, "missing")}</div>`)).join("");
    return `<section id="kolekcia" class="sec"><div class="wrap">
      <div class="sec-head"><h2>Kolekcia</h2>${ZIG}<span class="sec-hint"><b class="cl-total">${have.length} / ${all.length}</b> kariet</span></div>
      <div class="cl-bars">${bars}<button type="button" class="cl-bar all" data-act="filter" data-id="all" aria-pressed="${S.filter === "all"}"><span><b>Všetky</b><em>${have.length} / ${all.length}</em></span><i style="--p:${all.length ? (have.length / all.length) * 100 : 0}%"></i></button></div>
      <div class="cl-chips">${chips}</div>
      ${shown.length ? `<div class="cl-grid">${grid}</div>` : '<p class="empty">V tomto výbere nie sú žiadne karty.</p>'}
      ${have.length ? "" : '<p class="cl-hint">Zatiaľ nemáš žiadnu kartu. Otvor dnešný balík vyššie.</p>'}</div></section>`;
  }

  /* ---------- Vykreslenie ---------- */
  function render() {
    app.innerHTML = header() + daySec() + packSec() + collectionSec() + footer();
  }
  function setData(d) {
    S.data = d;
    S.T = teamsOf(d);
    S.P = Object.fromEntries(d.players.map((p) => [p.id, p]));
    S.cards = C.buildCards(d);
    S.byId = Object.fromEntries(S.cards.map((c) => [c.id, c]));
    if (!S.busy) render();
  }

  /* ---------- Otočenie a náklon karty ---------- */
  function tilt(el) {
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      el.style.setProperty("--ry", `${(x - 0.5) * 22}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * 18}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
      el.classList.add("tilting");
    };
    const leave = () => { el.classList.remove("tilting"); ["--rx", "--ry", "--mx", "--my"].forEach((k) => el.style.removeProperty(k)); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
  }

  // otočenie v dvoch polovičkách (do 90° rubom, výmena, z -90° lícom) – spoľahlivé aj na Safari
  async function flip(el, c) {
    const half = REDUCED ? 60 : 230;
    const P = "perspective(1000px)";
    await el.animate([{ transform: `${P} rotateY(0deg) scale(1)` }, { transform: `${P} rotateY(90deg) scale(1.06)` }], { duration: half, easing: "ease-in", fill: "forwards" }).finished;
    el.className = `fc r-${c.rarity} k-${c.kind} big tilt`;
    el.querySelector(".fc-in").innerHTML = front(c);
    await el.animate([{ transform: `${P} rotateY(-90deg) scale(1.06)` }, { transform: `${P} rotateY(0deg) scale(1)` }], { duration: half + 120, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "forwards" }).finished;
    el.getAnimations().forEach((a) => a.cancel()); // koniec = bez transformácie, náklon (.fc-in) potom funguje
  }

  /* ---------- Otvorenie balíka (celá obrazovka) ---------- */
  let tapWait = null;
  const waitTap = () => new Promise((r) => { tapWait = r; });
  function tapped() { if (tapWait) { const r = tapWait; tapWait = null; r(); } }

  function showLayer(html) {
    layer.innerHTML = html;
    layer.hidden = false;
    document.documentElement.classList.add("locked");
  }
  function hideLayer() {
    layer.hidden = true;
    layer.innerHTML = "";
    document.documentElement.classList.remove("locked");
    S.busy = false;
    render();
  }

  const RAYS = '<div class="rays" aria-hidden="true"></div>';
  async function openPack() {
    if (S.busy || !C.canOpen(S.save, today()) || !S.cards.length) return;
    S.busy = true;
    const had = Object.assign({}, S.save.c); // počty pred balíkom → „Nová karta“ / „×2“
    const seen = Object.assign({}, had);
    const pack = C.openPack(S.cards);
    S.save = C.addPack(S.save, pack.map((c) => c.id), today()); // uložené hneď: obnovenie stránky balík neotvorí znova
    store();
    let skip = false;
    showLayer(`<div class="op" data-stage="pack"><button type="button" class="op-skip" data-op="skip">Odkryť všetky</button>
      <div class="op-stage">${RAYS}<div class="op-pack pack">${PACK_ART}</div><div class="op-card"></div></div>
      <p class="op-cap">Ťukni na balík a roztrhni ho</p><div class="op-tray"></div></div>`);
    const op = layer.querySelector(".op");
    const cap = layer.querySelector(".op-cap");
    const tray = layer.querySelector(".op-tray");
    layer.querySelector("[data-op=skip]").addEventListener("click", (e) => { e.stopPropagation(); skip = true; tapped(); });
    op.addEventListener("click", tapped);
    const packEl = layer.querySelector(".op-pack");
    packEl.animate([{ transform: "translateY(40px) scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.2,1.3,.4,1)" });
    await waitTap();

    if (!skip) {
      cap.textContent = "";
      await packEl.animate([0, -7, 7, -9, 9, -5, 5, 0].map((r) => ({ transform: `rotate(${r}deg)` })), { duration: REDUCED ? 60 : 520 }).finished;
      op.dataset.stage = "tear";
      const topEl = packEl.querySelector(".pk-crimp.top");
      topEl.animate([{ transform: "none" }, { transform: "translate(60px,-260px) rotate(32deg)", opacity: 0 }], { duration: REDUCED ? 60 : 650, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
      await sleep(260);
      await packEl.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(70%) scale(.92)", opacity: 0 }], { duration: REDUCED ? 60 : 520, easing: "ease-in", fill: "forwards" }).finished;
      packEl.remove();
    } else packEl.remove();

    const slot = layer.querySelector(".op-card");
    for (let i = 0; i < pack.length && !skip; i++) {
      const c = pack[i];
      op.dataset.rarity = "";
      slot.innerHTML = cardHtml(c, "back", `big tease-${c.rarity}`);
      const el = slot.firstElementChild;
      cap.innerHTML = `<span class="op-n">${i + 1} / ${pack.length}</span> Ťukni a otoč kartu`;
      await el.animate([{ transform: "translateY(60%) scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: REDUCED ? 60 : 380, easing: "cubic-bezier(.2,1.2,.4,1)" }).finished;
      await waitTap();
      if (skip) break;
      await flip(el, c);
      if (c.rarity === "legendary" || c.rarity === "epic") op.dataset.rarity = c.rarity;
      tilt(el);
      seen[c.id] = (seen[c.id] || 0) + 1;
      cap.innerHTML = `<span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span>${seen[c.id] === 1 ? '<span class="op-new">Nová karta</span>' : `<span class="op-dup">Už máš · ×${seen[c.id]}</span>`}`;
      await waitTap();
      if (skip) break;
      tray.insertAdjacentHTML("beforeend", `<span class="op-mini">${cardHtml(c, "front")}</span>`);
      await el.animate([{ transform: "none", opacity: 1 }, { transform: "translate(-40%, 50%) scale(.3) rotate(-8deg)", opacity: 0 }], { duration: REDUCED ? 60 : 320, easing: "ease-in", fill: "forwards" }).finished;
    }
    summary(pack, S.save.c, had);
  }

  function summary(pack, counts, had) {
    showLayer(`<div class="op done" data-rarity="${pack.some((c) => c.rarity === "legendary") ? "legendary" : ""}">
      <h2 class="op-h">Dnešný balík</h2>
      <div class="op-sum">${pack.map((c, i) => `<button type="button" class="sum-card" data-act="show" data-id="${esc(c.id)}" style="--i:${i}">${cardHtml(c, "front")}
        <span class="sum-tags"><span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span>${had[c.id] ? `<span class="op-dup">×${counts[c.id]}</span>` : '<span class="op-new">Nová</span>'}</span></button>`).join("")}</div>
      <div class="op-btns"><button type="button" class="btn-white big" data-op="close">Do kolekcie</button></div></div>`);
    layer.querySelector("[data-op=close]").addEventListener("click", () => { hideLayer(); document.getElementById("kolekcia").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); });
  }

  /* ---------- Detail karty ---------- */
  function showCard(id) {
    const c = S.byId[id];
    if (!c) return;
    const n = owned(id);
    const where = c.kind === "player" ? `${c.season ? esc(c.season.name) : ""}${c.b > 0 ? ` · ${c.pos}. miesto v kanadskom bodovaní (${c.b} b)` : " · bez bodu v kanadskom bodovaní"}` : (c.season ? esc(c.season.name) : "Tím zatiaľ nie je v sezóne");
    const wasBusy = S.busy;
    const html = `<div class="op detail"><button type="button" class="op-x" data-op="x" aria-label="Zavrieť">${CLOSE}</button>
      <div class="op-stage">${c.rarity === "legendary" ? RAYS : ""}<div class="op-card">${cardHtml(c, "front", "big tilt")}</div></div>
      <p class="op-cap"><span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span><span>${where}</span>${n ? `<span class="op-dup">Máš ×${n}</span>` : ""}</p></div>`;
    const prev = wasBusy ? layer.innerHTML : null;
    showLayer(html);
    S.busy = true;
    tilt(layer.querySelector(".fc"));
    const close = () => {
      if (prev) { layer.innerHTML = prev; bindSummary(); } else hideLayer();
    };
    layer.querySelector("[data-op=x]").addEventListener("click", close);
    layer.querySelector(".op").addEventListener("click", (e) => { if (e.target.classList.contains("op") || e.target.classList.contains("op-stage")) close(); });
  }
  // zhrnutie balíka po návrate z detailu karty
  function bindSummary() {
    const btn = layer.querySelector("[data-op=close]");
    if (btn) btn.addEventListener("click", () => { hideLayer(); document.getElementById("kolekcia").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); });
  }

  /* ---------- Udalosti ---------- */
  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "prayer") { S.prayer = el.dataset.id; const box = app.querySelector(".pr"); if (box) box.outerHTML = prayerBox(); }
    else if (act === "open") openPack();
    else if (act === "show") showCard(el.dataset.id);
    else if (act === "filter") { S.filter = el.dataset.id; rerenderCollection(); }
    else if (act === "season") { S.season = el.dataset.id; rerenderCollection(); }
  }
  function rerenderCollection() {
    const sec = document.getElementById("kolekcia");
    if (sec) sec.outerHTML = collectionSec();
  }
  app.addEventListener("click", onClick);
  layer.addEventListener("click", (e) => { const el = e.target.closest("[data-act=show]"); if (el) { e.stopPropagation(); showCard(el.dataset.id); } });
  document.addEventListener("keydown", (e) => {
    if (layer.hidden) return;
    if (e.key === "Escape") { const x = layer.querySelector("[data-op=x]"); if (x) x.click(); }
    if (e.key === " " || e.key === "Enter") { if (tapWait) { e.preventDefault(); tapped(); } }
  });
  // hodiny do ďalšieho balíka; po polnoci sa stránka prekreslí (nový hráč dňa aj balík)
  let lastDay = today();
  setInterval(() => {
    if (!S.data) return;
    if (today() !== lastDay) { lastDay = today(); if (!S.busy) render(); return; }
    const clock = app.querySelector("[data-clock]");
    if (clock) clock.textContent = countdown();
  }, 1000);
  // náklon veľkej karty hráča dňa (po každom vykreslení je nový prvok)
  new MutationObserver(() => { const el = app.querySelector(".day-card .fc:not([data-t])"); if (el) { el.dataset.t = "1"; tilt(el); } }).observe(app, { childList: true, subtree: true });

  if (DB.cached) {
    setData(DB.cached);
    DB.fresh.then((d) => { if (JSON.stringify(d) !== JSON.stringify(S.data)) setData(d); }, () => {});
  } else {
    DB.fresh.then(setData, () => { app.innerHTML = '<p class="msg">Hru sa nepodarilo načítať. Skontroluj internet a obnov stránku.</p>'; });
  }
})();
