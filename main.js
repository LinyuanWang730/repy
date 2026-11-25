const { app, BrowserWindow, Menu, shell, ipcMain, dialog, clipboard, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const isMac = process.platform === "darwin";
const INDEX = path.join(__dirname, "src", "index.html");
const PRELOAD = path.join(__dirname, "preload.js");
const SNAPSHOT_FILE = "agent-snapshot.json";
const API_PORT_START = 47821;

// 应用名统一叫 Repy：快捷方式、任务栏、卸载列表、关于面板都读这个
if (isMac) app.setName("Repy");

/* 改名前 userData 目录叫「训练记录生成器」，目录名跟着产品名变会让老记录找不到。
   只要旧目录还在，就固定继续用它——两版共用同一份数据，来回装也不会丢。 */
(function pinUserData() {
  try {
    const legacy = path.join(app.getPath("appData"), "训练记录生成器");
    if (fs.existsSync(legacy)) app.setPath("userData", legacy);
  } catch (err) {}
})();

let win = null;
let apiPort = 0;
let snapshotCache = null;

/* ---------------- 主进程日志：导出日志时和渲染层日志合并 ---------------- */

const MAIN_LOGS = [];
const LOG_LIMIT = 600;

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function mlog(scope, message) {
  MAIN_LOGS.push(`[${stamp()}] [${scope}] ${message}`);
  if (MAIN_LOGS.length > LOG_LIMIT) MAIN_LOGS.splice(0, MAIN_LOGS.length - LOG_LIMIT);
}

process.on("uncaughtException", err => mlog("main:error", err && err.stack ? err.stack : String(err)));
process.on("unhandledRejection", err => mlog("main:reject", String(err)));

/* ---------------- 数据快照：给 AI / 本地接口用 ---------------- */

function snapshotPath() {
  return path.join(app.getPath("userData"), SNAPSHOT_FILE);
}

function saveSnapshot(payload) {
  if (!payload || typeof payload !== "object") return;
  snapshotCache = payload;
  try {
    fs.writeFileSync(snapshotPath(), JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("snapshot write failed:", err.message);
  }
}

/* ---------------- 本地只读接口（给 AI agent 用） ---------------- */

function sendJson(res, code, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function startAgentApi(port, attempt = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const route = url.pathname.replace(/\/+$/, "") || "/";
    const snap = snapshotCache;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "*"
      });
      return res.end();
    }

    if (route === "/" || route === "/health") {
      return sendJson(res, 200, {
        ok: true,
        app: "fitness-log-generator",
        version: app.getVersion(),
        port: apiPort,
        ready: Boolean(snap),
        endpoints: ["/health", "/snapshot", "/records", "/records?date=YYYY-MM-DD", "/plan", "/actions"]
      });
    }

    if (!snap) {
      return sendJson(res, 503, { ok: false, message: "应用还在启动，稍后再试" });
    }

    if (route === "/snapshot") return sendJson(res, 200, snap);

    if (route === "/records") {
      const day = url.searchParams.get("date");
      if (day) {
        const list = (snap.records || {})[day] || [];
        return sendJson(res, 200, { date: day, count: list.length, records: list });
      }
      return sendJson(res, 200, { ok: true, records: snap.records || {} });
    }

    if (route === "/plan") return sendJson(res, 200, { ok: true, weekPlan: snap.weekPlan || {} });
    if (route === "/actions") return sendJson(res, 200, { ok: true, actions: snap.actions || [] });

    return sendJson(res, 404, { ok: false, message: "没有这个接口" });
  });

  server.on("error", err => {
    if (err.code === "EADDRINUSE" && attempt < 12) {
      startAgentApi(port + 1, attempt + 1);
      return;
    }
    console.warn("agent api failed:", err.message);
  });

  server.listen(port, "127.0.0.1", () => {
    apiPort = port;
    mlog("api", "agent api on http://127.0.0.1:" + port);
    console.log("agent api on http://127.0.0.1:" + port);
  });
}

/* ---------------- 更新：读取 update.json，比对版本，拉起安装包 ---------------- */

