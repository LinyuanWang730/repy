# -*- coding: utf-8 -*-
"""
按 2026-11-24 参考样式卡修改：把星期按钮做成「分段标签页」。
  - 外层一个浅色胶囊容器，选中项是白色浮起的圆角块
  - 未选中项透明、次要色文字；悬停有淡底反馈，按下轻微回弹
  - 「有安排」继续用淡绿底 / 绿色字表示，选中项保持白色浮起
  - 主页面 .day-tabs 与一周安排弹窗 .plan-day-tabs 统一
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


POLISH = r'''
/* ============================================================
   V2.1.0 参考卡修订：星期按钮 -> 分段标签页
   外层浅色胶囊，选中项白色浮起圆角块，未选中项透明
   ============================================================ */
.day-tabs,.plan-day-tabs{
  display:grid;
  grid-template-columns:repeat(7,minmax(0,1fr));
  gap:2px;
  padding:5px;
  border:0!important;
  border-radius:999px!important;
  background:rgba(23,69,110,.06)!important;
}
.day-tabs{margin:12px 15px 14px!important}
.plan-day-tabs{margin:2px 0 10px!important}

.day-tab,.plan-day-tab{
  position:relative;
  min-width:0;
  min-height:38px;
  padding:8px 4px!important;
  color:var(--muted)!important;
  background:transparent!important;
  border:0!important;
  border-radius:999px!important;
  box-shadow:none!important;
  font-size:11.5px;
  font-weight:800;
  text-align:center;
  transition:background-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease;
}
.day-tab:hover,.plan-day-tab:hover{
  color:var(--navy)!important;
  background:rgba(23,69,110,.09)!important;
  border:0!important;
  box-shadow:none!important;
  transform:none!important;
}
.day-tab:active,.plan-day-tab:active{transform:scale(.96)}

/* 选中：白色圆角块浮起 */
.day-tab.active,.day-tab.active:hover,
.plan-day-tab.active,.plan-day-tab.active:hover{
  color:var(--navy)!important;
  background:#fff!important;
  border:0!important;
  box-shadow:0 2px 8px rgba(23,69,110,.17)!important;
  font-weight:900;
}

/* 有安排：淡绿底 + 绿色字；选中时仍是白色浮起，用绿色字保留信息 */
.day-tab.has-plan,.plan-day-tab.is-set{
  color:var(--green)!important;
  background:color-mix(in srgb,var(--green) 13%,transparent)!important;
  font-weight:900!important;
  box-shadow:none!important;
}
.day-tab.active.has-plan,.plan-day-tab.active.is-set{
  color:var(--green)!important;
  background:#fff!important;
  box-shadow:0 2px 8px rgba(23,69,110,.17)!important;
}

/* 今天的小圆点跟着胶囊收精致 */
.day-tab.today::after{
  right:7px;
  top:7px;
  width:4px;
  height:4px;
  background:var(--sky-deep);
  border-radius:50%!important;
}
.day-tab.active.today::after{background:var(--sky-deep)}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加分段标签页 CSS")

HTML.write_text(s, encoding="utf-8")
print("[saved]", HTML)

# ---------- 同步自检 ----------
c = CHECK.read_text(encoding="utf-8")


def crep(old, new, tag):
    global c
    if old not in c:
        raise SystemExit("[FAIL check.js] 没找到：" + tag)
    c = c.replace(old, new, 1)
    print("[ok check.js]", tag)


crep(
    "  report.loadRowBatch = await run(`(() => {\n",
    "  report.tabsBatch = await run(`(() => {\n"
    "    const cs = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };\n"
    "    return {\n"
    "      tabsRadius: cs('.day-tabs')?.borderTopLeftRadius,\n"
    "      tabsBg: cs('.day-tabs')?.backgroundColor,\n"
    "      tabsBorderBottom: cs('.day-tabs')?.borderBottomWidth,\n"
    "      tabRadius: cs('.day-tab')?.borderTopLeftRadius,\n"
    "      tabBorder: cs('.day-tab')?.borderRightWidth,\n"
    "      activeBg: cs('.day-tab.active')?.backgroundColor,\n"
    "      activeShadow: cs('.day-tab.active')?.boxShadow !== 'none',\n"
    "      planTabRadius: cs('.plan-day-tab')?.borderTopLeftRadius,\n"
    "      tabCount: document.querySelectorAll('#dayTabs .day-tab').length\n"
    "    };\n"
    "  })()`);\n\n"
    "  report.loadRowBatch = await run(`(() => {\n",
    "新增分段标签页自检",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
