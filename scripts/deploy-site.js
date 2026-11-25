#!/usr/bin/env node
/**
 * 把 site/ 部署到 Cloudflare Pages。
 *
 * 顺序：先同步（版本号 / 日志 / 在线版）→ 检查下载链接是否还是占位符 →
 *       确认已登录 → 保证项目存在 → 上传。
 *
 * 用法：npm run site:deploy    或双击 5-发布网站.bat
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "site");
const SITE_INDEX = path.join(SITE, "index.html");
const PROJECT = "repy"; // 部署后地址是 https://repy.pages.dev
const PLACEHOLDER = "YUANZI"; // site/index.html 里 GitHub 用户名的占位符

function capture(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    return ((e.stdout || "") + (e.stderr || "")).trim();
  }
}

function fail(msg) {
  console.error("\n✗ " + msg);
  process.exit(1);
}

console.log("── 1/4 同步站点内容 ───────────────────────────");
const sync = spawnSync(process.execPath, [path.join(__dirname, "sync-site.js")], {
  cwd: ROOT,
  stdio: "inherit",
});
if (sync.status !== 0) fail("同步失败，先看上面的报错");

console.log("\n── 2/4 检查下载链接 ───────────────────────────");
const page = fs.readFileSync(SITE_INDEX, "utf8");
if (page.includes(PLACEHOLDER)) {
  console.error("  ⚠ site/index.html 里的下载链接还是占位符（" + PLACEHOLDER + "）。");
  console.error("    三个下载按钮现在点下去是 404，换成你自己的 GitHub 用户名再发。");
  console.error("    方法：在 site/index.html 里把 github.com/" + PLACEHOLDER + "/repy-downloads");
  console.error("          整段替换成 github.com/你的用户名/repy-downloads");
  fail("下载链接没配好，先别发");
}
console.log("  ✓ 下载链接已指向真实仓库");

console.log("\n── 3/4 确认 Cloudflare 登录状态 ───────────────");
const who = capture("npx wrangler whoami");
if (/not authenticated|You are not authenticated|Please log in/i.test(who) || /error/i.test(who) && !/@/.test(who)) {
  console.error(who.split("\n").slice(0, 6).join("\n"));
  console.error("\n  还没登录 Cloudflare。先跑：npx wrangler login");
  console.error("  浏览器会弹出来让你点一下授权，回来再跑这个脚本。");
  process.exit(1);
}
const whoLine = who.split("\n").find(l => l.includes("@")) || who.split("\n")[0];
console.log("  ✓ " + whoLine.trim());

console.log("\n── 4/4 上传到 Cloudflare Pages ────────────────");
// 项目没建过就先建，已存在会报错但不影响后面
spawnSync("npx", ["wrangler", "pages", "project", "create", PROJECT, "--production-branch=main"], {
  cwd: ROOT,
  stdio: "ignore",
  shell: true,
});

const deploy = spawnSync(
  "npx",
  ["wrangler", "pages", "deploy", SITE, "--project-name", PROJECT, "--branch", "main", "--commit-dirty=true"],
  { cwd: ROOT, stdio: "inherit", shell: true }
);

if (deploy.status !== 0) fail("上传失败，看上面的 wrangler 输出");

console.log("\n完成。地址：https://" + PROJECT + ".pages.dev");
console.log("在 Cloudflare 面板的 Workers & Pages → " + PROJECT + " 里能看到每次部署记录。");
