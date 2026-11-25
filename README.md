# 训练记录生成器

这个仓库里有两个程序，共用一套定位器和数据键：

| | 桌面版 Repy 2.1.2 | 小程序 RepyNeo 1.0.2 |
|---|---|---|
| 代码 | `src/index.html`（单文件，约 1.28 万行） | `repyneo/`（4 页 + 5 个 utils） |
| 改哪里 | [docs/代码地图.md](docs/代码地图.md) | [docs/代码地图-Neo.md](docs/代码地图-Neo.md) |
| 自检 | `scripts/check.js` | `npm run check:neo` |
| 预览 | `1-开发预览.bat` | `RepyNeo-Preview.bat`（微信开发者工具） |

桌面版是把 `通用版 · 健身记录生成器.html` 包成本地应用的工程（Windows 出 exe，macOS 出 dmg），业务代码全部在 `src/index.html` 一个文件里，**改界面只需要改它**，改动会被打包脚本直接吃进去。

要改某处但不知道在哪：先 `npm run where 关键词`（**两个工程一起搜**，只列出命中行、所在函数、行号，不用把一万多行全读一遍）；`--neo` 只搜小程序、`--tree` 看结构总览、`--gen` 重算两份地图的行号附录。开工前也可以先读 [AGENTS.md](AGENTS.md) 的 30 秒指引。

## 目录

```
健身记录生成器/
├── 1-开发预览.bat        双击：开热更新窗口（改代码它自己变）
├── 2-打包出exe.bat       双击：关旧版 → 打包 → 出两个 exe
├── 3-打包出dmg（mac）.command   双击（在 Mac 上）：装依赖 → 打 dmg → 复制到桌面
├── 4-同步.bat            双击（Windows）：提交本地改动 → 拉取 → 推送
├── 4-同步（mac）.command 双击（Mac）：同上，只是壳换成苹果的
├── 5-发布网站.bat        双击：同步站点 → 上传到 Cloudflare Pages（详见 docs/发布网站.md）
├── site/                 给外面人看的落地页 + 在线体验版（安装包不在这，走 GitHub Releases）
├── src/index.html        桌面版业务代码（原 HTML + 本地保存逻辑）
├── repyneo/              小程序工程：4 页 + utils + assets（结构见 docs/代码地图-Neo.md）
├── RepyNeo-Preview.bat   双击：把小程序工程打开进微信开发者工具（配 repyneo-launch.ps1）
├── main.js               主进程：窗口壳、热更新、覆盖升级、本地 AI 接口（win/mac 双平台）
├── preload.js            渲染层唯一能用的主进程能力（IPC 白名单）
├── update.json           更新清单：版本号 + 安装包地址（覆盖升级用）
├── src/assets/coffee.jpg 收款码图片（设置 → 请作者喝一杯咖啡）
├── build/icon.ico        应用图标（圆角矩形底 + 机器人胸前抱「健身记录」牌）
├── build/icon.icns       mac 图标（同样的图，四周留白 + 淡投影，符合苹果习惯）
├── build/installerSidebar.bmp    安装向导左侧竖图（放大的图标当背景）
├── build/uninstallerSidebar.bmp  卸载向导左侧竖图
├── build/installerHeader.bmp     安装向导右上角小图
├── build/installer.nsh   安装向导脚本：加一页欢迎页，让那张竖图露出来
├── scripts/make-icon.py  图标生成脚本（改配色/尺寸后重跑即可出 png+ico）
├── scripts/make-icns.py  icns 生成脚本（Windows 上手写 ICNS 容器，不用 iconutil）
├── scripts/build-win.js  一条命令跑完全部打包步骤
├── scripts/build-mac.js  一条命令打完 mac 两种芯片的 dmg
├── scripts/after-pack.js 打包后给 .app 补 ad-hoc 签名（不然 M 系列会说「已损坏」）
├── scripts/check.js      桌面版自检脚本：跑一遍交互 + 截图
├── scripts/check-repyneo.js  小程序静态自检：npm run check:neo
├── scripts/where.js      双工程定位器：npm run where 关键词，查函数 / CSS 分区 / 行号
├── scripts/gen-repyneo-pool.js  从桌面版动作池生成小程序 pool.js
├── scripts/make-repyneo-tabs.py 生成小程序 8 张 tab 图标
├── scripts/shot-neo.js   小程序截图
├── scripts/bump.js       桌面版版本号同步：npm run bump 2.1.2，十个位置一次改完
├── scripts/sync-site.js  把版本号 / 更新日志 / 在线版同步进 site/：npm run site:sync
├── scripts/deploy-site.js 发布到 Cloudflare Pages：npm run site:deploy
├── scripts/pack-release.py 把安装包整理成 GitHub Release 要用的固定文件名
├── scripts/prep-site-images.py 把自检截图压成站点用的小图
├── scripts/archive/      历史一次性补丁（apply-*.py），只读，别执行
├── scripts/shot-doc.js   把某个 HTML 截成一整张长图（分享图用）
├── AGENTS.md             改这个仓库前的 30 秒指引（两个工程 / 定位器 / 约定）
├── docs/代码地图.md       桌面版改哪里：功能 → 函数对照表 + 自动行号附录
├── docs/代码地图-Neo.md   小程序改哪里：功能 → 文件 / 方法对照表 + 自动附录
├── docs/BUILD-MAC.md     怎么在 mac 上（或借 GitHub 的 mac）出 dmg
├── docs/发布网站.md       上线到 Cloudflare Pages 的完整流程 + 排错表
├── docs/使用技巧.html     给朋友看的使用技巧（十个用法，可打印）
├── docs/使用技巧.png      上面那页截成的长图，直接发群 / 发朋友
├── docs/分享文案.md       三版可以直接复制粘贴的介绍文案
├── docs/GIT-跨机器同步.md  一台 Windows 一台 Mac，代码怎么同步（三种做法 + 排错表）
├── .gitattributes        换行符规则：.bat 存 CRLF、.command 存 LF，这个不能删
├── .gitignore            排除 node_modules / dist / 临时截图
├── .github/workflows/build-mac.yml  没有 Mac 时，用 GitHub 的苹果机器自动打 dmg
├── package.json          版本号 + 打包配置
├── dist/                 产物
│   ├── win-unpacked/                    免安装目录（调试用）
│   ├── FitnessLog-2.1.0-Setup.exe       安装版（桌面也放了一份）
│   ├── FitnessLog-2.1.0-Portable.exe    便携版
│   └── FitnessLog-2.1.0-arm64.dmg       mac 版（在 mac 上打包后才有）
└── 通用版 · 健身记录生成器.html           原始文件，保留不动
```

