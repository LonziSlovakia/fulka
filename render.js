/* Verejný web FULky: vykreslí sezónu z dát v databáze podľa návrhu „Shard“.
   Stav stránky (vybraná sezóna, rozbalený zápas, otvorené menu) je v `state`; pri každej zmene
   sa celé #app vykreslí nanovo. Výpočty (tabuľka, body, playoff) robí logic.js. */
(() => {
  "use strict";
  const L = window.Logic;
  const app = document.getElementById("app");
  const state = { data: null, season: null, open: undefined, menu: false, photos: true, font: "saira", layout: "wide" };

  /* ---------- Drobnosti ---------- */
  const STAGE = { SF1: "Semifinále 1", SF2: "Semifinále 2", B3: "O 3. miesto", F: "Finále" };
  const TAG = { done: "Koniec", next: "Najbližší", tbd: "Bez termínu", moved: "Presunutý", plan: "Naplánovaný" };
  const NOTEAM = { id: "", name: "?", pre: "", c: "#2A2A2A", d: "#111111", ink: "#FFFFFF", svg: "assets/logos/ful.svg", gif: "assets/logos/ful.svg" };
  const ZIG = '<svg aria-hidden="true" width="132" height="18" viewBox="0 0 132 18"><polyline points="0,15 11,3 22,15 33,3 44,15 55,3 66,15 77,3 88,15 99,3 110,15 121,3 132,15" fill="none" stroke="#FFFFFF" stroke-width="3"></polyline></svg>';
  const ZIG_SM = '<svg aria-hidden="true" width="88" height="14" viewBox="0 0 88 14"><polyline points="0,12 8,2 16,12 24,2 32,12 40,2 48,12 56,2 64,12 72,2 80,12 88,2" fill="none" stroke="#FFFFFF" stroke-width="2.5"></polyline></svg>';
  const chev = (size = 12) => `<svg class="chev" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>`;
  const ghost = (style) => `<svg class="ghost" aria-hidden="true" viewBox="0 0 100 120" fill="currentColor" style="${style}"><circle cx="50" cy="34" r="21"></circle><path d="M8 120c0-28 19-46 42-46s42 18 42 46z"></path></svg>`;
  const rail = (color) => `<svg aria-hidden="true" viewBox="0 0 20 120" preserveAspectRatio="none"><polyline points="10,0 3,10 17,20 3,30 17,40 3,50 17,60 3,70 17,80 3,90 17,100 3,110 10,120" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></svg>`;

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ESC[ch]);
  const col = (c, fallback) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : fallback);
  const vars = (t) => `--c:${t.c};--d:${t.d};--ink:${t.ink}`;
  const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
  const today = () => L.localParts(Date.now()).date;

  /* ---------- Dáta pre vykreslenie ---------- */
  function teamsOf(d) {
    const T = {};
    d.teams.forEach((t) => {
      T[t.id] = {
        id: t.id, name: t.name, pre: t.venue, abbr: t.abbr,
        c: col(t.color, "#888888"), d: col(t.color_dark, "#333333"), ink: col(t.ink, "#FFFFFF"),
        svg: t.logo || NOTEAM.svg, gif: t.logo_anim || t.logo || NOTEAM.svg,
      };
    });
    return T;
  }
  const playersOf = (d) => Object.fromEntries(d.players.map((p) => [p.id, p]));

  // všetko, čo treba o jednej sezóne: zápasy s doplneným playoff, góly, tabuľka, hráči
  function seasonView(d, s, P) {
    const inSeason = new Set(d.season_teams.filter((x) => x.season_id === s.id).map((x) => x.team_id));
    const teamIds = d.teams.map((t) => t.id).filter((id) => inSeason.has(id));
    const raw = d.matches.filter((m) => m.season_id === s.id);
    const ids = new Set(raw.map((m) => m.id));
    const gm = L.goalsByMatch(d.goals.filter((g) => ids.has(g.match_id)));
    const settings = L.settingsOf(d.settings);
    const table = L.standings(teamIds, raw, gm, settings);
    const matches = L.resolveMatches(s, raw, gm, table);
    const rounds = L.rounds(matches);
    return {
      s, teamIds, matches, gm, settings, table, rounds,
      po: L.playoff(s, raw, gm, table),
      top: L.scorers(matches, gm, P, table, 10),
      roster: d.roster.filter((r) => r.season_id === s.id),
      doneRounds: rounds.filter((r) => r.matches.every((m) => m.status === "done")).length,
      champ: L.champion(matches, gm),
      places: L.places(matches, gm),
    };
  }

  // zápas → tímy, skóre, víťaz
  function sides(m, c) {
    const H = c.T[m.home_id] || NOTEAM;
    const A = c.T[m.away_id] || NOTEAM;
    const goals = c.v.gm[m.id] || [];
    const sc = L.score(goals);
    const done = L.isPlayed(m);
    const w = L.winner(m, goals);
    return { H, A, hs: sc.h, as: sc.a, done, hw: !!w && w === m.home_id, aw: !!w && w === m.away_id, draw: done && !w };
  }
  const label = (m) => (m.stage === "R" ? `Kolo ${m.round}` : STAGE[m.stage]);
  const week = (m) => (m.window_from ? `Týždeň ${L.weekLabel(m.window_from, m.window_to)}` : "");
  const dayLabel = (m) => (m.starts_at ? L.shortDate(L.matchDate(m)) : week(m));
  const photo = (p, key) => (state.photos && p && p[key] ? window.DB.photoUrl(p[key]) : "");

  /* Fotky a písmo nadpisov: podľa nastavení z adminu, ale adresa ich vie dočasne prepnúť
     na porovnanie (?fotky=ano|nie, ?pismo=saira|monument), nič sa tým neukladá. */
  const URLP = new URLSearchParams(location.search);
  function viewOptions(settings) {
    const f = URLP.get("fotky");
    const font = URLP.get("pismo");
    const lay = URLP.get("rozlozenie");
    state.photos = f === "ano" ? true : f === "nie" ? false : settings.photos !== false;
    state.font = font === "monument" || font === "saira" ? font : settings.headFont === "monument" ? "monument" : "saira";
    state.layout = lay === "uzke" ? "narrow" : lay === "siroke" ? "wide" : settings.layout === "narrow" ? "narrow" : "wide";
    document.documentElement.dataset.layout = state.layout;
    applyFont(state.font);
  }
  // Monument sa zapne až keď sa písmo naozaj načíta (inak by ostalo Saira so zmenšenými veľkosťami)
  function applyFont(font) {
    const root = document.documentElement;
    if (font !== "monument") { delete root.dataset.font; return; }
    if (!document.fonts || !document.fonts.load) return;
    document.fonts.load('900 20px "PP Monument Extended"').then((list) => {
      if (list.length && state.font === "monument") root.dataset.font = "monument";
    }, () => {});
  }

  // rozbalený zápas: kým ho nikto nezavrel, v prebiehajúcej sezóne je otvorený posledný výsledok
  function openId(c) {
    if (state.open !== undefined) return state.open;
    if (c.cur.state !== "live") return null;
    const played = c.v.matches.filter(L.isPlayed).sort(L.byTime);
    return played.length ? played[played.length - 1].id : null;
  }

  const secHead = (title, hint, extra) =>
    `<div class="sec-head"><h2>${title}</h2>${ZIG}${hint ? `<span class="sec-hint">${hint}</span>` : ""}${extra || ""}</div>`;

  /* ---------- Spoločné kúsky ---------- */
  function goalsList(m, c) {
    const gs = c.v.gm[m.id] || [];
    if (!gs.length) return `<div class="goals none">${L.isPlayed(m) ? "Zápas skončil bez gólov." : "Góly ešte nie sú zapísané."}</div>`;
    const rows = L.goalTimeline(gs, c.P).map((g) => {
      const t = c.T[g.side === "h" ? m.home_id : m.away_id] || NOTEAM;
      return `<div class="goal" style="${vars(t)}"><span class="sc">${g.score}</span><img src="${esc(t.svg)}" alt="${esc(t.name)}">`
        + `<span class="who"><b>${esc(g.scorer)}</b>${g.assist ? ` <span>(${esc(g.assist)})</span>` : ""}</span></div>`;
    });
    return `<div class="goals">${rows.join("")}</div>`;
  }

  function avatar(p, t, small) {
    const src = photo(p, "photo_face");
    const inner = src ? `<img src="${esc(src)}" alt="" loading="lazy">` : `<span>${esc(L.initials(p ? p.name : "?"))}</span>`;
    return `<span class="av${small ? " sm" : ""}" style="${vars(t || NOTEAM)}">${inner}</span>`;
  }

  /* ---------- Hlavička a výber sezóny ---------- */
  const STATE = {
    live: { status: "Prebieha", chipBg: "#FFFFFF", chipFg: "#050505", chipBd: "#FFFFFF", line: "solid", dot: "#3DDC84", dotBd: "#3DDC84" },
    done: { status: "Skončená", chipBg: "transparent", chipFg: "#BDBDBD", chipBd: "#5A5A5A", line: "solid", dot: "#9A9A9A", dotBd: "#9A9A9A" },
    soon: { status: "Pripravujeme", chipBg: "transparent", chipFg: "#FFFFFF", chipBd: "#FFFFFF", line: "dashed", dot: "transparent", dotBd: "#FFFFFF" },
  };
  const NAV = {
    live: [["#vysledky", "Výsledky"], ["#rozpis", "Rozpis"], ["#tabulka", "Tabuľka"], ["#hraci", "Hráči"], ["#playoff", "Playoff"], ["#timy", "Tímy"]],
    done: [["#sampion", "Šampión"], ["#poradie", "Poradie"], ["#tabulka", "Tabuľka"], ["#playoff", "Playoff"], ["#vysledky", "Výsledky"], ["#hraci", "Hráči"]],
    soon: [],
  };

  function header(c) {
    const s = c.cur;
    const st = STATE[s.state];
    const nav = NAV[s.state].map(([href, txt]) => `<a href="${href}">${txt}</a>`).join("");
    return `<header class="top"><div class="wrap top-in">
      <a class="brand" href="#top" data-act="home" aria-label="FULka — domov"><img src="assets/logos/ful-mark-white.png" alt="">
        <span class="brand-name"><b>FULka</b><small>Florbalová Upece Liga</small></span></a>
      <button type="button" class="season-btn" data-act="menu" aria-expanded="${state.menu}" aria-label="Vybrať sezónu, teraz ${esc(s.name)}">
        <span class="dot" aria-hidden="true" style="background:${st.dot};border:1px ${st.line} ${st.dotBd}"></span>${esc(s.name)}${chev(14)}</button>
      <nav class="nav" aria-label="Hlavná navigácia">${nav}
        <button type="button" class="nav-season" data-act="menu" aria-expanded="${state.menu}">Sezóny</button></nav>
    </div></header>`;
  }

  function seasonBlurb(s, sv, T) {
    if (s.state === "done") {
      const ch = sv.champ && T[sv.champ];
      return ch ? `Skončená · šampión ${ch.pre} ${ch.name}`.replace("  ", " ") : "Skončená";
    }
    if (s.state === "soon") return "Pripravujeme · draft a termíny čoskoro";
    const n = sv.doneRounds;
    const total = sv.rounds.length;
    if (!n) return "Prebieha · prvé kolo čoskoro";
    return `Prebieha · odohrané ${n} ${plural(n, "kolo", "kolá", "kôl")} ${[4, 6, 7].includes(total) ? "zo" : "z"} ${total}`;
  }

  function seasonMenu(c) {
    const cards = c.seasons.map((s) => {
      const sv = s.id === c.cur.id ? c.v : seasonView(c.d, s, c.P);
      const st = STATE[s.state];
      const ch = s.state === "done" && sv.champ ? c.T[sv.champ] : null;
      const shard = s.state === "live" ? "linear-gradient(160deg, #FFFFFF, #6A6A6A)"
        : s.state === "done" ? `linear-gradient(160deg, ${ch ? ch.c : "#5A5A5A"}, ${ch ? ch.d : "#1E1E1E"})`
          : "repeating-linear-gradient(115deg, #2E2E2E 0 6px, #141414 6px 12px)";
      return `<button type="button" class="season-card" data-act="season" data-id="${esc(s.id)}" aria-pressed="${s.id === c.cur.id}">
        <span class="shard" aria-hidden="true" style="background:${shard}"></span>
        ${ch ? `<img class="logo" src="${esc(ch.svg)}" alt="">` : ""}
        <span class="chip" style="background:${st.chipBg};color:${st.chipFg};border:1px ${st.line} ${st.chipBd}"><i aria-hidden="true" style="background:${st.dot}"></i>${st.status}</span>
        <span class="name">${esc(s.name)}</span>
        <span class="blurb">${esc(seasonBlurb(s, sv, c.T))}</span></button>`;
    });
    return `<section class="seasons" aria-label="Výber sezóny"><div class="wrap seasons-in">
      <div class="sec-head" style="margin:0"><h2 class="small">Sezóny</h2>${ZIG_SM}<span class="sec-hint">Vyber sezónu — skončené ostávajú v archíve</span></div>
      <div class="seasons-grid">${cards.join("")}</div></div></section>`;
  }

  /* ---------- Banner: najbližšie zápasy ---------- */
  const BANNER_SIZE = {
    2: { minCol: "420px", logo: "clamp(84px, 10cqi, 150px)", name: "clamp(20px, 2.6cqi, 34px)", time: "clamp(40px, 5cqi, 68px)" },
    3: { minCol: "340px", logo: "clamp(72px, 7.5cqi, 112px)", name: "clamp(18px, 2cqi, 26px)", time: "clamp(34px, 3.6cqi, 50px)" },
    4: { minCol: "270px", logo: "clamp(64px, 6cqi, 92px)", name: "clamp(16px, 1.7cqi, 22px)", time: "clamp(30px, 3cqi, 42px)" },
  };

  function bannerKicker(ups) {
    const rs = Array.from(new Set(ups.filter((m) => m.stage === "R").map((m) => m.round)));
    const parts = rs.length ? [rs.length === 1 ? `Kolo ${rs[0]}` : `Kolá ${rs.join(", ")}`] : [];
    ups.filter((m) => m.stage !== "R").forEach((m) => parts.push(STAGE[m.stage]));
    return `${ups.length === 1 ? "Najbližší zápas" : "Najbližšie zápasy"} · ${parts.join(" · ")}`;
  }

  // spoločný deň (alebo týždeň) hore nad kartami, ak ho majú všetky zápasy rovnaký
  function bannerDay(ups, c) {
    const key = (m) => (m.starts_at ? L.matchDate(m) : `${m.window_from}|${m.window_to}`);
    if (!ups.every((m) => key(m) === key(ups[0]))) return null;
    const f = ups[0];
    if (f.starts_at) return { dn: L.dayName(L.matchDate(f)), big: L.dShort(L.matchDate(f)), note: c.v.settings.bannerNote ?? "po sv. omši", week: false };
    return { dn: "Týždeň", big: L.weekLabel(f.window_from, f.window_to), note: "termín sa doplní", week: true };
  }

  function matchNotes(m, withTbd) {
    return [
      m.moved && m.orig_starts_at ? `Presunutý · pôvodne ${L.slot(m.orig_starts_at)}` : "",
      m.note || "",
      withTbd && !m.starts_at ? "termín sa doplní" : "",
    ].filter(Boolean).map(esc).join(" · ");
  }

  function banner(c) {
    const ups = L.nextMatches(c.v.matches, c.v.settings.bannerCount);
    if (!ups.length) return "";
    const day = bannerDay(ups, c);
    const kicker = esc(bannerKicker(ups));
    return ups.length === 1 ? heroSingle(ups[0], c, day, kicker) : heroMulti(ups, c, day, kicker);
  }

  function heroSingle(m, c, day, kicker) {
    const { H, A } = sides(m, c);
    const team = (t) => `<div class="side" style="gap:10px"><img src="${esc(t.svg)}" alt="${esc(t.name)}" style="width:clamp(110px, 22cqi, 260px);height:clamp(110px, 22cqi, 260px);filter:drop-shadow(0 14px 22px rgba(0,0,0,0.45))">
      <span class="tname" style="padding:4px 14px;--ts:clamp(24px, 4.4cqi, 56px)">${esc(t.name)}</span></div>`;
    const notes = matchNotes(m, false);
    return `<section class="hero" aria-label="Najbližší zápas">
      <div class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${H.c} 0%, ${H.d} 70%)"></div>
      <div class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${A.c} 0%, ${A.d} 80%);clip-path:polygon(58% 0, 100% 0, 100% 100%, 42% 100%, 51% 63%, 45.5% 59%, 55% 28%, 49.5% 24%)"></div>
      <div class="fill stripes" aria-hidden="true"></div>
      <div class="fill" aria-hidden="true" style="background:linear-gradient(180deg, rgba(5,5,5,0) 50%, rgba(5,5,5,0.85) 100%)"></div>
      <div class="wrap hero-in" style="padding-top:40px;padding-bottom:64px">
        <span class="kicker dark">${kicker}</span>
        <div class="vs3" style="gap:clamp(8px, 2cqi, 32px)">${team(H)}
          <div class="hero-c">
            <span class="fc upper" style="font-weight:800;font-size:clamp(16px, 2cqi, 24px);letter-spacing:0.2em">${esc(day.dn)}</span>
            <span class="fc" style="font-weight:900;font-size:${day.week ? "clamp(32px, 5cqi, 64px)" : "clamp(44px, 9cqi, 120px)"};line-height:0.82;transform:skewX(-8deg)">${esc(day.big)}</span>
            ${m.starts_at ? `<span class="fc" style="font-weight:900;font-size:clamp(28px, 4.4cqi, 56px);line-height:1">${L.matchTime(m)}</span>` : ""}
            <span class="note" style="color:#EDEDED">${esc(day.note)}</span>
          </div>${team(A)}</div>
        ${notes ? `<span class="mnote">${notes}</span>` : ""}
      </div><div class="teeth" aria-hidden="true"></div></section>`;
  }

  function heroMulti(ups, c, day, kicker) {
    const sz = BANNER_SIZE[Math.min(4, ups.length)];
    const team = (t) => `<div class="side"><img src="${esc(t.svg)}" alt="${esc(t.name)}" style="width:${sz.logo};height:${sz.logo}"><span class="tname" style="--ts:${sz.name}">${esc(t.name)}</span></div>`;
    const cards = ups.map((m, i) => {
      const { H, A } = sides(m, c);
      const notes = matchNotes(m, !day);
      return `<article class="mcard${i === 0 ? " first" : ""}" style="--c:${H.c};--d:${H.d};--ac:${A.c};--ad:${A.d}">
        <div class="fill grad" aria-hidden="true"></div><div class="fill grad away" aria-hidden="true"></div>
        <div class="fill stripes" aria-hidden="true"></div><div class="fill fade" aria-hidden="true"></div>
        <div class="mcard-in"><span class="kicker dark sm">${esc(day ? `${i + 1}. zápas` : dayLabel(m))}</span>
          <div class="vs3" style="margin-top:auto">${team(H)}
            <div class="mid"><span class="time" style="font-size:${sz.time}">${m.starts_at ? L.matchTime(m) : "vs"}</span><span class="sub">${esc(label(m))}</span></div>
          ${team(A)}</div>
          ${notes ? `<span class="mnote">${notes}</span>` : ""}</div></article>`;
    });
    const head = day ? `<div class="hero-day"><span class="dn">${esc(day.dn)}</span><span class="big"${day.week ? ' style="font-size:clamp(36px, 5cqi, 72px)"' : ""}>${esc(day.big)}</span><span class="note">${esc(day.note)}</span></div>` : "";
    return `<section class="hero" aria-label="Najbližšie zápasy">
      <div class="fill" aria-hidden="true" style="background:linear-gradient(160deg, #161616 0%, #050505 60%)"></div>
      <div class="fill stripes-light" aria-hidden="true"></div>
      <div class="wrap hero-in"><span class="kicker">${kicker}</span>${head}
        <div class="cards" style="grid-template-columns:repeat(auto-fit, minmax(min(100%, ${sz.minCol}), 1fr))">${cards.join("")}</div>
      </div><div class="teeth" aria-hidden="true"></div></section>`;
  }

  /* ---------- Výsledky ---------- */
  function resultCard(m, c, open) {
    const x = sides(m, c);
    const isOpen = open === m.id;
    const W = x.hw ? x.H : x.A;
    const shard = x.draw ? "" : `<span class="shard" aria-hidden="true" style="${vars(W)};clip-path:${x.hw ? "polygon(0 0, 50% 0, 30% 100%, 0 100%)" : "polygon(70% 0, 100% 0, 100% 100%, 50% 100%)"}"></span>`;
    const team = (t, win) => {
      const lost = !win && !x.draw;
      return `<span class="res-side"><img src="${esc(win ? t.gif : t.svg)}" alt="${esc(t.name)}"${lost ? ' class="lose"' : ""}><span${lost ? ' class="lose-ink"' : ""}>${esc(t.name)}</span></span>`;
    };
    const num = (n, win) => `<span style="color:${win || x.draw ? "#FFFFFF" : "#7A7A7A"}">${n}</span>`;
    return `<article class="res${isOpen ? " open" : ""}">
      <button type="button" class="res-btn" data-act="open" data-id="${esc(m.id)}" aria-expanded="${isOpen}">${shard}
        <span class="res-row">${team(x.H, x.hw)}<span class="res-score">${num(x.hs, x.hw)}<span class="colon">:</span>${num(x.as, x.aw)}</span>${team(x.A, x.aw)}</span>
        <span class="res-foot"><span>${esc(label(m))} · ${esc(dayLabel(m))}</span><span class="tg">${isOpen ? "Skryť góly" : "Góly"}${chev()}</span></span>
      </button>${isOpen ? goalsList(m, c) : ""}</article>`;
  }

  function results(c, open) {
    const played = c.v.matches.filter(L.isPlayed).sort(L.byTime).reverse();
    const body = played.length ? `<div class="results">${played.map((m) => resultCard(m, c, open)).join("")}</div>`
      : '<p class="empty">Zatiaľ sa nehralo. Výsledky sa tu ukážu hneď po prvom zápase.</p>';
    return `<section id="vysledky" class="sec" style="padding-top:56px">${secHead("Výsledky", played.length ? "Klikni na zápas a uvidíš, kto dal góly" : "")}${body}</section>`;
  }

  /* ---------- Rozpis ---------- */
  function scheduleRow(m, c, nextId) {
    const x = sides(m, c);
    const st = L.matchState(m, nextId);
    const weekOk = !m.starts_at && !!m.window_to && m.window_to >= today();
    const when = m.starts_at ? L.slot(m.starts_at) : weekOk ? week(m) : "Termín sa hľadá";
    const warn = st === "moved" || (!m.starts_at && !weekOk);
    const lines = [];
    if (m.orig_starts_at && (m.moved || !m.starts_at)) lines.push(`<small>pôvodne <s>${esc(L.slot(m.orig_starts_at))}</s></small>`);
    if (weekOk) lines.push("<small>termín sa doplní</small>");
    if (m.note) lines.push(`<small class="note">${esc(m.note)}</small>`);
    const team = (t, win, home) => {
      const lost = x.done && !win && !x.draw;
      const img = `<img src="${esc(win ? t.gif : t.svg)}" alt="">`;
      const name = `<span>${esc(t.name)}</span>`;
      return `<div class="row-team${home ? " h" : ""}"${lost ? ' style="opacity:0.4"' : ""}>${home ? name + img : img + name}</div>`;
    };
    const mid = x.done ? `${x.hs}:${x.as}` : !m.starts_at && !weekOk ? "?" : "vs";
    return `<div class="row"><span class="rail" aria-hidden="true" style="--hc:${x.H.c};--ac:${x.A.c}"></span><div class="row-in">
      <div class="row-teams">${team(x.H, x.hw, true)}<span class="row-mid${x.done ? " done" : ""}">${mid}</span>${team(x.A, x.aw, false)}</div>
      <div class="row-when"><span class="t${warn ? " warn" : ""}">${esc(when)}</span>${lines.join("")}<span class="tag ${st}">${TAG[st]}</span></div>
    </div></div>`;
  }

  function schedule(c) {
    if (!c.v.rounds.length) return "";
    const next = L.nextMatches(c.v.matches, 1)[0];
    const nextK = next && next.stage === "R" ? next.round : null;
    const rows = c.v.rounds.map((r) => {
      const past = r.matches.every((m) => m.status === "done");
      return `<div class="round${past ? " past" : ""}">
        <div class="round-date"><span class="d">${r.date ? L.dShort(r.date) : "?"}</span><span class="w">${r.date ? (r.exact ? L.dayName(r.date) : "týždeň") : ""}</span>${rail(past ? "#2E2E2E" : "#FFFFFF")}</div>
        <div class="round-body"><div class="round-title"><b>Kolo ${r.round}</b>${r.round === nextK ? '<span class="badge">Najbližšie</span>' : ""}</div>
          ${r.matches.map((m) => scheduleRow(m, c, next && next.id)).join("")}</div></div>`;
    });
    const legend = '<span class="legend"><span><i aria-hidden="true" style="background:#FFB020"></i>presunutý</span><span><i aria-hidden="true" style="border:1px dashed #FFFFFF"></i>bez termínu</span></span>';
    return `<section id="rozpis" class="sec">${secHead("Rozpis", "", legend)}<div class="rounds">${rows.join("")}</div></section>`;
  }

  /* ---------- Tabuľka ---------- */
  function tableRows(c) {
    const head = '<div class="tbl-row tbl-head"><span></span><span style="padding-left:16px;text-align:left">Tím</span><span>Z</span><span>V</span><span>R</span><span>P</span><span>Skóre</span><span>+/-</span><span class="b">Body</span></div>';
    const rows = c.v.table.map((s) => {
      const t = c.T[s.id] || NOTEAM;
      return `<div class="tbl-row tbl-body" style="${vars(t)}"><span class="pos">${s.pos}</span>
        <span class="tbl-team"><img src="${esc(t.svg)}" alt=""><span><b>${esc(t.name)}</b><small>${esc(t.pre)}</small></span></span>
        <span>${s.z}</span><span>${s.v}</span><span>${s.r}</span><span>${s.p}</span>
        <span class="soft">${s.gf}:${s.ga}</span><span class="soft">${s.diff > 0 ? "+" : ""}${s.diff}</span><span class="pts">${s.b}</span></div>`;
    });
    return `<div class="tbl-scroll"><div class="tbl">${head}${rows.join("")}</div></div>`;
  }

  function table(c, title, hint, foot) {
    if (!c.v.table.length) return "";
    return `<section id="tabulka" class="sec" style="padding-top:${foot ? 56 : 64}px">${secHead(title, hint)}${tableRows(c)}${foot ? `<p class="foot-note">${foot}</p>` : ""}</section>`;
  }

  function liveTableNote(c) {
    const s = c.v.settings;
    const four = c.v.teamIds.length === 4 ? " · do playoff idú všetky štyri tímy, poradie určí dvojice semifinále" : "";
    return `Výhra ${s.pointsWin} b · remíza ${s.pointsDraw} b${four}.`;
  }

  /* ---------- Hráči ---------- */
  function podiumCard(x, c) {
    const t = c.T[x.team_id] || NOTEAM;
    const p = c.P[x.player_id];
    const head = photo(p, "photo_head");
    const pic = head ? `<img class="photo" src="${esc(head)}" alt="${esc(x.name)}">`
      : `${ghost("right:5%;width:48%")}${state.photos ? '<span class="soon">Fotka čoskoro</span>' : ""}`;
    return `<article class="pod"><div class="shard grad-160" aria-hidden="true" style="${vars(t)}"></div><div class="shard stripes" aria-hidden="true"></div>${pic}
      <span class="outline-num" style="font-size:64px">${x.pos}</span>
      <span class="pod-info"><span class="pod-team"><img src="${esc(t.svg)}" alt="">${esc(t.name)}</span>
        <span class="pod-name">${esc(x.name)}</span>
        <span class="pod-stat">${x.g} G · ${x.a} A · ${x.z} ${plural(x.z, "zápas", "zápasy", "zápasov")}</span>
        <span class="pod-pts">${x.b}<small>B</small></span></span></article>`;
  }

  function playerRows(list, c, withZ) {
    return list.map((x) => {
      const t = c.T[x.team_id] || NOTEAM;
      return `<div class="ptbl-row"><span class="n">${x.pos}</span>
        <span class="pl">${avatar(c.P[x.player_id], t)}<b>${esc(x.name)}</b><img src="${esc(t.svg)}" alt="${esc(t.name)}"></span>
        ${withZ ? `<span class="soft">${x.z}</span>` : ""}<span>${x.g}</span><span>${x.a}</span><span class="pts">${x.b}</span></div>`;
    }).join("");
  }

  function players(c) {
    const top = c.v.top;
    const hint = "Gól = 1 bod · asistencia = 1 bod";
    if (!top.length) return `<section id="hraci" class="sec">${secHead("Kanadské bodovanie", hint)}<p class="empty">Zatiaľ nepadol žiadny gól. Body sa začnú rátať po prvom zápase.</p></section>`;
    const rest = top.slice(3);
    const tbl = rest.length ? `<div class="ptbl"><div class="ptbl-row ptbl-head"><span>#</span><span>Hráč</span><span>Z</span><span>G</span><span>A</span><span>B</span></div>${playerRows(rest, c, true)}</div>` : "";
    return `<section id="hraci" class="sec">${secHead("Kanadské bodovanie", hint)}<div class="podium">${top.slice(0, 3).map((x) => podiumCard(x, c)).join("")}</div>${tbl}</section>`;
  }

  /* ---------- Playoff (prebiehajúca sezóna: pavúk) ---------- */
  const whenOr = (m) => (m.starts_at ? L.slot(m.starts_at) : "termín sa doplní");

  function seedRow(m, home, c) {
    const id = home ? m.home_id : m.away_id;
    const seed = home ? m.seedH : m.seedA;
    if (m.fixed && id) {
      const t = c.T[id] || NOTEAM;
      const done = L.isPlayed(m);
      const w = done ? L.winner(m, c.v.gm[m.id]) : null;
      const sc = L.score(c.v.gm[m.id]);
      return `<div class="seed${w && w !== id ? " lost" : ""}" style="${vars(t)}"><span class="n">${seed || ""}</span><img src="${esc(w === id ? t.gif : t.svg)}" alt="">
        <span class="nm">${esc(t.name)}</span>${done ? `<span class="sc">${home ? sc.h : sc.a}</span>` : ""}</div>`;
    }
    if (!seed) return '<div class="seed tbd"><span class="n">?</span><span class="nm">Tím doplní admin</span></div>';
    const now = c.v.table[seed - 1];
    const played = c.v.matches.some((x) => x.stage === "R" && x.status === "done");
    return `<div class="seed tbd"><span class="n">${seed}</span><span class="nm">${seed}. tabuľky${played && now ? `<small>teraz ${esc((c.T[now.id] || NOTEAM).name)}</small>` : ""}</span></div>`;
  }

  function finalSides(m, c, ph1, ph2) {
    if (!m.fixed) return `<span><span class="ph" aria-hidden="true"></span>${ph1}</span><span><span class="ph" aria-hidden="true"></span>${ph2}</span>`;
    const done = L.isPlayed(m);
    const w = done ? L.winner(m, c.v.gm[m.id]) : null;
    const sc = L.score(c.v.gm[m.id]);
    return [[m.home_id, sc.h], [m.away_id, sc.a]].map(([id, n]) => {
      const t = c.T[id] || NOTEAM;
      return `<span${w && w !== id ? ' class="lost"' : ""}><img src="${esc(w === id ? t.gif : t.svg)}" alt=""><span class="nm">${esc(t.name)}</span>${done ? `<span class="sc">${n}</span>` : ""}</span>`;
    }).join("");
  }

  function playoffLive(c) {
    const po = c.v.po;
    if (!po.SF1 && !po.SF2 && !po.F) return "";
    const lastRound = c.v.rounds.length ? c.v.rounds[c.v.rounds.length - 1].round : 0;
    const hint = c.v.s.seed_mode === "manual" ? "Dvojice semifinále určil admin" : `1. – 4. a 2. – 3. podľa tabuľky po ${lastRound}. kole`;
    const semi = (m) => (!m ? "" : `<div class="box"><div class="box-head"><span>${STAGE[m.stage]}</span><span>${esc(whenOr(m))}</span></div>${seedRow(m, true, c)}${seedRow(m, false, c)}</div>`);
    const fin = po.F ? `<div class="final"><div class="fin-head"><b>Finále</b><span>${esc(whenOr(po.F))}</span></div>
      <div class="fin-sides">${finalSides(po.F, c, "Víťaz semifinále 1", "Víťaz semifinále 2")}</div></div>` : "";
    const b3 = po.B3 ? `<div class="box bronze"><div class="fin-head"><b>O 3. miesto</b><span>${esc(whenOr(po.B3))}</span></div>
      <div class="fin-sides">${po.B3.fixed ? finalSides(po.B3, c) : "Porazení zo semifinále"}</div></div>` : "";
    return `<section id="playoff" class="sec">${secHead("Playoff", hint)}<div class="bracket">
      <div class="semis"><div class="join" aria-hidden="true"></div>${semi(po.SF1)}${semi(po.SF2)}</div>
      <div class="finals"><i aria-hidden="true"></i><div class="finals-in">${fin}${b3}</div></div></div></section>`;
  }

  /* ---------- Tímy ---------- */
  function teamCard(id, c) {
    const t = c.T[id] || NOTEAM;
    const rs = c.v.roster.filter((r) => r.team_id === id)
      .map((r) => ({ r, p: c.P[r.player_id] })).filter((x) => x.p)
      .sort((a, b) => (b.r.captain - a.r.captain) || a.p.name.localeCompare(b.p.name, "sk"));
    const capt = rs.find((x) => x.r.captain);
    const full = capt ? photo(capt.p, "photo") : "";
    const pic = full ? `<img class="capt" src="${esc(full)}" alt="${esc(`${capt.p.name}, kapitán tímu ${t.name}`)}" loading="lazy">` : ghost("right:8%;width:52%");
    const list = rs.map((x) => `<li>${avatar(x.p, t, true)}<span>${esc(x.p.name)}</span>${x.r.captain ? '<span class="cap" aria-label="kapitán">C</span>' : ""}</li>`).join("");
    return `<article class="team" style="${vars(t)}"><div class="team-top"><div class="fill shard" aria-hidden="true"></div><div class="fill stripes" aria-hidden="true"></div>
      <img class="logo" src="${esc(t.svg)}" alt="">${pic}<div class="shade" aria-hidden="true"></div>
      <span class="team-title">${t.pre ? `<small>${esc(t.pre)}</small>` : ""}<b>${esc(t.name)}</b></span></div>
      <div class="team-body"><span class="team-meta"><span>Kapitán: <strong>${capt ? esc(capt.p.name) : "—"}</strong></span><span>${rs.length} ${plural(rs.length, "hráč", "hráči", "hráčov")}</span></span>
        <ul class="roster">${list}</ul></div></article>`;
  }

  function teams(c) {
    if (!c.v.teamIds.length) return "";
    return `<section id="timy" class="sec">${secHead("Tímy", "Súpisky po drafte · C = kapitán · fotky pribúdajú postupne")}<div class="teams">${c.v.teamIds.map((id) => teamCard(id, c)).join("")}</div></section>`;
  }

  /* ---------- Prebiehajúca sezóna ---------- */
  function liveBody(c, open) {
    return banner(c) + `<main class="wrap main">${results(c, open)}${schedule(c)}${table(c, "Tabuľka", "", liveTableNote(c))}${players(c)}${playoffLive(c)}${teams(c)}</main>`;
  }

  /* ---------- Skončená sezóna (archív) ---------- */
  const byStage = (c, st) => c.v.matches.find((m) => m.stage === st);

  function champion(c) {
    const f = byStage(c, "F");
    if (!c.v.champ || !f) return "";
    const ch = c.T[c.v.champ] || NOTEAM;
    const ru = c.T[L.loser(f, c.v.gm[f.id])] || NOTEAM;
    const sc = L.score(c.v.gm[f.id]);
    const rows = [[f.home_id, sc.h], [f.away_id, sc.a]].map(([id, n]) => {
      const t = c.T[id] || NOTEAM;
      const win = id === c.v.champ;
      return `<div class="row2${win ? "" : " lost"}"><img src="${esc(win ? t.gif : t.svg)}" alt=""><span class="nm">${esc(t.name)}</span><span class="sc">${n}</span></div>`;
    }).join("");
    return `<section id="sampion" class="hero" aria-label="Šampión sezóny">
      <div class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${ch.c} 0%, ${ch.d} 78%);clip-path:polygon(0 0, 64% 0, 52% 46%, 57% 50%, 46% 100%, 0 100%)"></div>
      <div class="fill" aria-hidden="true" style="background:linear-gradient(150deg, ${ru.c} 0%, ${ru.d} 90%);clip-path:polygon(64% 0, 100% 0, 100% 100%, 46% 100%, 57% 50%, 52% 46%);opacity:0.35"></div>
      <div class="fill stripes" aria-hidden="true"></div>
      <div class="fill" aria-hidden="true" style="background:linear-gradient(180deg, rgba(5,5,5,0) 55%, rgba(5,5,5,0.85) 100%)"></div>
      <div class="wrap champ-in"><img class="champ-logo" src="${esc(ch.gif)}" alt="${esc(ch.name)}">
        <div class="champ-txt"><span class="kicker dark" style="padding:6px 16px">Šampión · ${esc(c.cur.name)}</span>
          <span class="champ-name">${esc(ch.name)}</span><span class="champ-sub">${ch.pre ? `${esc(ch.pre)} · ` : ""}víťaz finále</span></div>
        <div class="champ-final"><div class="box-head"><span>Finále</span><span>${esc(dayLabel(f))}</span></div>${rows}</div>
      </div><div class="teeth" aria-hidden="true"></div></section>`;
  }

  function placesSec(c) {
    if (!c.v.places.length) return "";
    const f = byStage(c, "F");
    const sc = f ? L.score(c.v.gm[f.id]) : { h: 0, a: 0 };
    const NOTE = { 1: `Víťaz finále · ${sc.h}:${sc.a}`, 2: "Finalista", 3: "Vyhral zápas o 3. miesto", 4: "4. miesto" };
    const cards = c.v.places.map((p) => {
      const t = c.T[p.id] || NOTEAM;
      return `<article class="place${p.pos === 1 ? " first" : ""}"><div class="shard grad-160" aria-hidden="true" style="${vars(t)}"></div>
        <img class="logo" src="${esc(p.pos === 1 ? t.gif : t.svg)}" alt=""><span class="outline-num" style="font-size:70px">${p.pos}.</span>
        <span class="place-txt"><b>${esc(t.name)}</b><small>${NOTE[p.pos]}</small></span></article>`;
    });
    return `<section id="poradie" class="sec" style="padding-top:48px">${secHead("Konečné poradie")}<div class="places">${cards.join("")}</div></section>`;
  }

  function playoffPast(c, open) {
    const cards = ["SF1", "SF2", "B3", "F"].map((st) => byStage(c, st)).filter((m) => m && m.fixed).map((m) => {
      const isOpen = open === m.id;
      const done = L.isPlayed(m);
      const w = done ? L.winner(m, c.v.gm[m.id]) : null;
      const sc = L.score(c.v.gm[m.id]);
      const side = (id, n) => {
        const t = c.T[id] || NOTEAM;
        return `<span class="po-side${w && w !== id ? " lost" : ""}" style="${vars(t)}"><i aria-hidden="true"></i><img src="${esc(w === id ? t.gif : t.svg)}" alt="">
          <span class="nm">${esc(t.name)}</span><span class="sc">${done ? n : ""}</span></span>`;
      };
      return `<div class="po${m.stage === "F" ? " f" : ""}${isOpen ? " open" : ""}">
        <button type="button" class="po-btn" data-act="open" data-id="${esc(m.id)}" aria-expanded="${isOpen}">
          <span class="po-head"><b>${STAGE[m.stage]}</b><span>${esc(dayLabel(m))}</span></span>${side(m.home_id, sc.h)}${side(m.away_id, sc.a)}
          <span class="po-foot">${isOpen ? "Skryť góly" : "Kto dal góly"}${chev()}</span></button>${isOpen ? goalsList(m, c) : ""}</div>`;
    });
    if (!cards.length) return "";
    return `<section id="playoff" class="sec" style="padding-top:64px">${secHead("Playoff")}<div class="po-grid">${cards.join("")}</div></section>`;
  }

  function archiveRow(m, c, open) {
    const x = sides(m, c);
    const isOpen = open === m.id;
    const team = (t, win, home) => {
      const lost = x.done && !win && !x.draw;
      const img = `<img src="${esc(t.svg)}" alt="">`;
      const name = `<span>${esc(t.name)}</span>`;
      return `<span class="row-team${home ? " h" : ""}"${lost ? ' style="opacity:0.4"' : ""}>${home ? name + img : img + name}</span>`;
    };
    const mid = x.done ? `${x.hs}:${x.as}` : "vs";
    const aria = `${x.H.name} ${mid} ${x.A.name} — ${isOpen ? "skryť góly" : "ukázať góly"}`;
    return `<div class="arow${isOpen ? " open" : ""}"><button type="button" class="arow-btn" data-act="open" data-id="${esc(m.id)}" aria-expanded="${isOpen}" aria-label="${esc(aria)}">
      <span class="rail" aria-hidden="true" style="--hc:${x.H.c};--ac:${x.A.c}"></span>
      <span class="arow-in">${team(x.H, x.hw, true)}<span class="row-mid done">${mid}</span>${team(x.A, x.aw, false)}<span class="tg">${chev()}</span></span>
    </button>${isOpen ? goalsList(m, c) : ""}</div>`;
  }

  function allResults(c, open) {
    if (!c.v.rounds.length) return "";
    const rows = c.v.rounds.map((r) => `<div class="round past">
      <div class="round-date"><span class="d" style="color:#9A9A9A">${r.date ? L.dShort(r.date) : "?"}</span><span class="w" style="color:#6A6A6A">${r.date && r.exact ? L.dayName(r.date) : ""}</span>${rail("#3A3A3A")}</div>
      <div class="round-body" style="padding-bottom:24px"><div class="round-title"><b>Kolo ${r.round}</b></div>${r.matches.map((m) => archiveRow(m, c, open)).join("")}</div></div>`);
    return `<section id="vysledky" class="sec" style="padding-top:64px">${secHead("Všetky výsledky", "Klikni na zápas a uvidíš, kto dal góly")}<div class="rounds">${rows.join("")}</div></section>`;
  }

  function topPlayers(c) {
    if (!c.v.top.length) return "";
    return `<section id="hraci" class="sec" style="padding-top:48px">${secHead("Najlepší hráči", "Kanadské bodovanie celej sezóny vrátane playoff")}
      <div class="ptbl nz"><div class="ptbl-row ptbl-head"><span>#</span><span>Hráč</span><span>G</span><span>A</span><span>B</span></div>${playerRows(c.v.top, c, false)}</div></section>`;
  }

  function pastBody(c, open) {
    const back = c.live ? '<button type="button" class="btn-white" data-act="home">Prebiehajúca sezóna</button>' : "";
    const bar = `<div class="archive-bar"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v13H3zM8 7V4h8v3M3 12h18"></path></svg>
      <span>Archív — toto je skončená sezóna. Výsledky sa už nemenia.</span>${back}</div>`;
    const lastRound = c.v.rounds.length ? c.v.rounds[c.v.rounds.length - 1].round : 0;
    return champion(c) + `<main class="wrap main">${bar}${placesSec(c)}${table(c, "Základná časť", lastRound ? `Tabuľka po ${lastRound}. kole` : "")}${playoffPast(c, open)}${allResults(c, open)}${topPlayers(c)}</main>`;
  }

  /* ---------- Pripravovaná sezóna ---------- */
  function futureBody(c) {
    const steps = ["Prihlasovanie", "Draft tímov", "Prvý zápas"].map((s, i) =>
      `<div class="step"><span class="outline-num" style="font-size:52px">${i + 1}</span><span><b>${s}</b><small>čoskoro</small></span></div>`).join("");
    return `<section class="hero" aria-label="Pripravovaná sezóna">
      <div class="fill" aria-hidden="true" style="background:linear-gradient(150deg, #2A2A2A 0%, #0E0E0E 70%);clip-path:polygon(0 0, 46% 0, 34% 48%, 40% 52%, 26% 100%, 0 100%)"></div>
      <div class="fill" aria-hidden="true" style="background:linear-gradient(210deg, #2A2A2A 0%, #0E0E0E 70%);clip-path:polygon(70% 0, 100% 0, 100% 100%, 82% 100%, 90% 54%, 84% 50%)"></div>
      <div class="fill" aria-hidden="true" style="background:repeating-linear-gradient(-62deg, rgba(255,255,255,0.03) 0 2px, rgba(0,0,0,0) 2px 16px)"></div>
      <div class="future-in"><span class="future-logo"><img src="assets/anim/ful.webp" alt="FULka"></span>
        <span class="future-chip">Pripravujeme</span><h1>${esc(c.cur.name)}</h1>
        <p>Sezóna ešte nezačala. Keď bude draft a rozpis, nájdeš tu výsledky, tabuľku aj playoff.</p>
        <div class="steps">${steps}</div>
        ${c.live ? '<button type="button" class="btn-white big" data-act="home">Pozrieť prebiehajúcu sezónu</button>' : ""}
      </div><div class="teeth" aria-hidden="true"></div></section>`;
  }

  /* ---------- Päta ---------- */
  function footer(c) {
    return `<footer class="foot"><div class="wrap foot-in">
      <a href="#top" data-act="home" aria-label="Späť hore" style="line-height:0"><img src="assets/logos/ful-mark-white.png" alt=""></a>
      <span class="t">FULka · Florbalová Upece Liga · ${esc(c.cur.name)}</span>
      <a class="admin" href="?edit"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="1"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>Admin</a>
    </div></footer>`;
  }

  /* ---------- Vykreslenie ---------- */
  function context() {
    const d = state.data;
    const T = teamsOf(d);
    const P = playersOf(d);
    const seasons = d.seasons;
    const live = seasons.find((s) => s.state === "live") || null;
    const cur = seasons.find((s) => s.id === state.season) || live || seasons[0];
    return { d, T, P, seasons, live, cur, v: seasonView(d, cur, P) };
  }

  function render() {
    if (!state.data) return;
    if (!state.data.seasons.length) { app.innerHTML = '<p class="msg">Zatiaľ tu nie je žiadna sezóna.</p>'; return; }
    const c = context();
    viewOptions(c.v.settings);
    const open = openId(c);
    const body = c.cur.state === "live" ? liveBody(c, open) : c.cur.state === "done" ? pastBody(c, open) : futureBody(c);
    const focus = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-act]");
    const key = focus ? `[data-act="${focus.dataset.act}"]${focus.dataset.id ? `[data-id="${CSS.escape(focus.dataset.id)}"]` : ""}` : null;
    app.innerHTML = header(c) + (state.menu ? seasonMenu(c) : "") + body + footer(c);
    document.title = `FULka – ${c.cur.name}`;
    if (key) { const el = app.querySelector(key); if (el) el.focus({ preventScroll: true }); }
  }

  function pickSeason(id) {
    state.season = id;
    state.menu = false;
    state.open = undefined;
    render();
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || !app.contains(el)) return;
    const act = el.dataset.act;
    if (act === "menu") { state.menu = !state.menu; render(); }
    else if (act === "season") pickSeason(el.dataset.id);
    else if (act === "home") { e.preventDefault(); pickSeason(null); }
    else if (act === "open") {
      const c = context();
      state.open = openId(c) === el.dataset.id ? null : el.dataset.id;
      render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.menu) { state.menu = false; render(); }
  });

  /* ---------- Štart ---------- */
  // s ?edit v adrese stránku prevezme admin (admin.js), verejný web sa nevykresľuje
  const EDIT = new URLSearchParams(location.search).has("edit");
  function setData(d) {
    state.data = d;
    if (!EDIT) render();
    else if (window.Admin) window.Admin.setData(d);
  }
  const DB = window.DB;
  if (DB.cached) {
    setData(DB.cached);
    DB.fresh.then((d) => { if (JSON.stringify(d) !== JSON.stringify(state.data)) setData(d); }, () => {});
  } else {
    DB.fresh.then(setData, () => { app.innerHTML = '<p class="msg">FULku sa nepodarilo načítať. Skontroluj internet a obnov stránku.</p>'; });
  }

  // admin (editor) sa načíta iba s ?edit v adrese
  if (EDIT) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "admin.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "admin.js";
    document.body.appendChild(s);
  }

  window.App = { state, render, setData, context };
})();
