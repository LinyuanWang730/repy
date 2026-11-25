/**
 * 把一个本地 HTML 截成一整张长图（用来发群的分享图）。
 *
 *   npx electron scripts/shot-doc.js docs/使用技巧.html docs/使用技巧.png 900
 *
 * 思路：先按真实宽度开窗口 → 量出整页高度 → 把窗口拉到那么高 → 截当前视口。
 * 隐藏窗口不会绘制，所以这里必须 show:true。
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const [, , htmlArg, outArg, widthArg] = process.argv;
if (!htmlArg || !outArg) {
  console.error("用法：npx electron scripts/shot-doc.js <html> <out.png> [宽度]");
  process.exit(1);
}

const htmlPath = path.resolve(htmlArg);
const outPath = path.resolve(outArg);
const width = Number(widthArg) || 900;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height: 900,
    show: true,
    backgroundColor: "#f3f2ed",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await win.loadFile(htmlPath);
    await new Promise(resolve => setTimeout(resolve, 500));

    const pageHeight = await win.webContents.executeJavaScript(
      "Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))"
    );
    win.setContentSize(width, pageHeight);
    await new Promise(resolve => setTimeout(resolve, 700));

    const image = await win.webContents.capturePage();
    fs.writeFileSync(outPath, image.toPNG());
    const size = image.getSize();
    console.log(`captured ${size.width}x${size.height} -> ${outPath}`);
  } catch (err) {
    console.error("截图失败：", err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
