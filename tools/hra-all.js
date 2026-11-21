/* Krok pre shot.js (hra /hra/): uloží do localStorage kolekciu so všetkými kartami (niektoré 2×) a dnešný otvorený balík,
   potom treba RELOAD. Iba na lokálne testovanie vzhľadu kolekcie. */
DB.fresh.then((d) => {
  const cards = Cards.sortCards(Cards.buildCards(d));
  const c = {};
  cards.forEach((x, i) => { if (i % 4 !== 3) c[x.id] = i % 5 === 0 ? 2 : 1; });
  const today = Logic.localParts(Date.now()).date;
  localStorage.setItem("fulka-hra-v1", JSON.stringify({ d: today, c, l: cards.slice(0, 5).map((x) => x.id).reverse() }));
  return `${Object.keys(c).length} / ${cards.length} kariet, ${JSON.stringify(localStorage.getItem("fulka-hra-v1")).length} B`;
});
