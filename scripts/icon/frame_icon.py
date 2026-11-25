#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 AI 出的「满幅 / 小圆角」图标整理成 macOS Big Sur+ 规范图标。

处理链：
  1. 自动检测蓝色内容区 bounding box，去掉外面白边
  2. 内容整体缩小 + 用自身放大模糊版作底，制造四周均匀留白
  3. 套超椭圆(squircle)遮罩，居中放进 1024 透明画布

用法:
  python3 frame_icon.py <src.png> <out.png> [--inner 0.86] [--content 824]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

CANVAS = 1024
CONTENT = 824
SUPER_N = 5.0
SS = 4


def squircle_mask(size: int, n: float = SUPER_N) -> Image.Image:
    s = size * SS
    lin = (np.arange(s) + 0.5) / s * 2 - 1
    x, y = np.meshgrid(lin, lin)
    inside = (np.abs(x) ** n + np.abs(y) ** n) <= 1.0
    arr = (inside * 255).astype(np.uint8)
    return Image.fromarray(arr, mode="L").resize((size, size), Image.LANCZOS)


def detect_tile(im: Image.Image, thresh: int = 735) -> tuple:
    """检测非白区域 bbox。"""
    a = np.asarray(im.convert("RGB")).astype(int)
    nonwhite = a.sum(2) < thresh
    ys, xs = np.where(nonwhite)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def feather_mask(size: int, fade: int) -> Image.Image:
    """矩形羽化 alpha：中心满值，四边 fade 像素线性渐隐。"""
    m = np.full((size, size), 255, dtype=np.float64)
    if fade > 0:
        ramp = np.linspace(0, 1, fade)
        m[:fade, :] *= ramp[:, None]
        m[-fade:, :] *= ramp[::-1][:, None]
        m[:, :fade] *= ramp[None, :]
        m[:, -fade:] *= ramp[::-1][None, :]
    return Image.fromarray(m.astype(np.uint8), "L")


def reframe(src: str, dst: str, inner: float = 0.86,
            content: int = CONTENT) -> None:
    im = Image.open(src).convert("RGB")

    # 1. 去白边
    box = detect_tile(im)
    tile = im.crop(box)
    # 修成正方形（保险）
    side = min(tile.size)
    tile = tile.crop((0, 0, side, side))

    # 2. 底：自身放大 + 模糊，抹掉接缝感
    base = tile.resize((content, content), Image.LANCZOS)
    base = base.filter(ImageFilter.GaussianBlur(content * 0.012))

    # 前景：缩小后的内容，边缘羽化
    fg_side = int(round(content * inner))
    fg = tile.resize((fg_side, fg_side), Image.LANCZOS)
    fade = max(8, int(fg_side * 0.06))
    mask = feather_mask(fg_side, fade)

    out = base.copy()
    off = (content - fg_side) // 2
    out.paste(fg, (off, off), mask)

    # 3. squircle
    out = out.convert("RGBA")
    out.putalpha(squircle_mask(content))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    c_off = (CANVAS - content) // 2
    canvas.paste(out, (c_off, c_off), out)
    canvas.save(dst, "PNG")
    print(f"OK -> {dst}  tile={box} inner={inner}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    inner = 0.86
    content = CONTENT
    args = sys.argv[3:]
    for i, a in enumerate(args):
        if a == "--inner":
            inner = float(args[i + 1])
        if a == "--content":
            content = int(args[i + 1])
    reframe(src, dst, inner, content)
