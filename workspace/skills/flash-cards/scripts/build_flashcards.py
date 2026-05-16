#!/usr/bin/env python3
"""
Flash Card PDF Builder — 3 cards per page, large toddler-friendly layout.

TEMPLATE: Copy and customize CARDS list for each set.

Usage:
  python3 build_flashcards.py
  
Environment:
  CARDS_OUTDIR — output directory (default: cwd)
  CARDS_FILENAME — output filename (default: flash-cards.pdf)
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.colors import HexColor, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
import os, math

OUTDIR = os.environ.get("CARDS_OUTDIR", os.getcwd())
PDF_PATH = os.path.join(OUTDIR, os.environ.get("CARDS_FILENAME", "flash-cards.pdf"))

W, H = letter  # 8.5 x 11 portrait
CARDS_PER_PAGE = 3
CARD_H = H / CARDS_PER_PAGE
MARGIN = 0.4 * inch

# Try Georgia, fall back to Helvetica
try:
    font_path = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont("Georgia-Bold", font_path))
        FONT = "Georgia-Bold"
    else:
        raise FileNotFoundError
except:
    FONT = "Helvetica-Bold"

# Define your cards here — each needs: image path, primary text, optional secondary text
# Example for bilingual Spanish cards:
CARDS = [
    # {"image": "feliz.jpg", "primary": "Feliz", "secondary": "Happy"},
    # {"image": "triste.jpg", "primary": "Triste", "secondary": "Sad"},
]


def build_pdf(cards):
    c = pdfcanvas.Canvas(PDF_PATH, pagesize=letter)
    
    pages = math.ceil(len(cards) / CARDS_PER_PAGE)
    
    for page_idx in range(pages):
        start = page_idx * CARDS_PER_PAGE
        page_cards = cards[start:start + CARDS_PER_PAGE]
        
        for i, card in enumerate(page_cards):
            y_base = H - (i + 1) * CARD_H
            
            # Card border (rounded rect)
            c.setStrokeColor(HexColor("#CCCCCC"))
            c.setLineWidth(0.5)
            c.roundRect(MARGIN, y_base + 8, W - 2 * MARGIN, CARD_H - 16, radius=12, stroke=True, fill=False)
            
            # Image (centered in top portion of card)
            img_path = card.get("image")
            if img_path and os.path.exists(img_path):
                img = Image.open(img_path)
                iw, ih = img.size
                max_img_h = CARD_H * 0.6
                max_img_w = W - 4 * MARGIN
                scale = min(max_img_w / iw, max_img_h / ih)
                draw_w, draw_h = iw * scale, ih * scale
                img_x = (W - draw_w) / 2
                img_y = y_base + CARD_H * 0.3
                c.drawImage(img_path, img_x, img_y, draw_w, draw_h, preserveAspectRatio=True)
            
            # Primary text (large, bold)
            c.setFillColor(black)
            c.setFont(FONT, 28)
            c.drawCentredString(W / 2, y_base + CARD_H * 0.18, card.get("primary", ""))
            
            # Secondary text (smaller, lighter)
            secondary = card.get("secondary", "")
            if secondary:
                c.setFillColor(HexColor("#666666"))
                c.setFont(FONT, 18)
                c.drawCentredString(W / 2, y_base + CARD_H * 0.08, secondary)
        
        # Cut lines between cards (dashed)
        c.setStrokeColor(HexColor("#DDDDDD"))
        c.setDash(6, 3)
        c.setLineWidth(0.3)
        for i in range(1, CARDS_PER_PAGE):
            y = H - i * CARD_H
            c.line(MARGIN / 2, y, W - MARGIN / 2, y)
        c.setDash()
        
        c.showPage()
    
    c.save()
    size = os.path.getsize(PDF_PATH)
    print(f"PDF saved: {PDF_PATH}")
    print(f"Size: {size:,} bytes | {len(cards)} cards | {pages} pages")


if __name__ == "__main__":
    if not CARDS:
        print("No cards defined. Edit CARDS list in this script, then re-run.")
    else:
        build_pdf(CARDS)
