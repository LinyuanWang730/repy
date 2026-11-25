"""生成 RepyNeo 底部标签栏的 8 张小图标（81×81 PNG，普通 / 选中两态）。

不依赖任何字体或外部素材：四条路径用 ImageDraw 画出来。
用法：python scripts/make-repyneo-tabs.py
"""
from PIL import Image, ImageDraw
import os

SIZE = 81
STROKE = 6
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "repyneo", "assets", "tab")

NORMAL = (147, 170, 189, 255)   # #93aabd
ACTIVE = (29, 95, 168, 255)     # #1d5fa8


def canvas():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def pencil(d, c):
    # 笔杆：斜向四边形
    d.polygon([(18, 63), (27, 60), (63, 24), (57, 18)], outline=c)
    # 笔尖
    d.line([(18, 63), (24, 57)], fill=c, width=STROKE)
    # 笔身两端封口
    d.line([(27, 60), (60, 27)], fill=c, width=STROKE)
    d.line([(57, 18), (63, 24)], fill=c, width=STROKE)
    # 下划线
    d.line([(16, 70), (65, 70)], fill=c, width=STROKE)


def calendar(d, c):
    d.rounded_rectangle([14, 20, 67, 68], radius=8, outline=c, width=STROKE)
    d.line([(14, 34), (67, 34)], fill=c, width=STROKE)
    d.line([(27, 13), (27, 24)], fill=c, width=STROKE)
    d.line([(54, 13), (54, 24)], fill=c, width=STROKE)
    for x in (27, 41, 55):
        d.line([(x, 45), (x, 46)], fill=c, width=STROKE)
        d.line([(x, 57), (x, 58)], fill=c, width=STROKE)


def trend(d, c):
    d.line([(14, 67), (67, 67)], fill=c, width=STROKE)
    d.line([(14, 67), (14, 15)], fill=c, width=STROKE)
    path = [(22, 56), (34, 40), (46, 48), (62, 22)]
    for i in range(len(path) - 1):
        d.line([path[i], path[i + 1]], fill=c, width=STROKE)
    for p in path:
        d.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=c)


def gear(d, c):
    import math
    # 外圈
    d.ellipse([22, 22, 59, 59], outline=c, width=7)
    # 轴心
    d.ellipse([35, 35, 46, 46], fill=c)
    # 八根齿：从外圈长出去
    for i in range(8):
        a = math.radians(i * 45)
        x1, y1 = 40.5 + math.cos(a) * 20, 40.5 + math.sin(a) * 20
        x2, y2 = 40.5 + math.cos(a) * 27, 40.5 + math.sin(a) * 27
        d.line([(x1, y1), (x2, y2)], fill=c, width=7)


SHAPES = {"write": pencil, "review": calendar, "trend": trend, "settings": gear}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, shape in SHAPES.items():
        for state, color in (("", NORMAL), ("-on", ACTIVE)):
            img, d = canvas()
            shape(d, color)
            path = os.path.join(OUT, f"{name}{state}.png")
            img.save(path)
            print("wrote", path)


if __name__ == "__main__":
    main()
