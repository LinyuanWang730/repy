# 代码地图 · 小程序 RepyNeo

> 这份只回答一件事：**小程序要改的东西在哪**。桌面版看 [代码地图.md](代码地图.md)，功能怎么用看 [README](../README.md)。
> 两个工程共用一套定位器 `npm run where`，正文只写文件名和函数名，**行号一律看文末自动附录**（`npm run where -- --gen` 现算）。

## 两个工程，别改错文件

| | 桌面版 Repy | 小程序 RepyNeo |
|---|---|---|
| 版本 | 2.1.1 | 1.0.2 |
| 代码 | `src/index.html` 一个文件（约 1.28 万行） | `repyneo/` 下 4 页 + 5 个 utils，约 6000 行 |
| 索引 | [代码地图.md](代码地图.md) | 本文件 |
| 自检 | `scripts/check.js` | `scripts/check-repyneo.js` |
| 版本号 | `npm run bump x.y.z`（9 个位置） | 手改三处，**不归 bump 管** |

小程序和桌面版**共用同一套 `fitness-log-*` 数据键**、同一套动作 id，所以能互导记录与偏好；改动作池时注意两边对齐。

## 三层结构

```
壳   app.js（全局数据 jumpDate）   app.json（页面 + tabBar）   app.wxss（全局样式、主题变量）
 └── 页面   pages/{write,review,trend,settings}/  每页 4 件套：.js 逻辑 / .wxml 模板 / .wxss 样式 / .json
工具 utils/  store 存储 · pool 动作池 · util 纯函数 · calendar 月历 · handoff 导入导出
脚本 scripts/  check-repyneo.js 自检 · gen-repyneo-pool.js 生成动作池 · RepyNeo-Preview.bat 预览入口
```

页面路径写死在 `app.json` 的 `pages` / `tabBar`，**不要移动或改名页面目录**；小程序没有构建步骤，`require('../../utils/store')` 是相对路径，挪文件就会断。

## 找东西三步（省积分的关键）

```bash
npm run where 补记录                  # 1. 两个工程一起搜，标出【桌面版】/【小程序】、文件、所在函数、行号
npm run where 补记录 -- --neo         #    只搜小程序；--desk 只搜桌面版
npm run where -- --fn plan           # 2. 函数 / 方法总表（可按名字过滤）
npm run where -- --tree              #    项目结构总览：每个文件几行、干什么
npm run where -- --css               #    CSS / WXSS 分区表
npm run where -- --gen               # 3. 行号漂了就重算两份地图的附录
```

拿到方法名后按名定位，**别按行号记**。默认每个文件只列 12 条，`--all` 列全、`--limit=30` 调上限。

## 四页职责

| 页面 | 干什么 | 逻辑量 |
|---|---|---|
| `write` 撰写 | 选动作（点选 / 再点取消）、力量与有氧两套负荷、耗能评级、改一周安排、补记录提示条、保存 / 复制 / 回桌面版 | `write.js` 约 1040 行，方法最多 |
| `review` 复盘 | 页内完整月历（翻月 / 有记录染色 / 点选看当天）、补记录、记录按动作分组编辑（换动作 / 改重量 / 关键重量 / 删条）、「健身已经 N 天」 | `review.js` 约 585 行 |
| `trend` 趋势 | 添加 / 删除追踪动作、每个动作一张重量折线图（canvas 2d） | `trend.js` 约 200 行 |
| `settings` 设置 | 预设数值、起点日、一周安排（就地编辑器）、自建动作、删除自带动作、偏好 / 记录的导入导出、清空记录（两层确认）、补记录提示开关 | `settings.js` 约 640 行 |

## 功能 → 位置

