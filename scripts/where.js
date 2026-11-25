#!/usr/bin/env node
/**
 * where.js —— 双工程定位器 / 索引器
 *
 * 解决的问题：桌面版 src/index.html 一万多行，小程序 repyneo/ 二十多个文件，
 * 改一个字就把整份读进来太贵。先问「这个关键词在哪」，只读命中的那几行。
 *
 *   npm run where 气泡                两个工程一起搜，按工程 / 文件分组
 *   npm run where 气泡 -- --neo       只搜小程序
 *   npm run where 气泡 -- --desk      只搜桌面版
 *   npm run where 气泡 -- --all       命中全部列出（默认每文件 12 条）
 *   npm run where 气泡 -- --limit=30  自定义每文件上限
 *   npm run where -- --fn [关键词]    函数 / 方法总表
 *   npm run where -- --css            CSS / WXSS 分区表
 *   npm run where -- --tree           项目结构总览（文件 · 行数 · 职责 · 锚点数）
 *   npm run where -- --gen            重算两份代码地图的行号附录
 *
 * 行号会随改动漂移，所以地图正文只写函数名，行号由 --gen 现算。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DESK_TARGETS = ["src/index.html", "main.js", "preload.js", "scripts/check.js"];
const NEO_ROOT = "repyneo";
const NEO_EXT = /\.(js|wxml|wxss|json)$/;
const MAP_DESK = path.join(ROOT, "docs", "代码地图.md");
const MAP_NEO = path.join(ROOT, "docs", "代码地图-Neo.md");
const LIMIT = 12;

/* --tree 用的职责表：一眼看懂每个文件是干嘛的 */
const ROLES = {
  "src/index.html": "桌面版全部业务代码（style / HTML / script 三段）",
  "main.js": "Electron 主进程：窗口、热更新、覆盖升级、AI 接口",
  "preload.js": "渲染层唯一能碰的主进程能力（IPC 白名单）",
  "scripts/check.js": "桌面版自检 + 截图",
  "scripts/where.js": "本定位器（双工程索引）",
  "scripts/check-repyneo.js": "小程序静态自检：JSON / 语法 / 绑定 / 断言",
  "scripts/gen-repyneo-pool.js": "从桌面版动作池生成小程序 pool.js",
  "scripts/bump.js": "一键同步桌面版版本号（9 个位置）",
  "scripts/bake-chat.js": "把用户改过的台词烘进源码",
  "repyneo/app.js": "小程序全局数据（jumpDate / planEditorDay）",
  "repyneo/app.json": "页面注册 + tabBar 四页",
  "repyneo/app.wxss": "全局样式、主题变量、通用组件类",
  "repyneo/project.config.json": "开发者工具工程配置（AppID）",
  "repyneo/utils/store.js": "本地存储层：全部数据键 + 记录 / 偏好读写",
  "repyneo/utils/pool.js": "动作池：BASE_ACTIONS / GROUPS / 部位色",
  "repyneo/utils/util.js": "日期、耗能评级、文案拼装等纯函数",
  "repyneo/utils/calendar.js": "月历格子构建",
  "repyneo/utils/handoff.js": "记录导入导出（与桌面版互通）"
};
const PAGE_ROLE = {
  write: "撰写：选动作 / 负荷编排 / 耗能评级 / 改一周安排 / 补记录提示条",
  review: "复盘：月历 + 补记录 + 记录分组编辑 / 换动作 / 改重量 / 关键重量",
  trend: "趋势：添加动作 / 删除 / 重量折线图",
  settings: "设置：偏好 / 动作池 / 记录与偏好导入导出 / 清空"
};

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith("--")));
const words = args.filter(a => !a.startsWith("--"));
const keyword = words.join(" ").trim();
const all = flags.has("--all");
const limitArg = (args.find(a => a.startsWith("--limit=")) || "").split("=")[1];
const limit = Number(limitArg) || LIMIT;
const onlyNeo = flags.has("--neo");
const onlyDesk = flags.has("--desk");

