# -*- coding: utf-8 -*-
"""
V2.1.0 收尾打磨（可重复执行 / 一次性替换）：
  1. 中文旁边不再放同义英文（删 nav-sub）
  2. 全局直角 -> 同一弧度圆角；取消选项卡左侧小色条，改整块高透明度纯色块
  3. 气泡改圆角（由全局规则实现）+ 去掉「每 10 秒自动换」的重复提示元素
同时同步 scripts/check.js 的自检断言。
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


# ---------- 1. 全站统一圆角 ----------
rep(
    "  --shadow:0 8px 24px rgba(23,69,110,.09);\n}\n*{box-sizing:border-box;border-radius:0!important}",
    "  --shadow:0 8px 24px rgba(23,69,110,.09);\n"
    "  --r:14px;                 /* 全站统一圆角弧度 */\n"
    "}\n"
    "*{box-sizing:border-box;border-radius:var(--r)!important}",
    "全局圆角：--r + 去掉 border-radius:0!important",
)
rep("border-radius:0;", "border-radius:var(--r);", "清理两处残留 border-radius:0", all_occurrences=True)

# ---------- 2. 中文旁的同义英文 ----------
rep(
    '      <button class="side-nav-btn is-current" type="button" data-page="generator" aria-current="page">\n'
    '        <span class="nav-label">撰写</span><span class="nav-sub">Write a log</span>\n'
    '      </button>\n'
    '      <button class="side-nav-btn" type="button" data-page="overview">\n'
    '        <span class="nav-label">复盘</span><span class="nav-sub">Review &amp; recall</span>\n'
    '      </button>',
    '      <button class="side-nav-btn is-current" type="button" data-page="generator" aria-current="page">\n'
    '        <span class="nav-label">撰写</span>\n'
    '      </button>\n'
    '      <button class="side-nav-btn" type="button" data-page="overview">\n'
    '        <span class="nav-label">复盘</span>\n'
    '      </button>',
    "删除侧边栏中英并排的 nav-sub",
)
rep(
    ".side-nav-btn .nav-sub{\n"
    "  color:var(--muted);\n"
    "  font-size:9.5px;\n"
    "  font-weight:800;\n"
    "  letter-spacing:.1em;\n"
    "  text-transform:uppercase;\n"
    "}\n",
    "",
    "删除 nav-sub CSS",
)
rep(".side-nav-btn.is-current .nav-sub{color:rgba(255,255,255,.78)}\n", "", "删除 nav-sub 选中态 CSS")
rep("  .side-nav-btn .nav-sub{display:none}\n", "", "删除窄屏 nav-sub CSS")

# ---------- 3. 气泡：圆角由全局规则负责；去掉重复提示元素 ----------
rep('        <span class="bubble-count" id="bubbleCount">10s</span>\n', "", "删除气泡倒计时数字")
rep(
    '      <div class="bubble-foot">\n'
    '        <span class="bubble-dots"><i class="is-on"></i><i></i></span>\n'
    '        <span>每 10 秒自动换一条 · 点标签可以立刻切</span>\n'
    '      </div>\n',
    "",
    "删除气泡底部小圆点与「每 10 秒自动换」说明",
)
rep(
    ".bubble-count{\n"
    "  min-width:32px;\n"
    "  color:var(--muted);\n"
    "  font-size:10px;\n"
    "  font-weight:800;\n"
    "  text-align:right;\n"
    "  font-variant-numeric:tabular-nums;\n"
    "}\n",
    "",
    "删除倒计时 CSS",
)
rep(
    ".bubble-foot{\n"
    "  display:flex;\n"
    "  align-items:center;\n"
    "  gap:10px;\n"
    "  margin-top:10px;\n"
    "  color:var(--muted);\n"
    "  font-size:9.5px;\n"
    "  font-weight:700;\n"
    "}\n"
    ".bubble-dots{display:flex;gap:5px}\n"
    ".bubble-dots i{width:16px;height:4px;background:var(--sky-line)}\n"
    ".bubble-dots i.is-on{background:var(--sky-deep)}\n",
    "",
    "删除气泡底部 CSS",
)
rep("  .bubble-count{display:none}\n", "", "删除窄屏倒计时 CSS")

# 轮换逻辑保留（V2.1.0 需求），但去掉已删除元素的引用
rep(
    '    const dots = Array.from(document.querySelectorAll(".bubble-dots i"));\n'
    '    const count = document.getElementById("bubbleCount");\n',
    "",
    "清理 dots / count 变量",
)
rep(
    '      dots.forEach((d, i) => d.classList.toggle("is-on", i === bubbleIndex));\n'
    '      if (reset) bubbleLeft = 10;\n'
    '      if (count) count.textContent = bubbleLeft + "s";\n',
    '      if (reset) bubbleLeft = 10;\n',
    "清理 showBubble 里的冗余更新",
)
rep(
    '    function tick(){\n'
    '      bubbleLeft -= 1;\n'
    '      if (bubbleLeft <= 0) showBubble(bubbleIndex + 1, true);\n'
    '      else if (count) count.textContent = bubbleLeft + "s";\n'
    '    }\n',
    '    function tick(){\n'
    '      bubbleLeft -= 1;\n'
    '      if (bubbleLeft <= 0) showBubble(bubbleIndex + 1, true);\n'
    '    }\n',
    "清理 tick 里的倒计时更新",
)

# ---------- 4. 统一圆角例外 + 整块高透明度索引色 + 交互反馈 ----------
POLISH = r'''
/* ============================================================
   V2.1.0 收尾：统一圆角 / 索引色整块化 / 交互反馈
   全局弧度由 :root 的 --r 统一；这里只处理圆形例外、色块与反馈
   ============================================================ */

/* 圆形装饰不是直角，保持正圆 */
.switch-track::after,
.day-tab.today::after,
.select-option::before,
.bubble-news li::before{border-radius:50%!important}

/* 取消选项卡前面/左侧的一小条索引色 */
.category-chip::before{display:none!important}
.side-nav-btn,.action-choice,.selected-card,.plan-pick,.picked-chip{border-left-width:1px!important}
.category-chip,.part-btn{border-bottom-width:1px!important}

/* 统一过渡：悬停、按下、选中都有反馈 */
.action-choice,.selected-card,.plan-pick,.picked-chip,
.category-chip,.part-btn,.side-nav-btn,.bubble-tab,.day-tab,
.status-btn,.select-option,.rb-close,.cal-toggle,.version-chip,.side-gear{
  transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease;
}

/* 部位索引色：整块高透明度纯色，不再靠一条窄边 */
.action-choice,.selected-card,.plan-pick,.picked-chip,
.category-chip,.part-btn{
  background:color-mix(in srgb,var(--group-color,var(--blue)) 11%,transparent)!important;
  border-color:color-mix(in srgb,var(--group-color,var(--blue)) 26%,transparent)!important;
}
.category-chip,.part-btn{color:var(--group-color,var(--navy))!important}

/* 非部位色的选项卡：同样是高透明度浅蓝纯色块 */
.side-nav-btn,.bubble-tab,.day-tab,.status-btn,.select-option{
  background:color-mix(in srgb,var(--sky-deep) 9%,transparent)!important;
  border-color:color-mix(in srgb,var(--sky-deep) 24%,transparent)!important;
}

/* 悬停：色块加深 + 轻投影 */
.action-choice:hover,.selected-card:hover,.plan-pick:hover,.picked-chip:hover,
.category-chip:hover,.part-btn:hover{
  background:color-mix(in srgb,var(--group-color,var(--blue)) 22%,transparent)!important;
  border-color:color-mix(in srgb,var(--group-color,var(--blue)) 48%,transparent)!important;
  box-shadow:0 5px 14px color-mix(in srgb,var(--group-color,var(--blue)) 15%,transparent)!important;
}
.side-nav-btn:hover,.bubble-tab:hover,.day-tab:hover,.status-btn:hover,.select-option:hover{
  background:color-mix(in srgb,var(--sky-deep) 18%,transparent)!important;
  border-color:color-mix(in srgb,var(--sky-deep) 44%,transparent)!important;
  box-shadow:0 4px 12px color-mix(in srgb,var(--sky-deep) 14%,transparent)!important;
}

/* 选中 / 当前页：更实的透明色块 + 内描边 */
.action-choice.selected,.plan-pick.is-picked,.picked-chip.active,
.category-chip.active,.part-btn.active{
  color:var(--group-color,var(--navy))!important;
  background:color-mix(in srgb,var(--group-color,var(--blue)) 32%,transparent)!important;
  border-color:color-mix(in srgb,var(--group-color,var(--blue)) 62%,transparent)!important;
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--group-color,var(--blue)) 55%,transparent)!important;
}
.side-nav-btn.is-current,.bubble-tab.is-on,.day-tab.active,
.status-btn.active,.select-option.is-picked{
  color:var(--navy)!important;
  background:color-mix(in srgb,var(--sky-deep) 28%,transparent)!important;
  border-color:color-mix(in srgb,var(--sky-deep) 58%,transparent)!important;
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sky-deep) 48%,transparent)!important;
}

/* 按下：轻微回弹 */
.action-choice:active,.plan-pick:active,.picked-chip:active,
.category-chip:active,.part-btn:active,.side-nav-btn:active,
.bubble-tab:active,.day-tab:active,.status-btn:active,
.select-option:active,.rb-close:active,.cal-toggle:active,
.version-chip:active,.side-gear:active{transform:scale(.975)}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加统一圆角 / 色块 / 反馈 CSS")

HTML.write_text(s, encoding="utf-8")
print("[saved]", HTML)

# ---------- 5. 同步自检脚本 ----------
c = CHECK.read_text(encoding="utf-8")


def crep(old, new, tag):
    global c
    if old not in c:
        raise SystemExit("[FAIL check.js] 没找到：" + tag)
    c = c.replace(old, new, 1)
    print("[ok check.js]", tag)


crep(
    "    pane0: document.querySelector('[data-pane=\"0\"]').hidden,\n"
    "    count: document.getElementById('bubbleCount').textContent\n",
    "    pane0: document.querySelector('[data-pane=\"0\"]').hidden,\n"
    "    noCountdown: !document.getElementById('bubbleCount'),\n"
    "    noFoot: !document.querySelector('.bubble-foot'),\n"
    "    noDots: !document.querySelector('.bubble-dots')\n",
    "气泡检查改为「冗余元素已移除」",
)

POLISH_CHECK = r'''
  // V2.1.0 收尾：统一圆角 / 取消小色条 / 中文不并排英文
  report.polish = await run(`(() => {
    const cs = sel => getComputedStyle(document.querySelector(sel));
    return {
      radius: getComputedStyle(document.documentElement).getPropertyValue('--r').trim(),
      bubbleRadius: cs('.repy-bubble').borderTopLeftRadius,
      navRadius: cs('.side-nav-btn').borderTopLeftRadius,
      heroRadius: cs('.repy-hero').borderTopLeftRadius,
      navSubGone: document.querySelectorAll('.nav-sub').length === 0,
      chipDotGone: getComputedStyle(document.querySelector('.category-chip'), '::before').display === 'none',
      choiceLeftWidth: cs('.action-choice').borderLeftWidth,
      choiceBackground: cs('.action-choice').backgroundColor,
      navBackground: cs('.side-nav-btn').backgroundColor
    };
  })()`);

'''
crep(
    "  // 预选按钮：点击不重建 DOM\n",
    POLISH_CHECK + "  // 预选按钮：点击不重建 DOM\n",
    "新增圆角 / 色块自检",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
