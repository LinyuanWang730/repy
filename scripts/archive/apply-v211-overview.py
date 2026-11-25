# -*- coding: utf-8 -*-
"""
按 2026-11-24 批注截图修改（可重复执行 / 一次性替换）：
  1. 删掉顶部浅蓝状态条与「Repy · 撰写与复盘训练记录」
  2. 版本号 + 日历移到内容区右上角悬浮，且只在「撰写」页显示
  3. 去掉 Repy 下面的小字；Repy 字改深灰色
  4. 撰写 / 复盘两个选项卡做精致
  5. 复盘页三个数字块改成完整有底色的圆角矩形，去掉左侧色条与虚线小标签
  6. 去掉日历卡片 / Hero / 大标题上的粗色条，只留完整圆角矩形
  7. 设置按钮换成标准齿轮图标
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


# ---------- 1. 顶部浅蓝条 -> 右上角悬浮工具 ----------
rep(
    '<div class="status-strip">\n'
    '  <button class="version-chip" type="button" id="versionChip" title="查看更新日志">V2.1.0</button>\n'
    '  <span class="version-note">Repy · 撰写与复盘训练记录</span>\n'
    '  <button class="cal-toggle" type="button" id="calToggle" aria-expanded="true" aria-controls="rightBar"><span aria-hidden="true">▦</span> 日历</button>\n'
    '</div>',
    '<div class="float-tools" id="floatTools">\n'
    '  <button class="version-chip" type="button" id="versionChip" title="查看更新日志">V2.1.0</button>\n'
    '  <button class="cal-toggle" type="button" id="calToggle" aria-expanded="true" aria-controls="rightBar"><span aria-hidden="true">▦</span> 日历</button>\n'
    '</div>',
    "删除顶部状态条，换成右上角悬浮工具",
)

# ---------- 2. 左侧字标 / 选项卡 / 齿轮 ----------
rep('      <div class="side-tagline">撰写 · 复盘训练记录</div>\n', "", "删除 Repy 下面的小字")

GEAR_OLD = (
    '      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square">\n'
    '        <circle cx="12" cy="12" r="3.2"></circle>\n'
    '        <path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.9l2.7 1.6M16.9 14.5l2.7 1.6M4.4 16.1l2.7-1.6M16.9 9.5l2.7-1.6"></path>\n'
    '      </svg>'
)
GEAR_NEW = (
    '      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">\n'
    '        <circle cx="12" cy="12" r="3.1"></circle>\n'
    '        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>\n'
    '      </svg>'
)
rep(GEAR_OLD, GEAR_NEW, "设置按钮换成标准齿轮图标")

# ---------- 3. 清掉已经没有对应 DOM 的旧 CSS ----------
rep(
    ".status-strip{\n"
    "  position:sticky;\n"
    "  top:0;\n"
    "  z-index:55;\n"
    "  display:flex;\n"
    "  align-items:center;\n"
    "  gap:9px;\n"
    "  min-height:34px;\n"
    "  padding:7px 24px;\n"
    "  color:var(--navy);\n"
    "  background:var(--yellow);\n"
    "  border-bottom:1px solid #63b4e0;\n"
    "  font-size:11px;\n"
    "  font-weight:800;\n"
    "  letter-spacing:.06em;\n"
    "}\n",
    "",
    "删除状态条 CSS",
)
rep(".version-note{color:var(--navy);font-size:11px;font-weight:800;letter-spacing:.06em}\n", "", "删除版本说明 CSS")
rep("  .status-strip{padding:7px 14px}\n", "", "删除窄屏状态条 CSS")
rep(
    ".side-tagline{\n"
    "  margin-top:9px;\n"
    "  color:var(--ink2);\n"
    "  font-size:10.5px;\n"
    "  font-weight:800;\n"
    "  letter-spacing:.08em;\n"
    "}\n",
    "",
    "删除字标小字 CSS",
)
rep("  .side-tagline{display:none}\n", "", "删除窄屏小字 CSS")

# ---------- 4. 只在「撰写」页显示悬浮工具 ----------
rep(
    '    Object.entries(pages).forEach(([name, el]) => {\n'
    '      if (el) el.hidden = name !== page;\n'
    '    });\n',
    '    Object.entries(pages).forEach(([name, el]) => {\n'
    '      if (el) el.hidden = name !== page;\n'
    '    });\n'
    '    const floatTools = $("floatTools");\n'
    '    if (floatTools) floatTools.hidden = page !== "generator";\n',
    "showPage 里控制悬浮工具显隐",
)

# ---------- 5. 覆盖层 CSS ----------
POLISH = r'''
/* ============================================================
   V2.1.0 批注修订：顶部悬浮工具 / 左侧字标 / 完整圆角矩形
   ============================================================ */

/* 版本号 + 日历：悬浮在内容区右上角，滚动时固定；只在「撰写」页出现 */
.float-tools{
  position:fixed;
  top:12px;
  right:calc(313px + 22px);
  z-index:56;
  display:flex;
  align-items:center;
  gap:8px;
  padding:6px 8px;
  background:rgba(255,255,255,.86);
  border:1px solid var(--sky-line);
  box-shadow:0 6px 18px rgba(23,69,110,.13);
  backdrop-filter:blur(8px);
}
body.rb-closed .float-tools{right:22px}
.float-tools[hidden]{display:none!important}
.float-tools .cal-toggle{margin-left:0!important}
.float-tools .version-chip{min-height:24px;padding:3px 9px 2px!important}
.float-tools .cal-toggle{min-height:24px}
@media (max-width:1080px){
  .float-tools{right:16px!important;top:10px!important}
}

/* 左侧：去掉 Repy 下的小字与分割线，字标改深灰，选项卡做精致 */
.side-brand{padding:0 4px 18px!important;border-bottom:0!important}
.side-logo{
  color:#3d4650!important;
  font-size:42px!important;
  letter-spacing:-.05em!important;
}
.side-nav{gap:10px!important;margin-top:24px!important}
.side-nav-btn{
  min-height:52px!important;
  padding:13px 16px!important;
  font-size:20px!important;
  letter-spacing:.04em!important;
  border:1px solid rgba(43,143,214,.22)!important;
  background:rgba(255,255,255,.58)!important;
  box-shadow:0 2px 8px rgba(23,69,110,.05)!important;
}
.side-nav-btn:hover{
  background:rgba(255,255,255,.88)!important;
  border-color:rgba(43,143,214,.45)!important;
  transform:translateY(-1px);
}
.side-nav-btn.is-current{
  color:var(--navy)!important;
  background:color-mix(in srgb,var(--sky-deep) 26%,transparent)!important;
  border-color:color-mix(in srgb,var(--sky-deep) 55%,transparent)!important;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 6px 14px rgba(23,69,110,.12)!important;
}
.side-gear{min-height:40px!important;gap:8px!important}
.side-gear svg{width:17px!important;height:17px!important}

/* 三个数字块：完整的有底色圆角矩形，不再有左侧色条和虚线小标签 */
.ov-stat{
  border:1px solid rgba(255,255,255,.30)!important;
  background:rgba(255,255,255,.16)!important;
  box-shadow:none!important;
}
button.ov-stat{border:1px solid rgba(255,255,255,.30)!important}
.ov-stat.is-edit:hover{background:rgba(255,255,255,.26)!important}
.ov-stat.is-edit:active{background:rgba(255,255,255,.32)!important}
.ov-hint{
  border:0!important;
  color:rgba(255,255,255,.86)!important;
  background:rgba(255,255,255,.20)!important;
  padding:1px 5px!important;
  vertical-align:1px!important;
}
.ov-stat.is-edit:hover .ov-hint,
.ov-stat.is-edit .ov-hint{color:var(--navy)!important;background:var(--yellow)!important}

/* 只保留完整的圆角矩形：去掉只画了一部分的粗色条 */
.ov-head,.repy-hero,.set-head,.plan-banner{border:0!important}
.cal-panel,.mini-cal,.rightbar .mini-cal,
.import-lead,.rec-block{
  border:1px solid var(--rule)!important;
  border-left-width:1px!important;
  box-shadow:var(--shadow)!important;
}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加批注修订 CSS")

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
    "    aiStrip: !document.getElementById('aiStrip').hidden,\n"
    "    editables: [...document.querySelectorAll('.ov-stat.is-edit')].map(el => el.id)\n",
    "    aiStrip: !document.getElementById('aiStrip').hidden,\n"
    "    editables: [...document.querySelectorAll('.ov-stat.is-edit')].map(el => el.id),\n"
    "    floatHiddenOnOverview: document.getElementById('floatTools').hidden\n",
    "复盘页验证悬浮工具已隐藏",
)

crep(
    "  report.polish = await run(`(() => {\n",
    "  report.annotation = await run(`(() => {\n"
    "    const cs = sel => getComputedStyle(document.querySelector(sel));\n"
    "    return {\n"
    "      stripGone: !document.querySelector('.status-strip'),\n"
    "      taglineGone: !document.querySelector('.side-tagline'),\n"
    "      logoColor: cs('.side-logo').color,\n"
    "      floatVisibleOnGenerator: !document.getElementById('floatTools').hidden,\n"
    "      floatPosition: cs('.float-tools').position,\n"
    "      statLeft: cs('.ov-stat').borderLeftWidth,\n"
    "      statTop: cs('.ov-stat').borderTopWidth,\n"
    "      statRadius: cs('.ov-stat').borderTopLeftRadius,\n"
    "      hintBorderStyle: cs('.ov-hint').borderTopStyle,\n"
    "      calPanelTop: cs('.cal-panel').borderTopWidth,\n"
    "      ovHeadBottom: cs('.ov-head').borderBottomWidth,\n"
    "      heroBottom: cs('.repy-hero').borderBottomWidth,\n"
    "      setHeadBottom: cs('.set-head').borderBottomWidth,\n"
    "      planBannerLeft: cs('.plan-banner').borderLeftWidth,\n"
    "      gearPath: document.querySelector('.side-gear svg path').getAttribute('d').length\n"
    "    };\n"
    "  })()`);\n\n"
    "  report.polish = await run(`(() => {\n",
    "新增批注修订自检",
)

crep(
    "  await run(`document.getElementById('calToggle').click();`);\n",
    "  await run(`document.querySelector('[data-page=\"generator\"]').click();`);\n"
    "  await wait(200);\n"
    "  await run(`document.getElementById('calToggle').click();`);\n",
    "点日历按钮前先回到撰写页",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
