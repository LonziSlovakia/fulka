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
  const S = { data: null, cards: [], byId: {}, T: {}, P: {}, save: C.readSave(ls.get(KEY)), filter: "all", season: "all", busy: false };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Šance pri balíku: nastavenie v admine → Hra (settings.gameOdds: short / full / none);
     adresa ho vie dočasne prepnúť na pozretie (?sance=kratko|popis|nie), nič sa neukladá */
  const ODDS_URL = ({ kratko: "short", nie: "none", popis: "full" })[new URLSearchParams(location.search).get("sance")] || "";
  const oddsView = () => ODDS_URL || L.settingsOf(S.data.settings).gameOdds;

  /* ---------- Modlitby (názvy v cards.js – potrebuje ich aj hlavný web) ---------- */
  const PRAYERS = [
    { id: "otce", name: C.PRAYER_NAMES[0], text: [
      "Otče náš, ktorý si na nebesiach,", "posväť sa meno tvoje,", "príď kráľovstvo tvoje,", "buď vôľa tvoja ako v nebi, tak i na zemi.",
      "Chlieb náš každodenný daj nám dnes", "a odpusť nám naše viny,", "ako i my odpúšťame svojim vinníkom,", "a neuveď nás do pokušenia,", "ale zbav nás zlého.", "Amen."] },
    { id: "zdravas", name: C.PRAYER_NAMES[1], text: [
      "Zdravas’, Mária, milosti plná, Pán s tebou.", "Požehnaná si medzi ženami", "a požehnaný je plod života tvojho, Ježiš.",
      "Svätá Mária, Matka Božia,", "pros za nás hriešnych", "teraz i v hodinu smrti našej.", "Amen."] },
    { id: "slava", name: C.PRAYER_NAMES[2], text: [
      "Sláva Otcu i Synu i Duchu Svätému,", "ako bolo na počiatku, tak nech je i teraz i vždycky", "i na veky vekov.", "Amen."] },
    { id: "ochrana", name: C.PRAYER_NAMES[3], text: [
      "Pod tvoju ochranu sa utiekame, svätá Božia Rodička,", "neodvracaj zrak od našich prosieb,", "pomôž nám v núdzi",
      "a z každého nebezpečenstva nás vysloboď,", "ty Panna slávna a požehnaná.", "Amen."] },
    { id: "verim", name: C.PRAYER_NAMES[4], text: [
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
  const RNAME = Object.assign({ mythical: "Mythical" }, C.RARITY_NAME);
  // tajné karty (mythical): nikde sa nespomínajú, v kolekcii sú iba keď padli (hore ako prvé), nemenia počty
  const MYTHS = C.MYTHICALS; // FULka, UFLka, VERBISTI
  /* ?debug=vymena = ladenie výmeny: kolekcia = jedna common karta 5× (iba v pamäti, do localStorage nič), denný balík ju obsahuje → 6×
     → ponuka „vymeň 5 za balík“ → balík → ostane 1× a ponuka zmizne. Obnovenie stránky = znova od začiatku. */
  const DEBUG_VYMENA = new URLSearchParams(location.search).get("debug") === "vymena";
  const RLONG = { legendary: "Top 5 hráčov sezóny + trblietavé tímy s animovaným logom", epic: "6. – 10. hráč v kanadskom bodovaní",
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
  const store = () => { if (!DEBUG_VYMENA) ls.set(KEY, S.save); };
  const tradeable = () => C.tradeCard(S.cards.concat(MYTHS), S.save); // karta, ktorú má hráč aspoň 6× (alebo null)
  const canTrade = (id) => owned(id) > C.TRADE; // výmena 5 kusov za balík (v detaile karty), jeden ostane

  /* ---------- Karta ---------- */
  // trblietky na legendary (pozície sú v CSS cez --x/--y/--t)
  const SPARKS = [[14, 22, 0], [78, 14, 0.7], [64, 48, 1.4], [22, 62, 2.1], [86, 70, 0.4], [40, 30, 1.8], [52, 80, 1.1]]
    .map(([x, y, t]) => `<i class="sp" style="--x:${x}%;--y:${y}%;--t:${t}s"></i>`).join("");

  function stats(c) {
    if (c.kind === "player") return `<span class="fc-stats"><b>${c.b}</b><small>B</small><span>${c.g} G · ${c.a} A</span></span>`;
    const place = c.place === 1 ? "Víťaz sezóny" : c.place ? `${c.place}. miesto` : c.pos ? `${c.pos}. v tabuľke` : c.season ? "Sezóna pred nami" : "Nový tím";
    return `<span class="fc-stats team">${c.place === 1 ? '<i class="cup" aria-hidden="true"></i>' : ""}<span>${place}</span></span>`;
  }

  // tajné karty: logo FULky (lesknú sa zlaté časti), logo UFL, predchodcu FULky (leskne sa oranžový okraj, písmená, dráha a loptička)
  // a zlaté logo verbistov na verbistickej modrej (leskne sa celé);
  // lesk = vrstva v tvare lesklých častí loga (maska), ktorá sa hýbe s náklonom karty
  const MYTH_ART = {
    ful: { logo: "../assets/logos/ful.svg", mask: "../assets/logos/ful_bez_pozadia.svg", framed: true, sub: "Florbalová UPeCe liga" },
    ufl: { logo: "../assets/logos/ufl.svg", mask: "../assets/logos/ufl-lesk.svg", framed: false, sub: "Odtiaľto FULka pokračuje" },
    svd: { logo: "../assets/logos/verbisti.svg", mask: "../assets/logos/verbisti.svg", framed: false, sub: "Spoločnosť Božieho Slova" },
  };
  function mythFront(c) {
    const a = MYTH_ART[c.art] || MYTH_ART.ful;
    return `<div class="fc-face fc-front my-front my-${esc(c.art)}" style="--mask:url(${a.mask})"><div class="fill my-bg"></div>
      <span class="my-logo${a.framed ? " framed" : ""}"><img src="${a.logo}" alt=""><span class="my-gold"><i></i></span></span>
      <div class="fc-top"><span class="fc-rar">${RNAME.mythical}</span><span class="fc-pos">✦</span></div>
      <div class="fc-info"><b class="fc-name">${esc(c.name)}</b><span class="fc-sub">${a.sub}</span><span class="fc-stats team"><span>Tajná karta</span></span></div>${SPARKS}</div>`;
  }

  function front(c) {
    if (c.kind === "myth") return mythFront(c);
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
      <a class="brand${S.save.w ? " wreath" : ""}" href="../" aria-label="FULka – späť na web"><img src="../assets/logos/ful-mark-white.png" alt="">
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
  // modlitba dňa (bez prepínania): každý deň náhodná z piatich okrem včerajšej, výška podľa nej (nie podľa najdlhšej)
  function prayerBox(date) {
    const pr = PRAYERS[C.prayerOfDay(PRAYERS.length, date)];
    return `<div class="pr"><p class="pr-kick">Dnešná modlitba</p><div class="pr-text"><h3>${esc(pr.name)}</h3>`
      + `${pr.text.map((l) => `<p${l === "Amen." ? ' class="amen"' : ""}>${esc(l)}</p>`).join("")}</div></div>`;
  }
  function daySec() {
    const date = today();
    const p = C.playerOfDay(S.data.players, date);
    if (!p) return "";
    const c = dayCard(p);
    const t = teamOf(c);
    return `<section id="dnes" class="day" style="${vars(t)}"><div class="teeth"></div>
      <div class="wrap day-in"><div class="day-shard" aria-hidden="true"></div>
        <div class="day-card">${cardHtml(c, "front", "big tilt")}</div>
        <div class="day-txt">
          <span class="kicker">${esc(L.dayName(date))} ${esc(L.dShort(date).replace(".", ". "))}</span>
          <h1>Hráč dňa</h1>
          <p class="day-for">Dnes sa modlíme za</p>
          <p class="day-name">${esc(p.name)}</p>
          <p class="day-team"><img src="${esc(t.svg)}" alt="">${esc(t.name)}${t.pre ? ` · ${esc(t.pre)}` : ""}</p>
          <p class="day-lead">Každý deň jeden hráč FULky a jedna modlitba. Venuj ju jemu – za zdravie, rodinu, štúdium aj za fair play na ihrisku i mimo neho.</p>
          ${prayerBox(date)}
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
    const view = oddsView();
    if (view === "none") return "";
    const full = view === "full";
    const rows = C.RARITY.slice().reverse().map((r) => `<li class="r-${r}"><i></i><b>${RNAME[r]}</b>${full ? `<span>${RLONG[r]}</span>` : ""}<em>${C.ODDS[r]} %</em></li>`).join("");
    return `<ul class="odds${full ? "" : " short"}">${rows}</ul>`;
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
      <div class="sec-head"><h2>Denný balík</h2>${ZIG}${oddsView() === "full" ? '<span class="sec-hint">Vzácnosť hráča = priečka v kanadskom bodovaní sezóny</span>' : ""}</div>
      <div class="pk-grid"><button type="button" class="pack${open ? "" : " used"}" data-act="open" ${open ? "" : "disabled"} aria-label="Otvoriť balík">${PACK_ART}</button>
        <div class="pk-side">${side}${odds()}</div></div></div></section>`;
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
    const myth = MYTHS.filter((m) => owned(m.id)); // tajné karty hore ako prvé (iba tie, ktoré hráč má)
    const grid = myth.concat(shown).map((c) => (owned(c.id)
      ? `<button type="button" class="cl-card" data-act="show" data-id="${esc(c.id)}" aria-label="${esc(c.name)}">${cardHtml(c, "front")}${owned(c.id) > 1 ? `<span class="cnt${canTrade(c.id) ? " trade" : ""}">×${owned(c.id)}</span>` : ""}</button>`
      : `<div class="cl-card off" aria-label="Chýbajúca karta ${RNAME[c.rarity]}">${cardHtml(c, "missing")}</div>`)).join("");
    return `<section id="kolekcia" class="sec"><div class="wrap">
      <div class="sec-head"><h2>Kolekcia</h2>${ZIG}<span class="sec-hint"><b class="cl-total">${have.length} / ${all.length}</b> kariet</span></div>
      <div class="cl-bars">${bars}<button type="button" class="cl-bar all" data-act="filter" data-id="all" aria-pressed="${S.filter === "all"}"><span><b>Všetky</b><em>${have.length} / ${all.length}</em></span><i style="--p:${all.length ? (have.length / all.length) * 100 : 0}%"></i></button></div>
      <div class="cl-chips">${chips}</div>
      ${shown.length || myth.length ? `<div class="cl-grid">${grid}</div>` : '<p class="empty">V tomto výbere nie sú žiadne karty.</p>'}
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
    S.byId = Object.fromEntries(S.cards.concat(MYTHS).map((c) => [c.id, c]));
    if (DEBUG_VYMENA && !S.extra && S.cards.length) { // jedna common karta 5× (iba v pamäti)
      const commons = S.cards.filter((c) => c.rarity === "common");
      S.extra = commons[Math.floor(Math.random() * commons.length)] || S.cards[0];
      S.save = { d: "", c: { [S.extra.id]: 5 }, l: [], w: 0 };
    }
    if (!S.busy) render();
  }

  /* ---------- Otočenie a náklon karty ---------- */
  // náklon podľa polohy kurzora/prsta; mimo karty (v páse TILT_REACH okolo nej) náklon postupne slabne do nuly
  const TILT_REACH = 0.25; // myš nakláňa kartu už 25 % (šírky/výšky karty) pred jej okrajom (Lonzi 26. 11.)
  function tiltTo(el, e) {
    const r = el.getBoundingClientRect();
    const rx = (e.clientX - r.left) / r.width;
    const ry = (e.clientY - r.top) / r.height;
    const out = Math.max(0, -rx, rx - 1, -ry, ry - 1); // ako ďaleko za okrajom (0 = na karte)
    if (out > TILT_REACH) return false;
    const k = 1 - out / TILT_REACH; // na karte 1, na vonkajšom kraji pásu 0
    const x = Math.min(1, Math.max(0, rx));
    const y = Math.min(1, Math.max(0, ry));
    el.style.setProperty("--ry", `${((x - 0.5) * 22 * k).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 18 * k).toFixed(2)}deg`);
    el.style.setProperty("--hx", ((0.5 - x) * 60 * k).toFixed(1)); // posun zlatého lesku pri náklone
    el.classList.add("tilting");
    return true;
  }
  function untilt(el) { el.classList.remove("tilting"); ["--rx", "--ry", "--hx"].forEach((k) => el.style.removeProperty(k)); }
  const tilted = new Set(); // karty s náklonom (hráč dňa, karta vo vrstve) – myš ich sleduje cez celý dokument
  function tilt(el) {
    tilted.add(el);
    // dotyk bez gyroskopu: nakláňa sa prstom priamo na karte (mobil s gyroskopom: telefónom, nie prstom)
    const move = (e) => { if (e.pointerType !== "mouse" && !gyro.on) tiltTo(el, e); };
    const leave = (e) => { if (e.pointerType !== "mouse" && !gyro.on) untilt(el); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
  }
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tilted.forEach((el) => {
      if (!el.isConnected) { tilted.delete(el); return; }
      if (!tiltTo(el, e) && el.classList.contains("tilting")) untilt(el);
    });
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => tilted.forEach(untilt)); // kurzor odišiel z okna

  /* ---------- Náklon telefónu (gyroskop) ---------- */
  // na mobile sa podľa náklonu telefónu hýbe lesk na kartách (karta sama stojí, nenakláňa sa). „Rovno“ = poloha, v ktorej telefón držíš:
  // základ sa jej pomaly prispôsobuje (podrží sa naklonený → karta sa za ~2 s vráti). Iba karty, ktoré vidno.
  const gyro = { on: false, x: 0, y: 0, bx: null, by: null, frame: 0, last: "" };
  const GYRO_MAX = 16; // o koľko stupňov treba telefón nakloniť na plný náklon karty
  const clamp1 = (v) => Math.max(-1, Math.min(1, v));
  function gyroPaint() {
    gyro.frame = 0;
    const nx = clamp1(gyro.x / GYRO_MAX), ny = clamp1(gyro.y / GYRO_MAX);
    const key = `${nx.toFixed(2)},${ny.toFixed(2)}`;
    if (key === gyro.last) return; // telefón sa nehýbe → nič neprekresľovať
    gyro.last = key;
    const cards = layer.hidden ? app.querySelectorAll(".day-card .fc, .cl-card.vis .fc, .mini.vis .fc") : layer.querySelectorAll(".op-card .fc:not(.back)");
    cards.forEach((el) => { // karta stojí, hýbe sa iba lesk (Lonzi 26. 11.)
      el.classList.add("tilting");
      el.style.setProperty("--hx", (-(nx + ny * 0.5) * 30).toFixed(1));
    });
  }
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) % 360;
    // gamma = doľava/doprava, beta = dopredu/dozadu; pri telefóne na šírku sa vymenia
    let x = e.gamma, y = e.beta;
    if (a === 90) { x = e.beta; y = -e.gamma; } else if (a === 270 || a === -90) { x = -e.beta; y = e.gamma; } else if (a === 180) { x = -e.gamma; y = -e.beta; }
    if (gyro.bx == null || Math.abs(y - gyro.by) > 90) { gyro.bx = x; gyro.by = y; } // prvé meranie alebo preklopenie cez 180°
    gyro.bx += (x - gyro.bx) * 0.02;
    gyro.by += (y - gyro.by) * 0.02;
    gyro.x = x - gyro.bx;
    gyro.y = y - gyro.by;
    gyro.on = true;
    if (!gyro.frame) gyro.frame = requestAnimationFrame(gyroPaint);
  }
  function gyroStart() {
    if (!matchMedia("(hover: none) and (pointer: coarse)").matches || !("DeviceOrientationEvent" in window)) return; // iba dotykové zariadenia
    window.addEventListener("deviceorientation", onOrient); // Android: chodí hneď, bez pýtania
    if (typeof DeviceOrientationEvent.requestPermission !== "function") return;
    // iPhone: povolenie „pohyb a orientácia“ sa dá pýtať iba po ťuknutí → pri prvom ťuknutí na stránke (dovtedy udalosti nechodia)
    const ask = () => {
      document.removeEventListener("click", ask, true);
      DeviceOrientationEvent.requestPermission().catch(() => {});
    };
    document.addEventListener("click", ask, true);
  }
  gyroStart();

  // otočenie v dvoch polovičkách (do 90° rubom, výmena, z -90° lícom) – spoľahlivé aj na Safari
  async function flip(el, c) {
    const half = REDUCED ? 60 : 230;
    const P = "perspective(1000px)";
    await el.animate([{ transform: `${P} rotateY(0deg) scale(1)` }, { transform: `${P} rotateY(90deg) scale(1.06)` }], { duration: half, easing: "ease-in", fill: "forwards" }).finished;
    el.className = `fc r-${c.rarity} k-${c.kind} big tilt`;
    el.querySelector(".fc-in").innerHTML = front(c);
    await el.animate([{ transform: `${P} rotateY(-90deg) scale(1.06)` }, { transform: `${P} rotateY(0deg) scale(1)` }], { duration: half + 120, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "forwards" }).finished;
    el.getAnimations().forEach((a) => a.cancel()); // koniec = bez transformácie, náklon (.fc-in) potom funguje
    gyro.last = "";
  }

  /* ---------- Otvorenie balíka (celá obrazovka) ---------- */
  let tapWait = null;
  const waitTap = () => new Promise((r) => { tapWait = r; });
  function tapped() { if (tapWait) { const r = tapWait; tapWait = null; r(); } }

  function showLayer(html) {
    layer.innerHTML = html;
    layer.hidden = false;
    document.documentElement.classList.add("locked");
    gyro.last = ""; // nové karty dostanú náklon hneď
  }
  function hideLayer() {
    layer.hidden = true;
    layer.innerHTML = "";
    document.documentElement.classList.remove("locked");
    S.busy = false;
    render();
  }

  const RAYS = '<div class="rays" aria-hidden="true"></div>';
  // tradeId = balík za výmenu 5 kusov tejto karty (denný balík ostáva)
  async function openPack(tradeId) {
    if (S.busy || !S.cards.length) return;
    const t = tradeId ? S.byId[tradeId] : null;
    if (tradeId ? !t || !canTrade(t.id) : !C.canOpen(S.save, today())) return;
    const bonus = !!t;
    S.busy = true;
    const base = t ? C.spend(S.save, t.id) : S.save;
    const had = Object.assign({}, base.c); // počty pred balíkom → „Nová karta“ / „×2“
    const seen = Object.assign({}, had);
    let pack = C.openPack(S.cards, Math.random, MYTHS, base.c);
    if (DEBUG_VYMENA && !bonus && S.extra) pack = [S.extra].concat(pack.filter((c) => c !== S.extra).slice(1)); // ladenie: 6. kus karty
    const next = C.addPack(base, pack.map((c) => c.id), today(), !!t);
    const won = !next.w && C.complete(S.cards, next); // posledná chýbajúca karta → veniec (natrvalo)
    if (won) next.w = 1;
    S.save = next; // uložené hneď: obnovenie stránky balík neotvorí znova
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
      if (["mythical", "legendary", "epic"].includes(c.rarity)) op.dataset.rarity = c.rarity;
      tilt(el);
      seen[c.id] = (seen[c.id] || 0) + 1;
      cap.innerHTML = `<span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span>${seen[c.id] === 1 ? '<span class="op-new">Nová karta</span>' : `<span class="op-dup">Už máš · ×${seen[c.id]}</span>`}`;
      await waitTap();
      if (skip) break;
      tray.insertAdjacentHTML("beforeend", `<span class="op-mini">${cardHtml(c, "front")}</span>`);
      await el.animate([{ transform: "none", opacity: 1 }, { transform: "translate(-40%, 50%) scale(.3) rotate(-8deg)", opacity: 0 }], { duration: REDUCED ? 60 : 320, easing: "ease-in", fill: "forwards" }).finished;
    }
    if (won) await achievement();
    summary(pack, next.c, had, !!t);
  }

  // veniec za celú kolekciu: oslava po odkrytí posledného balíka, potom zhrnutie
  function achievement() {
    return new Promise((done) => {
      showLayer(`<div class="op ach" data-rarity="legendary">${RAYS}<div class="ach-in">
        <span class="ach-w" aria-hidden="true"><img src="../assets/logos/veniec.svg" alt=""><img class="ach-logo" src="../assets/logos/ful-mark-white.png" alt=""></span>
        <span class="kicker">Celá kolekcia</span><h2 class="ach-h">Elite Ball Knowledge</h2>
        <p class="ach-p">Máš všetkých ${S.cards.length} kariet FULky. Veniec ostane pri logu FULky na webe.</p>
        <button type="button" class="btn-white big" data-op="ach">Pokračovať</button></div></div>`);
      layer.querySelector("[data-op=ach]").addEventListener("click", (e) => { e.stopPropagation(); done(); });
    });
  }

  function summary(pack, counts, had, bonus) {
    const top = ["mythical", "legendary"].find((r) => pack.some((c) => c.rarity === r)) || "";
    const t = tradeable();
    showLayer(`<div class="op done" data-rarity="${top}">
      <h2 class="op-h">${bonus ? "Balík za výmenu" : "Dnešný balík"}</h2>
      <div class="op-sum">${pack.map((c, i) => `<button type="button" class="sum-card" data-act="show" data-id="${esc(c.id)}" style="--i:${i}">${cardHtml(c, "front")}
        <span class="sum-tags"><span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span>${had[c.id] ? `<span class="op-dup">×${counts[c.id]}</span>` : '<span class="op-new">Nová</span>'}</span></button>`).join("")}</div>
      <div class="op-btns"><button type="button" class="btn-white big" data-op="close">Do kolekcie</button>${t ? `<p class="op-trade">Máš ${owned(t.id)}× <b>${esc(t.name)}</b> – v kolekcii (detail karty) môžeš ${C.TRADE} vymeniť za nový balík.</p>` : ""}</div></div>`);
    bindSummary();
  }

  /* ---------- Detail karty ---------- */
  function showCard(id) {
    const c = S.byId[id];
    if (!c) return;
    const n = owned(id);
    const where = c.kind === "myth" ? "Tajná karta FULky" : c.kind === "player" ? `${c.season ? esc(c.season.name) : ""}${c.b > 0 ? ` · ${c.pos}. miesto v kanadskom bodovaní (${c.b} b)` : " · bez bodu v kanadskom bodovaní"}` : (c.season ? esc(c.season.name) : "Tím zatiaľ nie je v sezóne");
    const wasBusy = S.busy;
    const html = `<div class="op detail" data-rarity="${c.rarity === "mythical" ? "mythical" : ""}"><button type="button" class="op-x" data-op="x" aria-label="Zavrieť">${CLOSE}</button>
      <div class="op-stage">${c.rarity === "legendary" || c.rarity === "mythical" ? RAYS : ""}<div class="op-card">${cardHtml(c, "front", "big tilt")}</div></div>
      <p class="op-cap"><span class="op-tag r-${c.rarity}">${RNAME[c.rarity]}</span><span>${where}</span>${n ? `<span class="op-dup">Máš ×${n}</span>` : ""}</p>
      ${canTrade(id) ? `<div class="op-btns trade"><button type="button" class="btn-white big alt" data-op="trade">Vymeniť ${C.TRADE} za balík</button><p class="op-trade">${C.TRADE} kusov dáš za nový balík, jedna karta ti ostane.</p></div>` : ""}</div>`;
    const prev = wasBusy ? layer.innerHTML : null;
    showLayer(html);
    S.busy = true;
    tilt(layer.querySelector(".fc"));
    const close = () => {
      if (prev) { layer.innerHTML = prev; bindSummary(); } else hideLayer();
    };
    layer.querySelector("[data-op=x]").addEventListener("click", close);
    const tr = layer.querySelector("[data-op=trade]");
    if (tr) tr.addEventListener("click", () => { hideLayer(); openPack(id); });
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
    if (act === "open") openPack();
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
  // animácie bežia iba na kartách, ktoré vidno (slabšie mobily); trieda .vis spúšťa animácie v CSS
  const seen = "IntersectionObserver" in window
    ? new IntersectionObserver((list) => { list.forEach((x) => x.target.classList.toggle("vis", x.isIntersecting)); gyro.last = ""; }, { rootMargin: "120px" }) : null;
  // po každom vykreslení: náklon veľkej karty hráča dňa a sledovanie kariet v kolekcii
  new MutationObserver(() => {
    gyro.last = "";
    const el = app.querySelector(".day-card .fc:not([data-t])");
    if (el) { el.dataset.t = "1"; tilt(el); }
    app.querySelectorAll(".cl-card:not([data-o]), .mini:not([data-o])").forEach((x) => { x.dataset.o = "1"; if (seen) seen.observe(x); else x.classList.add("vis"); });
  }).observe(app, { childList: true, subtree: true });

  // tlačidlo „hore“ vpravo dole ako na hlavnom webe (styles.css .to-top), ukáže sa po 400 px
  function toTopButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Späť hore");
    btn.innerHTML = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>';
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }));
    document.body.appendChild(btn);
    const update = () => btn.classList.toggle("show", window.scrollY > 400);
    window.addEventListener("scroll", update, { passive: true });
    update();
  }
  toTopButton();

  if (DB.cached) {
    setData(DB.cached);
    DB.fresh.then((d) => { if (JSON.stringify(d) !== JSON.stringify(S.data)) setData(d); }, () => {});
  } else {
    DB.fresh.then(setData, () => { app.innerHTML = '<p class="msg">Hru sa nepodarilo načítať. Skontroluj internet a obnov stránku.</p>'; });
  }
})();
