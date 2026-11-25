# 一台 Windows、一台 Mac，代码怎么同步

这台机器上的仓库已经建好并提交了第一次：35 个文件、1.87 MB。`node_modules`（561 MB）和 `dist`（568 MB）都被排除在外 —— 它们各自在本地装、本地打，不进仓库。

## 先搞清楚一件事

**iCloud 是「文件同步」，Git 是「版本控制」，这两件事不是一回事。**

- iCloud 同步的是「此刻长什么样」。它不知道什么叫「昨天的版本」，也不知道什么叫「合并」。
- Git 管的是「每一次改动」。它能回退、能看差异、能说清哪一行是谁改的。

如果只靠 iCloud，两边的文件都动过，iCloud 的处理方式是**保留两份**（生成 `src/index 2.html` 这种文件），不会帮你合并。如果只用 Git，两台机器之间又需要一条「线」把提交传过去 —— 平时这条线是 GitHub，也可以把 iCloud 当成线。

所以下面三种做法，本质差别在于：**谁当那条「线」**。

## 三种做法对比

| | 做法 | 优点 | 缺点 | 适不适合你 |
|---|---|---|---|---|
| **A** | 整个文件夹放进 iCloud，`.git` 跟着一起同步 | 最直觉，两边文件自动一致，不用记命令 | **iCloud 不看 `.gitignore`**，会把 node_modules（561 MB）和 dist（568 MB）一起同步；`.git` 在同步中可能损坏 | 单人、一次只在一台机器上改、且能接受大目录同步 → 可以，但守纪律的成本高 |
| **B** | iCloud 里只放一个「裸仓库」，两台机器各自克隆 | 真正像 GitHub，有完整历史；iCloud 只同步 2.3 MB；生成物各自本地，永不互相同步 | 每台机器要 clone 一次，换机器要点一次同步脚本 | **已按这个建好** → 直接看下面 |
| **C** | GitHub 私有仓库当线，iCloud 不参与 | 最稳，有异地备份，还能白嫖 Actions 打 mac 包 | 要注册 GitHub；国内网络偶尔要梯子 | 想多一道保险 → 可以和 B 叠加 |

B 和 C 可以叠加：iCloud 放裸仓库做日常同步，GitHub 做异地备份。

## ⚠️ 一个必须先懂的区别

**`.gitignore` 只管 Git，不管 iCloud。**

Git 只会跟踪那 35 个源码文件（1.87 MB）。但 iCloud 同步的是**文件夹里实际存在的所有东西**，它根本不知道 `.gitignore` 是什么。

这个工程里有两块特别大的东西：

| 目录 | 体积 | 是什么 | 该不该进 iCloud |
|---|---|---|---|
| `node_modules/` | **561 MB** | npm 装的依赖，还分 Windows 版和 mac 版 | ❌ 绝对不要。几十万个小文件，iCloud 会同步到天荒地老；而且 Windows 那份到 Mac 上是废的 |
| `dist/` | **568 MB** | 打包出来的 exe / dmg | ❌ 不要。每打一次包就变一次，纯属给 iCloud 添堵 |

**一台机器只需要装一次 `node_modules`、打一次包。** 它们是「本地产物」，不是「共享代码」。

这就是为什么**做法 B 最省心** —— 它压根不把工作副本放进 iCloud，只让那 2.3 MB 的历史记录在云上走。

> **已按做法 B 建好，你只剩两步**：把桌面上的 `训练记录生成器.git` 拖进 iCloud，然后在 Mac 上 clone 一次（见下面「做法 B」的第 1、2 步）。做法 A 和 C 留作背景知识，不必现在动手。

---

# 做法 A：整个文件夹放进 iCloud（你想的那个）

## 第 0 步：先确认桌面是不是已经在 iCloud 里

macOS 有个「桌面与文档文件夹」同步开关。**如果开着，你现在桌面上这个文件夹，其实早就在 iCloud 里了**，什么都不用搬。

