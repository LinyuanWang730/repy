# AGENTS.md · 改这个仓库前的 30 秒

这个仓库里**有两个程序**，先确认改的是哪个，别改错文件：

| | 桌面版 Repy 2.1.2 | 小程序 RepyNeo 1.0.2 |
|---|---|---|
| 代码 | `src/index.html`（单文件，约 1.28 万行） | `repyneo/`（4 页 + 5 个 utils） |
| 索引 | `docs/代码地图.md` | `docs/代码地图-Neo.md` |
| 自检 | `scripts/check.js` | `npm run check:neo` |
| 版本号 | `npm run bump x.y.z[.w]`（10 个位置） | 手改三处，**不归 bump 管** |

1. **别整份读大文件**。先 `npm run where 关键词`（两个工程一起搜，标出【桌面版】/【小程序】、文件、所在函数、行号），拿到名字后**只读那 30–80 行**。
   - `npm run where 词 -- --neo` 只搜小程序；`--desk` 只搜桌面版；`--all` 列全命中
   - `npm run where -- --fn [词]` 函数 / 方法总表；`--css` 分区表；`--tree` 结构总览
   - 行号漂了：`npm run where -- --gen` 一次重算**两份**地图的自动附录
2. 想不起在哪：看对应的 `docs/代码地图*.md`（功能 → 文件 / 函数对照表 + 文末自动行号附录）。
3. 自检：小程序 `npm run check:neo`；改桌面版另跑桌面版自检，见其地图。
4. **新 CSS / WXSS 追加在文件末尾最后位置**，否则压不过前几轮的 `!important`。
5. `scripts/archive/` 是一次性旧补丁，**不要执行**；`.tmp-unpack/` 是临时解包副本，已被忽略。
6. 界面约定：中文旁不并排同义英文；同一机制不用三种方式重复表达；动作名和部位字统一深灰、卡底色才是部位索引纯色；所有直角统一同一弧度圆角；悬停 / 按下 / 选中都要有可见反馈。
7. **发布网站**：页面在 `site/`（落地页）+ `site/app/`（在线体验版）。改完跑 `npm run site:sync`，双击 `5-发布网站.bat` 上传。`site/app/index.html` 和落地页里 `RELEASES:BEGIN/END` 之间都是**脚本生成的，别手改**。安装包走 GitHub Releases（Pages 单文件上限 25 MiB），详见 `docs/发布网站.md`。