## 换行符（跨平台的关键，别删 `.gitattributes`）

`3-打包出dmg（mac）.command` 必须是 **LF**，否则 Mac 上双击报 `bad interpreter: /bin/bash^M`；`1-/2-/4-` 三个 `.bat` 必须是 **CRLF**，否则 Windows 上双击闪一下就没。

这两个要求互相矛盾，靠 `.gitattributes` 分文件类型锁死：

```gitattributes
*.bat      text eol=crlf
*.command  text eol=lf
```

所以**无论在哪台机器上检出，换行符都会自动正确**。`.command` 的可执行位也已在仓库里记录成 `100755`，clone 出来即可双击；万一没有：

```bash
chmod +x "3-打包出dmg（mac）.command"
```

## 两台机器怎么同步

一台 Windows、一台 Mac，同一份代码来回改 —— 完整方案（iCloud 放哪、三条纪律、排错表）见 **[docs/GIT-跨机器同步.md](docs/GIT-跨机器同步.md)**。

最短版本：iCloud 里只放一个**裸仓库**（`训练记录生成器.git`，2.3 MB、99 个文件），代码副本各自留在本地磁盘。**开工和收工各双击一次同步脚本**（Windows 是 `4-同步.bat`，Mac 是 `4-同步（mac）.command`），它会自己提交、拉取、推送。

这样每台机器的 `node_modules` 一直存在，不用每次重装；iCloud 也不碰那 1.1 GB 的依赖和产物。

为什么不是「整个文件夹扔进 iCloud」：**iCloud 不看 `.gitignore`**，它会照样同步 `node_modules`（561 MB，Windows 版二进制到 Mac 上直接用不了）和 `dist`（568 MB），两台机器还会互相覆盖。详见文档。

日常命令（脚本帮你做的事）：

```bash
git status                    # 换机器后先看一眼
git log --oneline -5          # 两边的最后一条提交应该是同一个
git add -A && git commit -m "改了什么"
git pull --rebase && git push
```

两个 `.bat` 存的是 GBK 编码（cmd 双击才不乱码），用 VS Code 打开会显示乱码，属正常现象，别另存成 UTF-8。

## 日常两条命令

```bash
npm run dev     # 开窗口 + 监听 src/index.html，存盘自动刷新
npm run build   # 出安装包 + 便携版到 dist/
```

窗口里按 `F12` 开 DevTools，`Ctrl+R` 强制刷新。

改完想快速验收（不改代码，只跑一遍交互并截图）：

```bash
env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS npx electron scripts/check.js
```

