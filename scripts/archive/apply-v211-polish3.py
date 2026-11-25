# -*- coding: utf-8 -*-
"""V2.1.0 收尾三（源子第六批需求）：
1. 对话气泡拆成三屏：问候 / 怎么用 / 新版本
2. 去掉右侧栏「日历」标题栏那圈细线
3. 星期选项卡不可拖动；移动动画去掉回弹、改干脆
4. 索引色：胸浅橙 / 背浅绿 / 腿浅蓝 / 肩浅紫
5. 左侧撰写、复盘：字号更大、黑体、垂直居中、水平靠左
6. 滚动条悬停加粗不再改变占位宽度，界面不抽动
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "src", "index.html")
CHECK = os.path.join(ROOT, "scripts", "check.js")


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def sub(s, old, new, label, count=1):
    if old not in s:
        raise SystemExit("[FAIL] 未找到替换目标: " + label)
    n = s.count(old)
    if n != count:
        raise SystemExit("[FAIL] %s 匹配 %d 次，期望 %d 次" % (label, n, count))
    print("[ok]", label)
    return s.replace(old, new, count)


s = read(HTML)

# ---------------------------------------------------------------- 1. 三屏气泡
OLD_HTML = """      <div class="bubble-head">
        <div class="bubble-tabs">
          <button class="bubble-tab is-on" type="button" data-bubble="0">怎么用</button>
          <button class="bubble-tab" type="button" data-bubble="1">V2.1.0 新东西</button>
        </div>
      </div>
      <div class="bubble-stage" id="bubbleStage">
        <div class="repy-bubble" id="repyBubble">
          <div class="bubble-clip">
            <p class="bubble-hello">你好，我是 Repy。</p>
            <div class="bubble-pane" data-pane="0">
              <p class="bubble-hi">仅需三步，快速写好记录</p>
              <ol class="bubble-steps">
                <li><b>01</b><span><strong>选动作</strong>支持按星期挑选动作，支持搜索寻找。</span></li>
                <li><b>02</b><span><strong>记重量</strong>填组次。标记关键重量、写备注，也都行。</span></li>
                <li><b>03</b><span><strong>保存与复制</strong>保存到复盘日历，复制到天涯海角。</span></li>
              </ol>
            </div>
            <div class="bubble-pane" data-pane="1" hidden>
              <ul class="bubble-news">
                <li>界面图标双双焕新。全新浅蓝色主题，Repy小机器人伴您左右。</li>
                <li>新增导入功能：借助AI把他处的训练记录翻译成Repy能读懂的格式。</li>
                <li>新增分享功能：重新打包，分享出去。独乐乐不如众乐乐。安装包自行选择存放。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>"""

NEW_HTML = """      <div class="bubble-head">
        <div class="bubble-tabs">
          <button class="bubble-tab is-on" type="button" data-bubble="0">问候</button>
          <button class="bubble-tab" type="button" data-bubble="1">怎么用</button>
          <button class="bubble-tab" type="button" data-bubble="2">V2.1.0 新东西</button>
        </div>
      </div>
      <div class="bubble-stage" id="bubbleStage">
        <div class="repy-bubble" id="repyBubble">
          <div class="bubble-clip">
            <div class="bubble-pane is-greet" data-pane="0">
              <p class="bubble-hello">你好，我是 Repy。</p>
            </div>
            <div class="bubble-pane" data-pane="1" hidden>
              <p class="bubble-hi">仅需三步，快速写好记录</p>
              <ol class="bubble-steps">
                <li><b>01</b><span><strong>选动作</strong>支持按星期挑选动作，支持搜索寻找。</span></li>
                <li><b>02</b><span><strong>记重量</strong>填组次。标记关键重量、写备注，也都行。</span></li>
                <li><b>03</b><span><strong>保存与复制</strong>保存到复盘日历，复制到天涯海角。</span></li>
              </ol>
            </div>
            <div class="bubble-pane" data-pane="2" hidden>
              <p class="bubble-hi">V2.1.0，全方面飞跃。</p>
              <ul class="bubble-news">
                <li>界面图标双双焕新。全新浅蓝色主题，Repy小机器人伴您左右。</li>
                <li>新增导入功能：借助AI把他处的训练记录翻译成Repy能读懂的格式。</li>
                <li>新增分享功能：重新打包，分享出去。独乐乐不如众乐乐。安装包自行选择存放。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>"""
s = sub(s, OLD_HTML, NEW_HTML, "气泡 DOM 改为三屏")

# 舞台高度：问候已独立成屏，不能再把它的高度额外加到每一屏上
OLD_MEASURE = """      const hello = document.querySelector(".bubble-hello");
      const helloH = hello
        ? hello.getBoundingClientRect().height + (parseFloat(getComputedStyle(hello).marginBottom) || 0)
        : 0;
      bubblePad = BUBBLE_PAD + helloH;"""
NEW_MEASURE = """      bubblePad = BUBBLE_PAD;"""
s = sub(s, OLD_MEASURE, NEW_MEASURE, "舞台高度不再叠加固定问候行")

# ---------------------------------------------------------------- 3. 星期不可拖
OLD_BTN1 = '''return `<button class="day-tab${index === state.activeDay ? " active" : ""}${index === today ? " today" : ""}" type="button" data-day="${index}" aria-pressed="${index === state.activeDay}">${day.label.replace("周","")}</button>`;'''
NEW_BTN1 = '''return `<button class="day-tab${index === state.activeDay ? " active" : ""}${index === today ? " today" : ""}" type="button" draggable="false" data-day="${index}" aria-pressed="${index === state.activeDay}">${day.label.replace("周","")}</button>`;'''
s = sub(s, OLD_BTN1, NEW_BTN1, "dayButtonHtml 禁用拖动")

OLD_BTN2 = '''return `<button class="${classes.join(" ")}" type="button" data-day="${index}" aria-pressed="${index === state.activeDay}">${day.label.replace("周","")}</button>`;'''
NEW_BTN2 = '''return `<button class="${classes.join(" ")}" type="button" draggable="false" data-day="${index}" aria-pressed="${index === state.activeDay}">${day.label.replace("周","")}</button>`;'''
s = sub(s, OLD_BTN2, NEW_BTN2, "renderDayTabs 禁用拖动")

OLD_BTN3 = '''return `<button class="${classes.join(" ")}" type="button" data-pday="${index}" aria-pressed="${index === planActiveDay}">${WEEK_PLAN[index].label.replace("周","")}</button>`;'''
if OLD_BTN3 in s:
    s = sub(s, OLD_BTN3, OLD_BTN3.replace('type="button"', 'type="button" draggable="false"'), "一周安排弹窗禁用拖动")

# ---------------------------------------------------------------- 4. 索引色
COLORS = {
    "胸": "#e08f4a",   # 浅橙
    "背": "#54ad7c",   # 浅绿
    "腿": "#4f9fd4",   # 浅蓝
    "肩": "#9078cf",   # 浅紫
}
CSS_OLD = {
    "胸": ".group-胸{--group-color:#2b8fd6}",
    "背": ".group-背{--group-color:#5b4b8a}",
    "肩": ".group-肩{--group-color:#2a6fa8}",
    "腿": ".group-腿{--group-color:#2f7d4f}",
}
for k, old in CSS_OLD.items():
    s = sub(s, old, ".group-%s{--group-color:%s}" % (k, COLORS[k]), "CSS 部位色 " + k)

# 另外三个保留色相，统一到同一明度，不再显得深浅不一
for old, new in [
    (".group-手臂{--group-color:#a8402f}", ".group-手臂{--group-color:#d47e70}"),
    (".group-核心{--group-color:#5a5470}", ".group-核心{--group-color:#8994bb}"),
    (".group-有氧{--group-color:#2b8394}", ".group-有氧{--group-color:#5aaeb9}"),
]:
    s = sub(s, old, new, "CSS 附带部位 " + old[7:9])

JS_OLD = {
    "胸": '"胸": {color:"#2b8fd6", order:1},',
    "背": '"背": {color:"#5b4b8a", order:2},',
    "腿": '"腿": {color:"#2f7d4f", order:3},',
    "肩": '"肩": {color:"#2a6fa8", order:4}',
}
for k, old in JS_OLD.items():
    tail = "," if old.endswith(",") else ""
    s = sub(s, old, '"%s": {color:"%s", order:%s}%s' % (k, COLORS[k], old.split("order:")[1][0], tail), "GROUPS 部位色 " + k)

INLINE_OLD = {
    "胸": '<button class="part-btn" type="button" data-part="胸" style="--group-color:#2b8fd6">胸</button>',
    "背": '<button class="part-btn" type="button" data-part="背" style="--group-color:#5b4b8a">背</button>',
    "腿": '<button class="part-btn" type="button" data-part="腿" style="--group-color:#2f7d4f">腿</button>',
    "肩": '<button class="part-btn" type="button" data-part="肩" style="--group-color:#2a6fa8">肩</button>',
}
for k, old in INLINE_OLD.items():
    s = sub(s, old, old.replace(old.split("--group-color:")[1][:7], COLORS[k]), "添加动作弹窗部位色 " + k)

s = sub(s, 'if (tab === "常用动作") return "#a8402f";',
        'if (tab === "常用动作") return "#d47e70";', "常用动作索引色统一明度")

# ---------------------------------------------------------------- 旧样式块替换
s = sub(s, """/* 气泡固定问候 */
.bubble-hello{
  margin:0 0 10px;
  color:#0f3c68!important;
  font-size:12px!important;
  font-weight:900;
  letter-spacing:.02em;
}""", """/* 问候语：独立一屏，大字号 */
.bubble-hello{
  margin:0;
  color:#0f3c68!important;
  font-size:30px!important;
  font-weight:900;
  letter-spacing:.01em;
}""", "问候语字号改大")

s = sub(s, "  transition:transform .42s cubic-bezier(.34,1.42,.5,1),width .42s cubic-bezier(.34,1.42,.5,1),background-color .3s ease!important;",
        "  transition:transform .20s cubic-bezier(.2,.8,.2,1),width .20s cubic-bezier(.2,.8,.2,1),background-color .18s ease!important;",
        "星期滑块改干脆缓动")

s = sub(s, """/* 滚动条：平时 6px 极细，鼠标移到滚动条区域才 12px */
:root{--sb:6px}
html.sb-hover{--sb:12px}
*::-webkit-scrollbar{width:var(--sb);height:var(--sb)}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(23,69,110,.22);border-radius:999px}
html.sb-hover *::-webkit-scrollbar-thumb{background:rgba(23,69,110,.48)}""",
        """/* 滚动条：轨道宽度恒定，悬停只改 thumb 着色，界面绝不抽动 */
