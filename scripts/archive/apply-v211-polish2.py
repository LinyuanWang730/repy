# -*- coding: utf-8 -*-
"""
按 2026-11-24 五条需求修改：
  1. 气泡里新增固定问候「你好，我是 Repy。」（两屏共用，去掉第二屏重复标题）
  2. 全站统一黑体类无衬线字体栈；扫描所有 <11px 的小字规则统一提到 11px，并调深浅色文字
  3. 星期选中块改带回弹的非线性缓动 + 毛玻璃（半透明，可透出底下的绿 / 白）
  4. 右侧栏日历卡片下方的阴影与分隔细线清掉
  5. 滚动条平时极细极浅，鼠标移到滚动条区域才加粗
同时同步 scripts/check.js。
"""
import re
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


# ---------- 1. 固定问候行；去掉第二屏重复标题 ----------
rep(
    '          <div class="bubble-clip">\n'
    '            <div class="bubble-pane" data-pane="0">',
    '          <div class="bubble-clip">\n'
    '            <p class="bubble-hello">你好，我是 Repy。</p>\n'
    '            <div class="bubble-pane" data-pane="0">',
    "气泡新增固定问候行",
)
rep(
    '              <p class="bubble-hi">你好，我是 Repy。</p>\n'
    '              <ul class="bubble-news">',
    '              <ul class="bubble-news">',
    "去掉第二屏重复问候标题",
)

# ---------- 2. 高度测量要把固定问候行算进去 ----------
rep(
    '    const BUBBLE_PAD = 34;\n'
    '    let paneHeights = [];\n',
    '    const BUBBLE_PAD = 34;\n'
    '    let bubblePad = BUBBLE_PAD;\n'
    '    let paneHeights = [];\n',
    "高度内边距改为可变量",
)
rep(
    '      panes.forEach((p, i) => { p.hidden = before[i]; });\n'
    '      if (stage) stage.style.height = (Math.max.apply(null, paneHeights) + BUBBLE_PAD) + "px";',
    '      panes.forEach((p, i) => { p.hidden = before[i]; });\n'
    '      const hello = document.querySelector(".bubble-hello");\n'
    '      const helloH = hello\n'
    '        ? hello.getBoundingClientRect().height + (parseFloat(getComputedStyle(hello).marginBottom) || 0)\n'
    '        : 0;\n'
    '      bubblePad = BUBBLE_PAD + helloH;\n'
    '      if (stage) stage.style.height = (Math.max.apply(null, paneHeights) + bubblePad) + "px";',
    "测量时计入问候行高度",
)
rep(
    '      bubble.style.height = (paneHeights[index] + BUBBLE_PAD) + "px";',
    '      bubble.style.height = (paneHeights[index] + bubblePad) + "px";',
    "设置高度时计入问候行",
)

# ---------- 3. 星期滑块：毛玻璃色调随「有安排」变化 ----------
rep(
    '    thumb.style.width = active.offsetWidth + "px";\n'
    '    thumb.style.transform = "translateX(" + active.offsetLeft + "px)";',
    '    thumb.style.width = active.offsetWidth + "px";\n'
    '    thumb.style.transform = "translateX(" + active.offsetLeft + "px)";\n'
    '    thumb.style.setProperty("--thumb-tint", active.classList.contains("has-plan")\n'
    '      ? "rgba(214,240,226,.66)" : "rgba(255,255,255,.68)");',
    "选中块按有安排与否切换毛玻璃色调",
)

# ---------- 4. 滚动条悬停加粗 ----------
rep(
    '    }\n'
    '  })();\n'
    '\n'
    '\n'
    '  /* ---------- V2.1.0：导入 / 分享 / 补记录提示 ---------- */',
    '    }\n'
    '\n'
    '    /* 滚动条：平时极细，鼠标移到滚动条区域才加粗 */\n'
    '    (function initScrollbarHover(){\n'
    '      const html = document.documentElement;\n'
    '      function update(e){\n'
    '        let hit = false;\n'
    '        ["shell", "rightBar"].forEach(id => {\n'
    '          const el = document.getElementById(id);\n'
    '          if (!el) return;\n'
    '          const r = el.getBoundingClientRect();\n'
    '          if (e.clientX >= r.right - 18 && e.clientX <= r.right + 6 &&\n'
    '              e.clientY >= r.top && e.clientY <= r.bottom) hit = true;\n'
    '        });\n'
    '        html.classList.toggle("sb-hover", hit);\n'
    '      }\n'
    '      document.addEventListener("mousemove", update, {passive:true});\n'
    '      document.addEventListener("mouseleave", () => html.classList.remove("sb-hover"));\n'
    '    })();\n'
    '  })();\n'
    '\n'
    '\n'
    '  /* ---------- V2.1.0：导入 / 分享 / 补记录提示 ---------- */',
    "插入滚动条悬停逻辑",
)