它会用独立的数据目录跑一遍：新功能浮条 → 展开动作池（底部大按钮）+ 添加动作小按钮 → 搜索 → 一周安排 → 健身起点 → 选动作保存 → 步骤条跳转 → 预选按钮（含「点了不重绘」检查）→ 总览（改开始日期 / 自定义训练天数 / 关 AI 条）→ 设置（咖啡码、预选自定义、导出日志、卸载）→ 补记录全流程 → 删单个动作 / 删整条记录，把结果打成 JSON 输出，截图落在 `build/check-*.png`。

**不想碰命令行**：双击 `1-开发预览.bat` 等价于 `npm run dev`，双击 `2-打包出exe.bat` 等价于 `npm run build`。黑窗口要一直开着，关掉应用就退了。

### 打包前把「当时写的台词」烘进源码

设置里改的台词只存在你自己的 localStorage，打包用的是 `src/index.html` 的 `CHAT_DEFAULTS`，两边不通。两条命令把这一步接上：

```bash
npx electron scripts/bake-chat.js --dump     # 从正在用的软件里捞出台词 → chat-lines.json
node scripts/bake-chat.js chat-lines.json    # 写进 src/index.html（--dry 只看不写）
```

`--dump` 跟 `main.js` 用同一套用户目录规则（老目录「训练记录生成器」还在就继续用它）；软件还没跑过、或者台词一句没改，会直接说「不用烘」。第二步会按设置页同一套规矩过滤：去重、超 50 字跳过、超 40 句只留前 40，逐条打印跳过了哪句。写完跑一遍 `check.js` 更稳。

## 改代码到看到效果的原理

窗口里跑的不是截图，是这个 HTML 文件本身。`main.js` 里有十行 `fs.watch` 监听 `src/index.html`，文件一存盘就调用 `reloadIgnoringCache()` 重新加载。所以：

- 我改 `src/index.html` → 保存 → 窗口 0.1 秒后自己变成新样子，不用你操作
- 改的是 `src/index.html`，**不是**根目录那个 `通用版 · 健身记录生成器.html`（原件不参与运行）
- `dist/` 里的 exe 是打包那一刻的快照，改代码不会影响它，必须重新打包

## 界面结构（V2.1.1）

- **顶部版本号**只显示当前版本号和「通用版」；点版本号可以重新打开更新日志
- **更新日志窗口**：标题下面一排版本标签 `V2.1.2 / V2.1.1 / V2.1.0 / V2.0.0`，点哪个看哪一版，清单和日期跟着换；底部「Repy 曾说」会先关掉日志、跳回撰写页，让气泡带上「Repy 曾说 · V2.1.1」的小标签把**上一版**的新东西念一遍（跟正在翻哪一版无关，`previousRelease()` 按当前版本自动取上一版），**10 秒后自己收回**（中途点气泡的标签会立刻收回）
- **对话气泡三屏**：闲聊 / 怎么用 / V2.1.1 新东西，每 10 秒自动轮换。标签栏只有「怎么用」「V2.1.1 新东西」两个，闲聊那屏不占标签——**点 Repy 本体**就回到闲聊屏换一句。「怎么用」是三行编号（01 选动作、02 记重量、03 保存与复制），`plus` 那一行夹在 02 和 03 之间，蓝底小标签和数字章同样大小
- **换版本首启动**会弹更新日志，清单由 `openRelease(0)` 统一渲染；点「Repy 曾说」后气泡临时借用第四屏念上一版内容，念完自己收回，那一屏平时是空的、**已经排除在轮换之外**（以前排进去，于是每转一圈闪一次空壳）
- **左侧常驻侧边栏**：品牌行 + 两个不带序号的导航（健身记录生成器 / 记录总览）+ 底部的操作步骤条 + 最底下的齿轮「设置」。整个应用是「外壳固定、内容区滚动」，所以侧边栏、步骤条、齿轮**任何窗口尺寸、任何缩放下都不会被卷走**；窗口窄于 1080px 时自动变成顶部横条
- **操作步骤跟着滚动走**：现在亮哪一步由「你正看到哪一段」决定（第一步动作池、第二步编排、第三步保存复制），滚到底自动亮第三步；在总览或设置页时整条变淡、不再乱亮。点任意一步仍然会滚到对应环节
- **标题右侧是本机日历**：读系统日期生成当月日历；三色状态与记录总览完全一致（浅黄＝有记录、深黄＋角标＝含关键重量、深底＝当前选中），下方一行图例；最底部那条显示「健身已经 · 从 X 起 / N 天」，**点它就能改开始日期**
- **第一步**分两块：
  - 上面「按星期选动作」：一到日的选项卡（有安排的日子带绿底线），下面是这一天自定义的动作，点卡片加入本次编排，右上角「编辑一周安排」现改
  - 下面「全部动作池」：**默认收起**；标题右侧是「编辑动作」和「＋ 添加动作」两个小按钮，面板底部整条通栏的大按钮负责展开 / 收起，展开后才有搜索 / 部位筛选 / 排序
