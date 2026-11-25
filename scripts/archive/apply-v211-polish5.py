# -*- coding: utf-8 -*-
"""V2.1.0 收尾五（源子第十批需求）：
1. 开关日历时星期选中块不漂移；复盘 / 设置页不再显示右侧日历栏
2. 撰写 / 复盘字号再收小；Repy 字标与两个选项卡整体下移
3. 更新日志：小机器人改举哑铃，文案同步当前版本
4. 设置页：卡片标题与选项拉开层次，可读性更强
"""
import io, os

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
        raise SystemExit("[FAIL] 未找到: " + label)
    n = s.count(old)
    if n != count:
        raise SystemExit("[FAIL] %s 匹配 %d 次，期望 %d 次" % (label, n, count))
    print("[ok]", label)
    return s.replace(old, new)


s = read(HTML)

# ------------------------------------------- 1a. 复盘 / 设置页隐藏右侧栏
s = sub(s, """    Object.entries(pages).forEach(([name, el]) => {
      if (el) el.hidden = name !== page;
    });
    const floatTools = $("floatTools");""",
        """    Object.entries(pages).forEach(([name, el]) => {
      if (el) el.hidden = name !== page;
    });
    document.body.classList.toggle("rb-hidden", page !== "generator");
    const floatTools = $("floatTools");""",
        "非撰写页隐藏右侧栏")

s = sub(s, """    if (page === "generator") { renderMiniCalendar(); moveDayThumb(); }""",
        """    if (page === "generator") { renderMiniCalendar(); snapDayThumb(); }""",
        "切回撰写页重新吸附滑块")

# ------------------------------------------- 1b. 右侧栏过渡期间逐帧吸附滑块
s = sub(s, """  window.addEventListener("resize", moveDayThumb);
""",
        """  window.addEventListener("resize", moveDayThumb);

  /* 右侧栏开合时宽度有 .2s 过渡，容器变宽会让星期选中块错位。
     过渡期间逐帧重算，并临时关掉它自己的过渡，避免出现滑过去的位移。 */
  function snapDayThumb(){
    const thumb = $("dayThumb");
    if (thumb) thumb.classList.add("is-snapping");
    const start = Date.now();
    const step = () => {
      moveDayThumb();
      if (Date.now() - start < 300) requestAnimationFrame(step);
      else if (thumb) thumb.classList.remove("is-snapping");
    };
    requestAnimationFrame(step);
    /* 兜底：窗口被节流导致 rAF 停摆时，过渡结束后仍会对齐一次 */
    setTimeout(() => {
      moveDayThumb();
      if (thumb) thumb.classList.remove("is-snapping");
    }, 320);
  }
""",
        "新增 snapDayThumb")

s = sub(s, """      try { localStorage.setItem(RB_KEY, closed ? "1" : "0"); } catch (err) {}
    };""",
        """      try { localStorage.setItem(RB_KEY, closed ? "1" : "0"); } catch (err) {}
      if (typeof snapDayThumb === "function") snapDayThumb();
    };""",
        "开关日历时吸附滑块")

# ------------------------------------------- 2. 侧栏字号收小 + 整体下移
s = sub(s, """  padding:22px 15px 18px;
  color:var(--ink);""",
        """  padding:46px 15px 18px;
  color:var(--ink);""",
        "Repy 与选项卡整体下移")

s = sub(s, """  font-size:20px!important;
  font-weight:900!important;
  line-height:1.15!important;
  letter-spacing:.02em!important;""",
        """  font-size:17px!important;
  font-weight:900!important;
  line-height:1.15!important;
  letter-spacing:.02em!important;
  min-height:46px!important;
  padding:11px 16px!important;""",
        "选项卡字号 20 -> 17")

# ------------------------------------------- 3. 更新日志改哑铃 + 同步当前版本
OLD_RELEASE = """    <ul class="release-list">
      <li><b>全新的 Repy</b>：换了应用图标，小机器人一手拿笔帮你撰写、一手拿放大镜帮你复盘；全站换成 JR0 浅蓝主题</li>
      <li><b>导入记录</b>：设置里新增「导入记录」，把外来数据交给 AI agent 翻译成 Repy 格式，粘贴回来预览确认即可并进现有记录</li>
      <li><b>分享软件</b>：设置里新增「分享软件」，重新打包一份安装包，保存在哪里由你自己选</li>
      <li>左侧边栏去掉操作步骤卡，只留粗体的 <b>Repy</b> 和加粗放大的「撰写」「复盘」两个标签</li>
      <li>新增右侧可收起的日历栏，原来标题旁的小日历搬进去了，顶条上可以一键开关</li>
      <li>主页面换成 Repy 机器人 + 对话气泡：使用步骤与新版日志每 10 秒轮换，也能点标签立刻切</li>
      <li>补记录更克制：只有空白日期变绿，已有记录的日子保持原样；提示弹窗多了「不再提醒」，设置里能改回来</li>
    </ul>"""
