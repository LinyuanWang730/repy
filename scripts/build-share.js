/**
 * 分享用打包：重新生成一个安装包，不关闭正在运行的软件。
 *
 * 和 scripts/build-win.js 的区别：
 *   - 不 taskkill（那个会杀掉自己）
 *   - 只出 setup / dmg，不出 portable，省一半时间
 * 由 main.js 的 app:shareSetup 调用，产物仍在 dist/。
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const version = pkg.version || "0.0.0";

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
env.ELECTRON_BUILDER_BINARIES_MIRROR =
  env.ELECTRON_BUILDER_BINARIES_MIRROR || "https://npmmirror.com/mirrors/electron-builder-binaries/";

const isWin = process.platform === "win32";
const builderBin = path.join(root, "node_modules", ".bin", isWin ? "electron-builder.cmd" : "electron-builder");
const electronDist = path.join("node_modules", "electron", "dist");

function run(args) {
  execFileSync(builderBin, args, { cwd: root, env, stdio: "inherit", shell: isWin });
}

function findRcedit() {
  const base = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base)) {
    const candidate = path.join(base, dir, "rcedit-x64.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stampExecutable() {
  if (!isWin) return;
  const exeName = "Repy.exe";
  const target = path.join(root, "dist", "win-unpacked", exeName);
  const rcedit = findRcedit();
  if (!rcedit || !fs.existsSync(target)) return;
  // 同 build-win.js：打包刚结束时 exe 可能被占用，先等一下再逐项写；图标多重试几次
  sleepSync(1200);
  const version4 = /^\d+\.\d+\.\d+$/.test(version) ? version + ".0" : version;
  const iconArgs = ["--set-icon", path.join(root, "build", "icon.ico")];
  const jobs = [
    iconArgs,
    ["--set-version-string", "ProductName", "Repy"],
    ["--set-version-string", "FileDescription", "Repy"],
    ["--set-version-string", "CompanyName", "源子"],
    ["--set-file-version", version4],
    ["--set-product-version", version4]
  ];
  for (const args of jobs) {
    const tries = args === iconArgs ? 4 : 2;
    let done = false;
    for (let i = 0; i < tries && !done; i++) {
      try {
        execFileSync(rcedit, [target, ...args], { cwd: root, stdio: "pipe" });
        done = true;
      } catch (err) {
        if (i < tries - 1) sleepSync(600);
      }
    }
    if (!done) console.warn("[share] 跳过：" + args[0] + " " + (args[1] || ""));
  }
}

console.log("[share] 重新打包 v" + version + " …");

if (isWin) {
  run(["--win", "--dir", "-c.electronDist=" + electronDist]);
  stampExecutable();
  run(["--prepackaged", "dist/win-unpacked", "-c.win.target=nsis"]);
} else {
  const arch = process.arch === "arm64" ? "--arm64" : "--x64";
  run(["--mac", arch]);
}

const out = path.join(root, "dist");
for (const file of fs.readdirSync(out)) {
  if (file.endsWith(".exe") || file.endsWith(".dmg")) {
    const size = (fs.statSync(path.join(out, file)).size / 1024 / 1024).toFixed(0);
    console.log("[share] " + file + "  " + size + "MB");
  }
}
console.log("[share] 完成");
