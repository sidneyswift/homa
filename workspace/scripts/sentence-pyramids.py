#!/usr/bin/env python3
"""Sentence Pyramids worksheets for the child — based on the Lyndsey Kuster format.
Each page: focus sound box, a tap-and-map CVC word with sound dots, a cumulative
sentence pyramid (one word added per line), 3 stars to color (read 3x),
dashed handwriting lines to copy, and a draw-a-picture box.

Decodable, CVC-level, tuned to the child's interests (Paw Patrol, frogs).
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUTPUT = os.path.expanduser("~/.openclaw/workspace/content/curriculum/phonics/worksheets/sentence-pyramids/story-sentence-pyramids.pdf")
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
FONTS = os.path.expanduser("~/.openclaw/workspace/fonts")

# Register a friendly handwriting-ish font for the big word + sentence
pdfmetrics.registerFont(TTFont("Patrick", os.path.join(FONTS, "PatrickHand-Regular.ttf")))

W, H = letter
BLACK = Color(0, 0, 0)
GRAY = Color(0.55, 0.55, 0.55)
LIGHT = Color(0.8, 0.8, 0.8)

# Each worksheet: focus letter, the CVC word + its sound segments (dots), and the
# list of cumulative pyramid lines (last line is the full sentence).
SHEETS = [
    {
        "letter": "u",
        "word": "pup",
        "segments": ["p", "u", "p"],
        "lines": [
            "The",
            "The pup",
            "The pup can",
            "The pup can run",
            "The pup can run up.",
        ],
    },
    {
        "letter": "o",
        "word": "log",
        "segments": ["l", "o", "g"],
        "lines": [
            "A",
            "A frog",
            "A frog sat",
            "A frog sat on",
            "A frog sat on a log.",
        ],
    },
    {
        "letter": "a",
        "word": "cat",
        "segments": ["c", "a", "t"],
        "lines": [
            "The",
            "The cat",
            "The cat is",
            "The cat is on",
            "The cat is on a mat.",
        ],
    },
]


def draw_star(c, cx, cy, r, fill=False):
    import math
    pts = []
    for i in range(5):
        ang = math.radians(-90 + i * 144)
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    p = c.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    c.setStrokeColor(GRAY)
    c.setLineWidth(1.5)
    if fill:
        c.setFillColor(Color(1, 0.9, 0.3))
        c.drawPath(p, stroke=1, fill=1)
    else:
        c.drawPath(p, stroke=1, fill=0)


def num_badge(c, x, y, n):
    c.setFillColor(BLACK)
    c.circle(x, y, 9, stroke=0, fill=1)
    c.setFillColor(Color(1, 1, 1))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(x, y - 4, str(n))


def build_page(c, sheet):
    margin = 0.55 * inch
    top = H - margin

    # Name line
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 12)
    c.drawString(margin, top - 6, "Name: _______________________")

    # Directions (small, top right)
    c.setFont("Helvetica", 6.5)
    c.setFillColor(GRAY)
    dirs = [
        "Directions: Say the focus sound. Tap and map the",
        "sounds to build the word. Read the sentence 3 times.",
        "Color a star after each read. Draw a picture to match.",
    ]
    dy = top - 2
    for line in dirs:
        c.drawRightString(W - margin - 70, dy, line)
        dy -= 8

    # Focus letter box (1) top-right
    box = 46
    bx = W - margin - box
    by = top - box - 6
    num_badge(c, bx - 6, by + box + 4, 1)
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.5)
    c.rect(bx, by, box, box, stroke=1, fill=0)
    c.setFont("Patrick", 30)
    c.setFillColor(BLACK)
    c.drawCentredString(bx + box / 2, by + box / 2 - 11, sheet["letter"])

    # Title with little pyramid icon
    title_y = top - 52
    c.setStrokeColor(BLACK)
    c.setLineWidth(2)
    c.roundRect(margin, title_y - 18, 3.9 * inch, 34, 16, stroke=1, fill=0)
    # tiny pyramid icon
    px, py = margin + 26, title_y - 12
    c.setLineWidth(1.2)
    for i, w in enumerate([6, 12, 18, 24]):
        yy = py + i * 6
        c.line(px - w / 2, yy, px + w / 2, yy)
    c.line(px, py + 24, px - 12, py)
    c.line(px, py + 24, px + 12, py)
    c.setFont("Patrick", 26)
    c.drawString(margin + 52, title_y - 12, "Sentence Pyramids")

    # Divider line under title
    mid_y = title_y - 30
    section_top = mid_y - 10

    # Left half (2): tap-and-map word with dots
    half_x = W / 2 - 6
    num_badge(c, margin + 4, section_top, 2)
    word = sheet["word"]
    segs = sheet["segments"]
    c.setFont("Patrick", 54)
    c.setFillColor(BLACK)
    word_w = c.stringWidth(word, "Patrick", 54)
    wx = margin + (half_x - margin) / 2 - word_w / 2
    word_y = section_top - 70
    c.drawString(wx, word_y, word)
    # sound dots under each letter
    c.setFillColor(BLACK)
    dot_y = word_y - 16
    # distribute dots evenly under the word span
    n = len(segs)
    for i in range(n):
        dx = wx + word_w * (i + 0.5) / n
        c.circle(dx, dot_y, 5, stroke=0, fill=1)

    # vertical divider between halves
    c.setStrokeColor(LIGHT)
    c.setLineWidth(1)
    c.line(half_x + 3, section_top + 6, half_x + 3, word_y - 40)

    # Right half (3): the pyramid sentence
    num_badge(c, half_x + 18, section_top, 3)
    c.setFillColor(BLACK)
    lines = sheet["lines"]
    ly = section_top - 16
    line_h = 19
    right_center = (half_x + 16 + (W - margin)) / 2
    c.setFont("Patrick", 15)
    for line in lines:
        c.drawCentredString(right_center, ly, line)
        ly -= line_h

    # horizontal divider
    div_y = min(word_y - 42, ly - 6)
    c.setStrokeColor(GRAY)
    c.setLineWidth(1)
    c.line(margin, div_y, W - margin, div_y)

    # (4) Read 3 times + (5) stars  — and (6) draw box on the right
    block_top = div_y - 14
    num_badge(c, margin + 4, block_top, 4)
    c.setFont("Helvetica", 10)
    c.setFillColor(BLACK)
    c.drawString(margin + 18, block_top - 4, "Read the sentence 3 times.")
    c.drawString(margin + 18, block_top - 18, "Color a star after each read.")

    # stars
    sx = margin + 18
    sy = block_top - 44
    for i in range(3):
        draw_star(c, sx + i * 34, sy, 14)

    # draw box (6) on right
    box_x = W / 2 + 6
    box_y_bottom = margin
    box_top = block_top + 6
    num_badge(c, box_x - 2, box_top, 6)
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.5)
    c.rect(box_x, box_y_bottom, (W - margin) - box_x, box_top - 8 - box_y_bottom, stroke=1, fill=0)

    # (5) handwriting copy lines on the left, below stars
    num_badge(c, margin + 4, sy - 24, 5)
    line_x0 = margin + 18
    line_x1 = box_x - 16
    yy = sy - 34
    for _ in range(5):
        # top solid, mid dashed, baseline solid (HWT-style)
        c.setStrokeColor(GRAY)
        c.setLineWidth(1)
        c.line(line_x0, yy, line_x1, yy)            # top
        c.setDash(3, 3)
        c.setStrokeColor(LIGHT)
        c.line(line_x0, yy - 9, line_x1, yy - 9)    # mid dashed
        c.setDash()
        c.setStrokeColor(GRAY)
        c.line(line_x0, yy - 18, line_x1, yy - 18)  # baseline
        yy -= 30


def build():
    c = canvas.Canvas(OUTPUT, pagesize=letter)
    for sheet in SHEETS:
        build_page(c, sheet)
        c.showPage()
    c.save()
    print("Wrote", OUTPUT)


if __name__ == "__main__":
    build()
