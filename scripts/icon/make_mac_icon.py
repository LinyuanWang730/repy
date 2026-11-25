#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把一张满幅方形源图处理成符合 macOS Big Sur+ 规范的 app 图标：
  1024x1024 透明画布 + 居中 824x824 超椭圆(squircle)内容区
用法:
  python3 make_mac_icon.py <源图.png> <输出.png> [--scale 824]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


CANVAS = 1024
CONTENT = 824          # macOS 图标内容区边长（1024 * 0.8047）
SUPER_N = 5.0          # 超椭圆指数，接近 Apple squircle
SS = 4                 # 遮罩超采样倍数（抗锯齿）


def squircle_mask(size: int, n: float = SUPER_N) -> Image.Image:
    """生成 size x size 的超椭圆遮罩（L 模式，255=内部）。"""
    s = size * SS
    # 归一化坐标 [-1, 1]
    lin = (np.arange(s) + 0.5) / s * 2 - 1
    x, y = np.meshgrid(lin, lin)
    # 超椭圆: |x|^n + |y|^n <= 1
    inside = (np.abs(x) ** n + np.abs(y) ** n) <= 1.0
    arr = (inside * 255).astype(np.uint8)
    m = Image.fromarray(arr, mode="L").resize((size, size), Image.LANCZOS)
    return m


def patch_watermark(img: Image.Image) -> Image.Image:
    """用同列上方无水印区域的像素纵向拉伸，覆盖右下角水印。"""
    w, h = img.size
    x0, y0 = int(w * 0.80), int(h * 0.88)
    # 取 y0 上方 8 行求均值作为该块顶部颜色，再纵向复制
    top = img.crop((x0, y0 - 10, w, y0 - 2)).resize((w - x0, 1), Image.LANCZOS)
    patch = top.resize((w - x0, h - y0), Image.LANCZOS)
    out = img.copy()
    out.paste(patch, (x0, y0))
    # 轻微模糊接缝
    band = out.crop((x0, y0 - 6, w, y0 + 6)).filter(ImageFilter.GaussianBlur(3))
    out.paste(band, (x0, y0 - 6))
    return out


def build(src: str, dst: str, content: int = CONTENT, patch: bool = True) -> None:
    img = Image.open(src).convert("RGB")
    if patch:
        img = patch_watermark(img)

    # 源图裁成正方形后缩放到内容区
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    sq = img.crop((left, top, left + side, top + side))
    sq = sq.resize((content, content), Image.LANCZOS).convert("RGBA")

    # 套超椭圆遮罩
    mask = squircle_mask(content)
    sq.putalpha(mask)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - content) // 2
    canvas.paste(sq, (off, off), sq)

    canvas.save(dst, "PNG")
    print(f"OK -> {dst}  ({canvas.width}x{canvas.height}, content {content})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    content = CONTENT
    if "--scale" in sys.argv:
        content = int(sys.argv[sys.argv.index("--scale") + 1])
    build(src, dst, content, patch="--nopatch" not in sys.argv)
