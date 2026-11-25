# -*- coding: utf-8 -*-
"""
按 2026-11-24 第二批批注截图修改（可重复执行 / 一次性替换）：
  1. 顶部做成「整体的悬浮栏」：横贯内容区、滚动时固定，版本号和日历靠右
  2. 去掉气泡的「Repy 说」字样
  3. 气泡第二屏标题去掉重复的版本号，改成机器人自我介绍
  4. 去掉所有「只画了一部分边的粗色条」，全部改成完整圆角矩形
  5. 星期选项卡「有安排」不再用底部绿线，改用整块高透明度底色 + 加粗
同时同步 scripts/check.js。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "src" / "index.html"
CHECK = ROOT / "scripts" / "check.js"

s = HTML.read_text(encoding="utf-8")


def rep(old, new, tag, all_occurrences=False):
    global s
    if old not in s:
        raise SystemExit("[FAIL] 没找到：" + tag)
    n = s.count(old)
    s = s.replace(old, new, -1 if all_occurrences else 1)
    print("[ok]", tag, "(匹配 %d 处)" % n)


# ---------- 1. 顶部小胶囊 -> 整条悬浮栏 ----------
rep(
    "/* 版本号 + 日历：悬浮在内容区右上角，滚动时固定；只在「撰写」页出现 */\n"
    ".float-tools{\n"
    "  position:fixed;\n"
    "  top:12px;\n"
    "  right:calc(313px + 22px);\n"
    "  z-index:56;\n"
    "  display:flex;\n"
    "  align-items:center;\n"
    "  gap:8px;\n"
    "  padding:6px 8px;\n"
    "  background:rgba(255,255,255,.86);\n"
    "  border:1px solid var(--sky-line);\n"
    "  box-shadow:0 6px 18px rgba(23,69,110,.13);\n"
    "  backdrop-filter:blur(8px);\n"
    "}\n"
    "body.rb-closed .float-tools{right:22px}\n"
    ".float-tools[hidden]{display:none!important}\n"
    ".float-tools .cal-toggle{margin-left:0!important}\n"
    ".float-tools .version-chip{min-height:24px;padding:3px 9px 2px!important}\n"
    ".float-tools .cal-toggle{min-height:24px}\n"
    "@media (max-width:1080px){\n"
    "  .float-tools{right:16px!important;top:10px!important}\n"
    "}\n",
    "/* 版本号 + 日历：整条悬浮栏，横贯内容区、滚动时固定；只在「撰写」页出现 */\n"
    ".float-tools{\n"
    "  position:fixed;\n"
    "  top:10px;\n"
    "  left:calc(214px + 18px);\n"
    "  right:calc(313px + 18px);\n"
    "  z-index:56;\n"
    "  display:flex;\n"
    "  align-items:center;\n"
    "  justify-content:flex-end;\n"
    "  gap:8px;\n"
    "  min-height:38px;\n"
    "  padding:5px 10px;\n"
    "  background:rgba(255,255,255,.86);\n"
    "  border:1px solid var(--sky-line);\n"
    "  box-shadow:0 6px 18px rgba(23,69,110,.13);\n"
    "  backdrop-filter:blur(8px);\n"
    "}\n"
    "body.rb-closed .float-tools{right:18px}\n"
    ".float-tools[hidden]{display:none!important}\n"
    ".float-tools .cal-toggle{margin-left:0!important}\n"
    ".float-tools .version-chip{min-height:24px;padding:3px 9px 2px!important}\n"
    ".float-tools .cal-toggle{min-height:24px}\n"
    "@media (max-width:1080px){\n"
    "  .float-tools{left:16px!important;right:16px!important;top:8px!important}\n"
    "}\n",
    "顶部改成整条悬浮栏，版本号和日历靠右",
)

# ---------- 2. 去掉「Repy 说」与版本号标题 ----------
rep('        <span class="bubble-kicker">Repy 说</span>\n', "", "删除气泡的「Repy 说」字样")
rep(
    ".bubble-kicker{\n"
    "  color:var(--navy);\n"
    "  font-size:11px;\n"
    "  font-weight:900;\n"
    "  letter-spacing:.14em;\n"
    "}\n",
    "",
    "删除「Repy 说」CSS",
)
rep(
    '          <p class="bubble-hi">V2.1.0 · 换了我，也换了一身浅蓝。</p>',
    '          <p class="bubble-hi">你好，我是 Repy。</p>',
    "气泡第二屏标题去掉版本号，改成自我介绍",
)

# ---------- 3. 追加覆盖 CSS ----------
POLISH = r'''
/* ============================================================
   V2.1.0 第二批批注：整体悬浮 / 去掉所有局部粗色条 / 有安排换表示法
   ============================================================ */

/* 悬浮栏占掉的顶部空间，只给撰写页补，避免复盘/设置页顶部留白 */
#generatorPage{padding-top:56px!important}
.repy-hero{margin-top:0!important}
.bubble-tabs{margin-left:0!important}

/* 去掉所有「只画了一部分边的粗色条」，只保留完整圆角矩形 */
/* 深色 / 渐变色块：纯色圆角矩形，不要边框 */
.masthead,.ov-head,.set-head,.repy-hero,.plan-banner,
.toast,.backfill-bar,.feature-pop,.ai-strip{border:0!important}
/* 浅色卡片与提示：完整 1px 细边框圆角矩形 */
.modal,.today-plate,.panel,.set-card,.day-panel,.copy-panel,.copy-right,
.cal-panel,.mini-cal,.rightbar .mini-cal,.form-error,.load-row,
.rec-item.is-key,.rec-block,.import-lead{
  border:1px solid var(--rule)!important;
}
/* 分栏靠背景色区分，不再用粗竖线 */
.sidebar,.rightbar{border:0!important}

/* 星期选项卡「有安排」：不再用底部绿线，改成整块高透明度底色 + 加粗 */
.day-tab.has-plan,.plan-day-tab.is-set{
  box-shadow:none!important;
  background:color-mix(in srgb,var(--green) 15%,transparent)!important;
  font-weight:900!important;
}
.day-tab.active.has-plan,.plan-day-tab.active.is-set{
  background:color-mix(in srgb,var(--sky-deep) 28%,transparent)!important;
  color:var(--navy)!important;
}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加整体悬浮 / 色条清理 CSS")

HTML.write_text(s, encoding="utf-8")
print("[saved]", HTML)

# ---------- 4. 同步自检 ----------
c = CHECK.read_text(encoding="utf-8")


def crep(old, new, tag):
    global c
    if old not in c:
        raise SystemExit("[FAIL check.js] 没找到：" + tag)
    c = c.replace(old, new, 1)
    print("[ok check.js]", tag)


crep(
    "  report.annotation = await run(`(() => {\n",
    "  report.floatBatch = await run(`(() => {\n"
    "    const cs = sel => getComputedStyle(document.querySelector(sel));\n"
    "    const ft = document.getElementById('floatTools');\n"
    "    return {\n"
    "      kickerGone: !document.querySelector('.bubble-kicker'),\n"
    "      bubbleTitle: document.querySelector('[data-pane=\"0\"] .bubble-hi').textContent,\n"
    "      floatWidth: Math.round(ft.getBoundingClientRect().width),\n"
    "      floatJustify: cs('.float-tools').justifyContent,\n"
    "      floatPosition: cs('.float-tools').position,\n"
    "      panelTop: cs('.panel').borderTopWidth,\n"
    "      panelLeft: cs('.panel').borderLeftWidth,\n"
    "      sidebarRight: cs('.sidebar').borderRightWidth,\n"
    "      rightbarLeft: cs('.rightbar').borderLeftWidth,\n"
    "      setCardTop: cs('.set-card').borderTopWidth,\n"
    "      heroBottom: cs('.repy-hero').borderBottomWidth,\n"
    "      dayTabShadow: (() => { const d = document.querySelector('.day-tab.has-plan'); return d ? getComputedStyle(d).boxShadow : 'no-plan'; })()\n"
    "    };\n"
    "  })()`);\n\n"
    "  report.annotation = await run(`(() => {\n",
    "新增第二批批注自检",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
