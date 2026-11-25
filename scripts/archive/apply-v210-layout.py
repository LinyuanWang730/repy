# -*- coding: utf-8 -*-
"""
V2.1.0 布局改造：侧边栏 / 右侧日历栏 / Repy 对话气泡（一次性脚本，可重复跑）

改动：
  1. 左侧：删掉操作步骤卡，换成粗体「Repy」+「撰写 / 复盘」两个大标签
  2. 右侧：新增可收起侧栏，把原来的迷你日历从大标题旁搬进去
  3. 主页面大标题换成：透明背景 Repy 机器人 + 10 秒轮换的对话气泡
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "src", "index.html")

MARK = "/* V2.1.0 JR0 LAYOUT */"


# ---------------- 1. 结构替换 ----------------

OLD_STATUS = '''<div class="status-strip">
  <button class="version-chip" type="button" id="versionChip" title="查看更新日志">V2.0.0</button>
  <span class="version-note">通用版</span>
</div>'''

NEW_STATUS = '''<div class="status-strip">
  <button class="version-chip" type="button" id="versionChip" title="查看更新日志">V2.1.0</button>
  <span class="version-note">Repy · 撰写与复盘训练记录</span>
  <button class="cal-toggle" type="button" id="calToggle" aria-expanded="true" aria-controls="rightBar"><span aria-hidden="true">▦</span> 日历</button>
</div>'''

OLD_SIDEBAR = '''  <aside class="sidebar" aria-label="页面导航与操作步骤">
    <div class="side-brand">
      <span class="side-mark" aria-hidden="true">训</span>
      <div>
        <strong>训练日志</strong>
        <span>本机保存 · 离线可用</span>
      </div>
    </div>

    <nav class="side-nav">
      <button class="side-nav-btn is-current" type="button" data-page="generator" aria-current="page">
        <span class="nav-dot" aria-hidden="true"></span><span>健身记录生成器</span>
      </button>
      <button class="side-nav-btn" type="button" data-page="overview">
        <span class="nav-dot" aria-hidden="true"></span><span>记录总览</span>
      </button>
    </nav>

    <div class="step-rail" id="stepRail" aria-label="操作步骤">
      <div class="rail-cap">操作步骤 · 点击跳转</div>
      <button class="rail-step is-active" type="button" data-step="1"><span class="rail-n">01</span><span>选动作</span></button>
      <button class="rail-step" type="button" data-step="2"><span class="rail-n">02</span><span>记重量</span></button>
      <button class="rail-step" type="button" data-step="3"><span class="rail-n">03</span><span>保存与复制</span></button>
    </div>

    <button class="side-gear" type="button" data-page="settings" aria-label="打开设置">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square">
        <circle cx="12" cy="12" r="3.2"></circle>
        <path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.9l2.7 1.6M16.9 14.5l2.7 1.6M4.4 16.1l2.7-1.6M16.9 9.5l2.7-1.6"></path>
      </svg>
      <span>设置</span>
    </button>
  </aside>'''

NEW_SIDEBAR = '''  <aside class="sidebar" aria-label="主导航">
    <div class="side-brand">
      <div class="side-logo">Repy</div>
      <div class="side-tagline">撰写 · 复盘训练记录</div>
    </div>

    <nav class="side-nav">
      <button class="side-nav-btn is-current" type="button" data-page="generator" aria-current="page">
        <span class="nav-label">撰写</span><span class="nav-sub">Write a log</span>
      </button>
      <button class="side-nav-btn" type="button" data-page="overview">
        <span class="nav-label">复盘</span><span class="nav-sub">Review &amp; recall</span>
      </button>
    </nav>

    <div class="side-spacer"></div>

    <button class="side-gear" type="button" data-page="settings" aria-label="打开设置">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square">
        <circle cx="12" cy="12" r="3.2"></circle>
        <path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.9l2.7 1.6M16.9 14.5l2.7 1.6M4.4 16.1l2.7-1.6M16.9 9.5l2.7-1.6"></path>
      </svg>
      <span>设置</span>
    </button>
  </aside>'''

# masthead：从 <header class="masthead"> 到 </header>，整块替换
OLD_MAST_START = '<header class="masthead">'
MINI_START = '    <div class="mini-cal" aria-label="本机日期日历">'

NEW_HERO = '''  <header class="repy-hero">
    <img class="repy-bot" src="assets/repy-robot.png" alt="Repy 小机器人">
    <div class="repy-talk">
      <div class="bubble-head">
        <span class="bubble-kicker">Repy 说</span>
        <div class="bubble-tabs">
          <button class="bubble-tab is-on" type="button" data-bubble="0">怎么用</button>
          <button class="bubble-tab" type="button" data-bubble="1">V2.1.0 新东西</button>
        </div>
        <span class="bubble-count" id="bubbleCount">10s</span>
      </div>
      <div class="repy-bubble">
        <div class="bubble-pane" data-pane="0">
          <p class="bubble-hi">三步写完一次训练，我陪着你。</p>
          <ol class="bubble-steps">
            <li><b>01</b><span><strong>选动作</strong>按星期安排挑动作，搜名字或俗称都行</span></li>
            <li><b>02</b><span><strong>记重量</strong>填组数与每组数量，顺手标一下关键重量</span></li>
            <li><b>03</b><span><strong>保存与复制</strong>存进复盘日历，或者直接复制发群</span></li>
          </ol>
        </div>
        <div class="bubble-pane" data-pane="1" hidden>
          <p class="bubble-hi">V2.1.0 · 换了我，也换了一身浅蓝。</p>
          <ul class="bubble-news">
            <li>JR0 浅蓝主题 + 全新 Repy 图标，界面和图标一个调子</li>
            <li>设置里新增「导入」：借助 AI 把别处的训练记录翻译成 Repy 格式</li>
            <li>新增「分享软件」：重新打包，装在哪个盘由你决定</li>
            <li>侧边栏只留「撰写 / 复盘」，日历搬到右边可收起的栏里</li>
            <li>补记录只把空白日期染绿，提示弹窗可以选「不再提醒」</li>
          </ul>
        </div>
      </div>
      <div class="bubble-foot">
        <span class="bubble-dots"><i class="is-on"></i><i></i></span>
        <span>每 10 秒自动换一条 · 点标签可以立刻切</span>
      </div>
    </div>
  </header>
'''

RIGHTBAR_OPEN = '''  <aside class="rightbar" id="rightBar" aria-label="日历侧栏">
    <div class="rb-head">
      <strong>日历</strong>
      <button class="rb-close" type="button" id="rbClose" aria-label="收起日历">›</button>
    </div>
    <div class="rb-body">
'''

RIGHTBAR_CLOSE = '''    </div>
  </aside>
'''


# ---------------- 2. 追加 CSS ----------------

CSS = r'''
/* V2.1.0 JR0 LAYOUT */
/* ---- 顶条：右侧栏开关 ---- */
.cal-toggle{
  margin-left:auto;
  min-height:24px;
  padding:2px 11px;
  color:var(--navy);
  background:rgba(255,255,255,.62);
  border:1px solid var(--navy);
  font-size:10px;
  font-weight:850;
  letter-spacing:.05em;
}
.cal-toggle:hover{background:#fff}
.cal-toggle span{margin-right:4px;font-size:11px}

/* ---- 左侧：Repy 字标 + 两个大标签 ---- */
.sidebar{
  width:214px;
  gap:0;
  padding:22px 15px 18px;
  color:var(--ink);
  background:linear-gradient(165deg,#eaf6fd 0%,#d5ebf9 100%);
  border-right:4px solid var(--sky);
}
.side-brand{
  display:block;
  padding:0 4px 20px;
  border-bottom:2px solid var(--sky-line);
}
.side-logo{
  color:var(--navy);
  font-family:"Arial Black","Segoe UI","Microsoft YaHei UI","PingFang SC",sans-serif;
  font-size:46px;
  font-weight:900;
  line-height:1;
  letter-spacing:-.055em;
}
.side-tagline{
  margin-top:9px;
  color:var(--ink2);
  font-size:10.5px;
  font-weight:800;
  letter-spacing:.08em;
}
.side-nav{display:grid;gap:12px;margin-top:22px}
.side-nav-btn{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:3px;
  width:100%;
  padding:17px 15px 15px;
  color:var(--navy);
  background:#fff;
  border:1px solid var(--sky-line);
  border-left:5px solid var(--sky-line);
  font-size:23px;
  font-weight:900;
  letter-spacing:.03em;
  text-align:left;
}
.side-nav-btn .nav-label{line-height:1.1}
.side-nav-btn .nav-sub{
  color:var(--muted);
  font-size:9.5px;
  font-weight:800;
  letter-spacing:.1em;
  text-transform:uppercase;
}
.side-nav-btn:hover{background:#f7fcff;border-color:var(--sky-deep)}
.side-nav-btn.is-current{
  color:#fff;
  background:var(--sky-deep);
  border-color:var(--sky-deep);
  border-left-color:var(--navy);
  box-shadow:0 6px 16px rgba(23,69,110,.18);
}
.side-nav-btn.is-current .nav-sub{color:rgba(255,255,255,.78)}
.side-spacer{flex:1 1 auto;min-height:20px}
.side-gear{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  width:100%;
  min-height:38px;
  margin-top:16px;
  color:#fff;
  background:var(--navy);
  border:1px solid var(--navy);
  font-size:11.5px;
  font-weight:850;
}
.side-gear:hover{background:var(--blue);border-color:var(--blue)}
.side-gear.is-current{background:var(--sky-deep);border-color:var(--sky-deep)}
.side-gear svg{width:15px;height:15px}

/* ---- 右侧：可收起日历栏 ---- */
.rightbar{
  flex:none;
  width:310px;
  max-height:100%;
  overflow:auto;
  background:var(--card2);
  border-left:3px solid var(--sky);
  transition:width .2s ease;
}
body.rb-closed .rightbar{width:0;border-left:0;overflow:hidden}
.rb-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  min-width:280px;
  padding:14px 16px 12px;
  color:var(--navy);
  background:var(--sky-soft);
  border-bottom:1px solid var(--sky-line);
  font-size:13px;
  font-weight:900;
  letter-spacing:.05em;
}
.rb-close{
  display:grid;
  place-items:center;
  width:26px;
  height:26px;
  padding:0;
  color:var(--navy);
  background:#fff;
  border:1px solid var(--sky-line);
  font-size:17px;
  line-height:1;
}
.rb-close:hover{background:var(--sky)}
.rb-body{min-width:280px;padding:16px 14px 28px}
.rightbar .mini-cal{max-width:none;border-top:5px solid var(--sky-deep);box-shadow:0 6px 18px rgba(23,69,110,.1)}
body.rb-closed .cal-toggle{background:var(--navy);color:#fff}

/* ---- 主页面 Hero：机器人 + 对话气泡 ---- */
.repy-hero{
  display:grid;
  grid-template-columns:250px minmax(0,1fr);
  align-items:center;
  gap:26px;
  margin-top:26px;
  padding:22px 30px 24px;
  background:linear-gradient(110deg,#eaf6fd 0%,#ffffff 62%,#eaf6fd 100%);
  border-bottom:5px solid var(--sky);
  box-shadow:var(--shadow);
}
.repy-bot{
  display:block;
  width:100%;
  max-width:250px;
  height:auto;
  margin:0 auto;
  filter:drop-shadow(0 12px 16px rgba(23,69,110,.16));
}
.repy-talk{min-width:0}
.bubble-head{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:9px;
}
.bubble-kicker{
  color:var(--navy);
  font-size:11px;
  font-weight:900;
  letter-spacing:.14em;
}
.bubble-tabs{display:flex;gap:6px;margin-left:auto}
.bubble-tab{
  min-height:26px;
  padding:3px 11px;
  color:var(--ink2);
  background:#fff;
  border:1px solid var(--sky-line);
  font-size:10.5px;
  font-weight:850;
}
.bubble-tab:hover{background:var(--sky-soft)}
.bubble-tab.is-on{color:#fff;background:var(--sky-deep);border-color:var(--sky-deep)}
.bubble-count{
  min-width:32px;
  color:var(--muted);
  font-size:10px;
  font-weight:800;
  text-align:right;
  font-variant-numeric:tabular-nums;
}
.repy-bubble{
  position:relative;
  padding:18px 22px 16px;
  background:#fff;
  border:2px solid var(--sky);
  box-shadow:0 8px 20px rgba(23,69,110,.08);
}
.repy-bubble::before,
.repy-bubble::after{
  content:"";
  position:absolute;
  left:-15px;
  top:38px;
  border-style:solid;
  border-width:11px 15px 11px 0;
  border-color:transparent var(--sky) transparent transparent;
}
.repy-bubble::after{
  left:-11px;
  border-width:9px 12px 9px 0;
  border-color:transparent #fff transparent transparent;
}
.bubble-hi{
  margin:0 0 11px;
  color:var(--navy);
  font-size:17px;
  font-weight:900;
  letter-spacing:.01em;
}
.bubble-steps,.bubble-news{
  display:grid;
  gap:8px;
  margin:0;
  padding:0;
  list-style:none;
}
.bubble-steps li{
  display:grid;
  grid-template-columns:32px minmax(0,1fr);
  gap:10px;
  align-items:center;
  color:var(--ink2);
  font-size:11.5px;
  line-height:1.5;
}
.bubble-steps b{
  display:grid;
  place-items:center;
  height:26px;
  color:#fff;
  background:var(--sky-deep);
  font-size:10px;
  font-weight:900;
}
.bubble-steps strong{margin-right:8px;color:var(--ink);font-size:12px}
.bubble-news li{
  position:relative;
  padding-left:15px;
  color:var(--ink2);
  font-size:11.5px;
  line-height:1.55;
}
.bubble-news li::before{
  content:"";
  position:absolute;
  left:0;
  top:7px;
  width:6px;
  height:6px;
  background:var(--sky-deep);
}
.bubble-foot{
  display:flex;
  align-items:center;
  gap:10px;
  margin-top:10px;
  color:var(--muted);
  font-size:9.5px;
  font-weight:700;
}
.bubble-dots{display:flex;gap:5px}
.bubble-dots i{width:16px;height:4px;background:var(--sky-line)}
.bubble-dots i.is-on{background:var(--sky-deep)}

@media (max-width:1080px){
  .sidebar{
    width:100%;
    max-height:none;
    height:auto;
    flex-direction:row;
    flex-wrap:wrap;
    align-items:center;
    gap:10px;
    padding:9px 14px;
    overflow:visible;
    border-right:0;
    border-bottom:3px solid var(--sky);
  }
  .side-brand{padding:0 14px 0 0;border-bottom:0;border-right:2px solid var(--sky-line)}
  .side-logo{font-size:30px}
  .side-tagline{display:none}
  .side-nav{display:flex;gap:8px;margin-top:0}
  .side-nav-btn{width:auto;flex-direction:row;align-items:center;gap:8px;padding:9px 14px;font-size:16px}
  .side-nav-btn .nav-sub{display:none}
  .side-spacer{display:none}
  .side-gear{width:auto;margin:0 0 0 auto;padding:0 12px}
  .rightbar{position:absolute;right:0;top:34px;bottom:0;z-index:40;box-shadow:-10px 0 30px rgba(23,69,110,.18)}
  .repy-hero{grid-template-columns:150px minmax(0,1fr);gap:16px;padding:16px 18px}
  .bubble-hi{font-size:14px}
}
@media (max-width:620px){
  .repy-hero{grid-template-columns:96px minmax(0,1fr);gap:10px;padding:12px}
  .repy-bot{max-width:96px}
  .bubble-tabs{width:100%;margin-left:0}
  .bubble-count{display:none}
  .bubble-steps li,.bubble-news li{font-size:10.5px}
}
'''


# ---------------- 3. 追加 JS ----------------

JS = r'''
  /* ---------- V2.1.0：右侧日历栏 + 对话气泡轮换 ---------- */
  (function initV210Layout(){
    const RB_KEY = "repy-rightbar-closed-v1";
    const setRightbar = closed => {
      document.body.classList.toggle("rb-closed", closed);
      const btn = document.getElementById("calToggle");
      if (btn) btn.setAttribute("aria-expanded", String(!closed));
      try { localStorage.setItem(RB_KEY, closed ? "1" : "0"); } catch (err) {}
    };
    let rbClosed = false;
    try { rbClosed = localStorage.getItem(RB_KEY) === "1"; } catch (err) {}
    setRightbar(rbClosed);

    const toggle = document.getElementById("calToggle");
    if (toggle) toggle.addEventListener("click", () => setRightbar(!document.body.classList.contains("rb-closed")));
    const rbClose = document.getElementById("rbClose");
    if (rbClose) rbClose.addEventListener("click", () => setRightbar(true));

    let bubbleIndex = 0;
    let bubbleLeft = 10;
    let bubbleTimer = 0;
    const panes = Array.from(document.querySelectorAll(".bubble-pane"));
    const tabs = Array.from(document.querySelectorAll(".bubble-tab"));
    const dots = Array.from(document.querySelectorAll(".bubble-dots i"));
    const count = document.getElementById("bubbleCount");

    function showBubble(index, reset){
      bubbleIndex = index % panes.length;
      panes.forEach((p, i) => { p.hidden = i !== bubbleIndex; });
      tabs.forEach((t, i) => t.classList.toggle("is-on", i === bubbleIndex));
      dots.forEach((d, i) => d.classList.toggle("is-on", i === bubbleIndex));
      if (reset) bubbleLeft = 10;
      if (count) count.textContent = bubbleLeft + "s";
    }
    function tick(){
      bubbleLeft -= 1;
      if (bubbleLeft <= 0) showBubble(bubbleIndex + 1, true);
      else if (count) count.textContent = bubbleLeft + "s";
    }
    tabs.forEach((tab, i) => tab.addEventListener("click", () => showBubble(i, true)));
    if (panes.length) {
      showBubble(0, true);
      bubbleTimer = setInterval(tick, 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) clearInterval(bubbleTimer);
        else bubbleTimer = setInterval(tick, 1000);
      });
    }
  })();
'''


def main():
    s = io.open(TARGET, encoding="utf-8").read()
    if MARK in s:
        print("V2.1.0 布局已应用，跳过")
        return

    # 状态条
    assert OLD_STATUS in s, "status-strip 未匹配"
    s = s.replace(OLD_STATUS, NEW_STATUS, 1)

    # 侧边栏
    assert OLD_SIDEBAR in s, "sidebar 未匹配"
    s = s.replace(OLD_SIDEBAR, NEW_SIDEBAR, 1)

    # masthead：抠出 mini-cal 原块，再整体替换
    start = s.index(OLD_MAST_START)
    end = s.index("  </header>", start) + len("  </header>")
    mast = s[start:end]
    mini_start = mast.index(MINI_START)
    mini_end = mast.rindex("    </div>")     # mini-cal 的闭合 div
    mini_html = mast[mini_start:mini_end + len("    </div>")]
    assert 'id="miniGrid"' in mini_html and 'id="streakBtn"' in mini_html, "mini-cal 截取不完整"
    s = s[:start] + NEW_HERO.rstrip("\n") + s[end:]

    # 右侧栏插到 body-row 结尾（</main> 之后两个 </div>：shell / body-row）
    anchor = "</main>\n</div>\n</div>\n\n<div class=\"modal-mask\" id=\"releaseModal\""
    assert anchor in s, "body-row 收尾未匹配"
    rightbar = RIGHTBAR_OPEN + mini_html + "\n" + RIGHTBAR_CLOSE
    s = s.replace(anchor, "</main>\n</div>\n" + rightbar + "</div>\n\n<div class=\"modal-mask\" id=\"releaseModal\"", 1)

    # CSS / JS
    s = s.replace("</style>", CSS + "\n</style>", 1)
    last_script = s.rindex("</script>")
    s = s[:last_script] + JS + "\n" + s[last_script:]

    io.open(TARGET, "w", encoding="utf-8", newline="").write(s)
    print("V2.1.0 布局已应用：侧边栏 / 右侧日历栏 / Repy 对话气泡")


if __name__ == "__main__":
    main()