# ---------- 5. 扫描所有小字规则，生成提级选择器 ----------
css = s.split("<style>")[1].split("</style>")[0]
small_selectors = []
seen = set()
for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
    sel = " ".join(m.group(1).split())
    body = m.group(2)
    if not sel or sel.startswith("@") or "/*" in sel or sel in ("from", "to", "0%", "100%"):
        continue
    if re.fullmatch(r"\d+%", sel):
        continue
    is_small = False
    for decl in body.split(";"):
        d = decl.strip()
        if d.startswith("font-size:") or d.startswith("font:"):
            nums = re.findall(r"(\d+(?:\.\d+)?)px", d)
            if nums and float(nums[0]) < 11:
                is_small = True
                break
    if is_small and sel not in seen:
        seen.add(sel)
        small_selectors.append(sel)

print("[info] 扫到小字选择器", len(small_selectors), "个")
SMALL_RULE = ",\n".join(small_selectors) + "{\n  font-size:11px!important;\n}\n"

POLISH = r'''
/* ============================================================
   V2.1.0 收尾二：问候 / 黑体与小字 / 毛玻璃滑块 / 细滚动条
   ============================================================ */

/* 全站黑体类无衬线字体栈 */
*,*::before,*::after{
  font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Hiragino Sans GB","SimHei","黑体","Heiti SC",Arial,sans-serif!important;
}
.side-logo{font-family:"Arial Black","Microsoft YaHei","SimHei","黑体",sans-serif!important}
/* 浅色文字调深，小字不再发虚 */
:root{--muted:#54718d;--faint:#7793aa}

/* 气泡固定问候 */
.bubble-hello{
  margin:0 0 10px;
  color:#0f3c68!important;
  font-size:12px!important;
  font-weight:900;
  letter-spacing:.02em;
}

/* 星期选中块：带回弹的非线性缓动 + 毛玻璃 */
.day-thumb{
  background:var(--thumb-tint,rgba(255,255,255,.68))!important;
  backdrop-filter:blur(10px) saturate(1.25);
  -webkit-backdrop-filter:blur(10px) saturate(1.25);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.72),0 3px 10px rgba(23,69,110,.16)!important;
  transition:transform .42s cubic-bezier(.34,1.42,.5,1),width .42s cubic-bezier(.34,1.42,.5,1),background-color .3s ease!important;
}

/* 右侧栏：日历下方不再有深色投影 / 分隔细线 */
.rightbar .mini-cal,.mini-cal{box-shadow:none!important}
.mini-cal-head,.mini-week,.mini-legend,.cal-legend{border-bottom:0!important}
.streak{border:0!important}

/* 滚动条：平时 6px 极细，鼠标移到滚动条区域才 12px */
:root{--sb:6px}
html.sb-hover{--sb:12px}
*::-webkit-scrollbar{width:var(--sb);height:var(--sb)}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(23,69,110,.22);border-radius:999px}
html.sb-hover *::-webkit-scrollbar-thumb{background:rgba(23,69,110,.48)}

/* 所有小于 11px 的小字统一提到 11px */
'''
rep("\n</style>", "\n" + POLISH + SMALL_RULE + "</style>", "追加五条需求覆盖 CSS")

HTML.write_text(s, encoding="utf-8")
print("[saved]", HTML)

# ---------- 6. 同步自检 ----------
c = CHECK.read_text(encoding="utf-8")


def crep(old, new, tag):
    global c
    if old not in c:
        raise SystemExit("[FAIL check.js] 没找到：" + tag)
    c = c.replace(old, new, 1)
    print("[ok check.js]", tag)


crep(
    "  report.bubbleBatch = await run(`(() => {\n",
    "  report.polish2 = await run(`(() => {\n"
    "    const root = document.documentElement;\n"
    "    const thumb = document.getElementById('dayThumb');\n"
    "    const mini = document.querySelector('.rightbar .mini-cal');\n"
    "    const sbDefault = getComputedStyle(root).getPropertyValue('--sb').trim();\n"
    "    root.classList.add('sb-hover');\n"
    "    const sbHover = getComputedStyle(root).getPropertyValue('--sb').trim();\n"
    "    root.classList.remove('sb-hover');\n"
    "    return {\n"
    "      hello: document.querySelector('.bubble-hello')?.textContent,\n"
    "      helloVisible: getComputedStyle(document.querySelector('.bubble-hello')).display !== 'none',\n"
    "      helloInNewsPane: !document.querySelector('[data-pane=\"1\"] .bubble-hi'),\n"
    "      bodyFont: getComputedStyle(document.body).fontFamily,\n"
    "      muted: getComputedStyle(root).getPropertyValue('--muted').trim(),\n"
    "      smallFonts: ['.mini-legend','.field label','.rec-part','.day-tab','.bubble-tab']\n"
    "        .map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : 'none'; }),\n"
    "      thumbTint: getComputedStyle(thumb).backgroundColor,\n"
    "      thumbTiming: getComputedStyle(thumb).transitionTimingFunction,\n"
    "      thumbBackdrop: getComputedStyle(thumb).backdropFilter,\n"
    "      miniShadow: mini ? getComputedStyle(mini).boxShadow : 'none',\n"
    "      sbDefault: sbDefault,\n"
    "      sbHover: sbHover\n"
    "    };\n"
    "  })()`);\n\n"
    "  report.bubbleBatch = await run(`(() => {\n",
    "新增五条需求自检",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
