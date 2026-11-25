# -*- coding: utf-8 -*-
"""
按 2026-11-24 第三批批注截图修改（可重复执行 / 一次性替换）：
  1. 动作配置行左侧那条蓝色索引色条去掉，改用整块高透明度背景色表示索引色
  2. 重量开关里的「各」字绝对居中
  3. 去掉「留空只记组次」提示文字
  4. 「健身已经」从日历卡片里独立出来，去掉浅蓝色块，用留白分隔
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


# ---------- 1. 去掉「留空只记组次」 ----------
rep(
    '        <div class="weight-presets">留空只记组次</div>',
    '        <div class="weight-presets" aria-hidden="true"></div>',
    "删除「留空只记组次」提示文字",
)

# ---------- 2. 「健身已经」移出日历卡片 ----------
rep(
    '      <button class="streak" type="button" id="streakBtn" title="点击修改健身起点">\n'
    '        <span class="streak-text">\n'
    '          <span class="streak-label" id="streakLabel">健身已经</span>\n'
    '          <span class="streak-line"><b class="streak-days" id="streakDays">—</b><span class="streak-unit">天</span></span>\n'
    '        </span>\n'
    '        <span class="streak-edit">改起点</span>\n'
    '      </button>\n'
    '    </div>\n'
    '    </div>',
    '    </div>\n'
    '    <button class="streak" type="button" id="streakBtn" title="点击修改健身起点">\n'
    '      <span class="streak-text">\n'
    '        <span class="streak-label" id="streakLabel">健身已经</span>\n'
    '        <span class="streak-line"><b class="streak-days" id="streakDays">—</b><span class="streak-unit">天</span></span>\n'
    '      </span>\n'
    '      <span class="streak-edit">改起点</span>\n'
    '    </button>\n'
    '    </div>',
    "「健身已经」从日历卡片里独立出来",
)

# ---------- 3. 覆盖层 CSS ----------
POLISH = r'''
/* ============================================================
   V2.1.0 第三批批注：索引色改背景 / 「各」字居中 / 健身已经独立
   ============================================================ */

/* 动作配置行：不再用左侧蓝色竖条，改成整块高透明度部位色背景 */
.load-row{
  border:1px solid color-mix(in srgb,var(--group-color,var(--blue)) 26%,transparent)!important;
  border-left-width:1px!important;
  background:color-mix(in srgb,var(--group-color,var(--blue)) 10%,transparent)!important;
}

/* 「各」字在开关里绝对居中 */
.each-toggle{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  letter-spacing:0!important;
}
.each-toggle span{
  display:block!important;
  margin:0!important;
  line-height:1!important;
}

/* 「健身已经」独立于日历：去掉底色块，靠留白分隔 */
.streak{
  margin:18px 2px 4px!important;
  padding:6px 4px!important;
  color:var(--navy)!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.streak:hover{background:transparent!important}
.streak-label{color:var(--muted)!important}
.streak-edit{
  color:var(--navy)!important;
  background:color-mix(in srgb,var(--sky-deep) 14%,transparent)!important;
  border:0!important;
}

'''
rep("\n</style>", "\n" + POLISH + "</style>", "追加索引色 / 居中 / 留白 CSS")

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
    "  report.floatBatch = await run(`(() => {\n",
    "  report.loadRowBatch = await run(`(() => {\n"
    "    const cs = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };\n"
    "    const lr = cs('.load-row');\n"
    "    const et = cs('.each-toggle');\n"
    "    return {\n"
    "      loadRowLeft: lr ? lr.borderLeftWidth : 'none',\n"
    "      loadRowBorder: lr ? lr.borderLeftColor : 'none',\n"
    "      loadRowBg: lr ? lr.backgroundColor : 'none',\n"
    "      eachToggleDisplay: et ? et.display : 'none',\n"
    "      eachToggleJustify: et ? et.justifyContent : 'none',\n"
    "      weightPresetsText: (document.querySelector('.weight-presets')?.textContent || '').trim(),\n"
    "      streakInMiniCal: Boolean(document.querySelector('.mini-cal .streak')),\n"
    "      streakBg: cs('.streak')?.backgroundColor,\n"
    "      streakMarginTop: cs('.streak')?.marginTop\n"
    "    };\n"
    "  })()`);\n\n"
    "  report.floatBatch = await run(`(() => {\n",
    "新增第三批批注自检",
)

CHECK.write_text(c, encoding="utf-8")
print("[saved]", CHECK)
print("done")
