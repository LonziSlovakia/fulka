// Skúšky opráv z code review (po fake-login.js, RELOAD, mock-db.js). Scenár podľa #hash v URL:
//   #sezona   – Sezóny → Tímy → „Pridať do sezóny“ → späť do Sezón: nový tím musí byť v editore zakliknutý (nie ponuka na odobratie)
//   #novytim  – Tímy → „Všetky tímy“ → Nový tím: nesmie sa pridať do žiadnej sezóny
//   #tabula   – zápas na tabuli zo sezóny z26, počas hry prepnúť admin na l27, „Ukončiť zápas“ musí uložiť do z26
//   #zatvorit – po uložení výsledku „Zavrieť“ v hlavičke tabule zavrie bez otázky „nič sa neuloží“
// Vráti stručný výpis; zápisy idú iba do pamäte (__writes).
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const $ = (sel) => document.querySelector(sel);
  const click = async (sel, wait = 150) => { const el = $(sel); if (!el) { out.push("CHÝBA " + sel); return; } el.click(); await sleep(wait); };
  const type = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  const scen = location.hash.slice(1);

  if (scen === "sezona") {
    await click('[data-a="tab"][data-id="seasons"]');
    await click('[data-a="tab"][data-id="teams"]');
    await click('[data-a="teamScope"][data-id="all"]');
    const outside = [...document.querySelectorAll('[data-a="team-sel"]')].map((b) => b.dataset.id).find((id) => !__mem().season_teams.some((x) => x.season_id === "l27" && x.team_id === id));
    await click(`[data-a="team-sel"][data-id="${outside}"]`);
    await click('[data-a="teamToSeason"]', 600);
    await click('[data-a="tab"][data-id="seasons"]');
    out.push(`tím ${outside} v editore sezóny zakliknutý: ${$(`[data-a="steam"][data-id="${outside}"]`).getAttribute("aria-pressed")}`);
    await click('[data-a="saveSeason"]', 400);
    out.push("ponuka na odobratie tímu: " + !!$(".a-modal"));
  }

  if (scen === "novytim") {
    await click('[data-a="tab"][data-id="teams"]');
    await click('[data-a="teamScope"][data-id="all"]');
    await click('[data-a="newTeam"]');
    type('[data-in="tname"]', "Testers");
    type('[data-in="tabbr"]', "TST");
    await click('[data-a="saveTeam"]', 600);
    out.push("zápis tímu: " + __writes.some((w) => w[1] === "teams") + " | do sezóny: " + JSON.stringify(__writes.filter((w) => w[1] === "season_teams")) + " | " + ($(".a-toast") || {}).textContent);
  }

  if (scen === "tabula" || scen === "zatvorit") {
    // zápas základnej časti zo z26 urobíme naoko neodohraným (iba v pamäti)
    const mem = __mem();
    const m = mem.matches.find((x) => x.season_id === "z26" && x.stage === "R");
    m.status = "plan";
    mem.goals = mem.goals.filter((g) => g.match_id !== m.id);
    Admin.setData(JSON.parse(JSON.stringify(mem)));
    await click('[data-a="season"][data-id="z26"]');
    await click('[data-a="tab"][data-id="board"]');
    await click(`[data-b="pick"][data-id="${m.id}"]`);
    if (!$('[data-b="prepare"]')) await click('[data-b="pick"]'); // ak sa výber robí inak, vezmi prvý zápas
    await click('[data-b="prepare"]');
    await click('[data-b="goal"][data-side="h"]');
    await click('[data-b="scorer"][data-side="h"]');
    if (scen === "tabula") await click('[data-a="season"][data-id="l27"]'); // admin prepnutý na inú sezónu
    await click('[data-b="end"]');
    await click('[data-m="ok"]', 700);
    const s = Board.load();
    out.push(`uložené: ${s.saved} | chyba: ${($(".a-error") || {}).textContent || "žiadna"} | zápis zápasu: ${JSON.stringify((__writes.filter((w) => w[1] === "matches").pop() || [])[2]?.[0]?.id)} (${s.matchId})`);
    if (scen === "zatvorit") {
      const btn = $(".a-ed-head [data-b]");
      out.push("tlačidlo v hlavičke: " + btn.dataset.b + " „" + btn.textContent.trim() + "“");
      btn.click();
      await sleep(200);
      out.push("otázka „nič sa neuloží“: " + !!$(".a-modal") + " | tabuľa zavretá: " + !Board.load());
    }
  }
  return out.join(" | ");
})()