- **Mac 上查**：系统设置 → 你的 Apple 账户 → iCloud → iCloud 云盘 → 看「桌面与文档文件夹」是否勾选。
- **Windows 上查**：装了 iCloud for Windows 之后，看 `C:\Users\你的用户名\iCloudDrive` 里有没有「桌面」这个文件夹。

**已经开着 → 跳过第 1 步，直接看第 2 步的纪律。**

## 第 1 步：搬进去

### 如果 Windows 上没装 iCloud

1. 去微软商店搜 **iCloud**，或从 <https://support.apple.com/zh-cn/106016> 下载 Windows 版，装好、登录同一个 Apple 账户。
2. 装完打开它，勾选 **iCloud 云盘**。
3. 这时会出现 `C:\Users\28919\iCloudDrive`。
4. 把整个 `健身记录生成器` 文件夹**拖进去**。

拖之前先做一件事，能省你半小时：

```bash
# 在 Git Bash 里，把两个大目录临时移出去
cd "/c/Users/28919/Desktop/健身记录生成器"
mv node_modules ../_node_modules_bak
mv dist ../_dist_bak
```

拖完再移回来（或者干脆不装，到 iCloud 那份里重新 `npm install`）。**561 MB 的 node_modules 里有几十万个小文件，iCloud 同步它会卡很久**，而且 Mac 上完全用不了（是 Windows 版二进制）。

## 第 2 步：三条纪律（不守必踩坑）

### 纪律一：Mac 上必须关掉「优化 Mac 存储空间」

**这条最重要。** iCloud 为了省空间，会把不常看的文件「驱逐」成占位符（文件名后面带 `.icloud`，实际 0 字节）。Git 读到 0 字节的文件，直接报：

```
fatal: unable to read tree ...
error: 无法读取对象
```

**关法**：Mac 系统设置 → 你的账户 → iCloud → iCloud 云盘 → 点「优化 Mac 存储空间」旁边的**选项** → 选「**下载所有文件**」/ 关闭优化。

或者更彻底：在 Finder 里找到这个文件夹 → 右键 → **「始终保留在此设备上」**。

### 纪律二：一次只在一台机器上改

不要 Windows 上开着编辑器、Mac 上也开着。iCloud 会在两边来回写，最后变成三份冲突文件。

换机器之前：
1. 在这台 `git add -A && git commit -m "..."`（改动进了 `.git`）
2. **等 iCloud 同步图标转完**（Mac 菜单栏 / Windows 任务栏那个圆圈）
3. 在那台 `git status` 看一眼，是不是干净的

### 纪律三：每次换机器先看一眼状态

iCloud 同步有延迟，几秒到几分钟。刚在这边提交，立刻去那边 `git log` 可能还看不到。**等图标停转再动手。**

## 第 3 步：Mac 上第一次打开

```bash
# 1. 装 Node（LTS）+ Xcode 命令行工具
xcode-select --install

# 2. 进到 iCloud 里的项目文件夹
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/健身记录生成器

# 3. 确认 Git 认得出来（应该看到 35 个文件、干净状态）
git status

# 4. 装依赖（这里是 mac 版 Electron，和 Windows 那份不通用）
npm install

# 5. 开发预览
npm run dev

# 6. 打 dmg
npm run build:mac
```

⚠️ **如果 `git status` 报一堆文件被修改**（明明没动过），八成是换行符。跑一次：

```bash
git add --renormalize .
git status
```

还乱的话，说明 `.gitattributes` 没生效，检查文件是否还在。

## 第 4 步：以后每天的节奏

```bash
# 开工（在任何一台机器上）
git pull

# ...改代码...

# 收工
git add -A
git commit -m "加了 xxx"
```

因为两台机器共用同一个 `.git`（iCloud 在同步它），其实连 `pull` 都省了 —— 但要**等同步完成**。想看同步好没好，用 `git log` 对比两边最后一条提交是不是同一个。

