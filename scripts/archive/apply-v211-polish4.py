# -*- coding: utf-8 -*-
"""V2.1.0 收尾四（源子第七批需求）+ 收尾三遗留：
1. 左侧撰写 / 复盘字号收小、更精致
2. 全站字体统一到黑体栈（去掉 Arial Black / 系统 UI 字体回落）
3. 新版本屏下方留白：三屏高度差压小、内容垂直居中、气泡在舞台里居中
4. 滚动条改为不占布局的自定义细条：平时 4px、悬停 8px，界面绝不抽动
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
    print("[ok]", label, "x%d" % n)
    return s.replace(old, new)


s = read(HTML)

STACK = '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Hiragino Sans GB","SimHei","黑体","Heiti SC",Arial,sans-serif'

# ------------------------------------------------- 2. 全站字体统一到黑体栈
FONT_OLD = [
    ('-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","SimHei","黑体","PingFang SC","Hiragino Sans GB","Heiti SC",Arial,sans-serif', 1),
    ('"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif', 14),
    ('"PingFang SC","Hiragino Sans GB","SimHei","黑体","Microsoft YaHei",sans-serif', 4),
    ('"Arial Black","Segoe UI","Microsoft YaHei UI","PingFang SC",sans-serif', 1),
    ('"Arial Black","Microsoft YaHei","SimHei","黑体",sans-serif', 1),
]
for old, cnt in FONT_OLD:
    s = sub(s, old, STACK, "统一字体栈 " + old[:28], cnt)

# ------------------------------------------------- 1. 侧栏字号收小
s = sub(s, """  font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","SimHei","黑体",sans-serif!important;
  font-size:24px!important;
  font-weight:900!important;
  line-height:1.15!important;""",
        """  font-family:%s!important;
  font-size:20px!important;
  font-weight:900!important;
  line-height:1.15!important;
  letter-spacing:.02em!important;""" % STACK,
        "侧栏字号 24 -> 20")

# ------------------------------------------------- 3. 新版本屏留白
s = sub(s, """  min-height:140px;
  text-align:center;
}""", """  min-height:126px;
  text-align:center;
}""", "问候屏最小高度收小")

s = sub(s, """.bubble-pane[hidden]{display:none!important}""",
        """.bubble-stage{align-items:center!important}
.bubble-pane[hidden]{display:none!important}""", "气泡在舞台中垂直居中")

s = sub(s, """.repy-bubble .bubble-pane .bubble-hi{color:#0f3c68!important;font-size:18px!important}""",
        """.repy-bubble .bubble-pane .bubble-hi{color:#0f3c68!important;font-size:18px!important}
/* 新版本屏内容少：撑到与其它屏接近的高度并垂直居中，底部不再空一大块 */
.bubble-pane[data-pane="2"]{
  display:flex;
  flex-direction:column;
  justify-content:center;
  min-height:118px;
}
.bubble-pane[data-pane="2"] .bubble-hi{margin-bottom:9px!important}""",
        "新版本屏撑高且内容居中")

# ------------------------------------------------- 4. 自定义不占布局滚动条
SB_OLD = """/* 滚动条：轨道宽度恒定，悬停只改 thumb 着色，界面绝不抽动 */
:root{--sb:12px}
*::-webkit-scrollbar{width:12px;height:12px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{
  background:linear-gradient(rgba(23,69,110,.22),rgba(23,69,110,.22)) center/6px 100% no-repeat;
  border-radius:999px;
}
html.sb-hover *::-webkit-scrollbar-thumb{
  background:linear-gradient(rgba(23,69,110,.48),rgba(23,69,110,.48)) center/12px 100% no-repeat;
}"""
SB_NEW = """/* 其它滚动容器：极细原生条 */
:root{--sb:6px}
*::-webkit-scrollbar{width:var(--sb);height:var(--sb)}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(23,69,110,.22);border-radius:999px}
/* 主内容区：原生条隐藏，改用不占布局的自定义细条，悬停只改它自己的宽度 */
#shell::-webkit-scrollbar{width:0!important;height:0!important}
.sb-overlay{position:fixed;width:14px;z-index:70}
.sb-thumb{
  position:absolute;
  right:3px;
  top:0;
  width:4px;
  min-height:36px;
  background:rgba(23,69,110,.28);
  border-radius:999px;
  transition:width .16s ease,background-color .16s ease;
}
.sb-overlay:hover .sb-thumb{width:8px;background:rgba(23,69,110,.55)}"""
s = sub(s, SB_OLD, SB_NEW, "滚动条改自定义细条")