- **第二步**「确认训练编排」：重量、组数、每组数量三列对齐，下面跟各自的快速预选按钮（**与各自输入框严格等宽**，数值可在设置里自定义）。每行右侧是删除 ×，「分别设置每组」就在它正下方（与列右边缘对齐），点它只重画这一行的每组数量格，**整张卡不重建、不闪**
- **有氧动作**在这张卡里换一套输入项：规格、配速、补充规格，配速下面 `m/s / km/m / km/h` 三个单位按钮，一段一行，「＋ 增加分段」加下一段；没有重量和组次，也不标关键重量
- **plus 步**「为耗能评级」：第二步和第三步之间那块扁圆角矩形，1 到 10 级柱状，前 3 级轻松（浅绿）、4–6 级适中（紫）、7–8 级困难（暗粉）、9–10 级竭尽全力（红褐），右侧读数跟着变色；评级跟着记录存下来，复盘日历按阶段上色
- **第三步**「保存、预览及复制到剪贴板」：保存写入当天记录并弹窗提示，复制走剪贴板；弹窗里的按钮是「去复盘看」
- **记录总览**：
  - 右上三块数字——**健身已经 N 天**（点一下改开始日期）、**有记录 N 次**（自动统计，不可改）、**训练天数 N 天**（点一下自己填，设置里也能改回自动）
  - 可点的两块带虚线小标「点击修改 / 点击自定义」，鼠标移上去会变成黄底
  - 「今天」下面一条浅黄的「接入 AI agent」，右侧「复制接入说明」，**分隔线右边的 × 可以关掉**（关掉记在 `overview-ai-strip-hidden-v1`）
  - 下面是当月日历：每一格四边都有边框、格与格之间留 4px 白缝（不再共线，蓝色一多也不会糊成一块）；有记录带底色、含关键重量标「关键」、选中日深底，关键重量那一行整行高亮
  - **补记录**：日历上「回到今天」左边的「补记录」→ 整月日期全部变绿 + 弹窗「可以补记录了」；关掉弹窗后点日历上任意一天，才会带着那一天跳回「健身记录生成器」，底部常驻一条「正在补某年某月某日」的提示，保存后补进那天、提示消失。按钮此时变成「取消补记」
  - **删记录**：每条记录右上角「删除」（点一次变「再点一次删除」，第二次才真删）；每个动作右侧的「×」单独删这个动作，删空了整条记录一起消失，复制文字会同步重算
- **设置页**（齿轮进入）：请作者喝一杯咖啡、**Repy 说**（抽屉）、动作池、一周安排、健身档案（开始日期 + 训练天数）、操作习惯、**快速预选**、记录数据、**日志与反馈**、软件更新、AI 接入、关于、**卸载**。十三张卡片**同宽、同左边距**
- **更新日志**是启动时的弹窗，右上角叉号关闭，关过之后同版本不再弹出
- **字体全部是黑体（无衬线）**：正文、按钮、输入框、备注框、预览区都不允许回落到宋体/等宽；勾号统一用直笔 SVG 勾
- **保存完成的弹窗只留 5 秒**：右上角是「N 秒后自动关闭」+ ×，倒数到 0 自己关；「日志已导出」这类要看路径的提示不自动关

### 健身档案：两个可改的数字

| 数字 | 怎么算 | 改法 |
|---|---|---|
| 健身已经 N 天 | 今天 − 开始日期 + 1 | 点总览里的「健身已经」，或点标题旁日历底部的黄条，或设置 → 健身档案 → 选择日期 |
| 有记录 N 次 | 保存过多少条记录 | 不可改，跟着保存走 |
| 训练天数 N 天 | 默认＝有记录的日期数；自定义时＝填的总天数（含没记录的日子）每天 +1，且不会小于有记录的天数 | 点总览里的「训练天数」填一个数；设置 → 健身档案 → 自定义 / 恢复自动 |

自定义的天数存 `settings.manualTrainDays`，设 `null` 就是回到自动统计。填了以后总览显示你填的数，日历和记录本身不受影响。

### 快速预选（组数 / 每组数量按钮的数值）

设置 → 快速预选：两组各四个输入框，最多各 4 个值，留空表示这一格不用。