---

# 做法 B：iCloud 里只放裸仓库（已按这个建好）

「裸仓库」就是**只有 `.git` 内容、没有工作文件的仓库**。它只存历史，2.3 MB、99 个文件，iCloud 同步起来毫无压力。两台机器各自 clone 一份，把它当 GitHub 用。

## 现状（Windows 这侧已全部完成）

裸仓库已经放进 iCloud，桌面那份工作副本的 `origin` 也指过去了：

```bash
$ git remote -v
origin  C:/Users/28919/iCloudDrive/训练记录生成器.git (fetch)
origin  C:/Users/28919/iCloudDrive/训练记录生成器.git (push)
```

| | 位置 | 体积 |
|---|---|---|
| 裸仓库（同步中枢） | `C:\Users\28919\iCloudDrive\训练记录生成器.git` | 2.3 MB / 99 文件 |
| Windows 工作副本 | `C:\Users\28919\Desktop\健身记录生成器` | 1.1 GB（含 node_modules） |
| Mac 工作副本 | 待创建 | 待创建 |

已经验证过的事：iCloud 里的裸仓库 `git fsck` 无损坏；从它 clone 出来 37 个文件、`src/index.html` 6607 行、`.command` 是 LF 且带执行位、`.bat` 是 CRLF、`node_modules` 和 `dist` 都没混进去。

**注意**：`node_modules` 和 `dist` 留在各自机器本地，这是故意的 —— 不要把它们挪进 iCloud。

## 第 1 步：确认 iCloud 已经传完（Windows）

Windows 任务栏右下角有个 iCloud 图标，点开看「最近同步」里 `训练记录生成器.git` 是否完成。2.3 MB 正常几秒就完。

**在上传完成之前，不要到 Mac 上去 clone** —— 会拿到残缺的仓库。

顺带确认两件事：

- 系统托盘 iCloud 图标 →「偏好设置」→ 勾选了「iCloud 云盘」
- **没有**勾选「桌面与文档文件夹」——一旦勾上，桌面那个 1.1 GB 的工程会被整个拖进 iCloud

## 第 2 步：Mac 上接上

```bash
# 1. 前置：Node + Xcode 命令行工具（打 dmg 需要 python3）
xcode-select --install

# 2. 从 iCloud 里的裸仓库克隆
cd ~
git clone ~/Library/Mobile\ Documents/com~apple~CloudDocs/训练记录生成器.git 训练记录生成器
cd 训练记录生成器

# 3. 装依赖（mac 版 Electron，第一次几分钟，之后一直存在）
npm install

# 4. 看看能不能跑
npm run dev
```

注意 `.command` 的可执行位 —— 仓库里已记录成 `100755`，clone 出来就能双击。万一不行：

```bash
chmod +x "3-打包出dmg（mac）.command"
```

## 第 3 步：以后每次切换

**不管开工还是收工，双击同一个脚本就行。** 它做三件事：提交本地改动 → 从裸仓库拉取 → 推送上去。

| 在哪台机器上 | 双击哪个 |
|---|---|
| Windows | `4-同步.bat` |
| Mac | `4-同步（mac）.command` |

两个脚本干的活一模一样，只是壳不同。Mac 上第一次双击如果提示「来自身份不明的开发者」，右键 → 打开 → 再点打开（只需一次）。

```bash
# 它们内部等价于
git add -A
git commit -m "你说的那句话"
git pull --rebase --autostash origin main
git push origin main
```

**顺序很重要**：先 commit 再 pull，改动会以你的提交身份参与 rebase；如果工作区脏着就 pull，git 会拒绝执行。脚本已经按这个顺序排好了。

**这套的好处**：