/* ---------- 读文件 ---------- */
function load(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  return { rel, lines };
}

function collectNeo() {
  const dir = path.join(ROOT, NEO_ROOT);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = sub => {
    const abs = path.join(dir, sub);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = sub ? `${sub}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === "assets" || e.name === "node_modules") continue;
        walk(rel);
      } else if (NEO_EXT.test(e.name)) {
        out.push(`${NEO_ROOT}/${rel}`);
      }
    }
  };
  walk("");
  return out.sort();
}

function files() {
  const list = [];
  if (!onlyNeo) DESK_TARGETS.forEach(rel => {
    const f = load(rel);
    if (f) { f.group = "桌面版"; list.push(f); }
  });
  if (!onlyDesk) collectNeo().forEach(rel => {
    const f = load(rel);
    if (f) { f.group = "小程序"; list.push(f); }
  });
  return list.map(f => { f.anchors = buildAnchors(f.rel, f.lines); return f; });
}

/* ---------- 建索引：分区 / 页面 / 函数 / 方法 / 绑定 / 弹窗 ---------- */
const JS_KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return", "else", "do", "try", "with"]);

function cleanComment(t) {
  return t.replace(/^\/\*+|\*+\/$/g, "").replace(/^[\s=—-]+|[\s=—-]+$/g, "").trim();
}

function buildAnchors(rel, lines) {
  const anchors = [];
  const ext = path.extname(rel);
  const isNeo = rel.startsWith(NEO_ROOT + "/");
  const isHtml = rel.endsWith(".html");
  const isNeoJs = isNeo && ext === ".js";
  const isWxml = ext === ".wxml";
  const isWxss = ext === ".wxss";
  const styleStart = isHtml ? lines.findIndex(l => l.trim().startsWith("<style")) : -1;
  const styleEnd = isHtml ? lines.findIndex(l => l.trim().startsWith("</style>")) : -1;
  const scriptStart = isHtml ? lines.findIndex(l => l.trim().startsWith("<script")) : -1;
  const inJs = i => (isHtml ? (scriptStart >= 0 && i > scriptStart) : true);

  lines.forEach((line, i) => {
    const n = i + 1;
    const t = line.trim();
    const isSectionComment = t.startsWith("/*") && t.endsWith("*/") && t.length < 110;

    // CSS / WXSS 分区注释
    const inStyle = isHtml && styleStart >= 0 && i > styleStart && (styleEnd < 0 || i < styleEnd);
    if ((inStyle || isWxss) && isSectionComment) {
      const name = cleanComment(t);
      if (name) anchors.push({ line: n, kind: "CSS", name });
      return;
    }

    // WXML 注释分区（<!-- 新建动作弹窗 --> 这类）
    if (isWxml && /^<!--[\s\S]*-->$/.test(t)) {
      const name = t.replace(/^<!--+|--+>$/g, "").trim();
      if (name && name.length < 60) { anchors.push({ line: n, kind: "区块", name }); return; }
    }

    // WXML 弹窗与事件绑定：弹窗优先（mask 行往往同时带 bindtap）
    if (isWxml) {
      const modal = t.match(/wx:if="\{\{([A-Za-z0-9_]+)\}\}"/);
      if (modal && /class="mask/.test(t)) { anchors.push({ line: n, kind: "弹窗", name: modal[1] }); return; }
      const floating = t.match(/wx:if="\{\{([A-Za-z0-9_]+Open)\}\}"/);
      if (floating) { anchors.push({ line: n, kind: "弹窗", name: floating[1] }); return; }
      const binds = [...t.matchAll(/\b(?:bind|catch)(?:tap|change|input|blur|confirm|longpress|submit)\s*=\s*"([^"]+)"/g)];
      if (binds.length) {
        binds.forEach(b => anchors.push({ line: n, kind: "绑定", name: b[1] }));
        return;
      }
    }

    // JS 大段注释分区
    if ((inJs(i) || isNeoJs) && isSectionComment) {
      const name = cleanComment(t);
      if (name && name.length < 80) { anchors.push({ line: n, kind: "分区", name }); return; }
    }

    // 标准函数 function foo()
    const fn = t.match(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
    if (fn && (inJs(i) || isNeoJs)) { anchors.push({ line: n, kind: "函数", name: fn[1] + "()" }); return; }

    // 小程序 Page / data 块锚点：data 里的字段不该误挂到上一个函数头上
    if (isNeoJs && /^Page\(\{\s*$/.test(t)) { anchors.push({ line: n, kind: "区块", name: "Page" }); return; }
    if (isNeoJs && /^data:\s*\{\s*$/.test(t)) { anchors.push({ line: n, kind: "数据", name: "data" }); return; }

    // 小程序 Page({}) 里的对象方法：  addAction(event) {
    if (isNeoJs) {
      const m = line.match(/^ {2}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
      if (m && !JS_KEYWORDS.has(m[1])) { anchors.push({ line: n, kind: "方法", name: m[1] + "()" }); return; }
    }

    // 顶层常量
    const konst = t.match(/^const\s+([A-Z][A-Z0-9_]{2,})\s*=/);
    if (konst && (inJs(i) || isNeoJs)) { anchors.push({ line: n, kind: "常量", name: konst[1] }); return; }

    // 主进程 IPC 通道
    const ipc = t.match(/ipcMain\.(?:handle|on)\(\s*"([^"]+)"/);
    if (ipc) { anchors.push({ line: n, kind: "IPC", name: ipc[1] }); return; }

    // 页面 / 面板锚点
    const dom = t.match(/^<(main|section|header|aside)\b[^>]*\bid="([^"]+)"/);
    if (dom) anchors.push({ line: n, kind: "区块", name: `#${dom[2]}` });
  });
  return anchors;
}