- 组数默认 `1 / 2 / 3 / 4`，每组数量默认 `6 / 8 / 12`
- 保存后第二步所有动作的按钮立刻换成新数值；**按钮数变几个就按几等分，宽度始终等于上面的输入框**
- 存 `settings.setsPresets` / `settings.repsPresets`；「恢复默认」一键回到出厂值
- 点这些预选按钮只改当前这一行（输入框数值 + 高亮状态），不再整块重绘，**不会闪**

### 导出日志

设置 → 日志与反馈 → 「导出日志」，弹保存框存一份 txt，内容：

- 版本、打包/开发模式、Electron / Chromium / Node 版本、系统与架构、安装目录、数据目录、本地接口端口
- 应用状态：动作数、记录数、开始日期、训练天数来源、一周安排天数、两组预设值、当前编排动作数
- 主进程日志（启动、接口端口、升级、卸载）与界面日志（页面切换、保存、设置改动、JS 报错）

界面日志用 `logLine(scope, message)` 写，环形缓冲 500 条；`window.onerror` 和 `unhandledrejection` 会自动记进去。

### 请作者喝一杯咖啡

设置最上面那张卡片，点「请喝一杯」弹出微信收款码（`src/assets/coffee.jpg`）。纯本地图片，不联网。

### 卸载

设置最底部的「卸载」：找到安装目录里的 `Uninstall *.exe` 并启动，应用随后自己退出。便携版/开发模式没有卸载程序，会提示直接删程序文件夹。**只删程序，`%APPDATA%\fitness-log-generator` 里的记录保留。**

### 安装向导的样子

`nsis` 配置里有三张图：左侧竖图 164×314（放大的图标当背景）、右上角小图 150×57、卸载向导竖图。`build/installer.nsh` 里加了 `customWelcomePage` 宏，让欢迎页出现——NSIS 的欢迎页和完成页都会用左侧那张竖图，图标就是在这里以背景形式露出来的。

### 一周安排（自定义每天的动作）

逻辑就是「选星期 → 挑动作 → 保存」：

1. 第一步右上角「编辑一周安排」，或设置页的「编辑一周安排」，或浮条上的「去试试」
2. 顶部七个星期按钮，右下角「已选 N 个」；点动作块切换选中（选中变黄底、方块变 ×），上面的已选条按顺序排列，点一下撤回，条尾的「清空」一把清干净
3. 「这一天叫什么」选填，会显示在第一步的深色横幅上；右边的「照抄某天」可以把这个星期照抄成别的一天（例如周四）
4. 搜索框下面是部位筛选（全部 + 七个部位），再下面是两列动作列表
5. 「保存」一次写整周（改了几个星期都能一起存），回到主界面后第一步立刻按新安排显示

数组存 `fitness-log-week-plan-v1`；首次打开会按内置的默认训练日种一份，随时可以全改掉。删除动作（含软件自带的）时，周安排里对应条目会自动清掉。

### 添加 / 编辑动作

动作池标题右侧有两个按钮：

- 「＋ 添加动作」打开表单：动作名（必填）、部位（七个部位任选）、又称作（选填，多个用 `/` 分隔）。保存后立刻写进动作池并落盘，顶部「全 N 个」和各标签页计数同步变化。自建动作在卡片名字后面带一个青色的「自建」标记。
- 「编辑动作」是 V2.1.1 新增的管理弹窗：搜索 + 「全部 / 各部位」筛选 + 两列清单，每行右侧的 × 删除。**点一次是确认态，点第二次才真删**；软件自带的动作一样能删，删掉的记进 `fitness-log-hidden-actions-v1`，重启也不会自己回来。删多了想找回，弹窗底部有「恢复自带的动作」。
- 删除入口只有这一个地方：动作池列表、复盘、趋势里都没有删动作的按钮。

### 有氧动作

跑步、跑步机、爬楼梯、骑行、动感单车、游泳、划船机、跳绳、椭圆机、爬坡走、篮球、羽毛球都归在「有氧」这个部位下，数据上多一个 `type:"cardio"`。

- 卡片里没有重量 / 组数 / 每组数量，换成三列：**规格**（例如 `6 km`、`40 分钟`）、**配速**（数字 + `m/s` / `km/m` / `km/h` 三个单位按钮）、**补充规格**（例如 `坡度 8`、`心率 150`）
- 一段一行，「＋ 增加分段」加下一段，用来记间歇；每段右侧的 × 删掉这一段（至少留一段）
- 有氧不标关键重量，也不进趋势页（趋势画的是重量曲线）
- 文字里的写法：`跑步 6 km @ 10 km/h（坡度 8）`
- 记录里每段存 `{spec, pace, paceUnit, extra}`，跟力量那套 `{weight, sets, reps}` 分开走；`formatLoad()` 认 `spec` 字段就按有氧写

