#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v7：最小侵入 —— 四角白底用泛洪染成背景蓝，内容整体缩一点留出边距，
边缘像素向外延展补齐，最后套 macOS 标准超椭圆遮罩。

不改动机器人任何像素，只做缩放 / 移位 / 边角清理。

用法:
  python3 finalize_icon.py <src.png> <out.png> [--inner 0.90] [--content 824]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

CANVAS = 1024
CONTENT = 824
SUPER_N = 5.0
SS = 4


def squircle_mask(size, n=SUPER_N):
    s = size * SS
    lin = (np.arange(s) + 0.5) / s * 2 - 1
    x, y = np.meshgrid(lin, lin)
    inside = (np.abs(x) ** n + np.abs(y) ** n) <= 1.0
    return Image.fromarray((inside * 255).astype(np.uint8), "L").resize((size, size), Image.LANCZOS)


def find_tile(im):
    a = np.asarray(im).astype(int)
    bl = a[..., 2] - np.maximum(a[..., 0], a[..., 1])
    ys, xs = np.where(bl > 70)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def kill_corners(tile):
    """四角白底泛洪染色，避免缩放后残留白边。"""
    w, h = tile.size
    # 用四角内侧一点的颜色作为填充色
    a = np.asarray(tile).astype(int)
    bl = a[..., 2] - np.maximum(a[..., 0], a[..., 1])
    ys, xs = np.where(bl > 90)
    fill = tuple(int(v) for v in np.median(a[ys, xs], axis=0))
    out = tile.copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(out, seed, fill, thresh=14)
    return out, fill


def edge_pad(img, size):
    """把 img 居中放进 size×size，四周用边缘像素复制补齐。"""
    s = img.size[0]
    arr = np.asarray(img).astype(np.uint8)
    off = (size - s) // 2
    canvas = np.zeros((size, size, 3), dtype=np.uint8)
    canvas[off:off + s, off:off + s] = arr
    canvas[:off, off:off + s] = arr[0:1, :]
    canvas[off + s:, off:off + s] = arr[-1:, :]
    canvas[:, :off] = canvas[:, off:off + 1]
    canvas[:, off + s:] = canvas[:, off + s - 1:off + s]
    return Image.fromarray(canvas, "RGB")


def build(src, dst, inner=0.90, content=CONTENT):
    im = Image.open(src).convert("RGB")
    tile = im.crop(find_tile(im))
    side = min(tile.size)
    tile = tile.crop((0, 0, side, side))
    tile, fill = kill_corners(tile)

    s = int(round(content * inner))
    tile = tile.resize((s, s), Image.LANCZOS)
    out = edge_pad(tile, content).convert("RGBA")
    out.putalpha(squircle_mask(content))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - content) // 2
    canvas.paste(out, (off, off), out)
    canvas.save(dst, "PNG")
    print(f"OK -> {dst} inner={inner} content={content} side={side} fill={fill}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    inner, content = 0.90, CONTENT
    args = sys.argv[3:]
    for i, k in enumerate(args):
        if k == "--inner":
            inner = float(args[i + 1])
        if k == "--content":
            content = int(args[i + 1])
    build(src, dst, inner, content)
