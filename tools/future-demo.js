// Ukážka stránky „Pripravujeme“ bez zápisu do databázy: pripravovaná sezóna dostane 2 termíny (tretí ostane „čoskoro“).
// Použitie: krok pre shot.js, alebo cez tools/future-demo.html. TIMY=n v URL (?timy=2) = koľko tímov ukázať (predvolene všetky zo sezóny).
(() => {
  const d = App.state.data;
  const s = d.seasons.find((x) => x.state === "soon");
  if (!s) return "žiadna pripravovaná sezóna";
  Object.assign(s, { signup_date: "2027-02-01", draft_date: "2027-02-22", start_date: null });
  const n = new URLSearchParams(location.search).get("timy");
  if (n !== null) {
    const keep = d.season_teams.filter((x) => x.season_id === s.id).slice(0, Number(n));
    d.season_teams = d.season_teams.filter((x) => x.season_id !== s.id).concat(keep);
  }
  App.state.season = s.id;
  App.render();
  return `ukážka: ${s.name}`;
})()
