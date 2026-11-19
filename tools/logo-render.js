/* Vyrobí z návrhov loga (design/ants/zdroj.html) statické PNG a animované WebP s priehľadným pozadím.
   node tools/logo-render.js [návrhy, napr. 1,2,3,4] [výstupný priečinok]
   Najprv bash tools/setup.sh (server :8770) a nástroje webp v tools/.cache/webproot (pozri CLAUDE.md).
   Načasovanie ako pri ostatných logách: pauza na začiatku, animácia po 45 ms, pauza na konci. */
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const BIN = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const LIBS = path.join(__dirname, ".cache/libroot/usr/lib/x86_64-linux-gnu");
const WEBP = path.join(__dirname, ".cache/webproot/usr");
const SRC = "http://127.0.0.1:8770/fulka/design/ants/zdroj.html?v=1";
const [list = "1,2,3,4", outDir = path.join(__dirname, "../design/ants")] = process.argv.slice(2);
const FRAMES = 32, HOLD0 = 900, STEP = 50, HOLD1 = 1200; // 32 × 50 ms ≈ 1,6 s animácie
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// časy snímok: [t 0..1, trvanie ms]
const timeline = () => [[0, HOLD0], ...Array.from({ length: FRAMES - 1 }, (_, i) => [(i + 1) / FRAMES, STEP]), [1, HOLD1]];

(async () => {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "chr-"));
  const chrome = spawn(BIN, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-sandbox", "--hide-scrollbars", "--window-size=512,512", "about:blank"],
    { stdio: "ignore", env: { ...process.env, LD_LIBRARY_PATH: LIBS } });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch (e) {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = {};
  ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 512, height: 512, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }); // priehľadné pozadie
  await send("Page.navigate", { url: SRC });
  await sleep(1500);
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "logo-"));
  const env = { ...process.env, LD_LIBRARY_PATH: path.join(WEBP, "lib/x86_64-linux-gnu") };
  for (const v of list.split(",")) {
    const args = ["-loop", "0", "-m", "4"];
    const last = timeline().length - 1;
    for (const [i, [t, ms]] of timeline().entries()) {
      await send("Runtime.evaluate", { expression: `draw(${v}, ${t})` });
      await sleep(30);
      const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 512, height: 512, scale: 1 } });
      const f = path.join(tmp, `v${v}-${String(i).padStart(2, "0")}.png`);
      fs.writeFileSync(f, Buffer.from(shot.result.data, "base64"));
      if (i === 0) fs.copyFileSync(f, path.join(outDir, `ants-${v}.png`)); // statické logo = prvá snímka
      // prvá a posledná snímka (dlho na obrazovke) bezstratovo, ostatné stratovo – súbor je niekoľkokrát menší
      args.push("-d", String(ms), ...(i === 0 || i === last ? ["-lossless"] : ["-lossy", "-q", "70"]), f);
    }
    const out = path.join(outDir, `ants-${v}.webp`);
    execFileSync(path.join(WEBP, "bin/img2webp"), [...args, "-o", out], { env, stdio: "ignore" });
    console.log(`návrh ${v}: ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} kB), PNG ${Math.round(fs.statSync(path.join(outDir, `ants-${v}.png`)).size / 1024)} kB`);
  }
  ws.close(); chrome.kill(); await sleep(300);
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
