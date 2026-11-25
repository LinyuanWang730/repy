#!/usr/bin/env node
/**
 * bump.js —— 版本号只敲一次，四处一起改
 *
 * 原来要手改的地方：package.json、update.json、index.html 的 title / versionChip /
 * APP_VERSION / RELEASE_VERSION，还有 check.js 里的 mock。漏一处就会出现
 * 「界面显示旧版本，安装包属性是新版本」。
 *
 *   npm run bump 2.1.1        直接改，并逐条打印改了哪
 *   npm run bump 2.1.1 -- --dry   只看会改什么，不写盘
 *
 * update.json 的 notes 是手写文案，脚本不动，改完记得自己补一句。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dry = process.argv.includes("--dry");
const next = (process.argv.slice(2).find(a => !a.startsWith("--")) || "").trim();

const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const cur = pkg.version;

if (!next) {
  console.log(`当前版本 ${cur}\n用法：npm run bump 2.1.2 [-- --dry]`);
  process.exit(0);
}
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`版本号要写成 2.1.2 这种三段式，收到的是「${next}」。四段号 electron-builder 会拒（Invalid version），打包不了。`);
  process.exit(1);
}
if (next === cur) {
  console.log(`已经是 ${cur}，没有改动。`);
  process.exit(0);
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const changes = [];

/** 按规则替换一个文件，rules = [[说明, 正则, 替换后]] */
function patch(rel, rules) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  let text = fs.readFileSync(abs, "utf8");
  const before = text;
  for (const [label, re, to] of rules) {
    const m = text.match(re);
    if (!m) continue;
    text = text.replace(re, to);
    const shown = to.replace(/\$\d/g, "");   // 只影响打印，实际替换仍带分组
    changes.push(`${rel}  ${label}：${m[0].trim().slice(0, 56)} → ${shown.trim().slice(0, 56)}`);
  }
  if (text !== before) {
    if (!dry) fs.writeFileSync(abs, text, "utf8");
  }
}

const c = esc(cur);
const n = next;

patch("package.json", [
  ["version", new RegExp(`"version"\\s*:\\s*"${c}"`), `"version": "${n}"`],
]);

patch("update.json", [
  ["version", new RegExp(`"version"\\s*:\\s*"${c}"`), `"version": "${n}"`],
]);

patch("src/index.html", [
  ["<title>", new RegExp(`(<title>[^<]*?)V${c}(</title>)`), `$1V${n}$2`],
  ["versionChip", new RegExp(`(id="versionChip"[^>]*>)V${c}(<)`), `$1V${n}$2`],
  ["APP_VERSION", new RegExp(`APP_VERSION\\s*=\\s*"${c}"`), `APP_VERSION = "${n}"`],
  ["RELEASE_VERSION", new RegExp(`RELEASE_VERSION\\s*=\\s*"${c}"`), `RELEASE_VERSION = "${n}"`],
  ["气泡标签", new RegExp(`>V${c} 新东西<`), `>V${n} 新东西<`],
]);

patch("scripts/check.js", [
  ["app:info mock", new RegExp(`version:\\s*"${c}"`), `version: "${n}"`],
  ["checkUpdate mock", new RegExp(`current:\\s*"${c}"`), `current: "${n}"`],
  ["checkUpdate 文案", new RegExp(`已经是最新版 V${c}`), `已经是最新版 V${n}`],
]);

if (!changes.length) {
  console.log(`没找到 ${cur} 的痕迹，可能已经被改过了。检查 package.json / index.html。`);
  process.exit(1);
}

console.log(`${dry ? "（预览，未写盘）" : ""}${cur} → ${next}\n`);
changes.forEach((line, i) => console.log(`${String(i + 1).padStart(2)}. ${line}`));
console.log(`
还剩两件手动的：
  · update.json 的 notes 写一句这个版本改了什么
  · README 的版本相关示例（dist 文件名等）按需更新`);
