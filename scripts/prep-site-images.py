#!/usr/bin/env python3
"""把自检截图和应用图标压成站点用的图。

站点目录是 site/，图片都放在 site/assets/。
自检脚本每次都会重写 build/check-*.png，那几张是 2x 截图、单张 700 KB 以上，
直接上线会让落地页首屏慢半拍，所以统一转成 1320 宽的 jpg。

用法：
  python scripts/prep-site-images.py
改截图时换 build/ 里对应文件名即可。
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "site", "assets")

SHOTS = [
    ("check-06-overview.png", "shot-overview.jpg"),
    ("check-01-generator.png", "shot-generator.jpg"),
]


def shrink(name, out_name, width=1320, quality=88):
    src = os.path.join(SRC, name)
    if not os.path.exists(src):
        print("跳过（没找到）：" + name)
        return
    img = Image.open(src).convert("RGB")
    if img.width > width:
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
    dst = os.path.join(OUT, out_name)
    img.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
    print("%s -> %s  %d KB" % (name, out_name, os.path.getsize(dst) // 1024))


def icon(size, out_name, ext="PNG"):
    src = os.path.join(SRC, "icon_1024.png")
    if not os.path.exists(src):
        print("跳过（没找到）：icon_1024.png")
        return
    img = Image.open(src).convert("RGBA").resize((size, size), Image.LANCZOS)
    dst = os.path.join(OUT, out_name)
    img.save(dst, ext)
    print("icon_1024.png -> %s  %d KB" % (out_name, os.path.getsize(dst) // 1024))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for src_name, out_name in SHOTS:
        shrink(src_name, out_name)
    icon(256, "icon-256.png")
    icon(64, "icon-64.png")
    icon(64, "favicon.ico", "ICO")