| 想改的东西 | 位置 |
|---|---|
| 顶栏机器人、两行气泡 | `write.wxml` 顶部 + `write.js` 的 `data.botLine`；全局样式 `app.wxss` 的 `.bot-avatar` / `.bot-bubble`（`white-space: pre-line` 才换行） |
| 动作点选 / 取消、动作池展开与搜索 | `write.js` 的 `addAction()` / `togglePool()` / `poolViewWith()` / `setGroup()`；模板 `write.wxml` 的 `plan-grid` / `pool-list` |
| 动作池、部位、索引色 | `utils/pool.js` 的 `BASE_ACTIONS` / `GROUPS` / `groupColor()` / `groupTint()`；颜色**改两处**：`pool.js` 的 `GROUPS[].color` + `app.wxss` 的 `.group-*`（「腹/核心」类名要写 `.group-腹\/核心`） |
| 力量 / 有氧两套负荷 | `write.js` 的 `decorateEntry()` / `buildItems()` / 各 `input*` / `addSegment()`；`utils/util.js` 的 `formatLoad()` / `formatSeg()` / `textFromItems()` 负责拼文案；判据是 `action.type === "cardio"` |
| 力量动作的多组重量（1.0.2） | `write.js` 的 `addLoad()` / `removeLoad()` / `scrollToLoad()`；模板 `write.wxml` 力量块底部的「＋ 新增重量 / 组次」和每组一个 `load-head`（两组以上才出「第 N 组 + 删」）。新加的那组沿用上一条的 `sets` / `setsExplicit` / `target`，重量与次数留空；只剩一组时删不掉。桌面版对应 `src/index.html` 的 `addLoad()` / `removeLoad()` / `selectedCardHtml()` 里那句「＋ 新增重量 / 组次」 |
| 耗能评级（plus 步） | `write.js` 的 `effortView()` / `setEffort()`；`utils/util.js` 的 `EFFORT_STAGES` / `clampEffort()` / `effortInfo()` |
| 保存 / 复制 / 回桌面版 | `write.js` 的 `saveRecord()` / `copyText()` / `continueInRepy()`；`utils/handoff.js` 的 `buildPayload()` / `writePayload()` / `shareFile()` |
| 改一周安排（七天一起改、照抄、清空、筛选、搜索） | **两处各有一套同构编辑器**：`write.js` 与 `settings.js` 的 `openPlanEdit()` / `planDraftDay()` / `renderPlanEdit()` / `clearPlanPicked()` / `togglePlanCopy()` / `copyPlanFrom()` / `setPlanFilter()` / `savePlanEdit()`，弹窗都在各自 wxml 的 `planEditOpen`。改其中一套的逻辑后，另一套要同步 |
| 补记录 | `utils/store.js` 的 `loadBackfill()` / `saveBackfill()` / `clearBackfill()`；`review.js` 的 `toggleBackfill()` / `pickDay()` / `renderCalendar()`；`write.js` 的 `syncBackfill()` / `backfillLabelOf()` / `saveRecord()`（写进选中那天并打 `backfill:true`）。日期经 `app.js` 的 `jumpDate` 传页 |
| 复盘月历 | `utils/calendar.js` 的 `monthStart()` / `shiftMonth()` / `buildMonth()`；`review.js` 的 `renderCalendar()` / `shiftMonth()` / `goToday()` |
| 复盘记录分组、换动作 | `review.js` 的 `loadView()` / `mutateRecord()` / `groupItems` 段；换动作弹窗 `openSwap()` / `swapView()` / `pickSwap()`（`swapOpen`） |
| 复盘改重量 / 组数 / 备注 | `review.js` 的 `openLoadEdit()` / `leInput()` / `leSetsStep()` / `leRepMode()` / `saveLoadEdit()`（`leOpen`） |
| 关键重量 | `review.js` 的 `askRecordKey()` / `applyRecordKey()` / `clearRecordKey()`；`write.js` 的 `toggleKey()`（标记后插到最后一个关键动作之后） |
| 「健身已经 N 天」、起点日 | `review.js` 的 `pickStart()` / 统计段；`settings.js` 的 `pickStartDate()` / `clearStartDate()`；`utils/store.js` 的 `recordStats()` |
| 趋势折线图 | `trend.js` 的 `build()` / `drawChart()`；添加与删除 `openPicker()` / `savePicker()` / `removeTracked()`；`utils/store.js` 的 `loadTrend()` / `saveTrend()`（默认空列表，不预填动作） |
| 设置 · 动作池管理 | `settings.js` 的 `openAdd()` / `submitAdd()` / `openManage()` / `removePoolAction()` / `restoreBuiltin()` / `removeAction()`；`utils/store.js` 的 `addCustomAction()` / `removeAction()` / `restoreBuiltin()`（自带动作删了进隐藏列表，不动已存记录） |
| 设置 · 导入导出 | 偏好：`settings.js` 的 `exportPrefs()` / `importPrefs()` / `applyPrefs()`（自建动作按 id + 同名同部位合并，不再整体替换）；记录：`exportRecords()` / `importRecords()` / `applyRecords()` → `writeRecords(incoming, policy)`，冲突时 `dupKeep()` / `dupOver()` / `cancelDup()` 走判重弹窗；清空 `clearAllRecords()`。判重函数 `recordSigns()` / `findSameRecord()` 在文件顶部。**桌面版对应功能在 `src/index.html` 设置页的「RepyNeo 偏好」卡** |
| 预设、补记录提示开关 | `settings.js` 的 `inputSets()` / `saveSets()` / `inputReps()` / `saveReps()` / `toggleSetting()`；`utils/store.js` 的 `loadSettings()` / `saveSettings()` |
| 全局样式 / 主题变量 | `app.wxss`（`--name-ink` / `--part-ink` / `--r` 等变量，以及 `.chip` / `.group-tab` / `.picker-name` 等通用类） |
| 版本号 1.0.2 | 手改三处：`app.js`、`pages/settings/settings.js` 的 `data.version`、`utils/handoff.js` 的 `version` 默认值。**只允许设置页显示版本号**，自检会扫其它页面 |

