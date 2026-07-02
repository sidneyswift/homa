#!/usr/bin/env python3
"""Word Pyramids — just the cumulative sentence pyramid, nothing else.
Matches Lyndsey Kuster style: centered, one word added per line, building to a
full decodable sentence. 10 versions, one per page. Tuned to the child's level
(CVC / Bob Book level) and interests (Paw Patrol pups, frogs, space, animals).
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

OUTPUT = os.path.expanduser("~/.openclaw/workspace/content/curriculum/phonics/worksheets/word-pyramids/story-word-pyramids.pdf")
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
FONTS = os.path.expanduser("~/.openclaw/workspace/fonts")
pdfmetrics.registerFont(TTFont("Patrick", os.path.join(FONTS, "PatrickHand-Regular.ttf")))

W, H = letter
BLACK = Color(0, 0, 0)

# Each sentence builds one word at a time. Decodable, short, the child-themed.
SENTENCES = [
    "Pip the Pup hops in the tub.",
    "The big dog ran to the den.",
    "A frog sat on a wet log.",
    "The red cat naps on a mat.",
    "Sam the pup can dig a pit.",
    "A bug hid in the tall grass.",
    "The hot sun is up in the sky.",
    "Six pups run up the big hill.",
    "A fox ran past the old box.",
    "The fish swam in the blue pond.",
]


def build_page(c, sentence):
    words = sentence.split()
    # build cumulative lines; keep the period only on the last line
    base = sentence.rstrip(".")
    base_words = base.split()
    lines = []
    for i in range(1, len(base_words) + 1):
        text = " ".join(base_words[:i])
        if i == len(base_words):
            text += "."
        lines.append(text)

    n = len(lines)
    # pick a font size that fits the longest (last) line within margins
    margin = 0.9 * inch
    max_w = W - 2 * margin
    size = 34
    while size > 16:
        if c.stringWidth(lines[-1], "Patrick", size) <= max_w:
            break
        size -= 1
    line_h = size * 1.55

    total_h = line_h * n
    start_y = H / 2 + total_h / 2 - line_h * 0.7

    c.setFillColor(BLACK)
    c.setFont("Patrick", size)
    for i, line in enumerate(lines):
        y = start_y - i * line_h
        c.drawCentredString(W / 2, y, line)


def build():
    c = canvas.Canvas(OUTPUT, pagesize=letter)
    for s in SENTENCES:
        build_page(c, s)
        c.showPage()
    c.save()
    print("Wrote", OUTPUT, "-", len(SENTENCES), "pyramids")


if __name__ == "__main__":
    build()