function versionParts(text) {
  return String(text || "")
    .split(/[.\-+]/)
    .map(piece => parseInt(piece, 10))
    .map(num => (Number.isFinite(num) ? num : 0));
}

function compareVersion(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function updateManifestPaths() {
  const list = [];
  if (isDev) list.push(path.join(__dirname, "update.json"));
  list.push(path.join(process.resourcesPath || __dirname, "update.json"));
  list.push(path.join(path.dirname(app.getPath("exe")), "update.json"));
  return list;
}

function readUpdateManifest() {
  for (const file of updateManifestPaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data && typeof data === "object") return { file, data };
    } catch (err) {
      console.warn("update manifest invalid:", file, err.message);
    }
  }
  return null;
}

function launchInstaller(file) {
  // NSIS 静默安装只存在于 Windows；mac 的 dmg 是挂载 + 拖拽，走 openMacImage
  if (isMac) {
    mlog("update", "skip silent install on mac: " + file);
    return false;
  }
  try {
    const child = spawn(file, ["/S"], { detached: true, stdio: "ignore", windowsVerbatimArguments: true });
    child.unref();
    mlog("update", "launch installer: " + file);
    setTimeout(() => app.quit(), 700);
    return true;
  } catch (err) {
    mlog("update:error", err.message);
    return false;
  }
}

/* mac：把 dmg 用「磁盘映像」的方式打开，用户把 app 拖进 Applications */
async function openMacImage(file) {
  mlog("update", "open dmg: " + file);
  const error = await shell.openPath(file);
  return {
    ok: !error,
    path: file,
    mac: true,
    error: error || "",
    message: error
      ? "dmg 没能打开：" + error
      : "dmg 已打开：把「Repy」拖进 Applications，选「替换」就完成升级，记录不会丢。"
  };
}

function downloadInstaller(url, target) {
  return new Promise((resolve, reject) => {
    const request = (link, depth = 0) => {
      if (depth > 4) return reject(new Error("重定向次数过多"));
      https
        .get(link, res => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return request(new URL(res.headers.location, link).toString(), depth + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error("下载失败，HTTP " + res.statusCode));
          }
          const out = fs.createWriteStream(target);
          res.pipe(out);
          out.on("finish", () => out.close(() => resolve(target)));
          out.on("error", reject);
        })
        .on("error", reject);
    };
    request(url);
  });
}

/* ---------------- 菜单 ---------------- */

/**
 * Windows 上直接去掉菜单栏，界面自带导航。
 * macOS 上不能没有菜单：Cmd+C / Cmd+V / Cmd+Z / Cmd+Q 全靠它，删掉输入框就没法复制粘贴了。
 */
function applyMenu() {
  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: "关于 Repy" },
        { type: "separator" },
        { role: "hide", label: "隐藏 Repy" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "全部显示" },
        { type: "separator" },
        { role: "quit", label: "退出 Repy" }
      ]
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" }
      ]
    },
    {
      label: "显示",
      submenu: [
        { role: "reload", label: "重新载入" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "进入全屏" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        { type: "separator" },
        { role: "front", label: "前置全部窗口" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------- 窗口 ---------------- */

function createWindow() {
  // 13 寸笔记本（尤其 mac）工作区只有 800 多高，按屏幕收一下，别让窗口顶出屏幕
  const work = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1280, work.width - 40),
    height: Math.min(920, work.height - 40),
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#f3f2ed",
    title: "Repy",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: PRELOAD
    }
  });

  applyMenu();
  win.loadFile(INDEX);

  win.once("ready-to-show", () => {
    win.show();
  });

  // F12 / Ctrl(Cmd)+Shift+I 打开 DevTools，Ctrl(Cmd)+R 刷新
  win.webContents.on("before-input-event", (event, input) => {
    const key = (input.key || "").toLowerCase();
    const mod = input.control || input.meta;
    if (key === "f12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (mod && input.shift && key === "i") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (mod && key === "r") {
      win.webContents.reloadIgnoringCache();
      event.preventDefault();
    }
  });

  // 外部链接一律丢给系统浏览器，不在应用内跳走
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });

  win.on("closed", () => {
    win = null;
  });
}