### plus 步：耗能评级

第二步和第三步之间那块扁圆角矩形，就是 plus 步：

- 左边一枚 plus 徽章：深蓝圆角方块里写白色 `plus`，方块正上方一行红色小字 `new`；外面不再套绿框。右边是标题，标题下面不挂说明文字
- 1–10 级柱状图，十根**等宽**，越往后越高；点一下选中，再点同一级取消
- 四段颜色：1–3 轻松（浅绿 `#7fc48f`）、4–6 适中（紫 `#9a89d8`）、7–8 困难（暗粉 `#cd7d95`）、9–10 竭尽全力（红褐 `#b0614a`）——柱子上不写阶段名和级数，最右侧读数据框显示「6 / 适中」
- 柱子填充用 40% 混白，比部位索引色的 11% 更实一档，一眼能分开「耗能评级」和「这是哪个部位」
- 存进记录的 `effort` 字段；草稿存在 `fitness-log-v1` 的 `effort`
- 复盘日历上，有记录的那一格按等级上色（一天多条记录取最高的那条），图例和右侧当日面板的「耗能 6 · 适中」标签用的是同一套颜色
- 当日面板上，耗能标签单独占上面一行，「xx:xx 保存」和「补记」在下面一行并缩进 19px、与标签里的「耗能」二字左对齐（没有耗能标签的卡不缩进）；日历空白天是纯白，不会再被补记录模式刷成一片绿
- 没评级的日子还是原来的浅蓝，不影响老记录

### Repy 说（台词库）

撰写页那只会说话的小机器人，念的句子来自一张表，一共 9 句（`CHAT_DEFAULTS`）：

| # | 台词 |
|---|---|
| 01 | 你好，我是 Repy。 |
| 02 | 开始训练 【天】 天了，你也没想到这么久了吧？ |
| 03 | 这个plus功能真方便啊，回顾每次练完的状态，一目了然。 |
| 04 | Hello, my name is Repy. |
| 05 | 练了啥？统统告诉我？ |
| 06 | 那么多记录方式，干嘛只用我啊，到时候又说我垄断了……（爱开玩笑） |
| 07 | 今天练了没？ |
| 08 | 今天要练，明天也许也练。 |
| 09 | 薄肌理论，大水理论，大Repy理论…… |

- **9 句全都能改**，在设置页第二张卡「Repy 说」里；卡片是个抽屉，默认收起，点标题行展开，行首是编号、行中是输入框、行尾是删除
- 写「**【天】**」会被换成当前训练天数；还没够一天的，带天数的句子先不说（新装软件不会念「开始训练 0 天」）
- 一句最多 50 字，最多存 40 句；抽屉底部是「复制全部」「恢复自带」「加一句」+ 一句提示「点 Repy 本体也能换一句」
- **伪随机用洗牌袋**：一轮里每句只说一次，整副抽完才重洗，跨轮不撞车，不会老盯着同一句念
- 改过的台词存 `fitness-log-chat-lines-v1`；**没改过就不写这个键**，永远读自带的那 9 句——所以想换默认开场白，改 `CHAT_DEFAULTS` 就够了
- 「恢复自带」要点两次才真盖掉（第一次按钮变红写「再点一次恢复」）；改完点「复制全部」把清单拷出来，或者直接跑 `scripts/bake-chat.js` 写进源码（见「打包前把当时写的台词烘进源码」）
- 气泡轮换三屏：闲聊 → 怎么用 → V2.1.1 新东西，每 10 秒一次；闲聊那屏不占标签，点 Repy 本体立刻回到闲聊屏并换一句

### 部位索引色

| 部位 | 色值 | 观感 |
|---|---|---|
| 胸 | `#e08f4a` | 橙 |
| 背 | `#54ad7c` | 绿 |
| 腿 | `#4f9fd4` | 蓝 |
| 肩 | `#9078cf` | 紫 |
| 手臂 | `#dfb43c` | 黄 |
| 腹/核心 | `#e6908f` | 浅红 |
| 有氧 | `#5aaeb9` | 青 |

「全部」用深蓝，「常用动作」用砖红。改色改两处：CSS 的 `.group-胸` 等七个类，和 JS 里 `GROUPS` 的 `color`。「腹/核心」的类名带斜杠，CSS 里要写成 `.group-腹\/核心`。

