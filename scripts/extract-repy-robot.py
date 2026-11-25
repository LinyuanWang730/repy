# -*- coding: utf-8 -*-
"""
从 Mac 端定稿的 build/icon_1024.png 里抠出 Repy 机器人（透明背景）。

思路沿用 scripts/icon/rebuild_icon3.py 的背景回归：
  1. 用「很蓝」的像素做二维线性回归，还原那层蓝→青的渐变底
  2. 每个像素与还原底色求颜色距离：距离大 = 机器人（白 / 深灰 / 黄 / 深蓝眼睛）
  3. 半透明边缘做去蓝污，避免抠出来带一圈蓝边

输出 src/assets/repy-robot.png，供主页面对话气泡左侧使用。
用法：python scripts/extract-repy-robot.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "icon_1024.png")
DST = os.path.join(ROOT, "src", "assets", "repy-robot.png")


def fit_background(rgb, mask):
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    A = np.stack([np.ones(mask.sum()), xx[mask], yy[mask]], axis=1)
    out = np.zeros((h, w, 3))
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A, rgb[..., c][mask], rcond=None)
        out[..., c] = coef[0] + coef[1] * xx + coef[2] * yy
    return np.clip(out, 0, 255)


def main():
    im = Image.open(SRC).convert("RGBA")
    arr = np.asarray(im).astype(np.float64)
    rgb = arr[..., :3]
    orig_a = arr[..., 3] / 255.0

    blueness = rgb[..., 2] - np.maximum(rgb[..., 0], rgb[..., 1])
    # 只拿「确定是背景」的像素去拟合渐变，腐蚀一下避开机器人边缘
    bg_guess = (blueness > 72) & (orig_a > 0.9)
    core = Image.fromarray((bg_guess * 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(15))
    bg_mask = np.asarray(core) > 127
    bg = fit_background(rgb, bg_mask)

    dist = np.linalg.norm(rgb - bg, axis=2)
    # 实体像素：与背景差异很大。只保留实体附近几像素的半透明边缘，
    # 原图标里那圈蓝色投影雾离得远，会被挡在外面。
    hard = (dist > 62) & (orig_a > 0.55)
    # 开运算：先腐蚀掉原图标圆角轮廓那种 1~2px 的蓝色细线，再膨胀回实体
    hard_img = Image.fromarray((hard * 255).astype(np.uint8), "L")
    hard_img = hard_img.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    near = np.asarray(hard_img.filter(ImageFilter.MaxFilter(9))) > 127
    alpha = np.clip((dist - 30.0) / 34.0, 0.0, 1.0)
    alpha *= near.astype(float)
    alpha *= (orig_a > 0.55).astype(float)
    alpha[alpha < 0.16] = 0

    # 腐蚀 1px：切掉最外层那圈和蓝色底混合过的抗锯齿像素，
    # 原图标里沿白色轮廓画的蓝色细线主要就贴在这一层上。
    eroded = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(3))
    alpha = np.asarray(eroded).astype(np.float64) / 255.0

    # 去蓝污：半透明边缘按 alpha 反解出真实前景色
    af = np.clip(alpha, 0.35, 1.0)[..., None]
    fg = np.clip((rgb - (1 - alpha[..., None]) * bg) / af, 0, 255)

    # 蓝线中和：原图标沿白色轮廓画过一圈 1px 蓝色描边，抠图后会留下断续蓝虚线。
    # 用形态学开运算区分「大块蓝（眼睛）」与「细蓝线」，只把细线还原成白色；
    # 深灰哑铃、黄天线球本身不偏蓝，不会进入掩膜。
    mx_rg = np.maximum(fg[..., 0], fg[..., 1])
    blue_all = ((fg[..., 2] - mx_rg) > 10) & (alpha > 0.15)
    blue_img = Image.fromarray((blue_all * 255).astype(np.uint8), "L")
    solid = blue_img.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    solid_near = np.asarray(solid.filter(ImageFilter.MaxFilter(7))) > 127
    fg[blue_all & ~solid_near] = (255, 255, 255)

    out = Image.fromarray(np.dstack([fg, alpha[..., None] * 255]).astype(np.uint8), "RGBA")

    box = out.getchannel("A").getbbox()
    pad = 16
    box = (max(0, box[0] - pad), max(0, box[1] - pad),
           min(out.width, box[2] + pad), min(out.height, box[3] + pad))
    robot = out.crop(box)
    w, h = robot.size
    robot = robot.resize((int(w * 1024 / h), 1024), Image.LANCZOS)
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    robot.save(DST, optimize=True)
    # 浅蓝底预览，方便肉眼确认还有没有蓝边
    preview = Image.new("RGBA", robot.size, (232, 246, 253, 255))
    preview.alpha_composite(robot)
    preview.convert("RGB").save(os.path.join(ROOT, "build", "_robot_on_sky.png"))
    print("bbox", box, "->", robot.size, "saved", DST)


if __name__ == "__main__":
    main()
