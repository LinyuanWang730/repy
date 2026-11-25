/**
 * 打包后的 mac 补签。
 *
 * Apple Silicon 上完全没有签名的 app 双击会直接报「已损坏」，必须先有一层
 * 临时签名（ad-hoc）。这里在 afterPack 阶段补上：
 *   - 如果机器上已经有正式证书（Developer ID）签过，就别动它；
 *   - 否则用 `codesign --sign -` 做 ad-hoc 签名。
 * 只是本地自用，不做公证（notarize），首次打开需要右键 →「打开」放行一次。
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function currentAuthority(appPath) {
  try {
    const info = execFileSync("codesign", ["-dv", "--verbose=4", appPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return String(info);
  } catch (err) {
    const out = `${err.stdout || ""}${err.stderr || ""}`;
    return String(out);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = fs.readdirSync(context.appOutDir).find(name => name.endsWith(".app"));
  if (!appName) {
    console.warn("[after-pack] 没找到 .app，跳过签名");
    return;
  }
  const appPath = path.join(context.appOutDir, appName);
  const detail = currentAuthority(appPath);

  if (/Authority=(Developer ID|Apple Development|Mac Developer)/.test(detail)) {
    console.log("[after-pack] 已有正式签名，保持不动");
    return;
  }

  console.log("[after-pack] ad-hoc 签名：" + appName);
  run("codesign", ["--force", "--deep", "--sign", "-", appPath]);

  try {
    run("codesign", ["--verify", "--deep", "--strict", appPath]);
    console.log("[after-pack] 签名校验通过");
  } catch (err) {
    console.warn("[after-pack] 签名校验有告警（本地自用一般不影响运行）：" + (err.message || "").split("\n")[0]);
  }
};