| | 整个文件夹进 iCloud | 裸仓库 |
|---|---|---|
| iCloud 同步量 | 1.1 GB、几十万文件 | **2.3 MB、99 文件** |
| `node_modules` | 两台机器互相覆盖，每换一次机器就得删掉重装 | **各自本地常驻，一次装好长期用** |
| `dist` | 每次打包 568 MB 全变，全部重传 | 不参与同步 |
| 工作副本出问题 | 代码可能变成两份待手工合并 | 代码在各自本地，iCloud 碰不到 |
| 代价 | 无（但要用对了才行） | 换机器要点一次同步脚本 |

---

# 做法 C：GitHub 私有仓库（最保险）

如果哪天 iCloud 真的把仓库搞坏了，`git fsck` 一通红字，你会庆幸有个异地备份。

```bash
# 1. 在 github.com 建一个 Private 仓库，别勾任何初始化文件
# 2. 接上
cd "/c/Users/28919/Desktop/健身记录生成器"
git remote add github https://github.com/你的用户名/健身记录生成器.git
git push -u github main
```

**额外好处**：仓库里已经有 `.github/workflows/build-mac.yml`，推上去之后 GitHub 会开一台真 Mac 帮你打 dmg，不用自己电脑跑。Actions 页面直接下载。

B + C 可以同时用：`origin` 指 iCloud（日常），`github` 指远端（备份）。

```bash
git push origin main && git push github main
```

---

# 排错表

| 现象 | 原因 | 处理 |
|---|---|---|
| `fatal: unable to read tree` | iCloud 把文件驱逐成占位符了 | Mac 上右键文件夹 →「始终保留在此设备上」；或关掉「优化 Mac 存储」 |
| 冒出一堆 `xxx 2.html`、`xxx 已冲突` | 两台机器同时改了同一个文件，iCloud 不合并 | 逐个对比删掉旧的那份，然后 `git add -A && git commit` |
| `AppleDouble`、`._开头的文件` | macOS 往非 APFS 卷写元数据 | 已在 `.gitignore` 里排除 `._*`，忽略即可 |
| `index.lock` 已存在 | 另一台机器的 git 正在写，或同步中断了 | 确认没别的 git 在跑，然后 `rm .git/index.lock` |
| `error: bad index file sha1 signature` | `.git` 同步到一半被打断 | 从备份恢复，或 `git clone` 一份新的（历史丢了但代码在） |
| Mac 上双击 `.command` 报 `bad interpreter` | 换行符变成 CRLF 了 | 已由 `.gitattributes` 锁定；手动修：`sed -i '' $'s/\r$//' "3-打包出dmg（mac）.command"` |
| Windows 上双击 `.bat` 一闪就没了 | 换行符变成 LF 了 | 同上反着来，检查 `.gitattributes` 里的 `*.bat text eol=crlf` |
| Mac 上提示「已损坏，无法打开」 | 没签名 + 隔离属性 | `xattr -dr com.apple.quarantine "/Applications/训练记录生成器.app"` |
| `git status` 明明没改却一堆 modified | 换行符被批量转换 | `git add --renormalize .` |
| iCloud 一直「正在上传」不动 | 遇到大文件或锁文件 | 检查是不是有 `dist/`、`node_modules/` 混进去了：`git status --ignored` |

## 万一仓库真坏了

代码文件本身永远是好的（iCloud 同步的只是文本）**，坏的只是 `.git` 里的历史**。急救：

```bash
# 1. 把 .git 挪开（别删，万一能救）
mv .git ../_git_broken

# 2. 重新建仓库，重新提交
git init -b main
git add -A
git commit -m "从损坏的仓库恢复"

# 3. 历史没了，但代码、图标、脚本一个都没少
```

这就是为什么建议至少加一道 GitHub 或本地 `git bundle` 备份：

```bash
# 把所有历史打成一个文件，扔网盘/移动硬盘
git bundle create ~/Desktop/健身记录生成器-backup-$(date +%Y%m%d).bundle --all
```

这个 `.bundle` 文件本身就是个完整仓库，`git clone xxx.bundle` 就能还原全部历史。
