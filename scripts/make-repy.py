# -*- coding: utf-8 -*-
"""
Repy · JR0 浅蓝主题视觉资源生成器（V2.1.0 定稿版）

构图：浅蓝圆角矩形底 + Repy 小机器人
  机器人头顶天线、深蓝面部屏、两只浅蓝眼睛，
  右手拿笔（撰写记录）、左手拿放大镜（复盘记录），
  胸前一张记录卡（三行 + 勾），底部有 REPY 字标。

一次生成：
  src/assets/repy-robot.png   透明背景、只有机器人的抠图（主页面对话气泡左侧用）
  build/icon_1024.png         浅蓝圆角矩形应用图标 1024×1024
  build/icon.ico              Windows 多尺寸图标
  build/icon_preview.png      各尺寸预览
  build/installerSidebar.bmp / uninstallerSidebar.bmp / installerHeader.bmp

再跑 `python scripts/make-icns.py` 得到 build/icon.icns（mac）。
另：scripts/make-repy-photo.py 是「蓝渐变 + 举哑铃白机器人」的备选方案。
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "src", "assets")

C = 1024
K = 3                      # 超采样，最后缩到 1024 抗锯齿
S = C * K

# ---------------- JR0 调色板 ----------------
BG_TOP = "#F4FBFF"
BG_BOTTOM = "#9BD3F2"
BRAND = "#7CC4F2"
BRAND_DEEP = "#2B8FD6"
NAVY = "#17456E"
FACE = "#123F68"
HEAD_TOP = "#F4FBFF"
HEAD_BOTTOM = "#B8DFF7"
BODY_TOP = "#FFFFFF"
BODY_BOTTOM = "#CDEAFB"
CARD = "#FFFFFF"
LINE = "#9CCBE8"
EYE = "#8ED9FF"
CHEEK = "#B9E6FF"
PEN = "#2B8FD6"

FONT_CN = "C:/Windows/Fonts/msyhbd.ttc"
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
    w = h = size
    yy, xx = np.mgrid[0:h, 0:w]
    t = (yy / max(h - 1, 1)) * math.cos(math.radians(angle)) + \
        (xx / max(w - 1, 1)) * math.sin(math.radians(angle))
    t = (t - t.min()) / max(t.max() - t.min(), 1e-6)
    a = np.array(rgb(top), float)
    b = np.array(rgb(bottom), float)
    arr = a[None, None, :] * (1 - t[:, :, None]) + b[None, None, :] * t[:, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def squircle(size, inset=0, power=4.2):
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


def paste_grad(canvas, mask, top, bottom, angle=90):
    canvas.alpha_composite(Image.composite(gradient(S, top, bottom, angle),
                                          Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))


def paste_solid(canvas, mask, color, alpha=255):
    col = rgb(color) + (alpha,)
    canvas.alpha_composite(Image.composite(Image.new("RGBA", (S, S), col),
                                          Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))


def shadow(canvas, mask, offset=(0, 16), blur=34, color="#0B3557", alpha=90):
    a = mask.filter(ImageFilter.GaussianBlur(px(blur)))
    a = a.point(lambda v: int(v * alpha / 255))
    layer = Image.new("RGBA", (S, S), rgb(color) + (0,))
    layer.putalpha(a)
    shifted = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shifted.paste(layer, (px(offset[0]), px(offset[1])))
    canvas.alpha_composite(shifted)


# ---------------- 机器人（透明背景） ----------------

def draw_robot():
    cv = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # 天线：细杆 + 顶端发光小球
    shadow(cv, rrect(S, (500, 92, 524, 218), 12), offset=(0, 8), blur=18, alpha=60)
    paste_grad(cv, rrect(S, (500, 92, 524, 218), 12), "#B9E1F8", "#7CC4F2", 90)
    shadow(cv, ellipse(S, (466, 48, 558, 140)), offset=(0, 12), blur=22, alpha=80)
    paste_grad(cv, ellipse(S, (466, 48, 558, 140)), "#FFFFFF", "#7CC4F2", 110)
    paste_solid(cv, ellipse(S, (490, 66, 520, 96)), "#FFFFFF", 220)

    # 头壳
    head = rrect(S, (246, 190, 778, 556), 106)
    shadow(cv, head, offset=(0, 20), blur=40, alpha=95)
    paste_grad(cv, head, HEAD_TOP, HEAD_BOTTOM, 105)
    inner = Image.new("L", (S, S), 0)
    ImageDraw.Draw(inner).rounded_rectangle([px(v) for v in (262, 206, 762, 540)],
                                            radius=px(94), outline=255, width=px(5))
    paste_solid(cv, inner, "#FFFFFF", 150)

    # 面部屏
    face = rrect(S, (292, 252, 732, 486), 72)
    paste_grad(cv, face, "#1B5383", FACE, 100)
    gloss = Image.new("L", (S, S), 0)
    ImageDraw.Draw(gloss).rounded_rectangle([px(v) for v in (306, 264, 718, 340)],
                                            radius=px(40), fill=70)
    paste_solid(cv, gloss, "#FFFFFF", 46)

    # 眼睛
    for ex in (372, 566):
        paste_grad(cv, rrect(S, (ex, 320, ex + 86, 404), 42), "#DDF4FF", EYE, 100)
        paste_solid(cv, rrect(S, (ex + 16, 332, ex + 40, 356), 12), "#FFFFFF", 235)

    # 腮红 + 微笑
    for cx in (338, 636):
        paste_solid(cv, ellipse(S, (cx, 410, cx + 54, 438)), CHEEK, 190)
    smile = Image.new("L", (S, S), 0)
    ImageDraw.Draw(smile).arc([px(438), px(388), px(586), px(462)], start=12, end=168,
                              fill=255, width=px(9))
    paste_solid(cv, smile, "#C7ECFF", 255)

    # 脖子 + 身体 + 脚
    paste_grad(cv, rrect(S, (452, 528, 572, 586), 22), "#9FD4F2", "#78BFE8", 90)
    torso = rrect(S, (310, 566, 714, 856), 74)
    shadow(cv, torso, offset=(0, 20), blur=38, alpha=85)
    paste_grad(cv, torso, BODY_TOP, BODY_BOTTOM, 100)
    for fx in (350, 590):
        foot = rrect(S, (fx, 838, fx + 84, 894), 26)
        shadow(cv, foot, offset=(0, 8), blur=16, alpha=60)
        paste_grad(cv, foot, "#A9D9F3", "#6FB5DE", 95)

    # 胸前记录卡
    card = rrect(S, (376, 610, 648, 806), 26)
    shadow(cv, card, offset=(0, 10), blur=22, alpha=70)
    paste_solid(cv, card, CARD)
    card_edge = Image.new("L", (S, S), 0)
    ImageDraw.Draw(card_edge).rounded_rectangle([px(v) for v in (376, 610, 648, 806)],
                                                radius=px(26), outline=255, width=px(4))
    paste_solid(cv, card_edge, "#BFE0F4", 255)
    paste_solid(cv, rrect(S, (404, 638, 490, 660), 11), BRAND_DEEP)
    for i, y in enumerate((684, 726, 768)):
        paste_solid(cv, rrect(S, (404, y - 14, 430, y + 12), 6),
                    "#CBE7F8" if i == 2 else BRAND)
        if i < 2:
            tick = Image.new("L", (S, S), 0)
            ImageDraw.Draw(tick).line([px(409), px(y), px(416), px(y + 6), px(427), px(y - 7)],
                                      fill=255, width=px(4), joint="curve")
            paste_solid(cv, tick, "#FFFFFF")
        paste_solid(cv, rrect(S, (446, y - 6, 620 - i * 32, y + 5), 5), LINE, 220)

    # 右手：握笔（撰写）
    arm_r = rrect(S, (660, 626, 736, 758), 38)
    shadow(cv, arm_r, offset=(0, 10), blur=20, alpha=60)
    paste_grad(cv, arm_r, HEAD_TOP, "#A8D8F2", 95)
    pen = Image.new("RGBA", (px(60), px(260)), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pen)
    pd.rounded_rectangle([px(8), px(8), px(42), px(198)], radius=px(15), fill=rgb(PEN) + (255,))
    pd.rounded_rectangle([px(8), px(8), px(42), px(50)], radius=px(14), fill=rgb(NAVY) + (255,))
    pd.polygon([(px(8), px(198)), (px(42), px(198)), (px(25), px(234))],
               fill=rgb("#F4FBFF") + (255,))
    pen = pen.rotate(-32, resample=Image.BICUBIC, expand=True)
    cv.alpha_composite(pen, (px(648), px(488)))
    paste_solid(cv, rrect(S, (676, 660, 728, 708), 26), "#F4FBFF")

    # 左手：放大镜（复盘）
    arm_l = rrect(S, (288, 630, 360, 756), 36)
    shadow(cv, arm_l, offset=(0, 10), blur=20, alpha=60)
    paste_grad(cv, arm_l, HEAD_TOP, "#A8D8F2", 95)
    lens_out = ellipse(S, (196, 646, 328, 778))
    lens_in = ellipse(S, (212, 662, 312, 762))
    shadow(cv, lens_out, offset=(0, 10), blur=20, alpha=65)
    paste_grad(cv, lens_out, BRAND_DEEP, NAVY, 100)
    paste_grad(cv, lens_in, "#F2FBFF", "#B7E1FA", 110)
    paste_solid(cv, ellipse(S, (226, 676, 262, 706)), "#FFFFFF", 210)
    hm = Image.new("L", (S, S), 0)
    hd = ImageDraw.Draw(hm)
    hd.line([px(306), px(754), px(356), px(822)], fill=255, width=px(30))
    hd.ellipse([px(291), px(739), px(321), px(769)], fill=255)
    hd.ellipse([px(341), px(807), px(371), px(837)], fill=255)
    paste_grad(cv, hm, BRAND_DEEP, NAVY, 90)

    return cv


# ---------------- 应用图标 ----------------

def draw_icon(robot):
    cv = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sq = squircle(S)

    cv.paste(gradient(S, BG_TOP, BG_BOTTOM, 0), (0, 0), sq)

    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).ellipse([px(-180), px(-430), px(1200), px(420)], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(px(90)))
    paste_solid(cv, glow, "#FFFFFF", 90)

    scale = 0.76
    r = robot.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
    cv.alpha_composite(r, ((S - r.width) // 2, int(S * 0.055)))

    f = font(FONT_EN, 92)
    d = ImageDraw.Draw(cv)
    text = "REPY"
    bbox = d.textbbox((0, 0), text, font=f)
    x = (S - (bbox[2] - bbox[0])) // 2
    y = px(872)
    d.text((x + px(3), y + px(4)), text, font=f, fill=rgb(NAVY) + (70,))
    d.text((x, y), text, font=f, fill=rgb("#FFFFFF") + (255,))

    band = np.clip(np.array(squircle(S), float) - np.array(squircle(S, inset=8), float), 0, 255)
    fade = np.clip(1.1 - np.linspace(0, 1, S) * 1.7, 0, 1) ** 1.2
    a = np.clip(band * fade[:, None] * 0.9, 0, 255).astype(np.uint8)
    hl = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    hl.putalpha(Image.fromarray(a, "L"))
    cv.alpha_composite(hl)

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
        bg = Image.new("RGBA", (w, h), rgb(BG_TOP) + (255,))
        bg.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
        im = bg
    im.convert("RGB").save(out, format="BMP")
    print("  ", os.path.basename(out), size)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)

    print("绘制 Repy 机器人…")
    robot = draw_robot()
    robot.resize((C, C), Image.LANCZOS).save(os.path.join(ASSETS, "repy-robot.png"), optimize=True)
    print("  src/assets/repy-robot.png")

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
