# -*- coding: utf-8 -*-
"""
健身记录生成器 · 应用图标生成器
构图：机器人头部在上，双臂在胸前抱住一块写有「健身记录」的牌子。
风格：超椭圆底 + 高饱和三色渐变 + 柔和体积阴影 + 内边缘高光。
用法：python scripts/make-icon.py
"""
import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

C = 1024
K = 4
S = C * K
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build")
FONT_PATH = "C:/Windows/Fonts/msyhbd.ttc"


def px(v):
    return int(round(v * K))


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def linear_gradient(w, h, stops, angle=90.0):
    yy, xx = np.mgrid[0:h, 0:w]
    x = xx / max(w - 1, 1)
    y = yy / max(h - 1, 1)
    a = math.radians(angle)
    t = x * math.cos(a) + y * math.sin(a)
    t = (t - t.min()) / max(t.max() - t.min(), 1e-6)
    out = np.zeros((h, w, 3), float)
    st = [(p, np.array(hex2rgb(c), float)) for p, c in stops]
    for i in range(len(st) - 1):
        p0, c0 = st[i]
        p1, c1 = st[i + 1]
        m = (t >= p0) & (t <= p1)
        if not m.any():
            continue
        u = ((t[m] - p0) / max(p1 - p0, 1e-6))[:, None]
        out[m] = c0 * (1 - u) + c1 * u
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def radial_alpha(size, cx, cy, r, peak=1.0, power=1.6):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** power * peak * 255
    return Image.fromarray(a.astype(np.uint8), "L")


BG_RADIUS = 196  # 圆角矩形半径（1024 基准）


def squircle(size, inset=0):
    """圆角矩形遮罩（按 1024 基准半径等比缩放）"""
    w, h = size
    m = Image.new("L", size, 0)
    r = BG_RADIUS * w / 1024.0 - inset
    ImageDraw.Draw(m).rounded_rectangle([inset, inset, w - 1 - inset, h - 1 - inset],
                                        radius=max(r, 1), fill=255)
    return m


def rrect_mask(size, box, radius=None):
    if len(box) == 5:
        box, radius = box[:4], box[4]
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([px(v) for v in box], radius=px(radius), fill=255)
    return m


