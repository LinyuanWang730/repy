/**
 * 给「第 0 步 / 拖入导入 / 在 Repy 继续」这三个新界面拍几张图看看。
 * 用法：npx electron scripts/shot-neo.js
 * 产物在 build/neo-*.png
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "build");
const PROFILE = path.join(OUT, ".neo-profile");
const ROOT = path.join(__dirname, "..");

fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath("userData", PROFILE);

ipcMain.handle("app:info", () => ({
  ok: true,
  version: "2.1.1",
  isPackaged: false,
  dataDir: PROFILE,
  snapshotPath: path.join(PROFILE, "agent-snapshot.json"),
  apiOrigin: "http://127.0.0.1:47821",
  exePath: "C:\\check\\Repy.exe"
}));
ipcMain.handle("app:copy", () => true);
ipcMain.handle("app:openDataDir", () => ({ ok: true }));
ipcMain.handle("app:checkUpdate", () => ({ ok: true, status: "latest", current: "2.1.1", message: "已经是最新版。" }));
ipcMain.handle("app:pickInstaller", () => ({ ok: false, canceled: true }));
ipcMain.handle("app:saveLog", () => ({ ok: true, path: "" }));
ipcMain.handle("app:shareSetup", () => ({ ok: true, path: "", rebuilt: true }));
ipcMain.handle("app:uninstallInfo", () => ({ found: true, file: "", dataDir: PROFILE }));
ipcMain.handle("app:uninstall", () => ({ ok: true, file: "" }));
ipcMain.on("data:snapshot", () => {});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/* 直接用小程序端的导出函数造样例，顺便验证两端 JSON 格式真的对得上 */
const { buildPayload } = require("../repyneo/utils/handoff");
const { BASE_ACTIONS } = require("../repyneo/utils/pool");

const STRENGTH = [
  { actionId: "bench", isKey: true, note: "", loads: [{ weight: "60", eachSide: false, sets: 4, setsExplicit: true, repMode: "same", sameRep: "5", reps: ["5", "5", "5", "5"], target: "12" }] },
  { actionId: "triceps-pushdown", isKey: false, note: "", loads: [{ weight: "25", eachSide: false, sets: 3, setsExplicit: true, repMode: "same", sameRep: "12", reps: ["12", "12", "12"], target: "12" }] }
];
const CARDIO = [
  { actionId: "running", isKey: false, note: "", loads: [{ spec: "5 km", pace: "10", paceUnit: "km/h", extra: "" }] }
];
const SAMPLE = buildPayload({
  selected: STRENGTH.concat(CARDIO),
  effort: 7,
  date: "2026-11-25",
  pool: BASE_ACTIONS,
  version: "1.0.0"
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 940,
    show: false,
    backgroundColor: "#f2f8fc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(ROOT, "preload.js")
    }
  });
  await win.loadFile(path.join(ROOT, "src", "index.html"));
  await wait(1500);
  // 更新日志弹窗会挡住画面，先关掉
  await win.webContents.executeJavaScript(`
    (() => {
      const close = document.getElementById('releaseClose');
      if (close) close.click();
      const pop = document.getElementById('featureClose');
      if (pop) pop.click();
    })()
  `);
  await wait(400);

  const shot = async name => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `neo-${name}.png`), img.toPNG());
    console.log("shot", name);
  };

  // 1) 第 0 步面板（强行显示，模拟设置里打开）
  await win.webContents.executeJavaScript(`
    (() => {
      const panel = document.getElementById('neoPanel');
      panel.hidden = false;
      const box = document.getElementById('neoInput');
      box.value = ${JSON.stringify(JSON.stringify(SAMPLE, null, 2).slice(0, 260))};
      box.dispatchEvent(new Event('input', {bubbles:true}));
      document.getElementById('generatorPage').scrollTop = 0;
      window.scrollTo(0,0);
    })()
  `);
  await wait(400);
  await shot("01-step0");

  // 2) 点导入 → 预览弹窗
  await win.webContents.executeJavaScript(`
    (() => {
      const box = document.getElementById('neoInput');
      box.value = ${JSON.stringify(JSON.stringify(SAMPLE))};
      document.getElementById('neoImport').click();
    })()
  `);
  await wait(600);
  await shot("02-handoff");

  // 真实导出的 JSON 必须被桌面端完整读懂
  const result = await win.webContents.executeJavaScript(`
    JSON.stringify({
      open: !document.getElementById('handoffModal').hidden,
      kicker: document.getElementById('handoffKicker').textContent,
      preview: document.getElementById('handoffPreview').innerText,
      step2: !document.getElementById('handoffToStep2').hidden,
      review: !document.getElementById('handoffToReview').hidden
    })
  `);
  const parsed = JSON.parse(result);
  console.log("HANDOFF_KICKER:", parsed.kicker);
  console.log("HANDOFF_PREVIEW:", parsed.preview.replace(/\n/g, " | ").slice(0, 260));
  console.log("HANDOFF_BUTTONS:", JSON.stringify({ step2: parsed.step2, review: parsed.review }));
  if (!parsed.open) throw new Error("导入预览弹窗没打开");
  if (!parsed.step2 || !parsed.review) throw new Error("两个使用方式按钮有缺失");
  if (!/1 天 · 1 条记录 · 3 个动作/.test(parsed.preview)) throw new Error("记录数不对（可能把 draft 也算进去了）");
  if (!/杠铃卧推/.test(parsed.preview) || !/跑步/.test(parsed.preview)) throw new Error("动作名没解析出来");
  if (parsed.kicker.indexOf("RepyNeo") < 0) throw new Error("弹窗来源标记不对：" + parsed.kicker);
  console.log("HANDOFF_OK: 小程序真实导出 → 桌面端预览通过");

  // 3) 选「第二步继续」看编排填回来的样子
  await win.webContents.executeJavaScript(`document.getElementById('handoffToStep2').click();`);
  await wait(900);
  await win.webContents.executeJavaScript(`document.getElementById('shell').scrollTop = 760;`);
  await wait(300);
  await shot("03-step2-filled");

  // 4) 设置页新增的那一行
  await win.webContents.executeJavaScript(`
    (() => {
      document.querySelector('.side-gear').click();
    })()
  `);
  await wait(500);
  await win.webContents.executeJavaScript(`
    (() => {
      const row = [...document.querySelectorAll('.set-row')].find(r => r.textContent.includes('第 0 步'));
      if (row) row.scrollIntoView({block:'center'});
    })()
  `);
  await wait(400);
  await shot("04-settings-row");

  // 5) 拖拽遮罩
  await win.webContents.executeJavaScript(`
    (() => {
      document.getElementById('dropVeil').hidden = false;
    })()
  `);
  await wait(300);
  await shot("05-drop-veil");

  app.quit();
}).catch(err => {
  console.error(err);
  app.exit(1);
});