// 开发模式：index.html 一存盘就自动刷新窗口
function watchSource() {
  if (!isDev) return;
  let timer = null;
  try {
    fs.watch(path.dirname(INDEX), (eventType, filename) => {
      if (filename !== "index.html") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
      }, 120);
    });
  } catch (err) {
    console.warn("watch failed:", err.message);
  }
}

/* ---------------- IPC ---------------- */

ipcMain.on("data:snapshot", (event, payload) => saveSnapshot(payload));

ipcMain.handle("app:info", () => ({
  ok: true,
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  isPackaged: isDev === false,
  dataDir: app.getPath("userData"),
  snapshotPath: snapshotPath(),
  apiOrigin: apiPort ? "http://127.0.0.1:" + apiPort : "",
  exePath: app.getPath("exe")
}));

ipcMain.handle("app:copy", (event, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});

ipcMain.handle("app:openDataDir", async () => {
  const dir = app.getPath("userData");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
  const error = await shell.openPath(dir);
  return { ok: !error, error: error || "" };
});

ipcMain.handle("app:pickInstaller", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: isMac ? "选择新版 dmg" : "选择新版安装包",
    buttonLabel: isMac ? "打开" : "覆盖安装",
    properties: ["openFile"],
    filters: isMac ? [{ name: "磁盘映像", extensions: ["dmg"] }] : [{ name: "安装包", extensions: ["exe"] }]
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  const file = result.filePaths[0];
  if (isMac) return openMacImage(file);
  const started = launchInstaller(file);
  return { ok: started, path: file };
});

/* ---------------- 导出日志 ---------------- */

function buildLogText(payload) {
  const lines = [];
  lines.push("Repy · 运行日志");
  lines.push("=".repeat(52));
  lines.push(`导出时间：${stamp()}`);
  lines.push(`应用版本：${app.getVersion()}`);
  lines.push(`打包版本：${isDev ? "开发模式（electron .）" : isMac ? "macOS 应用（dmg 安装）" : "安装版 / 便携版"}`);
  lines.push(`Electron：${process.versions.electron}   Chromium：${process.versions.chrome}   Node：${process.versions.node}`);
  lines.push(`系统：${process.platform} ${process.arch} ${require("os").release()}`);
  lines.push(`安装目录：${path.dirname(app.getPath("exe"))}`);
  lines.push(`数据目录：${app.getPath("userData")}`);
  lines.push(`本地接口：${apiPort ? "http://127.0.0.1:" + apiPort : "未启动"}`);
  if (payload && payload.state) {
    lines.push("");
    lines.push("【应用状态】");
    Object.keys(payload.state).forEach(key => lines.push(`  ${key}: ${payload.state[key]}`));
  }
  lines.push("");
  lines.push("【主进程日志】");
  if (MAIN_LOGS.length) MAIN_LOGS.forEach(item => lines.push(item));
  else lines.push("  （无）");
  lines.push("");
  lines.push("【界面日志】");
  const rendererLogs = Array.isArray(payload && payload.logs) ? payload.logs : [];
  if (rendererLogs.length) rendererLogs.forEach(item => lines.push(String(item)));
  else lines.push("  （无）");
  lines.push("");
  lines.push("=".repeat(52));
  lines.push("反馈问题时把这份文件发给我就行，里面没有密码之类的敏感信息。");
  return lines.join("\r\n");
}