## 本地数据键（`utils/store.js` 的 `KEYS`）

| 键 | 存什么 |
|---|---|
| `fitness-log-v1` | 当前编排草稿（含 `effort`） |
| `fitness-log-records-v2` | 全部训练记录（按日期分组） |
| `fitness-log-custom-actions-v1` | 自建动作 |
| `fitness-log-week-plan-v1` | 一周安排 |
| `fitness-log-settings-v1` | 预设、起点日、补记录提示开关 |
| `fitness-log-hidden-actions-v1` | 被删掉的自带动作 id |
| `fitness-log-trend-v1` | 趋势页追踪的动作 |
| `fitness-log-backfill-v1` | 补记录状态（`armed` / `date`） |
| `fitness-log-seeded` | 首次启动的标记 |

键名与桌面版保持一致，别擅自加前缀。改存储结构要同时看 `handoff.js` 的导出与桌面版的导入。

## 弹窗清单

| 页面 | 弹窗（wxml 里的 `wx:if`） |
|---|---|
| `write` | `noteOpen` 备注、`addOpen` 新建动作、`planEditOpen` 改一周安排、`planCopyOpen` 照抄菜单、`poolOpen` 动作池展开 |
| `review` | `swapOpen` 换动作、`leOpen` 改重量 |
| `trend` | `pickerOpen` 添加动作 |
| `settings` | `addOpen` 新建动作、`manageOpen` 删除自带动作 |

四个挑动作的弹窗（撰写改安排、复盘换动作、设置删自带动作、设置编辑某天已并入撰写）都带「全部 + 七部位」筛选条；改筛选样式看各页 `.group-tab`。

## 界面硬约定（改之前先看，别又改回去）

1. **中文旁边不并排同义英文**；同一个机制别用倒计时、圆点、文字三遍重复表达。
2. 浅蓝 JR0 主题；所有直角统一同一弧度 `var(--r)`；悬停 / 按下 / 选中都要有可见反馈。
3. **部位索引色是整块高透明度纯色块，不用左侧细色条**；贴在卡片边缘的内部横条只保留靠外那一侧圆角。
4. **任何界面的动作名与训练部位字都是深灰** `--name-ink #39434e` / `--part-ink #4d5863`，**不是**索引色；卡底色才是部位索引纯色，折线才是部位色。自检第 7 节会抓 `color:{{...}}` 回退。
5. 部位筛选选项卡是**圆角矩形**（`var(--r)`），不是胶囊。
6. **新 WXSS 追加在文件末尾**，写早了压不过前面几轮的 `!important`。WXSS 按页隔离，同一个类要在用到的每一页都写。
7. 版本号只出现在设置页；`wxml` 注释里也别写 `V2.1.1` 之类字样，自检第 4 节会拦。

## 改完怎么验

| 改动 | 验法 |
|---|---|
| 任何小程序改动 | `npm run check:neo`（即 `node scripts/check-repyneo.js`）：JSON 合法、js 语法、wxml 绑定的方法都存在、版本号位置、固定台词、补记录 / 改安排 / 深灰 / 圆角断言 |
| 看界面 | 微信开发者工具里点「编译」；一键启动用根目录 `RepyNeo-Preview.bat`（配 `repyneo-launch.ps1`，自动找中文安装路径） |
| 交互逻辑 | 用 Node 冒烟：`Page()` 挂桩后调方法，验证补记录落点、照抄、一键清空、筛选等状态机（静态自检抓不到运行时问题） |
| 动到桌面版 | 另跑桌面版自检，见 [代码地图.md](代码地图.md) |

`check-repyneo.js` 的断言是照着**当时**的界面写的，大改布局时先失败是正常的，顺手把断言改成符合新布局即可；但第 3 节「wxml 绑定的方法必须存在」永远不能删。

