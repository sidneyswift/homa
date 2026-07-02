#!/usr/bin/env python3
"""
Picture Book PDF Builder — landscape, full-bleed, varied layout.

TEMPLATE: Copy this file into your book project directory and customize PAGES.
"""
from reportlab.lib.pagesizes import landscape
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
import os

OUTDIR = os.environ.get("BOOK_OUTDIR", os.getcwd())
PDF_PATH = os.path.join(OUTDIR, os.environ.get("BOOK_FILENAME", "picture-book.pdf"))

# 11x8.5 landscape (standard letter)
W, H = landscape((8.5*inch, 11*inch))

# Try to register some nicer fonts; fall back to built-in
try:
    # Check for system fonts
    font_paths = [
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
    ]
    if all(os.path.exists(p) for p in font_paths):
        pdfmetrics.registerFont(TTFont("Georgia", font_paths[0]))
        pdfmetrics.registerFont(TTFont("Georgia-Bold", font_paths[1]))
        pdfmetrics.registerFont(TTFont("Georgia-Italic", font_paths[2]))
        BODY_FONT = "Georgia"
        BODY_BOLD = "Georgia-Bold"
        BODY_ITALIC = "Georgia-Italic"
    else:
        raise FileNotFoundError
except:
    BODY_FONT = "Times-Roman"
    BODY_BOLD = "Times-Bold"
    BODY_ITALIC = "Times-Italic"

TITLE_FONT = "Helvetica-Bold"


def draw_full_bleed_image(c, img_path, w, h):
    """Draw image to fill the entire page (crop to fit)."""
    img = Image.open(img_path)
    iw, ih = img.size
    
    # Calculate scale to cover the page
    scale_w = w / iw
    scale_h = h / ih
    scale = max(scale_w, scale_h)
    
    draw_w = iw * scale
    draw_h = ih * scale
    
    # Center the image
    x = (w - draw_w) / 2
    y = (h - draw_h) / 2
    
    c.drawImage(img_path, x, y, draw_w, draw_h)


def draw_text_bar(c, text_lines, y_center, w, font=None, size=20, color=HexColor("#FFFFFF"),
                  bg_color=None, bg_alpha=0.6, line_height=None, align="center", max_width=None):
    """Draw text with optional semi-transparent background bar."""
    if font is None:
        font = BODY_FONT
    if line_height is None:
        line_height = size * 1.5
    if max_width is None:
        max_width = w * 0.85
    
    total_height = len(text_lines) * line_height + size * 0.5
    
    if bg_color:
        c.saveState()
        c.setFillColor(bg_color)
        c.setFillAlpha(bg_alpha)
        bar_y = y_center - total_height/2 - size * 0.3
        c.roundRect(
            (w - max_width - 40) / 2, bar_y,
            max_width + 40, total_height + size * 0.6,
            radius=12, fill=True, stroke=False
        )
        c.restoreState()
    
    c.setFillColor(color)
    c.setFont(font, size)
    
    y = y_center + (len(text_lines) - 1) * line_height / 2
    for line in text_lines:
        if align == "center":
            c.drawCentredString(w/2, y, line)
        y -= line_height


PAGES = [
    # COVER — title integrated with illustration
    {
        "image": "page00-cover.jpg",
        "layout": "cover",
        "title": "The child's Dream About\nBruno's Birthday",
        "subtitle": "A Buzz Lightyear Adventure",
    },
    # Page 1 — text at bottom with dark overlay
    {
        "image": "page01-missing-bruno.jpg",
        "layout": "text_bottom",
        "text": [
            "The child looked at a picture of his cousin Mateo.",
            "",
            "Mateo lived far away in Florida.",
            "He was turning two tomorrow!",
            "",
            '"I wish I could be there," the child whispered.',
        ],
    },
    # Page 2
    {
        "image": "page02-falling-asleep.jpg",
        "layout": "text_bottom",
        "text": [
            "The child snuggled into bed and closed his eyes.",
            "",
            '"Happy birthday, Mateo," he said softly.',
            "",
            "And then... the stars began to sparkle.",
        ],
    },
    # Page 3
    {
        "image": "page03-dream-begins.jpg",
        "layout": "text_bottom",
        "text": [
            "The child floated up, up, up",
            "through a sky full of stars!",
            "",
            "He was flying — just like a real space ranger!",
        ],
    },
    # Page 4
    {
        "image": "page04-arrive-party.jpg",
        "layout": "text_bottom",
        "text": [
            "The child landed in a sunny backyard in Florida.",
            "",
            "Buzz Lightyear balloons were everywhere!",
            "",
            "A big banner said: HAPPY BIRTHDAY BRUNO!",
        ],
    },
    # Page 5 — emotional moment, text overlay centered
    {
        "image": "page05-bruno-hug.jpg",
        "layout": "text_center_bottom",
        "text": [
            '"The child! You came!"',
            "Mateo ran over for a big hug.",
            "",
            '"To infinity and beyond!"',
            "they both shouted.",
        ],
    },
    # Page 6
    {
        "image": "page06-space-rangers.jpg",
        "layout": "text_bottom",
        "text": [
            "The cousins put on cardboard jetpacks",
            "and pretended to fly.",
            "",
            '"Space Rangers, reporting for duty!"',
            "",
            "They zoomed around the whole backyard.",
        ],
    },
    # Page 7
    {
        "image": "page07-cake.jpg",
        "layout": "text_bottom",
        "text": [
            "Then it was time for cake!",
            "",
            "Mateo's cake had Buzz Lightyear on top",
            "and a big number 2.",
            "",
            "Everyone sang Happy Birthday.",
            "Mateo blew out the candle!",
        ],
    },
    # Page 8
    {
        "image": "page08-playing.jpg",
        "layout": "text_bottom",
        "text": [
            "The child and Mateo ran and laughed",
            "and played all afternoon.",
            "",
            "They chased bubbles. They ate ice cream.",
            "It was the best party ever.",
        ],
    },
    # Page 9 — emotional farewell
    {
        "image": "page09-goodbye-dream.jpg",
        "layout": "text_center_bottom",
        "text": [
            '"I have to go now," the child said.',
            "",
            '"Will you come back?" asked Mateo.',
            "",
            '"I\'ll always come back in my dreams."',
            "",
            "They hugged one more time.",
        ],
    },
    # Page 10 — closing
    {
        "image": "page10-wake-up.jpg",
        "layout": "text_bottom_final",
        "text": [
            "The child opened his eyes. Sunlight filled his room.",
            "",
            "He was back in his bed in Washington, DC.",
            "",
            "But he was smiling.",
            "The best dreams are the ones",
            "about the people you love.",
        ],
    },
]

