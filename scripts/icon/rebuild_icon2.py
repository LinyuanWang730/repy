#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 AI 出的「蓝底 + 白色机器人」图里抠出机器人，重建干净的渐变蓝背景，
重新排布成 macOS Big Sur+ 规范图标（v2，修补角上白底 + 边缘去蓝污）。

用法:
  python3 rebuild_icon2.py <src.png> <out.png> [--fill 0.80] [--content 824]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

CANVAS = 1024
CONTENT = 824
SUPER_N = 5.0
SS = 4
CORNER = 130        # 原图圆角大致半径，用于圈定角上白底


def squircle_mask(size: int, n: float = SUPER_N) -> Image.Image:
    s = size * SS
    lin = (np.arange(s) + 0.5) / s * 2 - 1
    x, y = np.meshgrid(lin, lin)
    inside = (np.abs(x) ** n + np.abs(y) ** n) <= 1.0
    return Image.fromarray((inside * 255).astype(np.uint8), "L").resize(
        (size, size), Image.LANCZOS)


def detect_tile(rgb: np.ndarray):
    """只用'蓝'像素定位内容区，避免被四角白底干扰。"""
    bl = rgb[..., 2].astype(int) - np.maximum(rgb[..., 0], rgb[..., 1]).astype(int)
    ys, xs = np.where(bl > 70)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


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


def rebuild(src, dst, fill=0.80, content=CONTENT):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float64)

    x0, y0, x1, y1 = detect_tile(a)
    rgb = a[y0:y1, x0:x1].copy()
    h, w, _ = rgb.shape

    # 背景拟合（很蓝的像素）
    bl = blueness(rgb)
    m = Image.fromarray(((bl > 70) * 255).astype(np.uint8), "L")
    m = m.filter(ImageFilter.MinFilter(15))
    bg_mask = np.asarray(m) > 127
    bg_fit = fit_background(rgb, bg_mask)

    # 修掉四个角上的白底：角块内不够蓝的像素直接换成背景色
    c = CORNER
    corners = [(slice(0, c), slice(0, c)), (slice(0, c), slice(w - c, w)),
               (slice(h - c, h), slice(0, c)), (slice(h - c, h), slice(w - c, w))]
    for cs in corners:
        sub = bl[cs]
        fix = sub < 20
        rgb[cs][fix] = bg_fit[cs][fix]

    # soft alpha
    bl = blueness(rgb)
    alpha = np.clip((60.0 - bl) / 60.0, 0, 1)

    # 边缘去蓝污：C = a*F + (1-a)*Bg  ->  F = (C-(1-a)*Bg)/a
    af = np.clip(alpha, 0.30, 1.0)[..., None]
    fg_rgb = (rgb - (1 - alpha[..., None]) * bg_fit) / af
    fg_rgb = np.clip(fg_rgb, 0, 255)

    fg = Image.fromarray(np.dstack([fg_rgb, alpha[..., None] * 255.0]).astype(np.uint8), "RGBA")
    ys, xs = np.where(alpha > 0.06)
    fg = fg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

    # 排布
    target_h = int(content * fill)
    scale = target_h / fg.height
    fg = fg.resize((int(round(fg.width * scale)), target_h), Image.LANCZOS)

    canvas = Image.fromarray(bg_fit.astype(np.uint8), "RGB").resize(
        (content, content), Image.LANCZOS).convert("RGBA")

    ox = (content - fg.width) // 2
    oy = int((content - fg.height) * 0.47)

    # 淡投影
    sa = fg.split()[3].filter(ImageFilter.GaussianBlur(max(6, content // 42)))
    sa = sa.point(lambda v: int(v * 0.30))
    shadow = Image.new("RGBA", fg.size, (8, 30, 85, 255))
    tmp = Image.new("RGBA", (content, content), (0, 0, 0, 0))
    tmp.paste(shadow, (ox + 3, oy + 16), sa)
    canvas = Image.alpha_composite(canvas, tmp)

    canvas.paste(fg, (ox, oy), fg)

    canvas.putalpha(squircle_mask(content))
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - content) // 2
    out.paste(canvas, (off, off), canvas)
    out.save(dst, "PNG")
    print(f"OK -> {dst} tile=({x0},{y0},{x1},{y1}) robot={fg.size}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    fill, content = 0.80, CONTENT
    args = sys.argv[3:]
    for i, k in enumerate(args):
        if k == "--fill":
            fill = float(args[i + 1])
        if k == "--content":
            content = int(args[i + 1])
    rebuild(src, dst, fill, content)
