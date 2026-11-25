#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v3：几何法清除原图圆角外/边缘白底，抠出机器人后重建渐变蓝背景，
按 Apple 规范重排成 1024 图标。

用法:
  python3 rebuild_icon3.py <src.png> <out.png> [--fill 0.80] [--inset 6]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

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


def blueness(rgb):
    return rgb[..., 2].astype(float) - np.maximum(rgb[..., 0], rgb[..., 1]).astype(float)


def fit_background(rgb, mask):
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    A = np.stack([np.ones(mask.sum()), xx[mask], yy[mask]], axis=1)
    out = np.zeros((h, w, 3))
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, rgb[..., c][mask], rcond=None)
        out[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return np.clip(out, 0, 255)


def inner_region(bl, thr=40):
    """用蓝像素的外包边界推出圆角矩形内部区域。"""
    h, w = bl.shape
    blue = bl > thr
    xmin = np.full(h, w, dtype=int)
    xmax = np.full(h, -1, dtype=int)
    for y in range(h):
        idx = np.flatnonzero(blue[y])
        if idx.size:
            xmin[y], xmax[y] = idx[0], idx[-1]
    ymin = np.full(w, h, dtype=int)
    ymax = np.full(w, -1, dtype=int)
    for x in range(w):
        idx = np.flatnonzero(blue[:, x])
        if idx.size:
            ymin[x], ymax[x] = idx[0], idx[-1]
    # 填补空洞
    for arr, fill in ((xmin, w), (ymin, h)):
        last = fill
        for i in range(len(arr)):
            if arr[i] == fill:
                arr[i] = last
            else:
                last = arr[i]
    for arr in (xmax, ymax):
        last = 0
        for i in range(len(arr)):
            if arr[i] < 0:
                arr[i] = last
            else:
                last = arr[i]
    yy, xx = np.mgrid[0:h, 0:w]
    return (xx >= xmin[yy]) & (xx <= xmax[yy]) & (yy >= ymin[xx]) & (yy <= ymax[xx])


def rebuild(src, dst, fill=0.80, content=CONTENT, inset=6):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float64)
    bl0 = blueness(a)
    ys, xs = np.where(bl0 > 70)
    rgb = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
    h, w, _ = rgb.shape

    bl = blueness(rgb)

    # 背景拟合：只取"内部、很蓝"的像素，避开边缘光晕
    valid = inner_region(bl, 40)
    inner = Image.fromarray((valid * 255).astype(np.uint8), "L").filter(
        ImageFilter.MinFilter(max(9, int(min(h, w) * 0.06)) | 1))
    core = np.asarray(inner) > 127
    bg_mask = core & (bl > 70)
    bg = fit_background(rgb, bg_mask)

    # alpha + 几何裁剪
    alpha = np.clip((60.0 - bl) / 60.0, 0, 1)
    er = Image.fromarray((valid * 255).astype(np.uint8), "L").filter(
        ImageFilter.MinFilter(inset * 2 + 1))
    alpha *= (np.asarray(er) > 127).astype(float)

    # 边缘去蓝污
    af = np.clip(alpha, 0.30, 1.0)[..., None]
    fg_rgb = np.clip((rgb - (1 - alpha[..., None]) * bg) / af, 0, 255)

    fg = Image.fromarray(np.dstack([fg_rgb, alpha[..., None] * 255]).astype(np.uint8), "RGBA")
    ys2, xs2 = np.where(alpha > 0.10)
    fg = fg.crop((xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1))

    target_h = int(content * fill)
    sc = target_h / fg.height
    fg = fg.resize((max(1, int(round(fg.width * sc))), target_h), Image.LANCZOS)

    canvas = Image.fromarray(bg.astype(np.uint8), "RGB").resize((content, content), Image.LANCZOS).convert("RGBA")
    ox = (content - fg.width) // 2
    oy = int((content - fg.height) * 0.47)

    sa = fg.split()[3].filter(ImageFilter.GaussianBlur(max(6, content // 42))).point(lambda v: int(v * 0.30))
    sh = Image.new("RGBA", fg.size, (8, 30, 85, 255))
    tmp = Image.new("RGBA", (content, content), (0, 0, 0, 0))
    tmp.paste(sh, (ox + 3, oy + 16), sa)
    canvas = Image.alpha_composite(canvas, tmp)
    canvas.paste(fg, (ox, oy), fg)

    canvas.putalpha(squircle_mask(content))
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - content) // 2
    out.paste(canvas, (off, off), canvas)
    out.save(dst, "PNG")
    print(f"OK -> {dst} robot={fg.size} tile={w}x{h}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    fill, content, inset = 0.80, CONTENT, 6
    args = sys.argv[3:]
    for i, k in enumerate(args):
        if k == "--fill":
            fill = float(args[i + 1])
        if k == "--content":
            content = int(args[i + 1])
        if k == "--inset":
            inset = int(args[i + 1])
    rebuild(src, dst, fill, content, inset)
