#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把一张「白底 + 圆角矩形图标」的图，转成 macOS / Windows 可用的整套图标资源。

  1. 定位内容区，四角白底用邻近背景蓝泛洪覆盖
  2. 缩放为 824 并套 macOS 标准超椭圆遮罩，放进 1024 透明画布
  3. 输出 .iconset -> .icns，以及多尺寸 .ico

用法:
  python3 produce_icons.py <src.png> <build目录>
"""
import sys
import os
import subprocess
from PIL import Image, ImageDraw
import numpy as np

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


def locate(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    bl = a[..., 2] - np.maximum(a[..., 0], a[..., 1])
    ys, xs = np.where(bl > 60)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def clean_corners(tile):
    w, h = tile.size
    a = np.asarray(tile).astype(int)
    pts = [(0.26, 0.26), (0.74, 0.26), (0.26, 0.74), (0.74, 0.74)]
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    out = tile.copy()
    for (px, py), seed in zip(pts, seeds):
        col = tuple(int(v) for v in a[int(h * py), int(w * px)])
        ImageDraw.floodfill(out, seed, col, thresh=22)
    return out


def build_master(src, pad=4):
    im = Image.open(src).convert("RGB")
    tile = im.crop(locate(im))
    side = min(tile.size)
    tile = tile.crop((0, 0, side, side))
    tile = clean_corners(tile)
    # 内缩几像素：让原图圆角外的白抗锯齿落到遮罩之外
    tile = tile.crop((pad, pad, side - pad, side - pad))

    body = tile.resize((CONTENT, CONTENT), Image.LANCZOS).convert("RGBA")
    body.putalpha(squircle_mask(CONTENT))

    master = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - CONTENT) // 2
    master.paste(body, (off, off), body)
    return master


def make_icns(master, out_dir):
    iconset = os.path.join(out_dir, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    spec = [(16, ""), (16, "@2x"), (32, ""), (32, "@2x"), (128, ""), (128, "@2x"),
            (256, ""), (256, "@2x"), (512, ""), (512, "@2x")]
    for base, suf in spec:
        px = base * (2 if suf else 1)
        img = master.resize((px, px), Image.LANCZOS)
        img.save(os.path.join(iconset, f"icon_{base}x{base}{suf}.png"))
    icns = os.path.join(out_dir, "icon.icns")
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", icns], check=True)
    return icns


def make_ico(master, out_dir):
    ico = os.path.join(out_dir, "icon.ico")
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.resize((256, 256), Image.LANCZOS).save(ico, sizes=sizes)
    return ico


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    master = build_master(src)
    p1024 = os.path.join(out_dir, "icon_1024.png")
    master.save(p1024, "PNG")
    icns = make_icns(master, out_dir)
    ico = make_ico(master, out_dir)
    print("master  ->", p1024)
    print("icns    ->", icns, os.path.getsize(icns), "bytes")
    print("ico     ->", ico, os.path.getsize(ico), "bytes")
