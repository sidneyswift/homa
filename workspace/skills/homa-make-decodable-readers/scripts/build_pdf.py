#!/usr/bin/env python3
"""
Decodable Reader — PDF Builder

TEMPLATE: Copy to your book project directory and customize PAGES.
Key difference from picture-book PDF: text is LARGE (28pt) because the child reads it.
Includes a word list page at the end.

Usage: BOOK_OUTDIR=/path/to/output BOOK_FILENAME=reader.pdf python3 build_pdf.py
"""
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
import os

OUTDIR = os.environ.get("BOOK_OUTDIR", os.getcwd())
PDF_PATH = os.path.join(OUTDIR, os.environ.get("BOOK_FILENAME", "decodable-reader.pdf"))

W, H = landscape((8.5*inch, 11*inch))

# Fonts
font_paths = [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
]
if all(os.path.exists(p) for p in font_paths):
    pdfmetrics.registerFont(TTFont("Georgia", font_paths[0]))
    pdfmetrics.registerFont(TTFont("Georgia-Bold", font_paths[1]))
    pdfmetrics.registerFont(TTFont("Georgia-Italic", font_paths[2]))
    BODY, BOLD, ITALIC = "Georgia", "Georgia-Bold", "Georgia-Italic"
else:
    BODY, BOLD, ITALIC = "Times-Roman", "Times-Bold", "Times-Italic"

TITLE_FONT = "Helvetica-Bold"


def draw_full_bleed(c, img_path, w, h):
    img = Image.open(img_path)
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(img_path, (w - dw) / 2, (h - dh) / 2, dw, dh)


# ── CUSTOMIZE THESE ──────────────────────────────────────────

TITLE = "My Decodable Reader"
SUBTITLE = "A Decodable Reader"
LEVEL_LABEL = "Level 1: CVC Words"

# Pages: cover image + story pages
# Each story page: image filename + lines of decodable text
PAGES = [
    # {"image": "page00-cover.jpg", "layout": "cover"},
    # {"image": "page01.jpg", "lines": ["The cat sat on a mat."]},
]

# Word lists for the back page
CVC_WORDS = []       # e.g. ["cat", "sat", "mat", "ran", "big"]
SIGHT_WORDS = []     # e.g. ["the", "a", "on", "is", "I"]

# ── END CUSTOMIZATION ────────────────────────────────────────


def build():
    c = pdfcanvas.Canvas(PDF_PATH, pagesize=(W, H))

    for i, page in enumerate(PAGES):
        img_path = os.path.join(OUTDIR, page["image"])
        draw_full_bleed(c, img_path, W, H)

        if page.get("layout") == "cover":
            # Dark overlay top
            c.saveState()
            c.setFillColor(HexColor("#0D1B2A"))
            c.setFillAlpha(0.65)
            c.rect(0, H * 0.42, W, H * 0.58, fill=True, stroke=False)
            c.restoreState()
            # Title
            c.setFillColor(white)
            c.setFont(TITLE_FONT, 56)
            for j, line in enumerate(TITLE.split("\n")):
                c.drawCentredString(W/2, H * 0.78 - j * 70, line)
            # Subtitle
            c.setFillColor(HexColor("#7FD4FF"))
            c.setFont(ITALIC, 24)
            c.drawCentredString(W/2, H * 0.52, SUBTITLE)
            # Level
            c.setFillColor(HexColor("#FFD700"))
            c.setFont(BOLD, 16)
            c.drawCentredString(W/2, H * 0.46, f"⭐ {LEVEL_LABEL} ⭐")
        else:
            # story page — large text at bottom
            lines = page.get("lines", [])
            non_empty = [l for l in lines if l.strip()]
            font_size = 28
            line_h = 42
            bar_h = max(len(non_empty) * line_h + 50, 130)

            c.saveState()
            c.setFillColor(HexColor("#1A1A2E"))
            c.setFillAlpha(0.75)
            c.rect(-5, -5, W+10, bar_h, fill=True, stroke=False)
            c.restoreState()

            c.setFillColor(white)
            y = bar_h - 38
            for line in lines:
                if not line.strip():
                    y -= line_h * 0.35
                else:
                    font = ITALIC if line.lstrip().startswith('"') else BODY
                    c.setFont(font, font_size)
                    c.drawCentredString(W/2, y, line)
                    y -= line_h

            # "The End" on last story page
            if i == len(PAGES) - 1:
                y -= line_h * 0.3
                c.setFont(BOLD, 20)
                c.setFillColor(HexColor("#7FD4FF"))
                c.drawCentredString(W/2, y, "The End")

            # Page number
            c.saveState()
            c.setFillColor(white)
            c.setFillAlpha(0.4)
            c.setFont(BODY, 11)
            c.drawCentredString(W - 30, 10, str(i))
            c.restoreState()

        c.showPage()

    # Word list page
    if CVC_WORDS or SIGHT_WORDS:
        c.setFillColor(HexColor("#1A1A2E"))
        c.rect(0, 0, W, H, fill=True, stroke=False)

        c.setFillColor(HexColor("#7FD4FF"))
        c.setFont(TITLE_FONT, 36)
        c.drawCentredString(W/2, H - 60, "Word List")

        y = H - 110
        if CVC_WORDS:
            c.setFillColor(HexColor("#FFD700"))
            c.setFont(BOLD, 20)
            c.drawCentredString(W/2, y, "CVC Words (sound these out!)")
            y -= 35
            c.setFillColor(white)
            c.setFont(BODY, 18)
            row = ""
            for w in CVC_WORDS:
                row += ("   •   " if row else "") + w
                if len(row) > 50:
                    c.drawString(100, y, row); y -= 30; row = ""
            if row:
                c.drawString(100, y, row); y -= 30
            y -= 20

        if SIGHT_WORDS:
            c.setFillColor(HexColor("#FFD700"))
            c.setFont(BOLD, 20)
            c.drawCentredString(W/2, y, "Sight Words (you know these!)")
            y -= 35
            c.setFillColor(white)
            c.setFont(BODY, 18)
            row = ""
            for w in SIGHT_WORDS:
                row += ("   •   " if row else "") + w
                if len(row) > 55:
                    c.drawString(100, y, row); y -= 30; row = ""
            if row:
                c.drawString(100, y, row); y -= 30
            y -= 30

        c.setFillColor(HexColor("#7FD4FF"))
        c.setFont(ITALIC, 16)
        c.drawCentredString(W/2, y, "Every word is either a CVC word to sound out")
        y -= 24
        c.drawCentredString(W/2, y, "or a sight word you already know!")
        y -= 40
        c.setFillColor(HexColor("#FFD700"))
        c.setFont(BOLD, 14)
        c.drawCentredString(W/2, y, "Tip: Point to each word. Sound out the CVC words. Read the sight words by sight!")

        c.showPage()

    c.save()
    size = os.path.getsize(PDF_PATH)
    print(f"PDF: {PDF_PATH} ({size:,} bytes, {size/1024/1024:.1f} MB)")


if __name__ == "__main__":
    if not PAGES:
        print("No pages defined — customize PAGES in this script first.")
    else:
        build()