c = pdfcanvas.Canvas(PDF_PATH, pagesize=(W, H))

for i, page in enumerate(PAGES):
    img_path = os.path.join(OUTDIR, page["image"])
    layout = page["layout"]
    
    # Full-bleed image on every page
    draw_full_bleed_image(c, img_path, W, H)
    
    if layout == "cover":
        # Dark gradient overlay at top for title
        c.saveState()
        # Semi-transparent dark overlay across top half
        c.setFillColor(HexColor("#0D1B2A"))
        c.setFillAlpha(0.65)
        c.rect(0, H * 0.45, W, H * 0.55, fill=True, stroke=False)
        c.restoreState()
        
        # Title
        c.setFillColor(white)
        c.setFont(TITLE_FONT, 52)
        title_lines = page["title"].split("\n")
        y = H * 0.78
        for line in title_lines:
            c.drawCentredString(W/2, y, line)
            y -= 64
        
        # Subtitle
        c.setFillColor(HexColor("#7FD4FF"))
        c.setFont(BODY_ITALIC, 22)
        c.drawCentredString(W/2, y - 15, page["subtitle"])
    
    elif layout == "text_bottom":
        # Semi-transparent dark bar at the bottom
        text_lines = [l for l in page["text"]]
        non_empty = [l for l in text_lines if l.strip()]
        
        bar_height = max(len(non_empty) * 32 + 40, 120)
        
        c.saveState()
        c.setFillColor(HexColor("#1A1A2E"))
        c.setFillAlpha(0.7)
        c.roundRect(-5, -5, W+10, bar_height, radius=0, fill=True, stroke=False)
        c.restoreState()
        
        # Text
        c.setFillColor(white)
        font_size = 19
        c.setFont(BODY_FONT, font_size)
        line_h = 28
        
        y = bar_height - 30
        for line in text_lines:
            if line.strip() == "":
                y -= line_h * 0.4
            else:
                # Use italic for dialogue
                if line.startswith('"') or line.startswith("'") or line.startswith('\u201c'):
                    c.setFont(BODY_ITALIC, font_size)
                else:
                    c.setFont(BODY_FONT, font_size)
                c.drawCentredString(W/2, y, line)
                y -= line_h
        
        # Page number
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFillAlpha(0.4)
        c.setFont(BODY_FONT, 11)
        c.drawCentredString(W - 30, 10, str(i))
    
    elif layout == "text_center_bottom":
        # Larger centered text overlay for emotional moments
        text_lines = [l for l in page["text"]]
        non_empty = [l for l in text_lines if l.strip()]
        
        bar_height = max(len(non_empty) * 34 + 50, 140)
        
        c.saveState()
        c.setFillColor(HexColor("#1A1A2E"))
        c.setFillAlpha(0.65)
        c.roundRect(-5, -5, W+10, bar_height, radius=0, fill=True, stroke=False)
        c.restoreState()
        
        font_size = 21
        line_h = 30
        c.setFillColor(white)
        
        y = bar_height - 35
        for line in text_lines:
            if line.strip() == "":
                y -= line_h * 0.4
            else:
                if line.startswith('"') or line.startswith("'") or line.startswith('\u201c'):
                    c.setFont(BODY_ITALIC, font_size)
                else:
                    c.setFont(BODY_FONT, font_size)
                c.drawCentredString(W/2, y, line)
                y -= line_h
        
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFillAlpha(0.4)
        c.setFont(BODY_FONT, 11)
        c.drawCentredString(W - 30, 10, str(i))
    
    elif layout == "text_bottom_final":
        # Final page — text with "The End" 
        text_lines = page["text"]
        non_empty = [l for l in text_lines if l.strip()]
        
        bar_height = max(len(non_empty) * 32 + 60, 150)
        
        c.saveState()
        c.setFillColor(HexColor("#1A1A2E"))
        c.setFillAlpha(0.7)
        c.roundRect(-5, -5, W+10, bar_height, radius=0, fill=True, stroke=False)
        c.restoreState()
        
        font_size = 19
        line_h = 28
        c.setFillColor(white)
        
        y = bar_height - 30
        for line in text_lines:
            if line.strip() == "":
                y -= line_h * 0.4
            else:
                c.setFont(BODY_FONT, font_size)
                c.drawCentredString(W/2, y, line)
                y -= line_h
        
        # "The End" with rocket emoji
        y -= line_h * 0.3
        c.setFont(BODY_BOLD, 16)
        c.setFillColor(HexColor("#7FD4FF"))
        c.drawCentredString(W/2, y, "The End")
    
    c.showPage()

c.save()
size = os.path.getsize(PDF_PATH)
print(f"PDF saved: {PDF_PATH}")
print(f"Size: {size:,} bytes ({size/1024/1024:.1f} MB)")