function anchorAt(anchors, line) {
  let found = null;
  for (const a of anchors) {
    if (a.line > line) break;
    found = a;
  }
  return found;
}

function countKind(f, kinds) {
  return f.anchors.filter(a => kinds.indexOf(a.kind) >= 0).length;
}

function roleOf(rel) {
  if (ROLES[rel]) return ROLES[rel];
  const m = rel.match(/\/pages\/(\w+)\/\1\.(js|wxml|wxss|json)$/);
  if (m) {
    const kind = { js: "逻辑", wxml: "模板", wxss: "样式", json: "页面配置" }[m[2]];
    return `${PAGE_ROLE[m[1]] || m[1]} · ${kind}`;
  }
  if (rel.endsWith(".json")) return "配置";
  return "";
}

/* ---------- 输出 ---------- */
function clip(s, n = 96) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function cmdSearch() {
  const data = files();
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  let total = 0;
  const blocks = [];

  for (const f of data) {
    const hits = [];
    f.lines.forEach((line, i) => { if (re.test(line)) hits.push(i + 1); });
    if (!hits.length) continue;
    total += hits.length;
    const show = all ? hits : hits.slice(0, limit);
    const rows = show.map(n => {
      const a = anchorAt(f.anchors, n);
      const where = a ? `${a.kind}·${a.name}` : "文件头";
      return `  L${String(n).padEnd(5)} ${where}  ${clip(f.lines[n - 1])}`;
    });
    const more = hits.length > show.length ? `  …还有 ${hits.length - show.length} 处（加 --all）` : "";
    blocks.push(`【${f.group}】${f.rel}  (${hits.length})\n${rows.join("\n")}${more ? "\n" + more : ""}`);
  }

  if (!total) {
    const scope = onlyNeo ? "小程序" : onlyDesk ? "桌面版" : "两个工程";
    console.log(`「${keyword}」${scope}都没找到。换个词，或 npm run where -- --fn 看函数总表。`);
    return;
  }
  console.log(blocks.join("\n\n"));
  console.log(`\n共 ${total} 处。只读了这些命中行，没整份加载。`);
}

