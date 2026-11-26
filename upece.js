/* Sekcia „Z UPeCe“: program týždňa a novinky naživo z webu upcba.sk (WordPress REST API, povoľuje čítanie z cudzej domény).
   Program = týždenné „UPeCe oznamy“ (kategória Oznamy): tabuľka deň / liturgický kalendár / sv. omša / akcie + oznamy pod ňou.
   Výnimočné akcie (nie každotýždenné) = tie, ktoré majú v tom týždni vlastný oznam s dátumom → na webe zvýraznené.
   Čítanie HTML je iba cez regulárne výrazy nad pevnou šablónou, takže sa dá testovať v Node (tests/upece.test.js). */
(() => {
  "use strict";
  const SITE = "https://www.upcba.sk";
  const API = `${SITE}/wp-json/wp/v2/posts`;
  const CAT_NEWS = 165; // Aktuality
  const CAT_WEEK = 174; // Oznamy (týždenný program)
  const CACHE = "fulka-upece-v1";
  const DAYS_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—" };

  /* ---------- Text z HTML ---------- */
  const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return ENT[e.toLowerCase()] ?? m;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
  const text = (html) => decode(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  const lines = (html) => String(html || "").split(/<br\s*\/?>/i).map(text).filter((t) => t && t !== "–" && t !== "-");
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  // skrátenie na celé slová
  const clip = (s, max) => (s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, "")}…`);
  // odkazy iba na upcba.sk (texty a adresy prichádzajú z cudzieho webu)
  const safeLink = (u) => (typeof u === "string" && u.startsWith(`${SITE}/`) ? u : `${SITE}/`);

  /* ---------- Dátumy ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const dow = (date) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const dayShort = (date) => DAYS_SHORT[dow(date)];
  const dayNum = (date) => Number(date.slice(8));
  // „UPeCe oznamy 2.11.2026 – 9.11.2026“ → rok a mesiac začiatku týždňa
  function weekStart(title) {
    const m = text(title).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    return m ? { m: Number(m[2]), y: Number(m[3]) } : null;
  }
  // „2. 11.“ → dátum; cez Nový rok (týždeň začal v decembri, deň je v januári) rok + 1
  function dateOf(dm, start) {
    const m = String(dm).match(/(\d{1,2})\.\s*(\d{1,2})\./);
    if (!m || !start) return null;
    const mon = Number(m[2]);
    return iso(start.y + (start.m === 12 && mon === 1 ? 1 : 0), mon, Number(m[1]));
  }
  const minutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  /* ---------- Oznamy pod tabuľkou ---------- */
  // „Večer UPeCe 4. 11.“ → { name, date }; rozsah „6. – 8. 11.“ alebo „30. 11. – 2. 12.“ → prvý deň;
  // „… do 4. 11.“ je termín (uzávierka), nie akcia → bez dátumu
  const HEAD = /^(.*?)\s+(do\s+)?(?:(\d{1,2})\.\s*(\d{1,2})\.(?:\s*[–-]\s*\d{1,2}\.\s*\d{1,2}\.)?|(\d{1,2})\.\s*[–-]\s*\d{1,2}\.\s*(\d{1,2})\.)\s*$/;
  function noticeHead(title, start) {
    const t = text(title);
    const m = t.match(HEAD);
    if (!m) return { name: t, date: null };
    return { name: m[1].trim(), date: m[2] ? null : dateOf(`${m[3] || m[5]}. ${m[4] || m[6]}.`, start) };
  }
  // čas akcie z textu oznamu: „o 20:00“ alebo „po svätej omši“
  function noticeTime(body) {
    const t = text(body);
    const m = t.match(/\bo\s+(\d{1,2}:\d{2})/);
    if (m) return m[1];
    return /po\s+(sv\.|svätej)\s+omši/i.test(t) ? "po sv. omši" : "";
  }
  function notices(html, start) {
    return String(html || "").split(/class="notice-title"/).slice(1).map((chunk) => {
      const end = chunk.indexOf("</div>");
      const head = noticeHead(chunk.slice(chunk.indexOf(">") + 1, end), start);
      const body = (chunk.slice(end).match(/<p class="notice-text"[^>]*>[\s\S]*?<\/p>/g) || []).join(" ");
      return Object.assign(head, { time: noticeTime(body) });
    });
  }

  /* ---------- Tabuľka programu ---------- */
  function cellsOf(row) {
    const c = {};
    for (const m of row.matchAll(/<td class="(\w+)"[^>]*>([\s\S]*?)<\/td>/g)) c[m[1]] = m[2];
    return c;
  }
  // „20:00 / kaplnka“ alebo „8:00 (kaplnka) / 10:00 (Veľká Sála)“ → jeden riadok „Sv. omša/omše“
  function massRow(cell, liturgy) {
    const all = lines(cell).join(" ");
    const times = all.match(/\d{1,2}:\d{2}/g) || [];
    if (!times.length) return null;
    const places = [...new Set(all.replace(/\d{1,2}:\d{2}/g, " ").split(/[()]/).map((p) => p.trim().toLowerCase()).filter(Boolean))];
    const where = places.map(cap).join(" a ");
    return { time: times.join(" · "), sort: minutes(times[0]), place: where, title: times.length > 1 ? "Sv. omše" : "Sv. omša", sub: text(liturgy), kind: "mass" };
  }
  // „Športy a tance 21:15“ → { title: „Športy a tance“, time: „21:15“ }; „adorácia po sv. omši“ ide hneď za omšu
  function eventRows(cell, massSort) {
    return lines(cell).map((t) => {
      const tm = t.match(/\d{1,2}:\d{2}/);
      const title = cap(t.replace(/\s*\d{1,2}:\d{2}\s*/, " ").trim());
      const after = /po\s+(sv\.|svätej)\s+omši/i.test(t);
      const closed = /zatvoren/i.test(t);
      const sort = tm ? minutes(tm[0]) : after && massSort != null ? massSort + 1 : closed ? -1 : 24 * 60;
      return { time: tm ? tm[0] : "", sort, place: "", title, sub: "", kind: closed ? "closed" : "event" };
    });
  }
  // rovnaká akcia: jeden názov obsahuje druhý, alebo je skratkou druhého („OĽV“ = „Ondrejská ľudová veselica“)
  const initials = (s) => s.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join("").toLowerCase();
  const same = (a, b) => {
    const x = a.toLowerCase(); const y = b.toLowerCase();
    const short = (s) => s.replace(/[^\p{L}]/gu, "");
    return x.includes(y) || y.includes(x) || (short(x).length >= 2 && (short(x) === initials(b) || short(y) === initials(a)));
  };

  // jeden príspevok „UPeCe oznamy“ → dni s riadkami programu
  function parseWeek(post) {
    const html = (post && post.content && post.content.rendered) || "";
    const start = weekStart(post && post.title ? post.title.rendered : "");
    const body = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1];
    if (!start || !body) return [];
    const special = notices(html, start).filter((n) => n.date);
    return body.split(/<\/tr>/).map(cellsOf).filter((c) => c.day).map((c) => {
      const date = dateOf(text(c.day), start);
      if (!date) return null;
      const mass = massRow(c.mass, c.liturgy);
      const rows = (mass ? [mass] : []).concat(eventRows(c.events, mass ? mass.sort : null));
      const todays = special.filter((n) => n.date === date);
      rows.forEach((r) => { if (r.kind === "event" && todays.some((n) => same(n.name, r.title))) r.kind = "special"; });
      // výnimočná akcia, ktorá je iba v oznamoch (nie v tabuľke), ak má čas
      todays.filter((n) => n.time && !rows.some((r) => same(n.name, r.title))).forEach((n) => {
        rows.push({ time: n.time, sort: n.time.includes(":") ? minutes(n.time) : mass ? mass.sort + 1 : 24 * 60, place: "", title: n.name, sub: "", kind: "special" });
      });
      if (!mass && c.liturgy && rows.length) rows[0].sub = rows[0].sub || text(c.liturgy);
      rows.sort((a, b) => a.sort - b.sort);
      return { date, rows };
    }).filter(Boolean);
  }

  // dátum o n dní neskôr (ISO)
  const addDays = (date, n) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

  /* ---------- Kalendár upcba.sk (data/upece-kalendar.json z GitHub Action, tools/kalendar.js) ---------- */
  // udalosti majú pravidlo opakovania (r: f = WEEKLY/DAILY/MONTHLY/YEARLY, i = každý i-ty, d = dni MO…SU, u = do dňa, n = počet), x = vynechané dni
  const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const dayIndex = (date) => { const [y, m, d] = date.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
  const monday = (date) => dayIndex(date) - ((dow(date) + 6) % 7);
  // dni výskytu udalosti v [from, to): podľa pravidla, plus dni navyše (a = RDATE), bez vynechaných dní (x = EXDATE a presunuté výskyty)
  function occurrences(e, from, to) {
    const skip = new Set(e.x || []);
    const days = ruleDays(e, from, to).concat((e.a || []).filter((d) => d >= from && d < to));
    return [...new Set(days)].filter((d) => !skip.has(d)).sort();
  }
  // dni podľa pravidla opakovania; jednorazová = deň začiatku (viacdňová, ktorá už beží = dnes)
  function ruleDays(e, from, to) {
    const start = e.s.slice(0, 10);
    const r = e.r;
    if (!r) {
      const end = (e.e || e.s).slice(0, 10);
      if (start >= from && start < to) return [start];
      return start < from && end > from && e.e ? [from] : [];
    }
    const days = r.d && r.d.length ? r.d : [WD[dow(start)]];
    const out = [];
    let n = 0;
    for (let d = start; d < to && (!r.u || d <= r.u); d = addDays(d, 1)) {
      const k = dayIndex(d) - dayIndex(start);
      let hit = false;
      if (r.f === "DAILY") hit = k % r.i === 0;
      else if (r.f === "WEEKLY") hit = days.includes(WD[dow(d)]) && ((monday(d) - monday(start)) / 7) % r.i === 0;
      else if (r.f === "MONTHLY") hit = d.slice(8) === start.slice(8) && ((+d.slice(0, 4) - +start.slice(0, 4)) * 12 + +d.slice(5, 7) - +start.slice(5, 7)) % r.i === 0;
      else if (r.f === "YEARLY") hit = d.slice(5) === start.slice(5) && (+d.slice(0, 4) - +start.slice(0, 4)) % r.i === 0;
      else hit = d === start;
      if (!hit) continue;
      n++;
      if (r.n && n > r.n) break;
      if (d >= from) out.push(d);
    }
    return out;
  }
  const isMass = (e) => /^sv\.?\s*omš/i.test(e.t) || e.c === "Sv. omše";
  const shortTime = (s) => (s.length > 10 ? s.slice(11).replace(/^0(\d)/, "$1") : ""); // „2026-11-27T08:00“ → „8:00“
  const dm = (date) => `${dayNum(date)}. ${Number(date.slice(5, 7))}.`;
  // kalendár → { dátum: [riadky programu] } na dni [from, to); omše v jeden deň = jeden riadok, jednorazové akcie = výnimočné (zvýraznené)
  function calendarDays(cal, from, to) {
    const events = (cal && cal.udalosti) || [];
    const repeats = (e) => e.r || (e.a && e.a.length);
    const repeating = new Set(events.filter(repeats).map((e) => e.t.toLowerCase()));
    const days = {};
    events.forEach((e) => occurrences(e, from, to).forEach((date) => {
      const rows = days[date] || (days[date] = []);
      const time = shortTime(e.s);
      if (isMass(e)) {
        const m = rows.find((r) => r.kind === "mass");
        if (m) {
          m.times.push(time);
          if (e.p && !m.places.includes(e.p)) m.places.push(e.p);
        } else rows.push({ kind: "mass", times: [time], places: e.p ? [e.p] : [] });
        return;
      }
      const end = e.e ? e.e.slice(0, 10) : "";
      const multi = end && !repeats(e) && (e.s.length > 10 ? end > e.s.slice(0, 10) : addDays(end, -1) > e.s.slice(0, 10));
      const last = e.s.length > 10 ? end : addDays(end, -1);
      rows.push({ time, sort: time ? minutes(time) : -2, place: e.p || "", title: e.t, sub: multi ? `${dm(e.s.slice(0, 10))} – ${dm(last)}` : "",
        kind: !repeats(e) && !repeating.has(e.t.toLowerCase()) ? "special" : "event" });
    }));
    Object.values(days).forEach((rows) => rows.forEach((r, i) => {
      if (r.kind !== "mass") return;
      const times = r.times.filter(Boolean).sort((a, b) => minutes(a) - minutes(b));
      rows[i] = { time: times.join(" · "), sort: times.length ? minutes(times[0]) : 0, place: r.places.join(" a "), title: times.length > 1 ? "Sv. omše" : "Sv. omša", sub: "", kind: "mass" };
    }));
    Object.values(days).forEach((rows) => rows.sort((a, b) => a.sort - b.sort));
    return days;
  }

  // program na najbližšie 2 týždne (DAYS dní od dnes): novší príspevok prepíše rovnaký deň zo staršieho;
  // najviac max riadkov, ale výnimočné akcie sa neodrežú nikdy (namiesto nich vypadnú bežné riadky na konci).
  // Deň z týždenného oznamu má prednosť (liturgický kalendár, miesta); z kalendára upcba.sk sa k nemu doplnia iba jednorazové akcie.
  // Dni, na ktoré oznam ešte nevyšiel, sa vezmú celé z kalendára (cal = data/upece-kalendar.json).
  const DAYS = 14;
  function program(posts, today, max = 10, cal) {
    const days = {};
    (posts || []).slice().reverse().forEach((p) => parseWeek(p).forEach((d) => { days[d.date] = d; }));
    const end = addDays(today, DAYS);
    const fromCal = cal ? calendarDays(cal, today, end) : {};
    const all = [];
    [...new Set(Object.keys(days).concat(Object.keys(fromCal)))].sort().filter((d) => d >= today && d < end).forEach((date) => {
      let rows = fromCal[date] || [];
      if (days[date]) {
        rows = days[date].rows.map((r) => Object.assign({}, r));
        (fromCal[date] || []).filter((c) => c.kind === "special").forEach((c) => {
          const hit = rows.find((r) => r.kind !== "mass" && same(r.title, c.title));
          if (!hit) { rows.push(c); return; }
          // tá istá akcia: zvýrazniť a doplniť z kalendára, čo v oznamu chýba (čas, miesto, celý názov namiesto skratky)
          Object.assign(hit, { kind: "special", title: c.title.length > hit.title.length ? c.title : hit.title });
          if (!hit.time && c.time) Object.assign(hit, { time: c.time, sort: c.sort });
          if (!hit.place && c.place) hit.place = c.place;
        });
        rows.sort((a, b) => a.sort - b.sort);
      }
      rows.forEach((r) => all.push(Object.assign({ date, dn: dayShort(date), dd: dayNum(date) }, r)));
    });
    const room = Math.max(0, max - all.filter((r) => r.kind === "special").length);
    let normal = 0;
    return all.filter((r) => r.kind === "special" || normal++ < room);
  }

  // novinky: dátum, nadpis, začiatok textu (na celé slová) a odkaz
  function news(posts, n = 2) {
    return (posts || []).slice(0, n).map((p) => {
      const sub = text(p.excerpt && p.excerpt.rendered).replace(/\s*(\[…\]|…)$/, "");
      const [y, m, d] = String(p.date || "").slice(0, 10).split("-").map(Number);
      return { date: y ? `${d}. ${m}. ${y}` : "", title: text(p.title && p.title.rendered), sub: clip(sub, 80), link: safeLink(p.link) };
    });
  }

  /* ---------- Načítanie (prehliadač) ---------- */
  const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE)) || null; } catch (e) { return null; }
  }
  function writeCache(v) {
    try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch (e) { /* bez úložiska ide web ďalej */ }
  }
  // stiahne posledné 2 týždenné oznamy (tento aj budúci týždeň), novinky a kalendár (JSON z nášho webu, obnovuje ho GitHub Action);
  // surové dáta uloží do cache. Kalendár je nepovinný – keď chýba, program je iba z oznamov.
  const CAL_URL = "data/upece-kalendar.json";
  // cache je čerstvá, kým nemá viac ako maxAge ms → web znova nesťahuje (žiadny spam na upcba.sk pri obnovovaní stránky)
  const MAX_AGE = 15 * 60e3;
  function fresh(cache, now, maxAge = MAX_AGE) {
    const age = cache && cache.at ? now - cache.at : -1;
    return age >= 0 && age < maxAge;
  }
  function load() {
    const week = getJson(`${API}?categories=${CAT_WEEK}&per_page=2&_fields=date,title,content`);
    const fresh = getJson(`${API}?categories=${CAT_NEWS}&categories_exclude=${CAT_WEEK}&per_page=3&_fields=date,link,title,excerpt`);
    const cal = getJson(`${CAL_URL}?h=${Math.floor(Date.now() / 36e5)}`).catch(() => null); // ?h = nová adresa každú hodinu (cache)
    return Promise.all([week, fresh, cal]).then(([w, n, c]) => {
      const v = { at: Date.now(), week: w, news: n, cal: c };
      writeCache(v);
      return v;
    });
  }

  const Upece = {
    SITE, CALENDAR: `${SITE}/kalendar/`, OFFER: `${SITE}/o-upece/`,
    decode, text, lines, safeLink, weekStart, dateOf, noticeHead, noticeTime, notices, massRow, eventRows, parseWeek, occurrences, calendarDays, program, news,
    readCache, fresh, load,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Upece;
  else window.Upece = Upece;
})();