动作数据集中在 `src/index.html` 的 `BASE_ACTIONS` 里，加内置动作只要照格式加一行；`common:true` 的会出现在「常用动作」标签下。界面上的「添加动作」写到 `CUSTOM_KEY`，两者运行时合并成 `ACTIONS`。

### 字体

全站统一非衬线：正文 `-apple-system → Segoe UI → Microsoft YaHei`，数字用 `font-variant-numeric: tabular-nums` 对齐。V1.5 之前几处等宽字体（`SFMono-Regular / Menlo / Consolas`）会把中文回落成宋体，看着像衬线，V1.6.0 已全部换掉。

## 覆盖升级（点新版安装包直接盖掉旧版）

两层保证：

1. **安装包本身**：`nsis.oneClick: false` + `perMachine: false` + `allowElevation: true` + `deleteAppDataOnUninstall: false`。同 `appId` 的新安装包会写回同一个安装目录，数据在 `%APPDATA%` 里，卸载/重装都不动
2. **应用内升级**：设置 → 软件更新
   - 「选择安装包升级」：选 `FitnessLog-x.y.z-Setup.exe`，主进程用 `/S` 静默覆盖安装，随后应用自己退出，重新打开就是新版
   - 「检查更新」：读 `update.json` 比对版本；填了 `installer` 就自动下载（http/https）或直接启动本地路径

`update.json` 就放在 exe 同级（打包时通过 `extraResources` 进 `resources/`）：

```json
{
  "version": "2.1.0",
  "notes": "这一版改了什么",
  "installer": "https://example.com/FitnessLog-2.1.0-Setup.exe"
}
```

`installer` 留空时，「检查更新」只会告诉你有没有新版，安装包请用「选择安装包升级」手动指过去。想发行新版：改 `package.json` 的 `version`、改 `update.json` 的 `version` 和 `installer`，`npm run build`。

## macOS 版（dmg）

同一份代码，多了一套 mac 打包配置。**dmg 只能在 macOS 上生成**（`hdiutil` / `codesign` 是苹果系统独有的），Windows 这边做不出来。

```bash
npm run build:mac                # 两个架构都打（在 mac 上跑）
npm run build:mac -- --arm64     # 只打 M 系列
npm run build:mac -- --x64       # 只打 Intel
```

产物 `dist/FitnessLog-2.1.0-arm64.dmg` / `-x64.dmg`，脚本会自动往桌面复制一份。没有 Mac 的话，把仓库推到 GitHub，用 `.github/workflows/build-mac.yml` 借苹果机器打，产物在 Actions 里下载。完整步骤（含首次打开被 Gatekeeper 拦、卸载、数据目录）见 **[docs/BUILD-MAC.md](docs/BUILD-MAC.md)**。

mac 那边专门处理过的地方：

- `build/icon.icns`：`scripts/make-icns.py` 手写 ICNS 容器（Windows 没有 `iconutil`），图形四周留 10% 透明边 + 淡投影，贴近苹果图标的画法
- 菜单栏：Windows 上 `Menu.setApplicationMenu(null)`，mac 上必须留菜单，否则输入框里 `Cmd+C/V/Z` 全失效；`Cmd+R` / `Cmd+Shift+I` 也一起认
- `scripts/after-pack.js`：打完包补一层 ad-hoc 签名，不然 Apple Silicon 双击直接报「已损坏」；有正式证书时自动跳过
- 升级 / 卸载改文案：mac 上「选择 dmg 升级」走挂载 + 拖拽，不再 spawn `/S`；设置页卸载按钮只给「拖进废纸篓」的提示
- 字体栈把 `PingFang SC / Hiragino Sans GB` 提到 `SimHei` 前面，mac 上中文不会掉到衬线

## AI 接入

给本机 agent 一个**只读**入口，两种取数方式：

1. **本地 HTTP 接口**（应用开着就生效，只绑 127.0.0.1，端口从 47821 开始，占用了自动加一）

| 接口 | 内容 |
|---|---|
| `GET /health` | 版本、端口、是否已就绪 |
| `GET /snapshot` | 全量快照：档案、动作池、一周安排、全部记录 |
| `GET /records` | 全部记录，按日期分组 |
| `GET /records?date=2026-11-23` | 单天记录 |
| `GET /plan` | 一周安排（0=周日 … 6=周六） |
| `GET /actions` | 动作池 |

2. **快照文件**：渲染层每次数据变化都会把快照推给主进程，主进程写一份到 `app.getPath("userData")`，也就是

```
%APPDATA%/fitness-log-generator/agent-snapshot.json
```

