# 打出 macOS 版（.dmg）

同一个 `src/index.html`，mac 版只是换了个「外壳」：Electron 换成苹果的二进制，封装格式从 NSIS 换成 dmg。

## 为什么不能在这台 Windows 上直接出 dmg

dmg 是苹果的磁盘映像格式，封装要用 macOS 自带的 `hdiutil`，签名要用 `codesign`。
Windows 上没有这两个东西，也没有能替代的实现 —— 所以最后那一步必须在苹果系统里完成。
代码这边已经全部准备好：icns 图标、mac 打包配置、ad-hoc 签名、菜单、路径、文案都改完了。

## 路子一：借一台 Mac（最直接）

1. 把整个 `健身记录生成器` 文件夹拷到 Mac 上（U 盘 / 网盘 / 微信都行）。**`node_modules` 千万别拷** ——
   Windows 版的 Electron 拷过去会顶替掉 Mac 版，双击脚本虽然会自动清掉，但白拷几百 MB。
   桌面上的 `训练记录生成器-mac打包.zip` 就是已经排好版的干净副本，传这个最省事。
2. 装 Node.js：<https://nodejs.org> 下 macOS 版，选 LTS。装完在终端敲 `node -v` 能看到版本号就对了。
3. 装 Xcode 命令行工具（免费，几分钟）：终端里跑

   ```bash
   xcode-select --install
   ```

   弹窗点「安装」，等它自己装完。**这一步不能跳**：dmg 的窗口布局（图标位置、Applications 快捷方式）
   是靠里面的 `python3` 画出来的，缺了它打包会停在最后一步。
4. 在这个文件夹里双击 **`3-打包出dmg（mac）.command`**。
   - 第一次会问「是否允许打开」，点允许；若提示权限不足，终端里跑一次
     `chmod +x "3-打包出dmg（mac）.command"`。
   - 它会自动 `npm install`（只装一次，几分钟）→ 打两种芯片的 dmg → 往桌面复制一份。
5. 产物：
   - `dist/FitnessLog-2.1.0-arm64.dmg` —— Apple Silicon（M1/M2/M3/M4）
   - `dist/FitnessLog-2.1.0-x64.dmg` —— Intel 芯片
   - 不确定自己是哪种：左上角苹果标 →「关于本机」，看「芯片」那一行。M 开头选 arm64，Intel 选 x64。
   - 只想自己用、想快一点：`npm run build:mac -- --arm64`（或 `--x64`）只打一个架构。

命令行等价写法：

```bash
npm install
npm run build:mac                # 两个架构都打
npm run build:mac -- --arm64     # 只打 M 系列
npm run build:mac -- --x64       # 只打 Intel
```

卡在下载 Electron（国内网络常见）：先执行这两行再打包。

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

## 路子二：没有 Mac，用 GitHub 的苹果机器打

仓库里已经放好 `.github/workflows/build-mac.yml`，它会自动开一台苹果机器（arm64 + Intel 各一台）打包。

1. 在 GitHub 新建一个空仓库（私有就行）。
2. 在这个文件夹里：

```bash
git init
git add .
git commit -m "V2.1.0 mac 打包"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

3. 打开仓库页面 → **Actions** → 左边选 `build-mac` → 右边 **Run workflow**。
4. 等 5～10 分钟，跑完后点进这次运行，页面底部 **Artifacts** 里有 `dmg-arm64` 和 `dmg-x64`，下载解压就是 dmg。

`.gitignore` 已经把 `node_modules`、`dist`、自检截图排除掉了，推上去只有几 MB 的源码。

## 路子三：云 Mac

MacinCloud、MacStadium、AWS EC2 mac 实例这类租一台苹果机器，远程桌面进去，照路子一的三步走。
适合不想买机器、也不想把代码放 GitHub 的情况。

## 第一次打开会被拦一下（正常）

没买苹果开发者证书（一年 688 元），所以安装包没有「公证」，macOS 会提示
**「无法验证开发者」** 或 **「已损坏，无法打开」**。这不是真的坏了，放行一次即可：

- 方式 A：右键点应用 → **打开** → 再点 **打开**（只需一次）。
- 方式 B：终端里跑一次，去掉「来自网络下载」的隔离标记：

```bash
xattr -dr com.apple.quarantine "/Applications/训练记录生成器.app"
```

- 方式 C：系统设置 → 隐私与安全性 → 拉到底 → **仍要打开**。

`scripts/after-pack.js` 会自动做一层 ad-hoc 签名，避免 Apple Silicon 上双击直接报「已损坏」。
如果真遇到了，手动补一次：

```bash
codesign --force --deep --sign - "/Applications/训练记录生成器.app"
```

## 装与卸

- **装**：双击 dmg → 把「训练记录生成器」拖进 Applications → 弹出旧版就选「替换」。
- **升级**：同上，拖进去覆盖。记录在应用数据目录里，不会丢。
- **卸**：把「训练记录生成器」从「应用程序」拖进废纸篓。想连记录一起清掉，再删
  `~/Library/Application Support/训练记录生成器`。
- 设置页的「卸载」按钮在 mac 上只给提示（macOS 没有卸载程序这回事），不会误以为坏了。

## mac 上和 Windows 的差别

| 地方 | Windows | macOS |
| --- | --- | --- |
| 安装包 | `Setup.exe` / `Portable.exe` | `FitnessLog-2.1.0-arm64.dmg` / `-x64.dmg` |
| 安装方式 | 向导，可改安装目录 | 拖进「应用程序」 |
| 升级 | 静默覆盖安装，应用自动关闭 | 打开 dmg，拖进去选「替换」 |
| 卸载 | 设置页按钮 → 卸载程序 | 拖进废纸篓 |
| 菜单栏 | 隐藏 | 有「训练记录生成器 / 编辑 / 显示 / 窗口」，`Cmd+C/V/Z/Q` 靠它 |
| 快捷刷新 | `Ctrl+R` | `Cmd+R`（两个都认） |
| 数据目录 | `%APPDATA%\fitness-log-generator` | `~/Library/Application Support/训练记录生成器` |
| AI 本地接口 | `http://127.0.0.1:47821` | 一样，端口被占就自动 +1 |

## 想在 mac 上直接改代码看效果

```bash
npm run dev
```

和 Windows 一样，改 `src/index.html` 存盘，窗口自己刷新。
