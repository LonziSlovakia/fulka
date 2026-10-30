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
  const same = (a, b) => { const x = a.toLowerCase(); const y = b.toLowerCase(); return x.includes(y) || y.includes(x); };

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

  // program na 7 dní od dnes: novší príspevok prepíše rovnaký deň zo staršieho;
  // najviac max riadkov, ale výnimočné akcie sa neodrežú nikdy (namiesto nich vypadnú bežné riadky na konci)
  function program(posts, today, max = 7) {
    const days = {};
    (posts || []).slice().reverse().forEach((p) => parseWeek(p).forEach((d) => { days[d.date] = d; }));
    const all = [];
    Object.keys(days).sort().filter((d) => d >= today && d < addDays(today, 7)).forEach((date) => {
      days[date].rows.forEach((r) => all.push(Object.assign({ date, dn: dayShort(date), dd: dayNum(date) }, r)));
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
  // stiahne posledné 2 týždenné oznamy (tento aj budúci týždeň) a novinky; surové príspevky uloží do cache
  function load() {
    const week = getJson(`${API}?categories=${CAT_WEEK}&per_page=2&_fields=date,title,content`);
    const fresh = getJson(`${API}?categories=${CAT_NEWS}&categories_exclude=${CAT_WEEK}&per_page=3&_fields=date,link,title,excerpt`);
    return Promise.all([week, fresh]).then(([w, n]) => {
      const v = { at: Date.now(), week: w, news: n };
      writeCache(v);
      return v;
    });
  }

  const Upece = {
    SITE, CALENDAR: `${SITE}/kalendar/`, OFFER: `${SITE}/o-upece/`,
    decode, text, lines, safeLink, weekStart, dateOf, noticeHead, noticeTime, notices, massRow, eventRows, parseWeek, program, news,
    readCache, load,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Upece;
  else window.Upece = Upece;
})();
