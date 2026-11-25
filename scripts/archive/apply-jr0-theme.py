# -*- coding: utf-8 -*-
"""
JR0 浅蓝主题 · 一次性换肤脚本（V2.1.0）

把 src/index.html 里原有的「深藏青 + 黄」配色整体换成蓝色系：
  - 主色 --yellow（原本是黄）改叫浅蓝，值 #8FD3F4
  - 深底 --navy 改成更蓝的 #1D5FA8，白字仍然可读
  - 所有黄色系硬编码（按钮、边框、日历有记录底色）映射到对应浅蓝
  - 灰绿系边框/底色统一偏蓝灰
  - 补记录的绿色系不动（它是状态色，用户明确要求绿）

用正则一次性替换，不会链式二次替换；脚本可重复跑（已换过的不会变）。
用法：python scripts/apply-jr0-theme.py
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "src", "index.html")

# ---------------- 变量块（整块替换，并新增 JR0 专用变量） ----------------
OLD_VARS = """  --paper:#f3f2ed;
  --card:#ffffff;
  --card2:#f5f5f0;
  --ink:#142536;
  --ink2:#43515d;
  --muted:#71808b;
  --rule:#c9d0d2;
  --faint:#84909a;
  --navy:#09283f;
  --blue:#155f9e;
  --yellow:#f1c84b;
  --green:#008b68;
  --red:#df4c43;
  --gold:#9a6a19;
  --violet:#5a5470;
  --teal:#2b8394;
  --shadow:0 8px 24px rgba(9,40,63,.07);"""

NEW_VARS = """  /* JR0 浅蓝主题 · V2.1.0 —— 与 Repy 图标同一套蓝 */
  --paper:#f2f8fc;
  --card:#ffffff;
  --card2:#f3f8fc;
  --ink:#173a5e;
  --ink2:#3f6183;
  --muted:#7a95ac;
  --rule:#c9dce9;
  --faint:#93aabd;
  --navy:#1d5fa8;          /* 深底：侧边栏 / 大标题，白字仍可读 */
  --blue:#2b8fd6;          /* 中蓝：hover / 链接 */
  --yellow:#8fd3f4;        /* 主色（沿用旧变量名）：JR0 浅蓝 */
  --sky:#8fd3f4;
  --sky-soft:#e6f5fd;
  --sky-line:#b6ddf2;
  --sky-deep:#2b8fd6;
  --green:#008b68;
  --red:#df4c43;
  --gold:#2a6fa8;
  --violet:#5a5470;
  --teal:#2b8394;
  --shadow:0 8px 24px rgba(23,69,110,.09);"""

# ---------------- 黄色系 → 浅蓝系 ----------------
HEX = {
    # 主黄 / 强调
    "#f1c84b": "#8fd3f4",
    "#d6ad32": "#63b4e0",
    "#e5b836": "#a5def7",
    "#e3c463": "#8cc9ea",
    "#d9b443": "#5fa9d8",
    "#d9ad29": "#4e9bd0",
    "#d8a92c": "#4e9bd0",
    "#c79e24": "#3e8bc4",
    "#bd921d": "#3479b2",
    "#e8d08a": "#b3dcf2",
    "#f0e6c2": "#dceffa",
    "#f0e3b8": "#d9edf9",
    "#e9dfb4": "#d5ebf7",
    "#d9cba1": "#c6e1f1",
    "#b3701a": "#2a6fa8",
    "#9a6a19": "#2a6fa8",
    # 日历 / 卡片淡黄底
    "#fff8dd": "#eaf6fd",
    "#ffefb0": "#cdeafb",
    "#fff1bd": "#e4f3fc",
    "#ffeaa6": "#d6eefb",
    "#fff9df": "#f0f9fe",
    "#fffaea": "#eef8fe",
    "#fff6d4": "#e9f5fd",
    "#fff4c9": "#e5f3fc",
    "#ffe58f": "#d2ecfa",
    "#fffdf4": "#f8fcff",
    "#fffdf2": "#f8fcff",
    "#fffbfa": "#f8fcff",
    # 深藏青系
    "#061c2e": "#10385f",
    "#18384f": "#1d5fa8",
    "#09283f": "#17456e",
    "#0f3a58": "#1c5b91",
    "#183b55": "#1c5b91",
    "#155f9e": "#2b8fd6",
    "#0d6faf": "#2b8fd6",
    "#142536": "#173a5e",
    # 灰绿边框/底色 → 蓝灰
    "#dfe3e4": "#dce7ef",
    "#c8d1ce": "#c7d9e6",
    "#c9d0d2": "#c9dce9",
    "#c9d0cd": "#c9dce9",
    "#e4e8e6": "#e3ebf1",
    "#e3e7e5": "#e2ebf2",
    "#b9c9c3": "#bfd4e3",
    "#ccd6d2": "#cbdbe7",
    "#eef0ee": "#edf3f7",
    "#eef1ef": "#edf3f7",
    "#eef3f1": "#ecf4f8",
    "#f5f5f0": "#f3f8fc",
    "#f3f2ed": "#f2f8fc",
    "#fbfbf8": "#fbfdff",
    "#f7f9f6": "#f6fafd",
    "#f5f8f6": "#f4f9fd",
    "#f6f8f7": "#f5fafd",
    "#f9f9f5": "#f9fcfe",
    "#fafaf6": "#fafcfe",
    "#e4ebe8": "#e5eff6",
    "#d1dfda": "#d5e6f1",
    "#dfe3e1": "#dee8f0",
    "#d8ddda": "#dae6ef",
    "#cfdad5": "#d2e1ec",
    "#cbd3d0": "#ccdce8",
    "#b8c4c0": "#bed2e1",
    "#a7b0b6": "#a9bfd0",
    "#8a959a": "#8fa7ba",
    "#9faab0": "#a2b8ca",
}

RGBA = {
    "rgba(241,200,75,.75)": "rgba(143,211,244,.95)",
    "rgba(9,40,63,.78)": "rgba(23,69,110,.78)",
    "rgba(9,40,63,.55)": "rgba(23,69,110,.55)",
    "rgba(9,40,63,.52)": "rgba(23,69,110,.52)",
    "rgba(9,40,63,.38)": "rgba(23,69,110,.38)",
    "rgba(9,40,63,.34)": "rgba(23,69,110,.34)",
    "rgba(9,40,63,.28)": "rgba(23,69,110,.28)",
    "rgba(9,40,63,.2)": "rgba(23,69,110,.2)",
    "rgba(9,40,63,.18)": "rgba(23,69,110,.18)",
    "rgba(9,40,63,.07)": "rgba(23,69,110,.07)",
}

hex_re = re.compile(r"#[0-9a-fA-F]{6}")


def main():
    s = io.open(TARGET, encoding="utf-8").read()
    before = s

    if NEW_VARS.strip() not in s:
        if OLD_VARS not in s:
            raise SystemExit("找不到变量块，请检查 src/index.html 是否被改过")
        s = s.replace(OLD_VARS, NEW_VARS, 1)

    s = hex_re.sub(lambda m: HEX.get(m.group(0).lower(), m.group(0)), s)
    for old, new in RGBA.items():
        s = s.replace(old, new)

    if s == before:
        print("已经是 JR0 主题，无需改动")
        return
    io.open(TARGET, "w", encoding="utf-8", newline="").write(s)
    print("JR0 浅蓝主题已应用；替换色值", len(HEX), "种 / rgba", len(RGBA), "种")


if __name__ == "__main__":
    main()