JS_OLD = """    /* 滚动条：平时极细，鼠标移到滚动条区域才加粗 */
    (function initScrollbarHover(){
      const html = document.documentElement;
      function update(e){
        let hit = false;
        ["shell", "rightBar"].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.right - 18 && e.clientX <= r.right + 6 &&
              e.clientY >= r.top && e.clientY <= r.bottom) hit = true;
        });
        html.classList.toggle("sb-hover", hit);
      }
      document.addEventListener("mousemove", update, {passive:true});
      document.addEventListener("mouseleave", () => html.classList.remove("sb-hover"));
    })();"""
JS_NEW = """    /* 主内容区滚动条：绝对定位、不占布局，悬停加粗也不会让界面抽动 */
    (function initOverlayScrollbar(){
      const shell = document.getElementById("shell");
      if (!shell) return;
      const overlay = document.createElement("div");
      overlay.className = "sb-overlay";
      const thumb = document.createElement("span");
      thumb.className = "sb-thumb";
      overlay.appendChild(thumb);
      document.body.appendChild(overlay);
      function layout(){
        const r = shell.getBoundingClientRect();
        overlay.style.left = (r.right - 14) + "px";
        overlay.style.top = r.top + "px";
        overlay.style.height = r.height + "px";
        const total = shell.scrollHeight;
        const view = shell.clientHeight;
        if (total <= view + 2 || view <= 0) { thumb.style.display = "none"; return; }
        thumb.style.display = "";
        const h = Math.max(36, view * view / total);
        thumb.style.height = h + "px";
        const maxTop = Math.max(0, view - h);
        const ratio = Math.min(1, shell.scrollTop / (total - view));
        thumb.style.top = (ratio * maxTop) + "px";
      }
      shell.addEventListener("scroll", layout, {passive:true});
      window.addEventListener("resize", layout);
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(layout);
        ro.observe(shell);
        ["generatorPage", "overviewPage", "settingsPage"].forEach(id => {
          const el = document.getElementById(id);
          if (el) ro.observe(el);
        });
      }
      layout();
      requestAnimationFrame(layout);
    })();"""
s = sub(s, JS_OLD, JS_NEW, "滚动条 JS 改自定义实现")

write(HTML, s)

# ================================================================ check.js
c = read(CHECK)

OLD = """      sbGutterBefore: gutterBefore,
      sbGutterAfter: gutterAfter,
      clientDelta: Math.abs(clientAfter - clientBefore)
    };
  })()`);
"""
NEW = """      sbGutterBefore: gutterBefore,
      sbGutterAfter: gutterAfter,
      clientDelta: Math.abs(clientAfter - clientBefore)
    };
  })()`);

  // 本轮追加：字号 / 全站黑体 / 新版本屏留白 / 不占布局的滚动条
  report.polish4 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const panes = [...document.querySelectorAll('.bubble-pane')];
    const heights = panes.map(p => {
      const was = p.hidden;
      p.hidden = false;
      const h = Math.round(p.getBoundingClientRect().height);
      p.hidden = was;
      return h;
    });
    const shell = document.getElementById('shell');
    return {
      navSize: cs('.side-nav-btn')?.fontSize,
      navLetter: cs('.side-nav-btn')?.letterSpacing,
      logoFont: cs('.side-logo')?.fontFamily,
      bodyFont: cs('body')?.fontFamily,
      helloFont: cs('.bubble-hello')?.fontFamily,
      monoFont: cs('.mono')?.fontFamily,
      paneHeights: heights,
      heightSpread: Math.max.apply(null, heights) - Math.min.apply(null, heights),
      stageAlign: cs('.bubble-stage')?.alignItems,
      newsPaneMin: cs('[data-pane="2"]')?.minHeight,
      newsJustify: cs('[data-pane="2"]')?.justifyContent,
      sbOverlay: !!document.querySelector('.sb-overlay'),
      sbThumbWidth: cs('.sb-thumb')?.width,
      sbHoverWidth: (() => {
        for (const sheet of document.styleSheets) {
          let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
          for (const r of rules) {
            if (r.selectorText && r.selectorText.indexOf('.sb-overlay:hover .sb-thumb') >= 0) return r.style.width;
          }
        }
        return 'none';
      })(),
      sbNativeGutter: shell.offsetWidth - shell.clientWidth
    };
  })()`);
"""
c = sub(c, OLD, NEW, "check.js 新增 polish4")

write(CHECK, c)
print("[done] index.html 与 check.js 已更新")