:root{--sb:12px}
*::-webkit-scrollbar{width:12px;height:12px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{
  background:linear-gradient(90deg,
    transparent 0,transparent 3px,
    rgba(23,69,110,.22) 3px,rgba(23,69,110,.22) 9px,
    transparent 9px,transparent 12px);
  border-radius:999px;
}
html.sb-hover *::-webkit-scrollbar-thumb{
  background:rgba(23,69,110,.48);
}""", "滚动条宽度恒定")

# ---------------------------------------------------------------- 追加新 CSS
CSS = """
/* ============================================================
   V2.1.0 收尾三：三屏气泡 / 去细线 / 干脆动画 / 浅色索引 / 侧栏 / 稳定滚动条
   ============================================================ */

/* 1. 问候独立成屏：大字、居中；另外两屏不再出现问候 */
.bubble-pane[hidden]{display:none!important}
.bubble-pane.is-greet{
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:140px;
  text-align:center;
}
.bubble-hello{white-space:nowrap;line-height:1.3}
.repy-bubble .bubble-pane .bubble-hi{color:#0f3c68!important;font-size:18px!important}

/* 2. 右侧栏「日历」标题栏：整圈细线一起去掉 */
.rb-head{border:0!important;box-shadow:none!important;background:transparent!important}
.rb-body{padding-top:8px!important}

/* 3. 星期选项卡：禁止拖选 / 原生拖拽，选中块不吃鼠标事件 */
.day-tabs-wrap,.day-tabs,.day-tab,.day-thumb,.plan-day-tabs,.plan-day-tab{
  user-select:none!important;
  -webkit-user-select:none!important;
  -webkit-user-drag:none!important;
  -webkit-touch-callout:none!important;
}
.day-tab,.plan-day-tab{touch-action:manipulation}
.day-thumb{pointer-events:none!important}

/* 5. 左侧撰写 / 复盘：黑体、更大、垂直居中、水平靠左 */
.side-nav-btn{
  flex-direction:row!important;
  align-items:center!important;
  justify-content:flex-start!important;
  text-align:left!important;
  font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","SimHei","黑体",sans-serif!important;
  font-size:24px!important;
  font-weight:900!important;
  line-height:1.15!important;
}
.side-nav-btn .nav-label{line-height:1.15}
"""
idx = s.rfind("</style>")
if idx < 0:
    raise SystemExit("[FAIL] 找不到 </style>")
s = s[:idx] + CSS + "\n" + s[idx:]
print("[ok] 追加 CSS 收尾块")

write(HTML, s)

# ================================================================ check.js
c = read(CHECK)

OLD_P2 = """  // V2.1.0 收尾：统一圆角 / 取消小色条 / 中文不并排英文
  report.polish2 = await run(`(() => {
    const root = document.documentElement;
    const thumb = document.getElementById('dayThumb');
    const mini = document.querySelector('.rightbar .mini-cal');
    const sbDefault = getComputedStyle(root).getPropertyValue('--sb').trim();
    root.classList.add('sb-hover');
    const sbHover = getComputedStyle(root).getPropertyValue('--sb').trim();
    root.classList.remove('sb-hover');
    return {
      hello: document.querySelector('.bubble-hello')?.textContent,
      helloVisible: getComputedStyle(document.querySelector('.bubble-hello')).display !== 'none',
      helloInNewsPane: !document.querySelector('[data-pane="1"] .bubble-hi'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      muted: getComputedStyle(root).getPropertyValue('--muted').trim(),
      smallFonts: ['.mini-legend','.field label','.rec-part','.day-tab','.bubble-tab']
        .map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : 'none'; }),
      thumbTint: getComputedStyle(thumb).backgroundColor,
      thumbTiming: getComputedStyle(thumb).transitionTimingFunction,
      thumbBackdrop: getComputedStyle(thumb).backdropFilter,
      miniShadow: mini ? getComputedStyle(mini).boxShadow : 'none',
      sbDefault: sbDefault,
      sbHover: sbHover
    };
  })()`);
"""
NEW_P2 = """  // V2.1.0 收尾：统一圆角 / 取消小色条 / 中文不并排英文
  report.polish2 = await run(`(() => {
    const root = document.documentElement;
    const thumb = document.getElementById('dayThumb');
    const mini = document.querySelector('.rightbar .mini-cal');
    return {
      hello: document.querySelector('[data-pane="0"] .bubble-hello')?.textContent,
      helloSize: getComputedStyle(document.querySelector('.bubble-hello')).fontSize,
      noHelloInSteps: !document.querySelector('[data-pane="1"] .bubble-hello'),
      noHelloInNews: !document.querySelector('[data-pane="2"] .bubble-hello'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      muted: getComputedStyle(root).getPropertyValue('--muted').trim(),
      smallFonts: ['.mini-legend','.field label','.rec-part','.day-tab','.bubble-tab']
        .map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : 'none'; }),
      thumbTint: getComputedStyle(thumb).backgroundColor,
      thumbTiming: getComputedStyle(thumb).transitionTimingFunction,
      thumbBackdrop: getComputedStyle(thumb).backdropFilter,
      miniShadow: mini ? getComputedStyle(mini).boxShadow : 'none',
      sbWidth: getComputedStyle(root).getPropertyValue('--sb').trim()
    };
  })()`);

  // 本轮六条
  report.polish3 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const shell = document.getElementById('shell');
    const root = document.documentElement;
    const gutterBefore = shell.offsetWidth - shell.clientWidth;
    const clientBefore = shell.clientWidth;
    root.classList.add('sb-hover');
    const gutterAfter = shell.offsetWidth - shell.clientWidth;
    const clientAfter = shell.clientWidth;
    root.classList.remove('sb-hover');
    const g = ['胸','背','腿','肩'].map(k => {
      const e = document.querySelector('.group-' + k);
      return e ? getComputedStyle(e).getPropertyValue('--group-color').trim() : 'none';
    });
    return {
      panes: document.querySelectorAll('.bubble-pane').length,
      tabs: [...document.querySelectorAll('.bubble-tab')].map(e => e.textContent),
      greet: document.querySelector('[data-pane="0"] .bubble-hello')?.textContent,
      greetSize: cs('.bubble-hello')?.fontSize,
      stepsTitle: document.querySelector('[data-pane="1"] .bubble-hi')?.textContent,
      newsTitle: document.querySelector('[data-pane="2"] .bubble-hi')?.textContent,
      newsCount: document.querySelectorAll('[data-pane="2"] .bubble-news li').length,
      partColors: g,
      rbHeadBorder: cs('.rb-head')?.borderBottomWidth,
      tabUserSelect: cs('.day-tab')?.userSelect,
      thumbTiming: cs('.day-thumb')?.transitionTimingFunction,
      thumbDuration: cs('.day-thumb')?.transitionDuration,
      navAlign: cs('.side-nav-btn')?.alignItems,
      navJustify: cs('.side-nav-btn')?.justifyContent,
      navSize: cs('.side-nav-btn')?.fontSize,
      navWeight: cs('.side-nav-btn')?.fontWeight,
      sbGutterBefore: gutterBefore,
      sbGutterAfter: gutterAfter,
      clientDelta: Math.abs(clientAfter - clientBefore)
    };
  })()`);
"""
c = sub(c, OLD_P2, NEW_P2, "check.js polish2 / 新增 polish3")

c = sub(c, """      stepsTitle: document.querySelector('[data-pane="0"] .bubble-hi').textContent,
      steps: [...document.querySelectorAll('[data-pane="0"] .bubble-steps li')].map(e => e.textContent.replace(/\\s+/g,' ').trim()),
      news: [...document.querySelectorAll('[data-pane="1"] .bubble-news li')].map(e => e.textContent.trim())""",
        """      stepsTitle: document.querySelector('[data-pane="1"] .bubble-hi').textContent,
      steps: [...document.querySelectorAll('[data-pane="1"] .bubble-steps li')].map(e => e.textContent.replace(/\\s+/g,' ').trim()),
      newsTitle: document.querySelector('[data-pane="2"] .bubble-hi').textContent,
      news: [...document.querySelectorAll('[data-pane="2"] .bubble-news li')].map(e => e.textContent.trim())""",
        "check.js bubbleBatch 改三屏索引")

c = sub(c, """  await run(`document.querySelector('[data-bubble="1"]').click();`);
  await wait(500);
  const panelTopAfter""",
        """  await run(`document.querySelector('[data-bubble="2"]').click();`);
  await wait(500);
  const panelTopAfter""", "check.js 截图切到新版本屏")

c = sub(c, """  await run(`document.querySelector('[data-bubble="0"]').click();`);
  await wait(500);
  const bubbleCompact""",
        """  await run(`document.querySelector('[data-bubble="1"]').click();`);
  await wait(500);
  const bubbleCompact""", "check.js 回切到怎么用屏")

c = sub(c, "      bubbleTitle: document.querySelector('[data-pane=\"0\"] .bubble-hi').textContent,",
        "      bubbleTitle: document.querySelector('[data-pane=\"1\"] .bubble-hi').textContent,",
        "check.js floatBatch 标题索引")

c = sub(c, """  await run(`document.querySelector('[data-bubble="1"]').click();`);
  await wait(150);
  report.bubbleSwitch = await run(`({
    pane1: !document.querySelector('[data-pane="1"]').hidden,
    pane0: document.querySelector('[data-pane="0"]').hidden,""",
        """  await run(`document.querySelector('[data-bubble="2"]').click();`);
  await wait(150);
  report.bubbleSwitch = await run(`({
    pane2: !document.querySelector('[data-pane="2"]').hidden,
    pane0: document.querySelector('[data-pane="0"]').hidden,
    pane1: document.querySelector('[data-pane="1"]').hidden,""",
        "check.js bubbleSwitch 改三屏")

write(CHECK, c)
print("[done] index.html 与 check.js 已更新")
