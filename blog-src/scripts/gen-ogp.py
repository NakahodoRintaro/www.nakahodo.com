#!/usr/bin/env python3
"""Generate OGP thumbnail image for a blog post."""

import sys
from PIL import Image, ImageDraw, ImageFont

# ── config ──────────────────────────────────────────────────────────────────
W, H = 1200, 630
BG       = (10, 15, 35)        # dark navy
ACCENT   = (100, 160, 230)     # cyan-blue
GOLD     = (210, 170, 90)      # gold
WHITE    = (255, 255, 255)
DIM      = (130, 150, 185)     # muted label colour

FONT_BOLD   = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
FONT_MEDIUM = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
FONT_LIGHT  = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"

# ── args ─────────────────────────────────────────────────────────────────────
if len(sys.argv) < 5:
    print("Usage: gen-ogp.py <output.png> <date> <label> <title_line1> [title_line2] [subtitle]")
    sys.exit(1)

out_path   = sys.argv[1]
date_str   = sys.argv[2]   # e.g. "2026.04.18"
label      = sys.argv[3]   # e.g. "SEO / Engineering"
title_l1   = sys.argv[4]
title_l2   = sys.argv[5] if len(sys.argv) > 5 else ""
subtitle   = sys.argv[6] if len(sys.argv) > 6 else ""

# ── draw ─────────────────────────────────────────────────────────────────────
img  = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# subtle dot grid
for x in range(40, W, 40):
    for y in range(40, H, 40):
        draw.ellipse([x-1, y-1, x+1, y+1], fill=(25, 35, 65))

# corner brackets
BW = 40   # bracket width
BT = 3    # bracket thickness
PAD = 36

def bracket(x, y, flip_x=False, flip_y=False):
    dx = -1 if flip_x else 1
    dy = -1 if flip_y else 1
    # horizontal arm
    x0, x1 = (x - BW, x) if flip_x else (x, x + BW)
    y0, y1 = (y - BT, y) if flip_y else (y, y + BT)
    draw.rectangle([x0, y0, x1, y1], fill=ACCENT)
    # vertical arm
    x0, x1 = (x - BT, x) if flip_x else (x, x + BT)
    y0, y1 = (y - BW, y) if flip_y else (y, y + BW)
    draw.rectangle([x0, y0, x1, y1], fill=ACCENT)

bracket(PAD,       PAD)
bracket(W - PAD,   PAD,       flip_x=True)
bracket(PAD,       H - PAD,   flip_y=True)
bracket(W - PAD,   H - PAD,   flip_x=True, flip_y=True)

# top-right decorative dashes
for i, dx in enumerate([80, 60, 40, 20]):
    draw.rectangle([W - PAD - dx - 12, PAD + 14, W - PAD - dx, PAD + 14 + BT], fill=ACCENT)

# ── date + label (top-left) ───────────────────────────────────────────────
f_label = ImageFont.truetype(FONT_LIGHT, 26)
draw.text((PAD + BW + 14, PAD + 10), f"{date_str}  {label}", font=f_label, fill=ACCENT)

# ── horizontal rule ───────────────────────────────────────────────────────
LINE_Y = H // 2 - 60
draw.rectangle([PAD, LINE_Y, W - PAD, LINE_Y + 1], fill=(40, 60, 100))

# ── main title ────────────────────────────────────────────────────────────
f_title = ImageFont.truetype(FONT_BOLD, 66)
f_title2 = ImageFont.truetype(FONT_BOLD, 58)

lines = [l for l in [title_l1, title_l2] if l]
total_h = sum(f_title.getbbox(l)[3] + 10 for l in lines)
start_y = LINE_Y + 30

for i, line in enumerate(lines):
    font = f_title if i == 0 else f_title2
    bbox = font.getbbox(line)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, start_y), line, font=font, fill=WHITE)
    start_y += bbox[3] - bbox[1] + 14

# ── subtitle ─────────────────────────────────────────────────────────────
if subtitle:
    f_sub = ImageFont.truetype(FONT_MEDIUM, 32)
    bbox = f_sub.getbbox(subtitle)
    sw = bbox[2] - bbox[0]
    draw.text(((W - sw) // 2, start_y + 8), subtitle, font=f_sub, fill=GOLD)

# ── nakahodo.com (bottom-right) ───────────────────────────────────────────
f_site = ImageFont.truetype(FONT_LIGHT, 24)
draw.text((W - PAD - BW - 130, H - PAD - 30), "nakahodo.com", font=f_site, fill=DIM)

img.save(out_path, "PNG")
print(f"Saved: {out_path}")
