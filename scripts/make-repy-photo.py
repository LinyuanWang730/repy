# -*- coding: utf-8 -*-
"""
Repy · V2.1.0 视觉资源生成器

设计来源：用户提供的 Apple 风格健身机器人图标
  蓝色渐变圆角矩形底 + 白色圆头圆身机器人 + 深蓝眼睛 + 黄色天线球
  + 四个深灰哑铃片（带白色高光点）+ 两条白色腿。

按这张设计用代码重绘成干净矢量图（照片本身有摩尔纹，不能直接当图标），
一次生成：
  src/assets/repy-robot.png   透明背景、只有机器人（主页面对话气泡左侧用）
  build/icon_1024.png         完整应用图标 1024×1024
  build/icon.ico              Windows 多尺寸图标
  build/icon_preview.png      各尺寸预览
  build/installerSidebar.bmp / uninstallerSidebar.bmp / installerHeader.bmp

再跑 `python scripts/make-icns.py` 得到 build/icon.icns（mac）。
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "src", "assets")

C = 1024
K = 3                      # 超采样，最后缩到 1024 做抗锯齿
S = C * K

# ---------------- 配色（图标：宝蓝 → 青蓝；界面：JR0 浅蓝） ----------------
BG_DEEP = "#1B3FCB"        # 左下
BG_LIGHT = "#3DB9E2"       # 右上
ROBOT_WHITE = "#F8FAFC"
ROBOT_SHADE = "#DCE7F2"
EYE = "#17325E"
ANTENNA_A = "#FFD24A"
ANTENNA_B = "#FF9E1B"
PLATE = "#4B5359"
PLATE_HI = "#FFFFFF"
LEG = "#F8FAFC"

FONT_EN = "C:/Windows/Fonts/arialbd.ttf"


def px(v):
    return int(round(v * K))


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(path, size):
    try:
        return ImageFont.truetype(path, px(size))
    except OSError:
        return ImageFont.load_default()


def gradient(size, top, bottom, angle=90):
    """angle=0 垂直 / 90 水平 / 135 左下→右上。"""
    w = h = size
    yy, xx = np.mgrid[0:h, 0:w]
    t = (yy / max(h - 1, 1)) * math.cos(math.radians(angle)) + \
        (xx / max(w - 1, 1)) * math.sin(math.radians(angle))
    t = (t - t.min()) / max(t.max() - t.min(), 1e-6)
    a = np.array(rgb(top), float)
    b = np.array(rgb(bottom), float)
    arr = a[None, None, :] * (1 - t[:, :, None]) + b[None, None, :] * t[:, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def squircle(size, inset=0, power=4.0):
    yy, xx = np.mgrid[0:size, 0:size]
    c = (size - 1) / 2
    nx = np.abs(xx - c) / max(c - inset, 1)
    ny = np.abs(yy - c) / max(c - inset, 1)
    v = nx ** power + ny ** power
    a = np.clip((1.02 - v) * 255 * 8, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "L")


def rrect(size, box, radius=None):
    if radius is None and len(box) == 5:
        box, radius = box[:4], box[4]
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([px(v) for v in box], radius=px(radius), fill=255)
    return m


def ellipse(size, box):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([px(v) for v in box], fill=255)
    return m


def capsule(size, box, angle=0):
    """圆头胶囊，可旋转。返回 L mask（尺寸与画布一致，便于投影）。"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    local = Image.new("L", (px(w), px(h)), 0)
    ImageDraw.Draw(local).rounded_rectangle([0, 0, px(w) - 1, px(h) - 1],
                                            radius=px(min(w, h) / 2), fill=255)
    if angle:
        local = local.rotate(angle, resample=Image.BICUBIC, expand=True)
    m = Image.new("L", (size, size), 0)
    # 以原 box 中心为锚点贴回去
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    m.paste(local, (px(cx) - local.width // 2, px(cy) - local.height // 2))
    return m


def paste_grad(canvas, mask, top, bottom, angle=90, alpha=255):
    g = gradient(S, top, bottom, angle)
    if alpha < 255:
        g.putalpha(g.getchannel("A").point(lambda v: int(v * alpha / 255)))
    canvas.alpha_composite(Image.composite(g, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))


def paste_solid(canvas, mask, color, alpha=255):
    col = rgb(color) + (alpha,)
    canvas.alpha_composite(Image.composite(Image.new("RGBA", (S, S), col),
                                          Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))


def shadow(canvas, mask, offset=(0, 14), blur=26, color="#0B2A6B", alpha=85):
    a = mask.filter(ImageFilter.GaussianBlur(px(blur)))
    a = a.point(lambda v: int(v * alpha / 255))
    layer = Image.new("RGBA", (S, S), rgb(color) + (0,))
    layer.putalpha(a)
    shifted = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shifted.paste(layer, (px(offset[0]), px(offset[1])))
    canvas.alpha_composite(shifted)


def thick_limb(size, points, width):
    """圆头折线：手臂 / 连接杆。"""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    pts = [(px(x), px(y)) for x, y in points]
    d.line(pts, fill=255, width=px(width), joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = px(width / 2)
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return m


# ---------------- 机器人（透明背景） ----------------

def draw_robot():
    cv = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # 两条腿（先画，被身体压住上端）
    for lx in (432, 636):
        leg = rrect(S, (lx, 690, lx + 68, 1000), 8)
        shadow(cv, leg, offset=(0, 8), blur=16, alpha=45)
        paste_solid(cv, leg, LEG)

    # 身体：白色大圆 + 下缘阴影
    body = ellipse(S, (352, 466, 706, 820))
    shadow(cv, body, offset=(0, 16), blur=28, alpha=70)
    paste_solid(cv, body, ROBOT_WHITE)
    body_shade = Image.new("L", (S, S), 0)
    ImageDraw.Draw(body_shade).ellipse([px(370), px(486), px(688), px(804)], outline=255, width=px(10))
    paste_solid(cv, body_shade, ROBOT_SHADE, 55)

    # 左臂：身体左侧 → 左上折 → 白色圆手
    arm_l = thick_limb(S, [(378, 560), (286, 466), (258, 356)], 54)
    shadow(cv, arm_l, offset=(0, 12), blur=20, alpha=55)
    paste_solid(cv, arm_l, ROBOT_WHITE)

    # 右臂：身体右侧 → 右下折 → 白色圆手
    arm_r = thick_limb(S, [(664, 552), (704, 646), (762, 680)], 58)
    shadow(cv, arm_r, offset=(0, 12), blur=20, alpha=55)
    paste_solid(cv, arm_r, ROBOT_WHITE)

    # 头：白色大圆（压在身体上方）
    head = ellipse(S, (352, 128, 716, 492))
    shadow(cv, head, offset=(0, 18), blur=30, alpha=78)
    paste_solid(cv, head, ROBOT_WHITE)
    head_shade = Image.new("L", (S, S), 0)
    ImageDraw.Draw(head_shade).ellipse([px(370), px(146), px(698), px(474)], outline=255, width=px(9))
    paste_solid(cv, head_shade, ROBOT_SHADE, 50)

    # 天线：白色斜杆 + 黄橙小球
    rod = thick_limb(S, [(600, 176), (676, 92)], 20)
    paste_solid(cv, rod, ROBOT_WHITE)
    ball = ellipse(S, (640, 34, 738, 132))
    shadow(cv, ball, offset=(0, 8), blur=16, alpha=50)
    paste_grad(cv, ball, ANTENNA_A, ANTENNA_B, 110)
    paste_solid(cv, ellipse(S, (660, 50, 690, 80)), "#FFFFFF", 130)

    # 眼睛：两个略微错落的深蓝椭圆
    for box in ((432, 236, 486, 306), (546, 286, 602, 358)):
        paste_solid(cv, ellipse(S, box), EYE)

    # 四个深灰哑铃片（带白色高光点）
    plates = [
        ((112, 356, 236, 546), -12, (150, 402)),
        ((300, 286, 420, 502), 8, (334, 328)),
        ((474, 566, 594, 782), 6, (508, 608)),
        ((770, 600, 896, 792), 8, (806, 642)),
    ]
    for box, ang, dot in plates:
        m = capsule(S, box, ang)
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        shadow(layer, m, offset=(0, 12), blur=20, alpha=70)
        paste_grad(layer, m, "#5C656B", PLATE, 100)
        hi = ellipse(S, (dot[0], dot[1] - 20, dot[0] + 40, dot[1] + 20))
        paste_solid(layer, hi, PLATE_HI, 235)
        cv.alpha_composite(layer)

    # 两手（白色小圆）压在哑铃片前面
    for cx, cy, r in ((258, 356, 36), (762, 680, 36)):
        hand = ellipse(S, (cx - r, cy - r, cx + r, cy + r))
        shadow(cv, hand, offset=(0, 6), blur=14, alpha=45)
        paste_solid(cv, hand, ROBOT_WHITE)

    return cv


# ---------------- 应用图标 ----------------

def draw_icon(robot):
    cv = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sq = squircle(S)

    # 左下深蓝 → 右上青蓝
    cv.paste(gradient(S, BG_DEEP, BG_LIGHT, 135), (0, 0), sq)

    # 左上角一点柔光
    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).ellipse([px(-340), px(-420), px(760), px(400)], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(px(120)))
    paste_solid(cv, glow, "#FFFFFF", 42)

    cv.alpha_composite(robot)

    # 内边缘高光
    band = np.clip(np.array(squircle(S), float) - np.array(squircle(S, inset=9), float), 0, 255)
    fade = np.clip(1.1 - np.linspace(0, 1, S) * 1.8, 0, 1) ** 1.2
    a = np.clip(band * fade[:, None] * 0.85, 0, 255).astype(np.uint8)
    hl = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    hl.putalpha(Image.fromarray(a, "L"))
    cv.alpha_composite(hl)

    # 裁成圆角矩形
    alpha = Image.fromarray(
        (np.array(cv.getchannel("A"), float) * np.array(sq, float) / 255).clip(0, 255).astype(np.uint8), "L")
    cv.putalpha(alpha)
    return cv


def make_bmp(src, out, size, mode="cover"):
    im = Image.open(src).convert("RGBA")
    w, h = size
    if mode == "cover":
        ratio = max(w / im.width, h / im.height)
        im = im.resize((int(im.width * ratio), int(im.height * ratio)), Image.LANCZOS)
        left, top = (im.width - w) // 2, (im.height - h) // 2
        im = im.crop((left, top, left + w, top + h))
    else:
        im.thumbnail((w, h), Image.LANCZOS)
        bg = Image.new("RGBA", (w, h), rgb("#EAF6FD") + (255,))
        bg.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
        im = bg
    im.convert("RGB").save(out, format="BMP")
    print("  ", os.path.basename(out), size)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)

    print("绘制机器人…")
    robot = draw_robot()
    robot_small = robot.resize((C, C), Image.LANCZOS)
    robot_small.save(os.path.join(ASSETS, "repy-robot.png"), optimize=True)
    print("  src/assets/repy-robot.png", robot_small.size)

    print("绘制应用图标…")
    master = draw_icon(robot).resize((C, C), Image.LANCZOS)
    master.save(os.path.join(OUT, "icon_1024.png"), optimize=True)

    sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    frames = [master.resize((s, s), Image.LANCZOS) for s in sizes]
    frames[-1].save(os.path.join(OUT, "icon.ico"), format="ICO",
                    sizes=[(s, s) for s in sizes])
    print("  build/icon.ico", sizes)

    pad, gap = 28, 18
    w = sum(s + gap for s in sizes) + pad * 2
    sheet = Image.new("RGB", (w, 300), "#EEF6FB")
    d = ImageDraw.Draw(sheet)
    f = font(FONT_EN, 13)
    x = pad
    for s, fr in zip(sizes, frames):
        sheet.paste(fr, (x, 80 + (240 - s) // 2), fr)
        d.text((x, 62), str(s), fill="#6E8899", font=f)
        x += s + gap
    sheet.save(os.path.join(OUT, "icon_preview.png"))

    print("生成安装向导位图…")
    make_bmp(os.path.join(OUT, "icon_1024.png"), os.path.join(OUT, "installerSidebar.bmp"), (164, 314))
    make_bmp(os.path.join(OUT, "icon_1024.png"), os.path.join(OUT, "uninstallerSidebar.bmp"), (164, 314))
    make_bmp(os.path.join(OUT, "icon_1024.png"), os.path.join(OUT, "installerHeader.bmp"), (150, 57), "contain")
    print("完成。接着跑：python scripts/make-icns.py")


if __name__ == "__main__":
    main()