function cmdFunctions() {
  const data = files();
  const kw = keyword ? keyword.toLowerCase() : "";
  const desk = data.filter(f => f.group === "桌面版" && f.rel === "src/index.html");
  const neo = data.filter(f => f.group === "小程序" && f.rel.endsWith(".js"));

  const rows = [];
  desk.forEach(f => {
    const list = f.anchors.filter(a => a.kind === "函数");
    const shown = kw ? list.filter(a => a.name.toLowerCase().includes(kw)) : list;
    if (shown.length) rows.push(`【桌面版】src/index.html 函数 ${shown.length} 个：\n` +
      shown.map(a => `  L${a.line}  ${a.name}`).join("\n"));
  });
  neo.forEach(f => {
    const list = f.anchors.filter(a => a.kind === "方法" || a.kind === "函数");
    const shown = kw ? list.filter(a => a.name.toLowerCase().includes(kw)) : list;
    if (shown.length) rows.push(`【小程序】${f.rel}  ${shown.length} 个：\n` +
      shown.map(a => `  L${a.line}  ${a.name}`).join("\n"));
  });
  console.log(rows.join("\n\n") || "没匹配到函数 / 方法。函数名是英文（renderCalendar 这种），中文关键词请直接 npm run where 关键词。");
  if (kw && !rows.length) console.log("提示：--fn 只搜名字，中文关键词请用普通搜索。");
}

function cmdCss() {
  const data = files();
  const kw = keyword ? keyword.toLowerCase() : "";
  const rows = [];
  data.forEach(f => {
    const list = f.anchors.filter(a => a.kind === "CSS");
    const shown = kw ? list.filter(a => a.name.toLowerCase().includes(kw)) : list;
    if (shown.length) rows.push(`【${f.group}】${f.rel}  ${shown.length} 个分区：\n` +
      shown.map(a => `  L${a.line}  ${a.name}`).join("\n"));
  });
  console.log(rows.join("\n\n") || "没有 CSS / WXSS 分区注释。");
}

function cmdTree() {
  const data = files();
  const groups = ["桌面版", "小程序"];
  console.log("Repy 工程结构（npm run where -- --tree）\n");
  console.log("两个程序、一套索引：桌面版 Repy 2.1.1 是单文件 Electron 应用，小程序 RepyNeo 1.0.1 是原生多文件工程。\n");
  groups.forEach(g => {
    const fs2 = data.filter(f => f.group === g);
    if (!fs2.length) return;
    console.log(`【${g}】${fs2.length} 个代码文件`);
    fs2.forEach(f => {
      const role = roleOf(f.rel);
      console.log(`  ${f.rel.padEnd(42)} ${String(f.lines.length).padStart(6)} 行  ${String(f.anchors.length).padStart(3)} 锚点  ${role}`);
    });
    console.log("");
  });
  console.log("常驻工具：");
  ["scripts/where.js", "scripts/check-repyneo.js", "scripts/check.js", "scripts/bump.js", "scripts/bake-chat.js"].forEach(rel => {
    console.log(`  ${rel.padEnd(32)} ${ROLES[rel] || ""}`);
  });
  console.log("\n先 where 定位 → 再只读那一段（30–80 行）。别整份打开。");
}

/* ---------- 生成两份地图的自动附录 ---------- */
const GROUP_NAMES = [
  "存储与状态", "记录 · 日历 · 总览", "编排 · 动作 · 动作池", "步骤条 · 复制 · 排序",
  "自己填数（日期 / 天数 / 预选 / 弹窗）", "一周安排 · 设置页", "AI 接入 · 快照 · 保存",
  "更新日志 · 气泡 · 导入 · 启动"
];

