# Repy · 撰写与复盘，训练记录桌面版

V2.1.3 · Windows 10/11（64 位）· MIT 协议 · 数据全程留在本机，不上传任何服务器。

按一周安排选动作，或直接从全部动作里挑，编排好重量 / 组数 / 次数，点一下就记完。练完回头看复盘和趋势：哪周偷懒了、哪个动作进步了，一目了然。

## 下载（推荐 Gitee，国内更快）

| 文件 | 说明 | Gitee |
|---|---|---|
| `Repy-Setup-2.1.3.exe` | 安装版（推荐），开始菜单和桌面都有图标 | [下载](https://gitee.com/linyuanwang/repy/releases/download/v2.1.3/Repy-Setup-2.1.3.exe) |
| `Repy-Portable-2.1.3.exe` | 便携版，双击就跑，可放 U 盘 | [下载](https://gitee.com/linyuanwang/repy/releases/download/v2.1.3/Repy-Portable-2.1.3.exe) |
| `Repy-Portable-2.1.3.zip` | 绿色版压缩包，浏览器拦 exe 时用这个 | [下载](https://gitee.com/linyuanwang/repy/releases/download/v2.1.3/Repy-Portable-2.1.3.zip) |

文件名带版本号，跟网页下载卡片一致。Gitee 链接走**发行版附件**，不用登录直接下；下不动再走备用：[GitHub Releases](https://github.com/LinyuanWang730/repy/releases/latest)（附件名同样带版本号）。
没买数字签名证书，第一次打开 Windows 会拦一下：点「更多信息 → 仍要运行」。

网页版先看看界面：[repy.pages.dev](https://repy.pages.dev)。

## 仓库地址

- Gitee：<https://gitee.com/linyuanwang/repy>
- GitHub：<https://github.com/LinyuanWang730/repy>

两个仓库内容一致，都是**桌面版 Repy 的源码**。安装包挂在各自的发行版附件里（Gitee `releases/download/v2.1.3/`、GitHub `releases/latest/download/`），`download/` 里另留一份源码内直链。升版本时记得把这三处连同网页里的链接一起改成新版本号。

## 从源码跑起来

```bash
npm install
npm run dev        # 开开发窗口，改 src/index.html 会自己刷新
npm run build      # 打 Windows 安装包（输出到 dist/）
npm run build:mac  # 在 Mac 上打 dmg
```

业务代码全在 `src/index.html` 一个文件里，`main.js` / `preload.js` 是 Electron 的窗口壳与本地接口。
`scripts/pack-release.py` 负责把打包产物改成落地页用的三个固定文件名。

## 数据放在哪

记录、动作池、一周安排、偏好全部存在本机（Electron 的 localStorage / IndexedDB），
身材照存在 IndexedDB 库 `repy-photos`。导出备份是纯 JSON（有照片时是 zip），导入时可逐条去重。

## 协议

MIT。随便看、随便改，别拿去当自己的闭源产品卖就行。
