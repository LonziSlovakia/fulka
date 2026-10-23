/* Screenshot + chyby z konzoly cez headless Chromium (Playwright), bez knižníc.
   node tools/shot.js <url> <šírka> <výstup.png> [krok…]
   krok = JS výraz (vráti hodnotu → vypíše sa), alebo "RELOAD"; súbor s krokom: "@tools/mock-db.js"
   CLIP=x,y,w,h → iba výrez. Najprv spusti bash tools/setup.sh */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const BIN = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const LIBS = path.join(__dirname, ".cache/libroot/usr/lib/x86_64-linux-gnu");
const [url, width = "1440", out = "shot.png", ...steps] = process.argv.slice(2);
const pres = steps.map((s) => (s.startsWith("@") ? fs.readFileSync(s.slice(1), "utf8") : s));
const port = 9300 + Math.floor(Math.random() * 500);
const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "chr-"));
const chrome = spawn(BIN, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-sandbox", "--hide-scrollbars", `--window-size=${width},900`, "about:blank"],
  { stdio: "ignore", env: { ...process.env, LD_LIBRARY_PATH: LIBS } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch (e) {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = {};
  const logs = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === "Runtime.exceptionThrown") logs.push(`EXCEPTION: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) logs.push(`HTTP ${m.params.response.status}: ${m.params.response.url}`);
  });
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 600 });
  await send("Page.navigate", { url });
  await sleep(3500);
  for (const pre of pres) {
    if (pre === "RELOAD") { await send("Page.reload"); await sleep(3000); continue; }
    const r = await send("Runtime.evaluate", { expression: pre, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) console.log("krok CHYBA:", r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    else if (r.result?.result?.value !== undefined) console.log("krok:", JSON.stringify(r.result.result.value));
    await sleep(800);
  }
  const { result } = await send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight", returnByValue: true });
  await send("Emulation.setDeviceMetricsOverride", { width: +width, height: Math.min(result.result.value, 16000), deviceScaleFactor: 1, mobile: +width < 600 });
  await sleep(500);
  const clip = process.env.CLIP ? (([x, y, w, h]) => ({ x, y, width: w, height: h, scale: 1 }))(process.env.CLIP.split(",").map(Number)) : undefined;
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log(logs.length ? logs.join("\n") : "konzola: bez chýb");
  ws.close(); chrome.kill(); await sleep(400);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