function deskIndexBody(data) {
  const html = data.find(x => x.rel === "src/index.html");
  const fns = html.anchors.filter(a => a.kind === "函数");
  const css = html.anchors.filter(a => a.kind === "CSS");
  const doms = html.anchors.filter(a => a.kind === "区块");
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });

  // 按函数实际行号自适应分 8 段（文件涨到多少行都不会漏函数）
  const per = Math.ceil(fns.length / GROUP_NAMES.length) || 1;
  const fnLines = GROUP_NAMES.map((name, gi) => {
    const inside = fns.slice(gi * per, (gi + 1) * per);
    if (!inside.length) return `- **${name}**（本段无函数）`;
    const a = inside[0].line, b = inside[inside.length - 1].line;
    const consts = html.anchors.filter(x => x.kind === "常量" && x.line >= a && x.line <= b);
    const head = consts.length ? `｜常量 ` + consts.map(x => `${x.name}·L${x.line}`).join("　") : "";
    return `- **${name}**（L${a}–L${b}，${inside.length} 个函数）${head}\n  ` +
      inside.map(f => `${f.name.replace("()", "")}·L${f.line}`).join("　");
  }).join("\n");

  return [
    `<!-- INDEX:BEGIN 此段由 npm run where -- --gen 生成，手改会被覆盖 -->`,
    `更新时间：${stamp}　·　共 ${html.lines.length} 行`,
    "",
    `**页面区块**：` + doms.map(d => `${d.name}·L${d.line}`).join("　"),
    "",
    `**JS 函数（按代码顺序粗分 8 段，行号现算）**`,
    fnLines,
    "",
    `**CSS 分区**`,
    css.map(c => `- L${c.line} ${c.name}`).join("\n"),
    `<!-- INDEX:END -->`
  ].join("\n");
}

function neoIndexBody(data) {
  const neo = data.filter(f => f.group === "小程序");
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const rows = neo.map(f => {
    const ms = countKind(f, ["方法", "函数"]);
    const binds = countKind(f, ["绑定"]);
    const parts = countKind(f, ["CSS", "分区"]);
    const modals = countKind(f, ["弹窗"]);
    const bits = [`${f.lines.length} 行`];
    if (ms) bits.push(`方法 ${ms}`);
    if (binds) bits.push(`绑定 ${binds}`);
    if (parts) bits.push(`分区 ${parts}`);
    if (modals) bits.push(`弹窗 ${modals}`);
    return `- \`${f.rel}\`　${bits.join(" · ")}`;
  });

  const pageRows = neo.filter(f => /\/pages\/.*\.js$/.test(f.rel)).map(f => {
    const ms = f.anchors.filter(a => a.kind === "方法" || a.kind === "函数");
    const page = path.basename(path.dirname(f.rel));
    return `- **${page}**（${ms.length} 个方法）　` + ms.map(a => `${a.name.replace("()", "")}·L${a.line}`).join("　");
  });

  const utilRows = neo.filter(f => /\/utils\/.*\.js$/.test(f.rel)).map(f => {
    const ms = f.anchors.filter(a => a.kind === "函数" || a.kind === "方法");
    return `- \`${f.rel}\`　${ms.map(a => a.name.replace("()", "")).join("、")}`;
  });

  const modalRows = neo.filter(f => f.rel.endsWith(".wxml")).map(f => {
    const ms = f.anchors.filter(a => a.kind === "弹窗");
    return ms.length ? `- ${f.rel.replace("repyneo/pages/", "")}　${ms.map(a => a.name).join("、")}` : null;
  }).filter(Boolean);

  const storeFile = neo.find(f => f.rel.endsWith("utils/store.js"));
  const keys = storeFile
    ? [...new Set((storeFile.lines.join("\n").match(/fitness-log-[a-z0-9-]+/g) || []))]
    : [];

  return [
    `<!-- INDEX:BEGIN 此段由 npm run where -- --gen 生成，手改会被覆盖 -->`,
    `更新时间：${stamp}`,
    "",
    `**文件清单**（代码文件 ${neo.length} 个）`,
    rows.join("\n"),
    "",
    `**四页方法**`,
    pageRows.join("\n"),
    "",
    `**工具层导出**`,
    utilRows.join("\n"),
    "",
    `**弹窗（wxml 的 mask + wx:if）**`,
    modalRows.join("\n") || "- 无",
    "",
    `**本地数据键**（store.js 实测）`,
    keys.map(k => `- \`${k}\``).join("\n") || "- 无",
    `<!-- INDEX:END -->`
  ].join("\n");
}