字段：`records[YYYY-MM-DD]` 是数组，每条含 `savedAt`（毫秒时间戳）、`text`（可直接粘贴的训练文本）、`items`（`name` 动作名、`group` 部位、`isKey` 是否关键重量、`loads` 里的 `weight / sets / reps`）。`profile` 里带 `startDate / daysSinceStart / trainDays / trainDaysManual / recordCount / trainedDays / setsPresets / repsPresets`。

设置 → AI 接入 里有「复制地址」「复制路径」「打开」「复制说明」四个按钮，最后那个会生成一段现成的接入提示词，粘给 agent 就能用；记录总览的「今天」下面也有一个「复制接入说明」，点 × 可以关掉那条提示。

## 版本号怎么升

一条命令：

```bash
npm run bump 2.1.2          # 加 -- --dry 只看会改哪，不写盘
```

它会同步 `package.json` 的 `version`（exe 的文件版本就取这里）、`update.json` 的 `version`、`src/index.html` 里的 `<title>` / `versionChip` / `APP_VERSION` / `RELEASE_VERSION`，以及 `scripts/check.js` 里两处 mock。**这七处漏一个就会出现「界面还是旧号、安装包属性是新号」**，所以别再手改了。

脚本不管的两件，升完自己补：`update.json` 的 `notes` 写一句这个版本改了什么；README 里的版本示例（`dist` 文件名那些）按需更新。

## 数据存在哪

渲染层的数据都在 localStorage，落盘位置：

```
%APPDATA%/fitness-log-generator/Local Storage/leveldb
```

| 键 | 内容 | 说明 |
|---|---|---|
| `fitness-log-v1` | 当前未完成的编排（动作、重量、组数、备注、有氧分段、耗能评级） | 自动保存，关掉再打开还在 |
| `fitness-log-records-v2` | 按日期归档的正式记录，键是 `YYYY-MM-DD` | 只在点「保存本次训练」时写入 |
| `fitness-log-custom-actions-v1` | 「添加动作」新建的自建动作 | 与内置动作合并成动作池 |
| `fitness-log-hidden-actions-v1` | 「编辑动作」里删掉的自带动作 id | 启动时从 `BASE_ACTIONS` 里剔掉；删空/恢复自带动作时清掉 |
| `fitness-log-week-plan-v1` | 一周七天的动作安排 | 首次打开按默认训练日种一份 |
| `fitness-log-settings-v1` | 两个开关 + `startDate` + `setsPresets` / `repsPresets` + `manualTrainDays` | 起点算「健身已经」天数；两个数组是快速预选值；`manualTrainDays` 为 `null` 表示自动 |
| `fitness-log-chat-lines-v1` | Repy 的台词清单（改过才写这个键） | 没有这个键就读 `CHAT_DEFAULTS` 的自带 9 句 |
| `feature-week-plan-seen-v1` | 新功能浮条是否已关 | 关过就不再弹 |
| `overview-ai-strip-hidden-v1` | 总览里的 AI 接入条是否已关 | 关过就不再出现 |
| `release-seen-version` | 已读过的更新日志版本 | 决定启动时是否弹窗 |

同一天可以保存多次，总览里会显示成「2 次保存」并各自带时间。升级 exe 不会清空。想彻底重来，删掉上面那个 leveldb 目录即可（数据文件夹路径在设置 → AI 接入里能直接复制/打开）。

## 三个已经踩过的坑（换机器/重装依赖时会再遇到）

1. **npm 装不上**：Electron 二进制默认从 GitHub 拉，国内常断；另外某些终端环境带 `ELECTRON_RUN_AS_NODE` 会把 Electron 变成纯 Node。
   做法：`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --ignore-scripts`，再把 [npmmirror](https://npmmirror.com/mirrors/electron/) 的 `electron-v33.4.11-win32-x64.zip` 解压到 `node_modules/electron/dist`，并写一个内容为 `electron.exe` 的 `path.txt`。
2. **winCodeSign 解压失败**（`Cannot create symbolic link`）：包里有 macOS 的 dylib 符号链接，普通用户没权限创建，而且 electron-builder 每次重试都换一个随机缓存目录，没法预置。
   做法：配置里 `win.signAndEditExecutable: false` 直接跳过这套工具，图标改由 `scripts/build-win.js` 调用缓存里的 `rcedit-x64.exe` 手动打。
3. **图标或版本信息没进 exe**：多半是第 2 条失败导致 rcedit 没跑，或者旧进程锁着文件。
   做法：先 `taskkill` 掉所有实例，再 `npm run build`。

> 另外：本机 shell 里若带 `ELECTRON_RUN_AS_NODE=1`，直接跑 exe 会当成 Node 秒退，命令行验证要写 `env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS`。
