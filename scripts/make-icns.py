# -*- coding: utf-8 -*-
"""
把 build/icon_1024.png 转成 macOS 的 build/icon.icns。

Windows 上没有 iconutil，直接手写 ICNS 容器：文件头 + 若干 PNG 块。
macOS 图标习惯：图形不顶满画布，四周留 ~10% 透明边 + 一层很淡的投影，
所以这里先重排一次 1024 画布，再等比切出各个尺寸。
"""
import io
import os
import struct

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "icon_1024.png")
OUT = os.path.join(ROOT, "build", "icon.icns")

CANVAS = 1024
BODY = 824          # 圆角矩形本体边长，留出 100px 边距
SHADOW_BLUR = 18
SHADOW_ALPHA = 70

# ICNS 里的 PNG 块类型 → 像素尺寸
TYPES = [
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
    ("ic11", 32),    # 16@2x
    ("ic12", 64),    # 32@2x
    ("ic13", 256),   # 128@2x
    ("ic14", 512),   # 256@2x
]


def build_master():
    art = Image.open(SRC).convert("RGBA")
    body = art.resize((BODY, BODY), Image.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    # 投影：拿本体的 alpha 当遮罩，压暗后模糊
    alpha = body.split()[-1].point(lambda a: int(a * SHADOW_ALPHA / 255))
    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 255), (100, 100 + 8), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))

    canvas.alpha_composite(shadow)
    canvas.alpha_composite(body, (100, 100))
    return canvas


def png_bytes(image):
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main():
    master = build_master()
    master.save(os.path.join(ROOT, "build", "icon_mac_1024.png"))

    chunks = []
    for kind, size in TYPES:
        img = master.resize((size, size), Image.LANCZOS)
        data = png_bytes(img)
        chunks.append(kind.encode("ascii") + struct.pack(">I", len(data) + 8) + data)

    body = b"".join(chunks)
    total = 8 + len(body)
    with open(OUT, "wb") as fh:
        fh.write(b"icns" + struct.pack(">I", total) + body)

    print("wrote", OUT, os.path.getsize(OUT), "bytes,", len(chunks), "sizes")


if __name__ == "__main__":
    main()