function writeIndex(doc, body) {
  if (!fs.existsSync(doc)) return false;
  const md = fs.readFileSync(doc, "utf8");
  const re = /<!-- INDEX:BEGIN[\s\S]*?<!-- INDEX:END -->/;
  if (!re.test(md)) return false;
  fs.writeFileSync(doc, md.replace(re, body), "utf8");
  return true;
}

function cmdGen() {
  const data = files();
  const okDesk = writeIndex(MAP_DESK, deskIndexBody(data));
  const okNeo = writeIndex(MAP_NEO, neoIndexBody(data));
  if (!okDesk) console.error(`没回写 ${path.relative(ROOT, MAP_DESK)}（缺 INDEX:BEGIN 标记或文件不存在）`);
  if (!okNeo) console.error(`没回写 ${path.relative(ROOT, MAP_NEO)}（缺 INDEX:BEGIN 标记或文件不存在）`);
  const html = data.find(x => x.rel === "src/index.html");
  const neo = data.filter(x => x.group === "小程序");
  console.log(`桌面版附录：函数 ${html.anchors.filter(a => a.kind === "函数").length} 个 · CSS 分区 ${html.anchors.filter(a => a.kind === "CSS").length} 个 · 区块 ${html.anchors.filter(a => a.kind === "区块").length} 个`);
  console.log(`小程序附录：${neo.length} 个文件 · 方法 ${neo.reduce((s, f) => s + countKind(f, ["方法", "函数"]), 0)} 个 · 绑定 ${neo.reduce((s, f) => s + countKind(f, ["绑定"]), 0)} 个`);
  if (okDesk && okNeo) console.log("两份 docs/代码地图*.md 已同步。");
}

/* ---------- 入口 ---------- */
if (flags.has("--gen")) cmdGen();
else if (flags.has("--tree")) cmdTree();
else if (flags.has("--css")) cmdCss();
else if (flags.has("--fn")) cmdFunctions();
else if (keyword) cmdSearch();
else {
  const data = files();
  console.log("Repy 双工程定位器\n");
  ["桌面版", "小程序"].forEach(g => {
    const fs2 = data.filter(f => f.group === g);
    const lines = fs2.reduce((s, f) => s + f.lines.length, 0);
    const anchors = fs2.reduce((s, f) => s + f.anchors.length, 0);
    console.log(`  ${g.padEnd(6)} ${String(fs2.length).padStart(2)} 个文件  ${String(lines).padStart(6)} 行  ${String(anchors).padStart(4)} 个锚点`);
  });
  console.log(`
用法：
  npm run where 关键词              两个工程一起搜，标出工程 / 文件 / 函数 / 行号
  npm run where 关键词 -- --neo     只搜小程序     --desk 只搜桌面版
  npm run where 关键词 -- --all     命中全部列出   --limit=30 自定义上限
  npm run where -- --fn [关键词]    函数 / 方法总表
  npm run where -- --css            CSS / WXSS 分区表
  npm run where -- --tree           项目结构总览（文件 · 行数 · 职责）
  npm run where -- --gen            重算两份 docs/代码地图*.md 的行号附录

习惯：先 where 拿到函数名，再只读那个函数（一般 30–80 行），别整份打开。`);
}
