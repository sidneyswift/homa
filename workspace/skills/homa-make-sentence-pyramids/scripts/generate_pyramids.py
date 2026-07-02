#!/usr/bin/env python3
"""
Generate Sentence Pyramid worksheets / pyramid-only print sets.

Modes:
  pyramids   -> just centered sentence pyramids, N per page (default 2). Default mode.
  worksheet  -> full 6-section Lyndsey-Kuster-style page, one pyramid per page.

Data file (JSON list of pyramid objects):
[
  {
    "focus": "u",
    "target": "tub",
    "lines": ["Pip", "Pip the", "Pip the Pup", "Pip the Pup hops",
               "Pip the Pup hops in", "Pip the Pup hops in the",
               "Pip the Pup hops in the tub."],
    "map_word": "tub",              # worksheet mode only
    "pic_correct": "/tmp/tub.png",  # worksheet mode only
    "pic_distractor": "/tmp/barrel.png"  # worksheet mode only
  }
]

Usage:
  python3 generate_pyramids.py --mode pyramids --data /tmp/p.json --per-page 2 --output out.pdf
  python3 generate_pyramids.py --mode worksheet --data /tmp/p.json --output out.pdf [--copies N]
"""
import argparse
import json
import subprocess
import sys
import os
import math

from reportlab.lib.pagesizes import letter as LETTER_SIZE
from reportlab.lib.units import inch
from reportlab.lib.colors import Color, black, white
from reportlab.pdfgen import canvas

WIDTH, HEIGHT = LETTER_SIZE  # 8.5 x 11
LIGHT_GREY = Color(0.80, 0.80, 0.80)

PYRAMID_FONT = "Helvetica"
PYRAMID_SIZE = 17
LINE_LEADING = 1.55  # multiple of font size