## 脚本分区

```
scripts/
  where.js                 双工程定位器（桌面版 + 小程序共用）
  check-repyneo.js         小程序静态自检
  gen-repyneo-pool.js      从桌面版动作池生成小程序 pool.js
  make-repyneo-tabs.py     生成 8 张 tab 图标
  shot-neo.js              小程序截图
  check.js / bump.js / bake-chat.js / build-*.js   桌面版工具（bump 只管桌面版版本号）
  archive/                 历史一次性补丁，只读，别执行
根目录
  RepyNeo-Preview.bat      双击：启动微信开发者工具打开本工程（配 repyneo-launch.ps1）
  docs/代码地图-Neo.md     本文件
```

## 自动附录

<!-- INDEX:BEGIN 此段由 npm run where -- --gen 生成，手改会被覆盖 -->
更新时间：2026/11/25 18:21:45

**文件清单**（代码文件 28 个）
- `repyneo/app.js`　17 行 · 方法 1
- `repyneo/app.json`　51 行
- `repyneo/app.wxss`　562 行 · 分区 11
- `repyneo/minitest/test.config.json`　3 行
- `repyneo/pages/review/review.js`　585 行 · 方法 35 · 分区 20
- `repyneo/pages/review/review.json`　5 行
- `repyneo/pages/review/review.wxml`　166 行 · 绑定 34 · 弹窗 2
- `repyneo/pages/review/review.wxss`　468 行 · 分区 7
- `repyneo/pages/settings/settings.js`　818 行 · 方法 51 · 分区 18
- `repyneo/pages/settings/settings.json`　5 行
- `repyneo/pages/settings/settings.wxml`　290 行 · 绑定 47 · 弹窗 5
- `repyneo/pages/settings/settings.wxss`　409 行 · 分区 7
- `repyneo/pages/trend/trend.js`　201 行 · 方法 10 · 分区 5
- `repyneo/pages/trend/trend.json`　5 行
- `repyneo/pages/trend/trend.wxml`　64 行 · 绑定 7 · 弹窗 1
- `repyneo/pages/trend/trend.wxss`　117 行
- `repyneo/pages/write/write.js`　1039 行 · 方法 75 · 分区 21
- `repyneo/pages/write/write.json`　5 行
- `repyneo/pages/write/write.wxml`　292 行 · 绑定 60 · 弹窗 5
- `repyneo/pages/write/write.wxss`　730 行 · 分区 15
- `repyneo/project.config.json`　48 行
- `repyneo/project.private.config.json`　22 行
- `repyneo/sitemap.json`　10 行
- `repyneo/utils/calendar.js`　54 行 · 方法 3 · 分区 1
- `repyneo/utils/handoff.js`　120 行 · 方法 6 · 分区 2
- `repyneo/utils/pool.js`　151 行 · 方法 3 · 分区 2
- `repyneo/utils/store.js`　350 行 · 方法 28 · 分区 11
- `repyneo/utils/util.js`　145 行 · 方法 15 · 分区 2

