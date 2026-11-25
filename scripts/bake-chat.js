#!/usr/bin/env node
/**
 * bake-chat.js —— 把「当时写的台词」写进源码，打包才带上
 *
 * 设置里改过的台词存在用户自己的 localStorage（fitness-log-chat-lines-v1），
 * 打包用的是 src/index.html 里的 CHAT_DEFAULTS，两边不通。这个脚本负责把
 * 前者搬进后者，省得手抄。
 *
 *   1. 先从正在用的软件里把台词捞出来
 *        npx electron scripts/bake-chat.js --dump
 *      → 生成 chat-lines.json（如果软件没跑过、里面没这个键，会明说）
 *
 *   2. 再写进源码
 *        node scripts/bake-chat.js chat-lines.json           真写
 *        node scripts/bake-chat.js chat-lines.json --dry     只看会换成什么
 *
 * 也可以直接从剪贴板/手写 JSON 走第二步：文件里是字符串数组就行。
 * 顺序、字数（≤50）、条数（≤40）跟设置页同一套规矩，不合规的会跳过并报出来。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "src", "index.html");
const DUMP_FILE = path.join(ROOT, "chat-lines.json");
const CHAT_KEY = "fitness-log-chat-lines-v1";
const MAX_LEN = 50;
const MAX_COUNT = 40;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const doDump = args.includes("--dump");
const file = args.find(a => !a.startsWith("--")) || "";

/* ---------- 第一步：从真实用户目录里读 localStorage ---------- */
function dumpFromProfile() {
  const { app, BrowserWindow } = require("electron");
  /* 跟 main.js 同一套目录规则：老目录还在就继续用它 */
  const ledgered = (() => {
    const legacy = path.join(app.getPath("appData"), "训练记录生成器");
    return fs.existsSync(legacy) ? legacy : app.getPath("userData");
  })();
  app.setPath("userData", ledgered);

  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    try {
      await win.loadFile(INDEX);
      await new Promise(r => setTimeout(r, 800));
      const raw = await win.webContents.executeJavaScript(
        `localStorage.getItem(${JSON.stringify(CHAT_KEY)})`, true
      );
      if (!raw) {
        console.log(`没有找到 ${CHAT_KEY}：要么软件还没跑过，要么台词一句没改（那就用自带的 9 句，不用烘）。`);
        app.exit(0);
        return;
      }
      const lines = JSON.parse(raw);
      if (!Array.isArray(lines) || !lines.length) {
        console.log(`键在，但里面是空的（${raw}），用自带的就行。`);
        app.exit(0);
        return;
      }
      fs.writeFileSync(DUMP_FILE, JSON.stringify(lines, null, 2) + "\n", "utf8");
      console.log(`捞到 ${lines.length} 句，已写入 ${path.relative(ROOT, DUMP_FILE)}：`);
      lines.forEach((line, i) => console.log(`  ${String(i + 1).padStart(2, "0")} ${line}`));
      console.log(`\n下一步：node scripts/bake-chat.js chat-lines.json`);
      app.exit(0);
    } catch (err) {
      console.error("读取失败：", err.message);
      app.exit(1);
    }
  });
}
if (doDump) { dumpFromProfile(); return; }

/* ---------- 第二步：写进 CHAT_DEFAULTS ---------- */
if (!file) {
  console.log([
    "用法：",
    "  npx electron scripts/bake-chat.js --dump    从正在用的软件里捞出改过的台词",
    "  node scripts/bake-chat.js chat-lines.json   把它写进 src/index.html",
    "  加 --dry 只看会换成什么，不写盘"
  ].join("\n"));
  process.exit(0);
}

const src = path.isAbsolute(file) ? file : path.join(ROOT, file);
if (!fs.existsSync(src)) {
  console.error(`找不到 ${file}`);
  process.exit(1);
}
let lines;
try {
  lines = JSON.parse(fs.readFileSync(src, "utf8"));
} catch (err) {
  console.error(`${file} 不是合法 JSON：${err.message}`);
  process.exit(1);
}
if (!Array.isArray(lines)) {
  console.error(`${file} 要是一个字符串数组，比如 ["你好，我是 Repy。", "今天练了没？"]`);
  process.exit(1);
}

const clean = [];
lines.forEach((line, i) => {
  const text = String(line ?? "").replace(/\s+/g, " ").trim();
  if (!text) return;
  if (text.length > MAX_LEN) {
    console.warn(`跳过第 ${i + 1} 句：${text.length} 字，超过 ${MAX_LEN} 字上限 → ${text}`);
    return;
  }
  if (clean.includes(text)) {
    console.warn(`跳过第 ${i + 1} 句：跟前面重复 → ${text}`);
    return;
  }
  clean.push(text);
});
if (!clean.length) {
  console.error("过滤完一句都不剩，没改。");
  process.exit(1);
}
if (clean.length > MAX_COUNT) {
  console.warn(`超过 ${MAX_COUNT} 句，只保留前 ${MAX_COUNT} 句。`);
  clean.splice(MAX_COUNT);
}

const html = fs.readFileSync(INDEX, "utf8");
const blockRe = /(const CHAT_DEFAULTS = \[)([\s\S]*?)(\n  \];)/;
const m = html.match(blockRe);
if (!m) {
  console.error("在 src/index.html 里没找到 CHAT_DEFAULTS 数组，可能改名了，先跑 npm run where CHAT_DEFAULTS 看看。");
  process.exit(1);
}
const before = m[2].match(/^\s{4}".*",?$/gm) || [];
const body = clean.map(text => `    ${JSON.stringify(text)},`).join("\n");
/* 用函数替换，台词里出现 $& 这类字符才不会被当成替换模板 */
const next = html.replace(blockRe, (all, head, _old, tail) => `${head}\n${body}${tail}`);

console.log(`CHAT_DEFAULTS：${before.length} 句 → ${clean.length} 句`);
if (dry) {
  console.log("\n--- 会换成 ---");
  clean.forEach((text, i) => console.log(`${String(i + 1).padStart(2, "0")} ${text}`));
  console.log("\n（--dry，没写盘）");
  process.exit(0);
}
fs.writeFileSync(INDEX, next, "utf8");
console.log(`已写入 src/index.html。跟自带的对比、确认没漏句：`);
clean.forEach((text, i) => console.log(`  ${String(i + 1).padStart(2, "0")} ${text}`));