def draw_num_badge(c, x, y, n, r=9):
    c.setFillColor(black)
    c.circle(x, y, r, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", r * 1.15)
    c.drawCentredString(x, y - r * 0.42, str(n))
    c.setFillColor(black)


def draw_pyramid(c, lines, cx, top_y, size=PYRAMID_SIZE):
    """Draw a centered sentence pyramid. Returns bottom y."""
    c.setFont(PYRAMID_FONT, size)
    c.setFillColor(black)
    lead = size * LINE_LEADING
    y = top_y
    for ln in lines:
        c.drawCentredString(cx, y, ln)
        y -= lead
    return y


def draw_pyramid_icon(c, x, y, w=0.22 * inch):
    """Small striped pyramid/triangle icon with sparkle."""
    h = w
    c.setStrokeColor(black)
    c.setLineWidth(1)
    p = c.beginPath()
    p.moveTo(x, y)
    p.lineTo(x + w, y)
    p.lineTo(x + w / 2, y + h)
    p.close()
    c.drawPath(p, stroke=1, fill=0)
    for frac in (0.33, 0.66):
        yy = y + h * frac
        half = (w / 2) * (1 - frac)
        c.line(x + w / 2 - half, yy, x + w / 2 + half, yy)
    sx, sy = x + w / 2, y + h + 2
    c.line(sx, sy, sx, sy + 4)
    c.line(sx - 3, sy + 2, sx + 3, sy + 2)


def draw_writing_lines(c, x, y_top, w, rows=4, row_h=0.42 * inch):
    c.setLineWidth(0.7)
    y = y_top
    for _ in range(rows):
        c.setStrokeColor(LIGHT_GREY)
        c.setDash(3, 3)
        c.line(x, y + row_h * 0.5, x + w, y + row_h * 0.5)
        c.setDash()
        c.setStrokeColor(black)
        c.line(x, y, x + w, y)
        y -= row_h
    return y


def draw_star(c, cx, cy, r):
    pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    c.setStrokeColor(black)
    c.setLineWidth(1)
    p = c.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    c.drawPath(p, stroke=1, fill=0)


# ---------- PYRAMID-ONLY MODE ----------

def render_pyramids_only(c, pyramids, per_page):
    slot = 0
    for pyr in pyramids:
        region_h = (HEIGHT - 1.2 * inch) / per_page
        idx_in_page = slot % per_page
        region_top = HEIGHT - 0.6 * inch - idx_in_page * region_h
        cx = WIDTH / 2
        c.setFont("Helvetica-Oblique", 11)
        c.setFillColor(Color(0.4, 0.4, 0.4))
        c.drawCentredString(cx, region_top - 6, f"focus sound:  {pyr.get('focus','')}")
        c.setFillColor(black)
        n_lines = len(pyr["lines"])
        pyr_block_h = n_lines * PYRAMID_SIZE * LINE_LEADING
        start_y = region_top - 24 - (region_h - 30 - pyr_block_h) / 2
        draw_pyramid(c, pyr["lines"], cx, start_y)
        if idx_in_page < per_page - 1:
            c.setStrokeColor(LIGHT_GREY)
            c.setLineWidth(0.8)
            c.line(0.7 * inch, region_top - region_h + 8,
                   WIDTH - 0.7 * inch, region_top - region_h + 8)
            c.setStrokeColor(black)
        slot += 1
        if slot % per_page == 0:
            c.showPage()
    if slot % per_page != 0:
        c.showPage()


# ---------- FULL WORKSHEET MODE ----------

def render_worksheet(c, pyr):
    left = 0.55 * inch
    top = HEIGHT - 0.55 * inch

    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(black)
    c.drawString(left, top - 12, "Name:")
    c.setLineWidth(0.8)
    c.line(left + 48, top - 13, left + 2.4 * inch, top - 13)

    c.setFont("Helvetica", 7.4)
    dirs = ("Directions: Say the focus sound. Tap and map the sounds to build the "
            "word. Circle the picture that matches the word. Read the sentence 3 "
            "times. Write the complete sentence. Draw a picture to match.")
    tx = left + 2.7 * inch
    words = dirs.split()
    line = ""
    yy = top - 6
    for w in words:
        if c.stringWidth(line + " " + w, "Helvetica", 7.4) > 2.7 * inch:
            c.drawString(tx, yy, line); line = w; yy -= 9
        else:
            line = (line + " " + w).strip()
    if line:
        c.drawString(tx, yy, line)

    bx = WIDTH - 1.15 * inch
    by = top - 0.75 * inch
    draw_num_badge(c, bx - 6, top - 8, 1)
    c.setLineWidth(1.2)
    c.rect(bx, by, 0.7 * inch, 0.7 * inch, stroke=1, fill=0)
    c.setFont("Helvetica", 30)
    c.drawCentredString(bx + 0.35 * inch, by + 0.18 * inch, pyr.get("focus", ""))

    band_y = top - 1.05 * inch
    c.setLineWidth(1.4)
    c.roundRect(left, band_y - 0.28 * inch, 3.7 * inch, 0.5 * inch, 0.25 * inch, stroke=1, fill=0)
    draw_pyramid_icon(c, left + 12, band_y - 0.2 * inch, 0.28 * inch)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(left + 0.55 * inch, band_y - 0.13 * inch, "Sentence Pyramids")

    mid_top = band_y - 0.5 * inch
    mid_bot = 4.0 * inch
    midx = WIDTH / 2
    c.setLineWidth(1)
    c.line(midx, mid_bot, midx, mid_top)

    draw_num_badge(c, left + 4, mid_top - 6, 2)
    mw = pyr.get("map_word", pyr.get("target", ""))
    letters = list(mw)
    n = len(letters)
    span = 2.0 * inch
    x0 = left + 0.5 * inch
    step = span / max(n, 1)
    c.setFont("Helvetica", 34)
    ly = mid_top - 0.7 * inch
    for i, ch in enumerate(letters):
        cxx = x0 + step * (i + 0.5)
        c.drawCentredString(cxx, ly, ch)
        c.setFillColor(black)
        c.circle(cxx, ly - 16, 3.5, fill=1, stroke=0)
    pic_y = ly - 1.7 * inch
    pw = 1.1 * inch
    for i, key in enumerate(("pic_correct", "pic_distractor")):
        path = pyr.get(key)
        pxx = x0 + i * (pw + 0.25 * inch)
        c.setLineWidth(0.8)
        c.rect(pxx, pic_y, pw, pw, stroke=1, fill=0)
        if path:
            try:
                c.drawImage(path, pxx + 4, pic_y + 4, width=pw - 8, height=pw - 8,
                            preserveAspectRatio=True, anchor='c', mask='auto')
            except Exception:
                pass

    # Section 3 — pyramid centered in the right column
    draw_num_badge(c, midx + 12, mid_top - 6, 3)
    col_right = WIDTH - 0.5 * inch
    col_cx = (midx + col_right) / 2
    draw_pyramid(c, pyr["lines"], col_cx, mid_top - 0.55 * inch, size=13)

    c.setLineWidth(1)
    c.line(left, mid_bot - 0.15 * inch, WIDTH - 0.5 * inch, mid_bot - 0.15 * inch)

    s4y = mid_bot - 0.5 * inch
    draw_num_badge(c, left + 4, s4y, 4)
    c.setFont("Helvetica", 10)
    c.drawString(left + 0.3 * inch, s4y + 2, "Read the sentence 3 times.")
    c.drawString(left + 0.3 * inch, s4y - 12, "Color a star after each read.")
    for i in range(3):
        draw_star(c, left + 3.4 * inch + i * 0.6 * inch, s4y - 4, 0.22 * inch)

    draw_num_badge(c, left + 4, s4y - 0.5 * inch, 5)
    draw_writing_lines(c, left + 0.3 * inch, s4y - 0.75 * inch, 3.0 * inch, rows=4)

    draw_num_badge(c, midx + 0.2 * inch, s4y - 0.42 * inch, 6)
    box_x = midx + 0.2 * inch
    box_y = 0.6 * inch
    c.setLineWidth(1.2)
    c.rect(box_x, box_y, WIDTH - 0.5 * inch - box_x, s4y - 0.6 * inch - box_y,
           stroke=1, fill=0)

    c.showPage()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["pyramids", "worksheet"], default="pyramids")
    ap.add_argument("--data", required=True, help="JSON file: list of pyramid objects")
    ap.add_argument("--per-page", type=int, default=2, help="pyramids-only: per page")
    ap.add_argument("--output", default="/tmp/sentence-pyramids.pdf")
    ap.add_argument("--copies", type=int, default=0)
    args = ap.parse_args()

    with open(args.data) as f:
        pyramids = json.load(f)
    if not isinstance(pyramids, list) or not pyramids:
        print("data must be a non-empty JSON list"); sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    c = canvas.Canvas(args.output, pagesize=LETTER_SIZE)

    if args.mode == "pyramids":
        render_pyramids_only(c, pyramids, max(1, args.per_page))
    else:
        for pyr in pyramids:
            render_worksheet(c, pyr)

    c.save()
    print(f"Saved {len(pyramids)} pyramid(s) -> {args.output}")

    if args.copies > 0:
        subprocess.run(["lpr", "-#", str(args.copies), args.output], check=True)
        print(f"Printed {args.copies} copies")


if __name__ == "__main__":
    main()