def circle_mask(size, cx, cy, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse([px(cx - r), px(cy - r), px(cx + r), px(cy + r)], fill=255)
    return m


def fill_grad(canvas, mask, stops, angle=90.0):
    canvas.paste(linear_gradient(S, S, stops, angle), (0, 0), mask)


def fill_solid(canvas, mask, color, alpha=255):
    canvas.paste(Image.new("RGBA", (S, S), hex2rgb(color) + (alpha,)), (0, 0), mask)


def add_shadow(canvas, mask, offset=(0, 18), blur=36, color="#000A1E", alpha=110, clip=None):
    sh = Image.new("L", (S, S), 0)
    sh.paste(mask, (px(offset[0]), px(offset[1])))
    sh = sh.filter(ImageFilter.GaussianBlur(px(blur) / 2))
    if clip is not None:
        sh = Image.fromarray((np.array(sh, float) * np.array(clip, float) / 255.0).astype(np.uint8), "L")
    layer = Image.new("RGBA", (S, S), hex2rgb(color) + (0,))
    layer.putalpha(sh.point(lambda v: int(v * alpha / 255)))
    canvas.alpha_composite(layer)


def draw_text_spaced(canvas, text, font, color, center, spacing):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    adv = [d.textlength(ch, font=font) for ch in text]
    total = sum(adv) + spacing * (len(text) - 1)
    x = (S - total) / 2.0
    for ch, a in zip(text, adv):
        d.text((x, S * 0.3), ch, font=font, fill=hex2rgb(color) + (255,))
        x += a + spacing
    layer = layer.crop(layer.getbbox())
    canvas.alpha_composite(layer, (int(px(center[0]) - layer.width / 2),
                                   int(px(center[1]) - layer.height / 2)))



# ---- 配色：品牌 navy/yellow 提纯后的高饱和版本 ----
BG_STOPS = [(0.00, "#5AA6FF"), (0.26, "#2477F2"), (0.58, "#0F49B2"), (1.00, "#08224A")]
SIGN_STOPS = [(0.00, "#FFDD63"), (0.40, "#FFBF27"), (1.00, "#F28A0A")]
BODY_STOPS = [(0.00, "#FFFFFF"), (0.44, "#FBFDFF"), (1.00, "#DAE7FA")]
BALL_STOPS = [(0.00, "#FFE68F"), (1.00, "#FF9A12")]
NAVY = "#0A2540"
EYE = "#10304F"

HEAD = (352, 176, 672, 420, 82)
NECK = (484, 406, 540, 466, 18)
TORSO = (334, 440, 690, 764, 100)
SIGN = (140, 470, 884, 730, 68)
TXT_C = (512, 596)


def catmull(pts, steps=40):
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(p) - 3):
        p0, p1, p2, p3 = p[i], p[i + 1], p[i + 2], p[i + 3]
        for t in np.linspace(0, 1, steps, endpoint=False):
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
                       (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
                       (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(pts[-1])
    return out


def build(with_hands=True):
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sq = squircle((S, S))

    # ---------- 背景 ----------
    canvas.paste(linear_gradient(S, S, BG_STOPS, angle=118).convert("RGBA"), (0, 0), sq)

    g = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    g.putalpha(radial_alpha((S, S), S * 0.5, -S * 0.05, S * 0.78, 0.34, 2.2))
    g = Image.composite(Image.new("RGBA", (S, S), (170, 212, 255, 255)),
                        Image.new("RGBA", (S, S), (0, 0, 0, 0)), g.getchannel("A"))
    canvas.alpha_composite(Image.composite(g, Image.new("RGBA", (S, S), (0, 0, 0, 0)), sq))

    v = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    v.putalpha(radial_alpha((S, S), S * 0.5, S * 1.2, S * 1.02, 0.46, 1.4))
    canvas.alpha_composite(Image.composite(v, Image.new("RGBA", (S, S), (0, 0, 0, 0)), sq))

    # ---------- 体型 ----------
    head_m = rrect_mask((S, S), HEAD)
    neck_m = rrect_mask((S, S), NECK)
    torso_m = rrect_mask((S, S), TORSO)
    sign_m = rrect_mask((S, S), SIGN)

    body = Image.new("L", (S, S), 0)
    for m in (torso_m, head_m, neck_m):
        body.paste(m, (0, 0))
    add_shadow(canvas, body, offset=(0, 22), blur=58, alpha=90, clip=sq)

    fill_grad(canvas, neck_m, BODY_STOPS, 90)
    fill_grad(canvas, torso_m, BODY_STOPS, 90)

    # ---------- 牌子 ----------
    add_shadow(canvas, sign_m, offset=(0, 12), blur=30, alpha=78)
    fill_grad(canvas, sign_m, SIGN_STOPS, 104)

    gloss = np.array(sign_m, float) * (np.clip(1 - np.linspace(0, 1, S) * 2.4, 0, 1) ** 1.2)[:, None] * 0.32
    canvas.alpha_composite(Image.merge("RGBA", (
        Image.new("L", (S, S), 255), Image.new("L", (S, S), 255), Image.new("L", (S, S), 255),
        Image.fromarray(np.clip(gloss, 0, 255).astype(np.uint8), "L"))))

    font = ImageFont.truetype(FONT_PATH, px(124))
    draw_text_spaced(canvas, "健身记录", font, NAVY, TXT_C, px(3))

    # ---------- 双手从下方托住牌底（圆头，无手指） ----------
    if with_hands:
        hands = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        hd = ImageDraw.Draw(hands)
        for hx in (296, 728):
            hd.rounded_rectangle([px(hx - 54), px(686), px(hx + 54), px(772)],
                                 radius=px(38), fill=(255, 255, 255, 255))

        hand_a = hands.getchannel("A")
        add_shadow(canvas, hand_a, offset=(0, 8), blur=30, alpha=46)
        canvas.alpha_composite(Image.composite(
            linear_gradient(S, S, BODY_STOPS, 90).convert("RGBA"),
            Image.new("RGBA", (S, S), (0, 0, 0, 0)), hand_a))

    # ---------- 头部 ----------
    fill_grad(canvas, head_m, BODY_STOPS, 90)
    fill_solid(canvas, rrect_mask((S, S), (499, 118, 525, 198, 13)), "#F6FAFF")
    fill_grad(canvas, circle_mask((S, S), 512, 110, 31), BALL_STOPS, 125)
    fill_solid(canvas, circle_mask((S, S), 501, 99, 9), "#FFFDF0", 200)
    for ex in (414, 556):
        fill_solid(canvas, rrect_mask((S, S), (ex, 264, ex + 58, 334, 28)), EYE)

    # ---------- 边缘高光 ----------
    band = np.clip(np.array(squircle((S, S)), float) - np.array(squircle((S, S), inset=9), float), 0, 255)
    fade = np.clip(1.15 - np.linspace(0, 1, S) * 1.75, 0, 1) ** 1.3
    a = band * fade[:, None] * 0.85
    canvas.alpha_composite(Image.merge("RGBA", (
        Image.new("L", (S, S), 255), Image.new("L", (S, S), 255), Image.new("L", (S, S), 255),
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))))

    return canvas


def main():
    os.makedirs(OUT, exist_ok=True)
    master = build(with_hands=False)
    master.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, "icon_1024.png"))

    sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    frames = [master.resize((s, s), Image.LANCZOS) for s in sizes]
    frames[-1].save(os.path.join(OUT, "icon.ico"), format="ICO", sizes=[(s, s) for s in sizes])

    pad, gap = 28, 18
    w = max(sum(s + gap for s in sizes) + pad * 2, 860)
    sheet = Image.new("RGB", (w, 300), "#F2F4F7")
    d = ImageDraw.Draw(sheet)
    try:
        f = ImageFont.truetype(FONT_PATH, 13)
    except Exception:
        f = None
    x = pad
    for s, fr in zip(sizes, frames):
        sheet.paste(fr, (x, 80 + (240 - s) // 2), fr)
        d.text((x, 62), str(s), fill="#8A929C", font=f)
        x += s + gap
    sheet.save(os.path.join(OUT, "icon_preview.png"))
    print("ok")


if __name__ == "__main__":
    main()
