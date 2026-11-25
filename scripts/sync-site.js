#!/usr/bin/env node
/**
 * 把桌面版的最新状态同步进站点目录 site/。
 *
 * 干三件事：
 *   1. site/app/index.html = src/index.html + 在线版说明卡片（scripts/site-parts/web-note.html）
 *   2. 落地页顶部的版本徽章、更新日志，从 src/index.html 的 RELEASES 数组重新生成
 *   3. 下载行显示的体积，从 dist/ 里的真实安装包算
 *
 * 为什么不让两边各自维护：版本号和更新日志一改两处，迟早对不上。
 * 这里统一以 src/index.html 为唯一真相，站点只当展示层。
 *
 * 用法：npm run site:sync
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_HTML = path.join(ROOT, "src", "index.html");
const SITE = path.join(ROOT, "site");
const SITE_INDEX = path.join(SITE, "index.html");
const APP_DIR = path.join(SITE, "app");
const NOTE = path.join(__dirname, "site-parts", "web-note.html");
const DIST = path.join(ROOT, "dist");

const LOG_KEEP = 4; // 落地页最多展示几版日志

function log(msg) {
  console.log("  " + msg);
}

/** 从源码里抠出 `const RELEASES = [...]`，按括号配平，跳过字符串里的括号 */
function extractReleases(html) {
  const anchor = html.indexOf("const RELEASES = [");
  if (anchor < 0) throw new Error("src/index.html 里找不到 RELEASES 数组");
  const start = html.indexOf("[", anchor);
  let depth = 0;
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === "\\") { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        const text = html.slice(start, i + 1);
        return new Function("return " + text)();
      }
    }
  }
  throw new Error("RELEASES 数组没有闭合");
}

function extractVersion(html, releases) {
  const m = html.match(/RELEASE_VERSION\s*=\s*["']([\d.]+)["']/);
  if (m) return m[1];
  if (releases[0] && releases[0].version) return releases[0].version.replace(/^V/, "");
  throw new Error("拿不到版本号");
}

/** 把版本数组渲染成落地页的 <details> 组 */
function renderReleases(releases) {
  return releases.slice(0, LOG_KEEP).map((rel, i) => {
    const items = (rel.items || []).map(t => "        <li>" + t + "</li>").join("\n");
    const isNew = i === 0;
    return [
      '    <details class="log"' + (isNew ? " open" : "") + ">",
      "      <summary>",
      '        <span class="log-ver">' + rel.version + "</span>",
      '        <span class="log-date">' + rel.date + "</span>",
      isNew ? '        <span class="log-new">最新</span>' : null,
      '        <span class="log-caret"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>',
      "      </summary>",
      "      <ul>",
      items,
      "      </ul>",
      "    </details>",
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

/** 安装包体积，找不到就返回 null（页面保留原值）。
 *  用 1024 而不是 1000：Windows 资源管理器和浏览器下载栏显示的都是 MiB，
 *  页面上写「78 MB」跟用户眼睛看到的一致，写「83 MB」会让人觉得对不上。
 *  pack-release 会把定名文件放到 dist/release/，两个位置都找。 */
function sizeOf(name) {
  const candidates = [path.join(DIST, "release", name), path.join(DIST, name)];
  for (const p of candidates) {
    if (fs.existsSync(p)) return Math.round(fs.statSync(p).size / 1024 / 1024);
  }
  return null;
}

function main() {
  const src = fs.readFileSync(SRC_HTML, "utf8");
  const releases = extractReleases(src);
  const version = extractVersion(src, releases);
  console.log("同步站点 · 桌面版 V" + version + "，日志 " + releases.length + " 版");

  // ── 1. 在线版 ──
  if (!fs.existsSync(NOTE)) throw new Error("缺少 scripts/site-parts/web-note.html");
  const note = fs.readFileSync(NOTE, "utf8");

  // 在线版首次打开时不自动弹更新日志：进来就该看见界面，想看自己点版本号
  const preset = '<script>try{localStorage.setItem("release-seen-version","' + version + '");}catch(e){}</script>';
  let app = src.replace("<body>", "<body>\n" + preset);
  if (!app.includes(preset)) log("⚠ 没找到 <body> 标签，跳过预置脚本");

  app = app.replace("</body>", note + "\n</body>");
  fs.mkdirSync(path.join(APP_DIR, "assets"), { recursive: true });
  fs.writeFileSync(path.join(APP_DIR, "index.html"), app);
  log("site/app/index.html  " + Math.round(Buffer.byteLength(app) / 1024) + " KB");

  for (const f of ["coffee.jpg", "repy-robot.png"]) {
    const from = path.join(ROOT, "src", "assets", f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(APP_DIR, "assets", f));
  }
  log("site/app/assets/  两张图已同步");

  // ── 2. 落地页的版本号 + 日志 ──
  let page = fs.readFileSync(SITE_INDEX, "utf8");

  page = page.replace(
    /(<span class="ver" data-site-ver>)[^<]*(<\/span>)/,
    "$1V" + version + "$2"
  );

  // 用「有没有匹配上」判断，别用长度比较：版本没变时替换前后长度正好相同，会误报
  const RE_MARK = /(<!-- RELEASES:BEGIN[\s\S]*?-->)([\s\S]*?)(<!-- RELEASES:END -->)/;
  if (RE_MARK.test(page)) {
    page = page.replace(RE_MARK, function (_, head, __, tail) {
      return head + "\n" + renderReleases(releases) + "\n    " + tail;
    });
  } else {
    log("⚠ 没找到 RELEASES:BEGIN / END 标记，日志没更新");
  }

  // ── 3. 安装包体积 ──
  const sizes = {
    setup: sizeOf("Repy-" + version + "-Setup.exe"),
    portable: sizeOf("Repy-" + version + "-Portable.exe"),
    zip: sizeOf("Repy-Portable.zip"),
  };
  for (const [key, mb] of Object.entries(sizes)) {
    if (!mb) continue;
    page = page.replace(
      new RegExp('(data-size="' + key + '">)[^<]*(<)'),
      "$1" + mb + " MB$2"
    );
  }
  const missing = Object.entries(sizes).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) log("⚠ dist/ 里没找到：" + missing.join(" / ") + "（页面体积保持原样）");

  fs.writeFileSync(SITE_INDEX, page);
  log("site/index.html    版本徽章 V" + version + "，日志 " + Math.min(LOG_KEEP, releases.length) + " 版");

  console.log("\n接下来：npm run site:deploy");
}

main();
