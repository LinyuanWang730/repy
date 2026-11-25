# -*- coding: utf-8 -*-
"""
按 2026-11-24 四条需求修改：
  1. 星期选项卡切换加平滑滑动动画（独立的白色选中块在标签间移动）
  2. 对话气泡改成纯色底圆角矩形 + 一个小尖尖；两屏切换时高度带动画，
     但外层舞台高度固定，不会推动下面的面板造成页面抽搐
  3. 替换「V2.1.0 新东西」三条文案
  4. 替换「怎么用」大标题与三步文案
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


# ---------- 1. 星期按钮外层包一个舞台，放滑动选中块 ----------
rep(
    '      <div class="day-tabs" id="dayTabs" aria-label="选择星期"></div>',
    '      <div class="day-tabs-wrap"><span class="day-thumb" id="dayThumb" aria-hidden="true"></span>'
    '<div class="day-tabs" id="dayTabs" aria-label="选择星期"></div></div>',
    "星期按钮外层加滑动选中块",
)

# ---------- 2. 气泡 DOM：舞台 + 裁剪层 + 新文案 ----------
rep(
    '      <div class="repy-bubble">\n'
    '        <div class="bubble-pane" data-pane="0">\n'
    '          <p class="bubble-hi">三步写完一次训练，我陪着你。</p>\n'
    '          <ol class="bubble-steps">\n'
    '            <li><b>01</b><span><strong>选动作</strong>按星期安排挑动作，搜名字或俗称都行</span></li>\n'
    '            <li><b>02</b><span><strong>记重量</strong>填组数与每组数量，顺手标一下关键重量</span></li>\n'
    '            <li><b>03</b><span><strong>保存与复制</strong>存进复盘日历，或者直接复制发群</span></li>\n'
    '          </ol>\n'
    '        </div>\n'
    '        <div class="bubble-pane" data-pane="1" hidden>\n'
    '          <p class="bubble-hi">你好，我是 Repy。</p>\n'
    '          <ul class="bubble-news">\n'
    '            <li>JR0 浅蓝主题 + 全新 Repy 图标，界面和图标一个调子</li>\n'
    '            <li>设置里新增「导入」：借助 AI 把别处的训练记录翻译成 Repy 格式</li>\n'
    '            <li>新增「分享软件」：重新打包，装在哪个盘由你决定</li>\n'
    '            <li>侧边栏只留「撰写 / 复盘」，日历搬到右边可收起的栏里</li>\n'
    '            <li>补记录只把空白日期染绿，提示弹窗可以选「不再提醒」</li>\n'
    '          </ul>\n'
    '        </div>\n'
    '      </div>',
    '      <div class="bubble-stage" id="bubbleStage">\n'
    '        <div class="repy-bubble" id="repyBubble">\n'
    '          <div class="bubble-clip">\n'
    '            <div class="bubble-pane" data-pane="0">\n'
    '              <p class="bubble-hi">仅需三步，快速写好记录</p>\n'
    '              <ol class="bubble-steps">\n'
    '                <li><b>01</b><span><strong>选动作</strong>支持按星期挑选动作，支持搜索寻找。</span></li>\n'
    '                <li><b>02</b><span><strong>记重量</strong>填组次。标记关键重量、写备注，也都行。</span></li>\n'
    '                <li><b>03</b><span><strong>保存与复制</strong>保存到复盘日历，复制到天涯海角。</span></li>\n'
    '              </ol>\n'
    '            </div>\n'
    '            <div class="bubble-pane" data-pane="1" hidden>\n'
    '              <p class="bubble-hi">你好，我是 Repy。</p>\n'
    '              <ul class="bubble-news">\n'
    '                <li>界面图标双双焕新。全新浅蓝色主题，Repy小机器人伴您左右。</li>\n'
    '                <li>新增导入功能：借助AI把他处的训练记录翻译成Repy能读懂的格式。</li>\n'
    '                <li>新增分享功能：重新打包，分享出去。独乐乐不如众乐乐。安装包自行选择存放。</li>\n'
    '              </ul>\n'
    '            </div>\n'
    '          </div>\n'
    '        </div>\n'
    '      </div>',
    "气泡改舞台结构并替换两屏文案",
)

# ---------- 3. 星期滑块 JS ----------
rep(
    '    }).join("");\n'
    '  }\n'
    '\n'
    '  function renderDaily(){',
    '    }).join("");\n'
    '    moveDayThumb();\n'
    '  }\n'
    '\n'
    '  function moveDayThumb(){\n'
    '    const thumb = $("dayThumb");\n'
    '    const tabs = $("dayTabs");\n'
    '    if (!thumb || !tabs) return;\n'
    '    const active = tabs.querySelector(".day-tab.active") || tabs.querySelector(".day-tab");\n'
    '    if (!active || !active.offsetWidth) return;\n'
    '    thumb.style.width = active.offsetWidth + "px";\n'
    '    thumb.style.transform = "translateX(" + active.offsetLeft + "px)";\n'
    '  }\n'
    '  window.addEventListener("resize", moveDayThumb);\n'
    '\n'
    '  function renderDaily(){',
    "renderDayTabs 末尾同步滑块位置",
)
rep(
    '    if (page === "generator") renderMiniCalendar();',
    '    if (page === "generator") { renderMiniCalendar(); moveDayThumb(); }',
    "切回撰写页时重新对齐滑块",
)

# ---------- 4. 气泡高度动画 JS ----------
rep(
    '    let bubbleIndex = 0;\n'
    '    let bubbleLeft = 10;\n'
    '    let bubbleTimer = 0;\n'
    '    const panes = Array.from(document.querySelectorAll(".bubble-pane"));\n'
    '    const tabs = Array.from(document.querySelectorAll(".bubble-tab"));\n'
    '\n'
    '    function showBubble(index, reset){\n'
    '      bubbleIndex = index % panes.length;\n'
    '      panes.forEach((p, i) => { p.hidden = i !== bubbleIndex; });\n'
    '      tabs.forEach((t, i) => t.classList.toggle("is-on", i === bubbleIndex));\n'
    '      if (reset) bubbleLeft = 10;\n'
    '    }\n'
    '    function tick(){\n'
    '      bubbleLeft -= 1;\n'
    '      if (bubbleLeft <= 0) showBubble(bubbleIndex + 1, true);\n'
    '    }\n'
    '    tabs.forEach((tab, i) => tab.addEventListener("click", () => showBubble(i, true)));\n'
    '    if (panes.length) {\n'
    '      showBubble(0, true);\n'
    '      bubbleTimer = setInterval(tick, 1000);\n'
    '      document.addEventListener("visibilitychange", () => {\n'
    '        if (document.hidden) clearInterval(bubbleTimer);\n'
    '        else bubbleTimer = setInterval(tick, 1000);\n'
    '      });\n'
    '    }\n',
    '    let bubbleIndex = 0;\n'
    '    let bubbleLeft = 10;\n'
    '    let bubbleTimer = 0;\n'
    '    const panes = Array.from(document.querySelectorAll(".bubble-pane"));\n'
    '    const tabs = Array.from(document.querySelectorAll(".bubble-tab"));\n'
    '    const stage = document.getElementById("bubbleStage");\n'
    '    const bubble = document.getElementById("repyBubble");\n'
    '    const BUBBLE_PAD = 34;\n'
    '    let paneHeights = [];\n'
    '\n'
    '    function measurePanes(){\n'
    '      if (!bubble || !panes.length) return;\n'
    '      const before = panes.map(p => p.hidden);\n'
    '      panes.forEach(p => { p.hidden = false; });\n'
    '      paneHeights = panes.map(p => p.getBoundingClientRect().height);\n'
    '      panes.forEach((p, i) => { p.hidden = before[i]; });\n'
    '      if (stage) stage.style.height = (Math.max.apply(null, paneHeights) + BUBBLE_PAD) + "px";\n'
    '    }\n'
    '    function sizeBubble(index){\n'
    '      if (!bubble || !paneHeights.length) return;\n'
    '      bubble.style.height = (paneHeights[index] + BUBBLE_PAD) + "px";\n'
    '    }\n'
    '    function showBubble(index, reset){\n'
    '      bubbleIndex = index % panes.length;\n'
    '      panes.forEach((p, i) => {\n'
    '        p.hidden = i !== bubbleIndex;\n'
    '        p.classList.remove("is-entering");\n'
    '      });\n'
    '      tabs.forEach((t, i) => t.classList.toggle("is-on", i === bubbleIndex));\n'
    '      sizeBubble(bubbleIndex);\n'
    '      const current = panes[bubbleIndex];\n'
    '      if (current) {\n'
    '        void current.offsetWidth;\n'
    '        current.classList.add("is-entering");\n'
    '      }\n'
    '      if (reset) bubbleLeft = 10;\n'
    '    }\n'
    '    function tick(){\n'
    '      bubbleLeft -= 1;\n'
    '      if (bubbleLeft <= 0) showBubble(bubbleIndex + 1, true);\n'
    '    }\n'
    '    tabs.forEach((tab, i) => tab.addEventListener("click", () => showBubble(i, true)));\n'
    '    if (panes.length) {\n'
    '      measurePanes();\n'
    '      showBubble(0, true);\n'
    '      bubbleTimer = setInterval(tick, 1000);\n'
    '      window.addEventListener("resize", () => { measurePanes(); sizeBubble(bubbleIndex); });\n'
    '      document.addEventListener("visibilitychange", () => {\n'
    '        if (document.hidden) clearInterval(bubbleTimer);\n'
    '        else bubbleTimer = setInterval(tick, 1000);\n'
    '      });\n'
    '    }\n',
    "气泡高度测量与切换动画",
)

# ---------- 5. 覆盖层 CSS ----------
POLISH = r'''
/* ============================================================
   V2.1.0 收尾：星期滑块动画 + 纯色对话气泡（高度平滑、不推页面）
   ============================================================ */

/* 星期分段控件：白色选中块在标签之间滑动 */
.day-tabs-wrap{position:relative;margin:12px 15px 14px}
.day-tabs{margin:0!important}
.day-thumb{
  position:absolute;
  left:0;
  top:5px;
  height:calc(100% - 10px);
  width:0;
  background:#fff;
  border:0!important;
  border-radius:999px!important;
  box-shadow:0 2px 8px rgba(23,69,110,.17);
  pointer-events:none;
  z-index:0;
  transition:transform .32s cubic-bezier(.22,.61,.36,1),width .32s cubic-bezier(.22,.61,.36,1);
}
.day-tab{z-index:1!important}
.day-tab:hover{background:transparent!important}
.day-tab.active,.day-tab.active:hover,
.day-tab.active.has-plan{
  background:transparent!important;
  box-shadow:none!important;
}
.day-tab.has-plan{background:color-mix(in srgb,var(--green) 13%,transparent)!important}
.plan-day-tab{
  transition:background-color .28s ease,color .28s ease,box-shadow .28s ease,transform .28s ease!important;
}

/* 对话气泡：纯色底圆角矩形 + 小尖尖 */
.bubble-stage{
  display:flex;
  align-items:flex-start;
  height:var(--stage-h,196px);
}
.repy-bubble{
  position:relative;
  width:100%;
  height:var(--bubble-h,170px);
  padding:0!important;
  overflow:visible;
  background:var(--sky)!important;
  border:0!important;
  box-shadow:0 8px 20px rgba(23,69,110,.10)!important;
  transition:height .34s cubic-bezier(.22,.61,.36,1)!important;
}
.bubble-clip{
  height:100%;
  padding:18px 22px 16px;
  overflow:hidden;
}
.repy-bubble::before{
  content:"";
  position:absolute;
  left:-9px;
  top:30px;
  border-style:solid;
  border-width:8px 10px 8px 0;
  border-color:transparent var(--sky) transparent transparent;
  border-radius:0!important;
}
.repy-bubble::after{display:none!important}
.repy-bubble .bubble-hi{color:#0f3c68!important}
.repy-bubble .bubble-steps strong{color:#0f3c68!important}
.repy-bubble .bubble-steps li,
.repy-bubble .bubble-news li{color:#17456f!important}

@keyframes repyBubbleIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bubble-pane.is-entering{animation:repyBubbleIn .3s ease both}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加滑块与纯色气泡 CSS")

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
    "  report.tabsBatch = await run(`(() => {\n",
    "  report.bubbleBatch = await run(`(() => {\n"
    "    const bubble = document.getElementById('repyBubble');\n"
    "    const cs = getComputedStyle(bubble);\n"
    "    return {\n"
    "      stageHeight: Math.round(document.getElementById('bubbleStage').getBoundingClientRect().height),\n"
    "      bubbleHeight: Math.round(bubble.getBoundingClientRect().height),\n"
    "      bubbleBg: cs.backgroundColor,\n"
    "      bubbleBorder: cs.borderTopWidth,\n"
    "      bubbleTransition: cs.transitionProperty,\n"
    "      tipColor: getComputedStyle(bubble, '::before').borderRightColor,\n"
    "      tipAfter: getComputedStyle(bubble, '::after').display,\n"
    "      thumb: !!document.getElementById('dayThumb'),\n"
    "      thumbTransition: getComputedStyle(document.getElementById('dayThumb')).transitionProperty,\n"
    "      stepsTitle: document.querySelector('[data-pane=\"0\"] .bubble-hi').textContent,\n"
    "      steps: [...document.querySelectorAll('[data-pane=\"0\"] .bubble-steps li')].map(e => e.textContent.replace(/\\s+/g,' ').trim()),\n"
    "      news: [...document.querySelectorAll('[data-pane=\"1\"] .bubble-news li')].map(e => e.textContent.trim())\n"
    "    };\n"
    "  })()`);\n\n"
    "  const panelTopBefore = await run(`document.getElementById('planPanel').getBoundingClientRect().top`);\n"
    "  await run(`document.querySelector('[data-bubble=\"1\"]').click();`);\n"
    "  await wait(500);\n"
    "  const panelTopAfter = await run(`document.getElementById('planPanel').getBoundingClientRect().top`);\n"
    "  const bubbleExpanded = await run(`Math.round(document.getElementById('repyBubble').getBoundingClientRect().height)`);\n"
    "  await run(`document.getElementById('shell').scrollTop = 0;`);\n"
    "  await wait(180);\n"
    "  await shot(win, \"18-bubble-news\");\n"
    "  await run(`document.querySelector('[data-bubble=\"0\"]').click();`);\n"
    "  await wait(500);\n"
    "  const bubbleCompact = await run(`Math.round(document.getElementById('repyBubble').getBoundingClientRect().height)`);\n"
    "  report.bubbleJitter = {\n"
    "    panelTopDelta: Math.round(Math.abs(panelTopAfter - panelTopBefore)),\n"
    "    expandedHeight: bubbleExpanded,\n"
    "    compactHeight: bubbleCompact\n"
    "  };\n\n"
    "  report.tabsBatch = await run(`(() => {\n",
    "新增气泡与滑块自检（含页面不抽搐断言）",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