ipcMain.handle("app:saveLog", async (event, payload) => {
  const text = buildLogText(payload);
  const now = new Date();
  const p = n => String(n).padStart(2, "0");
  const name = `fitness-log-report-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.txt`;
  const result = await dialog.showSaveDialog(win, {
    title: "导出日志",
    defaultPath: path.join(app.getPath("desktop"), name),
    filters: [{ name: "文本文件", extensions: ["txt"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, text, "utf8");
    mlog("log", "exported to " + result.filePath);
    return { ok: true, path: result.filePath };
  } catch (err) {
    mlog("log:error", err.message);
    return { ok: false, error: err.message };
  }
});

/* ---------------- 分享安装包：重新打包 + 用户自己选保存位置 ---------------- */

function shareCandidates(version) {
  const names = isMac
    ? [`FitnessLog-${version}-arm64.dmg`, `FitnessLog-${version}-x64.dmg`, `FitnessLog-${version}.dmg`, `Repy-${version}-arm64.dmg`]
    : [`FitnessLog-${version}-Setup.exe`, `Repy-${version}-Setup.exe`];
  const dirs = [path.join(__dirname, "dist"), app.getPath("desktop")];
  if (!isDev) dirs.unshift(path.dirname(app.getPath("exe")));
  const hits = [];
  for (const dir of dirs) {
    for (const name of names) {
      const file = path.join(dir, name);
      try { if (fs.existsSync(file)) hits.push({ file, mtime: fs.statSync(file).mtimeMs }); } catch (_) {}
    }
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!(isMac ? /\.dmg$/i : /-Setup\.exe$/i).test(name)) continue;
        const file = path.join(dir, name);
        hits.push({ file, mtime: fs.statSync(file).mtimeMs });
      }
    } catch (_) {}
  }
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits.length ? hits[0].file : "";
}

function rebuildForShare() {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, "scripts", "build-share.js");
    const cleanEnv = { ...process.env };
    delete cleanEnv.ELECTRON_RUN_AS_NODE;
    delete cleanEnv.NODE_OPTIONS;
    const child = spawn(process.platform === "win32" ? "node.exe" : "node", [script], {
      cwd: __dirname, env: cleanEnv, stdio: "ignore", shell: true, windowsHide: true
    });
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      reject(new Error("打包超时（超过 6 分钟）"));
    }, 6 * 60 * 1000);
    child.on("error", err => { clearTimeout(timer); reject(err); });
    child.on("exit", code => {
      clearTimeout(timer);
      if (code === 0) resolve(true);
      else reject(new Error("打包脚本退出码 " + code));
    });
  });
}

