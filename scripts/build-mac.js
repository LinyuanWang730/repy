/**
 * 一条命令出 mac 安装包：npm run build:mac
 *
 * 必须在 macOS 上跑 —— dmg 的封装（hdiutil）是苹果系统自带的工具，Windows 上做不出来。
 *   npm run build:mac          两个架构都打（Apple Silicon + Intel）
 *   npm run build:mac -- --arm64   只打 M 系列芯片
 *   npm run build:mac -- --x64     只打 Intel 芯片
 *
 * 产物：dist/FitnessLog-2.1.0-arm64.dmg 之类，同时复制一份到桌面。
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.dirname(__dirname);
const DIST = path.join(ROOT, "dist");
const pkg = require(path.join(ROOT, "package.json"));

if (process.platform !== "darwin") {
  console.error("");
  console.error("这个脚本只能在 macOS 上跑：dmg 需要苹果自带的 hdiutil 封装。");
  console.error("当前系统是 " + process.platform + "，Windows 上只能打 exe（npm run build）。");
  console.error("");
  console.error("想拿到 dmg，三条路：");
  console.error("  1. 借一台 Mac，把这个文件夹拷过去，装好 Node 20+，跑 npm install && npm run build:mac");
  console.error("  2. 推到 GitHub，用仓库里的 .github/workflows/build-mac.yml 在苹果机器上自动构建，产物在 Actions 里下载");
  console.error("  3. 用云 Mac（MacinCloud / MacStadium 之类）远程跑同样两条命令");
  console.error("");
  process.exit(1);
}

const args = process.argv.slice(2);
const archFlag = args.includes("--x64") ? "--x64" : args.includes("--arm64") ? "--arm64" : "";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;

console.log("==> electron-builder --mac " + (archFlag || "--arm64 --x64"));
const build = spawnSync("npx", ["electron-builder", "--mac", ...(archFlag ? [archFlag] : [])], {
  cwd: ROOT,
  stdio: "inherit",
  env
});

if (build.status !== 0) {
  console.error("打包失败，退出码 " + build.status);
  process.exit(build.status || 1);
}

const files = fs.existsSync(DIST) ? fs.readdirSync(DIST).filter(name => name.endsWith(".dmg")) : [];
if (!files.length) {
  console.error("没找到 dmg，检查 electron-builder 的输出。");
  process.exit(1);
}

const desktop = path.join(os.homedir(), "Desktop");
files.forEach(name => {
  const from = path.join(DIST, name);
  const mb = (fs.statSync(from).size / 1024 / 1024).toFixed(1);
  let copyNote = "";
  try {
    fs.copyFileSync(from, path.join(desktop, name));
    copyNote = "  → 已复制到桌面";
  } catch (err) {
    copyNote = "  （复制到桌面失败：" + err.message + "）";
  }
  console.log("✔ " + name + "  " + mb + " MB" + copyNote);
});

console.log("");
console.log("装法：双击 dmg，把「Repy」拖进 Applications。");
console.log("第一次打开如果提示「无法验证开发者」，右键图标 → 打开 → 再点「打开」即可（只需一次）。");
console.log("版本 V" + pkg.version);
