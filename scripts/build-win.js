const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const version = pkg.version || "0.0.0";
const exeName = "Repy.exe";
const unpackedDir = path.join(root, "dist", "win-unpacked");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
env.ELECTRON_BUILDER_BINARIES_MIRROR =
  env.ELECTRON_BUILDER_BINARIES_MIRROR || "https://npmmirror.com/mirrors/electron-builder-binaries/";

const builderBin = path.join(root, "node_modules", ".bin", "electron-builder.cmd");
const electronDist = path.join("node_modules", "electron", "dist");

function step(label) {
  console.log("\n=== " + label + " ===");
}

function killRunningApp() {
  try {
    execFileSync("taskkill", ["/F", "/IM", exeName], { stdio: "ignore" });
    console.log("已关闭正在运行的旧版本");
  } catch (err) {
    // 没有在运行，正常
  }
}

function runBuilder(args) {
  execFileSync(builderBin, args, { cwd: root, env, stdio: "inherit", shell: true });
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

// signAndEditExecutable:false 时，exe 图标完全靠 rcedit 写入。
// 用二进制比对确认图标帧真的进了 exe，避免悄悄产出 Electron 默认原子图标。
function iconEmbedded(target) {
  const ico = fs.readFileSync(path.join(root, "build", "icon.ico"));
  const count = ico.readUInt16LE(4);
  if (!count) return false;
  const firstOffset = ico.readUInt32LE(6 + 12);
  const needle = ico.subarray(firstOffset, firstOffset + 64);
  return fs.readFileSync(target).includes(needle);
}

function stampExecutable() {
  const target = path.join(unpackedDir, exeName);
  if (!fs.existsSync(target)) {
    console.warn("跳过：找不到 " + target);
    return;
  }
  const rcedit = findRcedit();
  if (!rcedit) throw new Error("找不到 rcedit-x64.exe，无法写入应用图标");

  // 打包刚结束时 exe 可能仍被索引 / 杀毒软件占用，rcedit 首调会报 Unable to commit changes
  sleepSync(1200);

  const iconArgs = ["--set-icon", path.join(root, "build", "icon.ico")];
  const version4 = /^\d+\.\d+\.\d+$/.test(version) ? version + ".0" : version;
  const jobs = [
    iconArgs,
    ["--set-version-string", "ProductName", "Repy"],
    ["--set-version-string", "FileDescription", "Repy"],
    ["--set-version-string", "CompanyName", "源子"],
    ["--set-version-string", "OriginalFilename", exeName],
    ["--set-version-string", "LegalCopyright", "Copyright 2026 源子"],
    ["--set-file-version", version4],
    ["--set-product-version", version4]
  ];
  let ok = 0;
  for (const args of jobs) {
    // 图标是关键项，多重试几次；其余是可选元数据，失败只警告
    const tries = args === iconArgs ? 4 : 2;
    let done = false;
    for (let i = 0; i < tries && !done; i++) {
      try {
        execFileSync(rcedit, [target, ...args], { cwd: root, stdio: "pipe" });
        done = true;
        ok += 1;
      } catch (err) {
        if (i < tries - 1) sleepSync(600);
      }
    }
    if (!done) console.warn("跳过：" + args[0] + " " + (args[1] || ""));
  }

  if (!iconEmbedded(target)) {
    throw new Error("应用图标未写入 exe（会显示 Electron 默认图标），已中止打包，请重试");
  }
  console.log("已写入 " + ok + "/" + jobs.length + " 项，应用图标已校验 v" + version);
}

step("关闭旧版本");
killRunningApp();

step("打包应用目录");
runBuilder(["--win", "--dir", "-c.electronDist=" + electronDist]);

step("写入图标与版本信息");
stampExecutable();

step("生成安装包");
runBuilder(["--prepackaged", "dist/win-unpacked", "-c.win.target=nsis"]);

step("生成便携版");
runBuilder(["--prepackaged", "dist/win-unpacked", "-c.win.target=portable"]);

console.log("\n完成，产物在 dist/");
for (const file of fs.readdirSync(path.join(root, "dist"))) {
  if (file.endsWith(".exe")) {
    const size = (fs.statSync(path.join(root, "dist", file)).size / 1024 / 1024).toFixed(0);
    console.log("  " + file + "  " + size + "MB");
  }
}