**四页方法**
- **review**（35 个方法）　sinceDaysFrom·L18　itemKeyOf·L27　emptyStrengthLoad·L31　emptyCardioLoad·L35　groupItems·L40　onLoad·L116　onShow·L122　loadView·L137　mutateRecord·L174　renderCalendar·L187　shiftMonth·L208　pickDay·L213　toggleBackfill·L230　goToday·L251　pickStart·L258　deleteRecord·L270　deleteRecordItem·L287　askRecordKey·L316　applyRecordKey·L328　clearRecordKey·L351　openSwap·L369　swapView·L383　closeSwap·L399　inputSwapSearch·L403　setSwapFilter·L407　pickSwap·L416　openLoadEdit·L442　closeLoadEdit·L480　leInput·L486　leNoteInput·L503　leEachSide·L507　leSetsStep·L516　leRepMode·L527　leUnit·L543　saveLoadEdit·L552
- **settings**（51 个方法）　parsePresets·L10　recordSigns·L20　findSameRecord·L28　onLoad·L89　onShow·L93　loadAll·L99　toggleSetting·L145　inputSets·L153　inputReps·L157　saveSets·L161　saveReps·L169　pickStartDate·L177　clearStartDate·L184　openPlanEdit·L195　planDraftDay·L208　renderPlanEdit·L212　closePlanEdit·L266　pickPlanDay·L272　inputPlanName·L279　setPlanFilter·L285　inputPlanSearch·L291　togglePlanItem·L297　removePlanPicked·L307　clearPlanPicked·L315　togglePlanCopy·L322　copyPlanFrom·L328　savePlanEdit·L342　removeAction·L364　restoreBuiltin·L379　openManage·L387　manageView·L396　closeManage·L408　setManageFilter·L412　removePoolAction·L421　openAdd·L440　closeAdd·L444　inputAddName·L448　pickAddGroup·L452　submitAdd·L456　exportPrefs·L470　importPrefs·L520　applyPrefs·L541　exportRecords·L626　importRecords·L667　applyRecords·L688　writeRecords·L726　dupKeep·L772　dupOver·L776　cancelDup·L780　finishDup·L785　clearAllRecords·L793
- **trend**（10 个方法）　weightOf·L6　onLoad·L20　onShow·L24　build·L30　drawChart·L77　openPicker·L156　closePicker·L168　togglePick·L172　savePicker·L186　removeTracked·L194
- **write**（75 个方法）　emptyLoad·L16　onLoad·L88　onShow·L104　syncBackfill·L114　backfillLabelOf·L123　cancelBackfill·L128　decorateEntry·L138　renderEntry·L151　previewText·L181　summaryText·L192　effortView·L203　dayTabsView·L222　planView·L234　groupTabsView·L257　poolView·L266　syncAll·L288　refreshText·L312　persist·L321　setDay·L337　addAction·L343　togglePool·L370　inputSearch·L374　poolViewWith·L378　setGroup·L399　groupTabsViewWith·L408　removeAction·L414　moveAction·L420　clearAll·L433　toggleKey·L449　openNote·L470　inputNote·L477　saveNote·L481　closeNote·L488　findLoad·L493　inputWeight·L500　inputSameRep·L507　inputRep·L515　inputSpec·L523　inputPace·L530　inputExtra·L537　setPaceUnit·L544　toggleEachSide·L552　setSets·L559　applySetsPreset·L569　applyRepsPreset·L579　toggleRepMode·L593　addLoad·L609　removeLoad·L632　scrollToLoad·L644　addSegment·L665　removeSegment·L680　setEffort·L693　buildItems·L708　saveRecord·L736　copyText·L776　continueInRepy·L788　openAdd·L838　closeAdd·L842　inputAddName·L846　pickAddGroup·L850　submitAdd·L854　openPlanEdit·L871　planDraftDay·L884　renderPlanEdit·L888　closePlanEdit·L942　pickPlanDay·L948　inputPlanName·L955　setPlanFilter·L961　inputPlanSearch·L967　togglePlanItem·L973　removePlanPicked·L983　clearPlanPicked·L991　togglePlanCopy·L998　copyPlanFrom·L1004　savePlanEdit·L1018

**工具层导出**
- `repyneo/utils/calendar.js`　monthStart、shiftMonth、buildMonth
- `repyneo/utils/handoff.js`　cleanLoad、cleanItems、buildPayload、fileNameFor、writePayload、shareFile
- `repyneo/utils/pool.js`　groupColor、groupTint、hexToRgba
- `repyneo/utils/store.js`　read、write、ensureStore、customActions、hiddenIds、actionList、findAction、addCustomAction、removeAction、restoreBuiltin、loadPlan、savePlan、prunePlan、loadSettings、saveSettings、loadDraft、saveDraft、pruneDraft、loadRecords、saveRecords、addRecord、removeRecord、recordStats、loadBackfill、saveBackfill、clearBackfill、loadTrend、saveTrend
- `repyneo/utils/util.js`　uid、pad2、dateKey、todayKey、parseDate、formatClock、formatDateCn、clampEffort、effortInfo、normalizeWeight、formatScheme、formatSeg、formatLoad、lineFor、textFromItems

**弹窗（wxml 的 mask + wx:if）**
- review/review.wxml　swapOpen、leOpen
- settings/settings.wxml　dupOpen、addOpen、manageOpen、planEditOpen、planCopyOpen
- trend/trend.wxml　pickerOpen
- write/write.wxml　poolOpen、noteOpen、addOpen、planEditOpen、planCopyOpen

**本地数据键**（store.js 实测）
- `fitness-log-v1`
- `fitness-log-records-v2`
- `fitness-log-custom-actions-v1`
- `fitness-log-week-plan-v1`
- `fitness-log-settings-v1`
- `fitness-log-hidden-actions-v1`
- `fitness-log-trend-v1`
- `fitness-log-backfill-v1`
- `fitness-log-seeded`
<!-- INDEX:END -->