NEW_RELEASE = """    <ul class="release-list">
      <li><b>全新的 Repy</b>：换了应用图标，小机器人举着哑铃陪你撰写记录、复盘记录；界面换成 JR0 浅蓝主题，图标和界面风格统一</li>
      <li><b>界面更清爽</b>：左侧只留「撰写」「复盘」，右侧是可收起的日历栏；全站黑体、圆角统一，索引色改成整块高透明度色块</li>
      <li><b>Repy 会说话了</b>：主页机器人旁的对话气泡分「问候 / 怎么用 / 新版本」三屏，自动轮换，点标签可立刻切；气泡伸缩不会推动页面</li>
      <li><b>导入记录</b>：设置里新增「导入记录」，把外来数据交给 AI agent 翻译成 Repy 格式，粘贴回来预览确认即可并进现有记录</li>
      <li><b>分享软件</b>：设置里新增「分享软件」，重新打包一份安装包，保存在哪里由你自己选</li>
      <li><b>补记录更克制</b>：只有空白日期变绿，已有记录的日子保持原样；提示弹窗多了「不再提醒」，设置里能改回来</li>
    </ul>"""
s = sub(s, OLD_RELEASE, NEW_RELEASE, "更新日志改哑铃并同步当前版本")

# ------------------------------------------- 4. 设置页层次 + 1 的 CSS
CSS = """
/* ============================================================
   V2.1.0 收尾五：右栏按页显隐 / 滑块吸附 / 侧栏下移 / 设置页层次
   ============================================================ */

/* 右侧日历栏只在「撰写」页出现；用户的开合偏好仍由 rb-closed 保存 */
body.rb-hidden .rightbar{display:none!important}
/* 容器宽度过渡期间，选中块瞬时跟随、不做补间，避免视觉位移 */
.day-thumb.is-snapping{transition:none!important}

/* 设置页：卡片标题做成整块浅蓝底，与选项行拉开三级层次 */
.set-card-head{
  padding:16px 18px 14px!important;
  background:color-mix(in srgb,var(--sky-deep) 9%,transparent)!important;
  border-bottom:1px solid rgba(43,143,214,.18)!important;
}
.set-card-head h3{
  margin:0;
  color:#173a5e!important;
  font-size:17px!important;
  font-weight:900!important;
  letter-spacing:.01em;
}
.set-card-head p{
  margin:5px 0 0;
  color:#5b7b96!important;
  font-size:11px!important;
  line-height:1.55;
}
.set-row{
  padding:14px 18px;
  transition:background-color .16s ease;
}
.set-row:hover{background:rgba(143,211,244,.07)}
.set-row-text strong{
  color:#1d3f5e!important;
  font-size:13px!important;
  font-weight:800!important;
}
.set-row-text span{
  color:#7893a8!important;
  font-size:11px!important;
}
"""
idx = s.rfind("</style>")
if idx < 0:
    raise SystemExit("[FAIL] 找不到 </style>")
s = s[:idx] + CSS + "\n" + s[idx:]
print("[ok] 追加 CSS 收尾块")

write(HTML, s)

# ================================================================ check.js
c = read(CHECK)

OLD = """  report.runErrors = runErrors;
"""
NEW = """  // 第十批：星期滑块不漂移 + 右栏按页显隐
  const thumbDrift = () => run(`(() => {
    const t = document.querySelector('#dayTabs .day-tab.active');
    const th = document.getElementById('dayThumb');
    if (!t || !th) return 999;
    const a = t.getBoundingClientRect(), b = th.getBoundingClientRect();
    return Math.round(Math.abs(b.left - a.left) + Math.abs(b.width - a.width));
  })()`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(350);
  const d0 = await thumbDrift();
  await run(`document.getElementById('calToggle').click();`);
  await wait(100);
  const dMid1 = await thumbDrift();
  await wait(320);
  const d1 = await thumbDrift();
  await run(`document.getElementById('calToggle').click();`);
  await wait(100);
  const dMid2 = await thumbDrift();
  await wait(320);
  const d2 = await thumbDrift();
  await run(`document.querySelector('[data-page="overview"]').click();`);
  await wait(320);
  const rbOverview = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  await run(`document.querySelector('[data-page="settings"]').click();`);
  await wait(320);
  const rbSettings = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(420);
  const rbGenerator = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  const d3 = await thumbDrift();
  report.polish5Motion = { d0, dMid1, d1, dMid2, d2, d3, rbOverview, rbSettings, rbGenerator };

  report.polish5 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const rel = document.querySelector('.release-list')?.textContent || '';
    return {
      navSize: cs('.side-nav-btn')?.fontSize,
      sidebarPadTop: cs('.sidebar')?.paddingTop,
      releaseDumbbell: rel.indexOf('哑铃') >= 0,
      releaseNoOldTools: !/拿笔|放大镜/.test(rel),
      releaseItems: document.querySelectorAll('.release-list li').length,
      setHeadSize: cs('.set-card-head h3')?.fontSize,
      setHeadWeight: cs('.set-card-head h3')?.fontWeight,
      setHeadBg: cs('.set-card-head')?.backgroundColor,
      setOptionSize: cs('.set-row-text strong')?.fontSize,
      setDescSize: cs('.set-row-text span')?.fontSize,
      setDescColor: cs('.set-row-text span')?.color
    };
  })()`);

  report.runErrors = runErrors;
"""
c = sub(c, OLD, NEW, "check.js 新增 polish5 与右栏/滑块运动断言")

write(CHECK, c)
print("[done] index.html 与 check.js 已更新")
