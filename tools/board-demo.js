// Ukážkový stav tabule do localStorage (na screenshoty): potom krok RELOAD. Argumenty cez globálne premenné window.__demo (voliteľné).
(() => {
  const T = (id, name, c, d, ink) => ({ id, name, abbr: name.slice(0, 3).toUpperCase(), c, d, ink, logo: `assets/logos/${id}.svg` });
  const s = Board.create({ matchId: "z26-07", seasonId: "z26", title: "Kolo 7 · Zimná sezóna 2026",
    home: T("giants", "Giants", "#C9A15B", "#6B4F1F", "#050505"), away: T("brewers", "Brewers", "#8B5E34", "#3A2412", "#FFFFFF") }, { parts: 3, minutes: 15 }, { twoScreens: true });
  let n = Board.adjust(s, -(15 * 60000 - 222000), Date.now());
  n = Board.nextPart(Board.adjust(n, -222000, Date.now()), Date.now());
  n = Board.adjust(n, -(15 * 60000 - 222000), Date.now());
  ["p", "p", "p"].forEach(() => { n = Board.addGoal(n, "h", "x"); });
  n = Board.addGoal(n, "a", "y"); n = Board.addGoal(n, "a", "y");
  n = Board.addPenalty(n, "h", 83000, { id: "a", name: "Adam Novák", number: 7 }, Date.now());
  n = Board.addPenalty(n, "a", 120000, { id: "b", name: "Jakub Šrefánek", number: 12 }, Date.now());
  n = Board.addPenalty(n, "a", 45000, { id: "c", name: "Martin Kostolník" }, Date.now());
  n = Board.start(n, Date.now());
  localStorage.setItem("fulka-board-v1", JSON.stringify(Board.save(n)));
  return "demo uložený";
})()