ipcMain.handle("app:shareSetup", async (event, payload) => {
  const version = String((payload && payload.version) || app.getVersion());
  let source = shareCandidates(version);
  let rebuilt = false;
  const canRebuild = isDev && fs.existsSync(path.join(__dirname, "scripts", "build-share.js"));

  if (canRebuild) {
    mlog("share", "重新打包 v" + version);
    try {
      await rebuildForShare();
      rebuilt = true;
      source = shareCandidates(version) || source;
    } catch (err) {
      mlog("share:error", err.message);
      if (!source) return { ok: false, error: "重新打包失败：" + err.message };
    }
  }
  if (!source) {
    return {
      ok: false,
      error: isDev
        ? "dist/ 里没有安装包，重新打包也没成功。把报错发我看。"
        : "安装版里没有可复制的安装包文件，到开发目录打包一次就行。"
    };
  }

  const ext = isMac ? "dmg" : "exe";
  const defaultName = `Repy-${version}-${isMac ? "arm64" : "Setup"}.${ext}`;
  const result = await dialog.showSaveDialog(win, {
    title: "把安装包存到哪儿",
    buttonLabel: "保存安装包",
    defaultPath: path.join(app.getPath("desktop"), defaultName),
    filters: [{ name: isMac ? "磁盘映像" : "安装程序", extensions: [ext] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    fs.copyFileSync(source, result.filePath);
    mlog("share", "saved " + result.filePath);
    return { ok: true, path: result.filePath, source, rebuilt, size: fs.statSync(result.filePath).size };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ---------------- 卸载 ---------------- */

function findUninstaller() {
  if (isMac) return "";
  const dir = path.dirname(app.getPath("exe"));
  try {
    const files = fs.readdirSync(dir);
    const hit = files.find(name => /^uninstall.*\.exe$/i.test(name));
    return hit ? path.join(dir, hit) : "";
  } catch (err) {
    return "";
  }
}

ipcMain.handle("app:uninstallInfo", () => {
  if (isMac) {
    return {
      found: false,
      file: "",
      mac: true,
      dataDir: app.getPath("userData"),
      hint: "macOS 没有卸载程序：把「Repy」从「应用程序」拖进废纸篓就是卸载。"
    };
  }
  return {
    found: Boolean(findUninstaller()),
    file: findUninstaller(),
    dataDir: app.getPath("userData")
  };
});

ipcMain.handle("app:uninstall", async () => {
  if (isMac) {
    return {
      ok: false,
      mac: true,
      error: "macOS 上把「Repy.app」拖进废纸篓就是卸载；训练记录留在 ~/Library/Application Support 里。"
    };
  }
  const file = findUninstaller();
  if (!file) {
    return { ok: false, error: "没找到卸载程序；可能是便携版或开发模式，直接删掉程序文件夹就行。" };
  }
  try {
    const child = spawn(file, [], { detached: true, stdio: "ignore" });
    child.unref();
    mlog("uninstall", "launch " + file);
    setTimeout(() => app.quit(), 900);
    return { ok: true, file };
  } catch (err) {
    mlog("uninstall:error", err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("app:checkUpdate", async () => {
  const current = app.getVersion();
  const manifest = readUpdateManifest();
  if (!manifest) {
    return {
      ok: false,
      status: "no-source",
      current,
      message: "没找到 update.json，可以手动选择新版安装包。"
    };
  }

  const { data, file } = manifest;
  const latest = String(data.version || "").trim();
  if (!latest) {
    return { ok: false, status: "no-source", current, message: "update.json 缺少 version 字段。" };
  }
  if (compareVersion(latest, current) <= 0) {
    return { ok: true, status: "latest", current, latest, message: `已经是最新版 V${current}。` };
  }

  // mac 上不下载 exe：dmg 挂载后拖进 Applications 才是标准升级方式
  if (isMac) {
    const macUrl = String(data.mac || "").trim();
    return {
      ok: true,
      status: "manual",
      current,
      latest,
      notes: data.notes || "",
      message: macUrl
        ? `发现 V${latest}：下载 ${macUrl}，打开后把应用拖进「应用程序」覆盖即可。`
        : `发现 V${latest}：下载 mac 版 dmg，打开后把应用拖进「应用程序」覆盖即可。`
    };
  }

  const installer = String(data.installer || "").trim();
  if (!installer) {
    return {
      ok: false,
      status: "manual",
      current,
      latest,
      notes: data.notes || "",
      message: `发现 V${latest}，但没有配置下载地址，请手动选择安装包。`
    };
  }

  if (/^https?:\/\//i.test(installer)) {
    const target = path.join(app.getPath("temp"), `FitnessLog-${latest}-Setup.exe`);
    try {
      await downloadInstaller(installer, target);
      const started = launchInstaller(target);
      return started
        ? { ok: true, status: "installing", current, latest, message: `正在安装 V${latest}，应用会自行关闭。` }
        : { ok: false, status: "error", current, latest, message: "安装包下载好了，但启动失败。" };
    } catch (err) {
      return { ok: false, status: "error", current, latest, message: "下载失败：" + err.message };
    }
  }

  const local = path.isAbsolute(installer) ? installer : path.join(path.dirname(file), installer);
  if (!fs.existsSync(local)) {
    return {
      ok: false,
      status: "error",
      current,
      latest,
      message: "update.json 指向的安装包不存在：" + local
    };
  }
  const started = launchInstaller(local);
  return started
    ? { ok: true, status: "installing", current, latest, message: `正在安装 V${latest}，应用会自行关闭。` }
    : { ok: false, status: "error", current, latest, message: "安装包启动失败。" };
});

/* ---------------- 启动 ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    if (isMac) {
      app.setAboutPanelOptions({
        applicationName: "Repy",
        applicationVersion: app.getVersion(),
        version: `Electron ${process.versions.electron}`,
        copyright: "源子 · 自用工具"
      });
    }
    mlog("app", `start v${app.getVersion()} packaged=${isDev === false} exe=${app.getPath("exe")}`);
    createWindow();
    watchSource();
    startAgentApi(API_PORT_START);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
