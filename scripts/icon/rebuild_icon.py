#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 AI 出的「蓝底 + 白色机器人」图里，把机器人抠出来，重建干净的
渐变蓝背景，重新排布成 macOS Big Sur+ 规范图标。

  1. 检测内容区，去掉外面白边
  2. 用「蓝度」B-max(R,G) 做软 alpha，抠出机器人（白/灰/黄）
  3. 对背景像素做二维线性回归 color = a + b*x + c*y，还原干净渐变
  4. 机器人按目标占比缩放居中，加一层淡投影
  5. 套超椭圆遮罩，放进 1024 透明画布

用法:
  python3 rebuild_icon.py <src.png> <out.png> [--fill 0.80] [--content 824]
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


def detect_tile(a: np.ndarray, thresh: int = 735):
    nonwhite = a.sum(2) < thresh
    ys, xs = np.where(nonwhite)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def blueness(rgb: np.ndarray) -> np.ndarray:
    """蓝度：蓝通道减红绿最大值。蓝底为正，白/灰/黄为 0 或负。"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return b - np.maximum(r, g)


def fit_background(rgb: np.ndarray, bg_mask: np.ndarray):
    """二维线性回归拟合背景渐变，返回 (h,w,3) float。"""
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    A = np.stack([np.ones(bg_mask.sum()), xx[bg_mask], yy[bg_mask]], axis=1)
    out = np.zeros((h, w, 3), dtype=np.float64)
    for c in range(3):
        v = rgb[..., c][bg_mask]
        coef, *_ = np.linalg.lstsq(A, v, rcond=None)
        out[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return np.clip(out, 0, 255)


def rebuild(src: str, dst: str, fill: float = 0.80, content: int = CONTENT):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float64)

    # 1. 内容区
    x0, y0, x1, y1 = detect_tile(a.astype(int))
    rgb = a[y0:y1, x0:x1]

    # 2. 软 alpha：蓝底 -> 0，机器人 -> 1
    bl = blueness(rgb)
    alpha = np.clip((45.0 - bl) / 45.0, 0, 1)   # bl>=45 纯背景, bl<=0 纯前景
    alpha[bl < -10] = 1.0                        # 灰/黄 明确前景

    # 3. 背景拟合（只用"很蓝"且离机器人远的像素）
    solid_bg = bl > 70
    # 腐蚀一圈，避免边缘过渡带污染拟合
    m = Image.fromarray((solid_bg * 255).astype(np.uint8), "L")
    m = m.filter(ImageFilter.MinFilter(15))
    bg_mask = np.asarray(m) > 127
    bg = fit_background(rgb, bg_mask)

    # 4. 机器人图层
    fg = np.dstack([rgb, alpha[..., None] * 255.0]).astype(np.uint8)
    fg_im = Image.fromarray(fg, "RGBA")
    ys, xs = np.where(alpha > 0.05)
    fg_im = fg_im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

    # 5. 排布：按高度占比缩放，居中偏上一点点
    target_h = int(content * fill)
    scale = target_h / fg_im.height
    tw, th = int(fg_im.width * scale), target_h
    fg_im = fg_im.resize((tw, th), Image.LANCZOS)

    canvas = Image.fromarray(bg.astype(np.uint8), "RGB").resize(
        (content, content), Image.LANCZOS).convert("RGBA")

    ox = (content - tw) // 2
    oy = int((content - th) * 0.47)

    # 淡投影
    sh = Image.new("RGBA", (content, content), (0, 0, 0, 0))
    sh_a = Image.new("L", fg_im.size, 0)
    sh_a.paste(fg_im.split()[3], (0, 0))
    sh_a = sh_a.filter(ImageFilter.GaussianBlur(max(6, content // 40)))
    shadow = Image.new("RGBA", fg_im.size, (10, 35, 90, 90))
    sh.paste(shadow, (ox + 4, oy + 18), sh_a.point(lambda v: int(v * 0.45)))
    canvas = Image.alpha_composite(canvas, sh)

    canvas.paste(fg_im, (ox, oy), fg_im)

    # 6. squircle
    canvas.putalpha(squircle_mask(content))
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - content) // 2
    out.paste(canvas, (off, off), canvas)
    out.save(dst, "PNG")
    print(f"OK -> {dst}  tile=({x0},{y0},{x1},{y1}) robot={fg_im.size} fill={fill}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    fill, content = 0.80, CONTENT
    args = sys.argv[3:]
    for i, a_ in enumerate(args):
        if a_ == "--fill":
            fill = float(args[i + 1])
        if a_ == "--content":
            content = int(args[i + 1])
    rebuild(src, dst, fill, content)
