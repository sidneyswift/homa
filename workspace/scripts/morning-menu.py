#!/usr/bin/env python3
"""
Morning Menu PDF Generator - Watercolor Botanical Style
Generates a reusable morning menu for pre-K with dry-erase marker use.
"""

import os
import sys
import json
import time
import requests
from io import BytesIO
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

# --- Config ---
CHILD_NAME = "Emma"
OUTPUT_DIR = os.path.expanduser("~/.openclaw/workspace/content/fun/rewards/morning-menu")
OUTPUT_PDF = os.path.join(OUTPUT_DIR, "emmas-morning-menu.pdf")
FONT_DIR = os.path.expanduser("~/.openclaw/workspace/fonts")
FAL_KEY = os.environ.get("FAL_API_KEY", "")

# Colors - watercolor botanical palette
CREAM = HexColor("#FDF6EC")
SAGE = HexColor("#8FAE7E")
SAGE_LIGHT = HexColor("#D4E4CB")
TAN = HexColor("#C4A97D")
BROWN = HexColor("#6B4F36")
BROWN_LIGHT = HexColor("#8B6F47")
WARM_GRAY = HexColor("#9E9589")
DUSTY_ROSE = HexColor("#C9918A")
SOFT_GOLD = HexColor("#D4A843")

# Page dimensions
W, H = letter  # 612 x 792

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Register fonts ---
pdfmetrics.registerFont(TTFont("Caveat", os.path.join(FONT_DIR, "Caveat.ttf")))
pdfmetrics.registerFont(TTFont("PatrickHand", os.path.join(FONT_DIR, "PatrickHand-Regular.ttf")))

# --- Image generation via fal ---
def generate_image(prompt, filename, w=1024, h=1024):
    """Generate image with Nano Banana 2 via fal API."""
    path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(path):
        print(f"  [cached] {filename}")
        return path
    
    if not FAL_KEY:
        print(f"  [skip] No FAL_API_KEY for {filename}")
        return None
    
    print(f"  [generating] {filename}...")
    url = "https://fal.run/fal-ai/nano-banana"
    headers = {"Authorization": f"Key {FAL_KEY}", "Content-Type": "application/json"}
    payload = {
        "prompt": prompt,
        "negative_prompt": "text, words, letters, captions, watermark, signature, ugly, blurry, low quality",
        "image_size": {"width": w, "height": h},
        "num_images": 1,
        "seed": 42,
    }
    
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=300)
        resp.raise_for_status()
        data = resp.json()
        img_url = data["images"][0]["url"]
        img_data = requests.get(img_url, timeout=60).content
        with open(path, "wb") as f:
            f.write(img_data)
        print(f"  [done] {filename}")
        return path
    except Exception as e:
        print(f"  [error] {filename}: {e}")
        return None

def load_image(path):
    """Load image as ReportLab ImageReader."""
    if path and os.path.exists(path):
        return ImageReader(path)
    return None

# --- Drawing helpers ---
def draw_page_bg(c):
    """Draw cream background."""
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def draw_botanical_border(c):
    """Draw a simple botanical-style border."""
    # Outer border
    c.setStrokeColor(SAGE)
    c.setLineWidth(3)
    c.roundRect(30, 30, W-60, H-60, 15)
    
    # Inner border
    c.setStrokeColor(TAN)
    c.setLineWidth(1)
    c.roundRect(40, 40, W-80, H-80, 10)

def draw_leaf(c, x, y, size=20, angle=0):
    """Draw a simple watercolor-style leaf."""
    c.saveState()
    c.translate(x, y)
    c.rotate(angle)
    c.setFillColor(SAGE)
    c.setStrokeColor(Color(0.55, 0.68, 0.49, 0.8))
    c.setLineWidth(0.5)
    # Leaf shape using bezier
    p = c.beginPath()
    p.moveTo(0, 0)
    p.curveTo(size*0.3, size*0.6, size*0.7, size*0.8, size, 0)
    p.curveTo(size*0.7, -size*0.2, size*0.3, -size*0.1, 0, 0)
    c.drawPath(p, fill=1, stroke=1)
    # Leaf vein
    c.setStrokeColor(Color(0.45, 0.58, 0.39, 0.6))
    c.setLineWidth(0.5)
    c.line(0, 0, size*0.9, 0)
    c.restoreState()

def draw_small_flower(c, x, y, size=8):
    """Draw a small botanical flower."""
    c.saveState()
    c.setFillColor(DUSTY_ROSE)
    for angle in range(0, 360, 72):
        c.saveState()
        c.translate(x, y)
        c.rotate(angle)
        c.ellipse(-size*0.3, size*0.2, size*0.3, size*0.8, fill=1, stroke=0)
        c.restoreState()
    # Center
    c.setFillColor(SOFT_GOLD)
    c.circle(x, y, size*0.25, fill=1, stroke=0)
    c.restoreState()

def draw_corner_botanicals(c):
    """Draw botanical decorations in corners."""
    # Top-left
    draw_leaf(c, 50, H-55, 18, 30)
    draw_leaf(c, 55, H-50, 14, -20)
    draw_small_flower(c, 70, H-48, 6)
    
    # Top-right
    draw_leaf(c, W-65, H-55, 18, 150)
    draw_leaf(c, W-70, H-50, 14, -160)
    draw_small_flower(c, W-85, H-48, 6)
    
    # Bottom-left
    draw_leaf(c, 50, 55, 18, -30)
    draw_leaf(c, 55, 50, 14, 20)
    draw_small_flower(c, 70, 52, 6)
    
    # Bottom-right
    draw_leaf(c, W-65, 55, 18, -150)
    draw_leaf(c, W-70, 50, 14, 160)
    draw_small_flower(c, W-85, 52, 6)

def draw_dashed_line(c, x1, y1, x2, y2, dash=[4,3]):
    """Draw a dashed line for writing practice."""
    c.setDash(dash)
    c.setStrokeColor(WARM_GRAY)
    c.setLineWidth(0.75)
    c.line(x1, y1, x2, y2)
    c.setDash([])

def draw_solid_line(c, x1, y1, x2, y2):
    """Draw a solid baseline for writing."""
    c.setStrokeColor(BROWN_LIGHT)
    c.setLineWidth(1)
    c.line(x1, y1, x2, y2)

def draw_writing_lines(c, x, y, width, count=4, spacing=50):
    """Draw sets of writing lines (baseline + midline + topline)."""
    for i in range(count):
        base_y = y - i * spacing
        mid_y = base_y + 18
        top_y = base_y + 36
        draw_solid_line(c, x, base_y, x + width, base_y)
        draw_dashed_line(c, x, mid_y, x + width, mid_y)
        c.setStrokeColor(Color(0.62, 0.59, 0.54, 0.4))
        c.setLineWidth(0.5)
        c.line(x, top_y, x + width, top_y)

def draw_dotted_text(c, text, x, y, font_name, font_size, color=WARM_GRAY):
    """Draw dotted/traced text for practice."""
    c.setFont(font_name, font_size)
    c.setFillColor(color)
    # Draw with transparency effect by using a lighter color
    light = Color(color.red, color.green, color.blue, 0.35)
    c.setFillColor(light)
    c.drawString(x, y, text)

def draw_circle_option(c, x, y, text, radius=22, font_size=11):
    """Draw a circled option (for weather, emotions, etc.)."""
    c.setStrokeColor(TAN)
    c.setLineWidth(1)
    c.circle(x, y, radius, fill=0, stroke=1)
    c.setFillColor(BROWN)
    c.setFont("PatrickHand", font_size)
    tw = c.stringWidth(text, "PatrickHand", font_size)
    c.drawString(x - tw/2, y - font_size*0.35, text)

def draw_checkbox(c, x, y, size=14):
    """Draw a small checkbox."""
    c.setStrokeColor(TAN)
    c.setLineWidth(1)
    c.roundRect(x, y, size, size, 2, fill=0, stroke=1)

# =============================================
# PAGE BUILDERS
# =============================================

def page_cover(c, cover_img):
    """Page 1: Cover page."""
    draw_page_bg(c)
    
    # Place generated cover image if available
    if cover_img:
        img = load_image(cover_img)
        if img:
            # Center the wreath image
            c.drawImage(img, W/2 - 180, H/2 - 120, 360, 360, 
                       preserveAspectRatio=True, mask='auto')
    else:
        # Fallback: draw botanical wreath manually
        draw_botanical_border(c)
        # Draw decorative wreath shape
        cx, cy = W/2, H/2 + 40
        for i in range(24):
            angle = i * 15
            import math
            r = 140
            lx = cx + r * math.cos(math.radians(angle))
            ly = cy + r * math.sin(math.radians(angle))
            draw_leaf(c, lx, ly, 15 + (i%3)*5, angle + 90)
            if i % 3 == 0:
                draw_small_flower(c, lx + 10, ly + 10, 7)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 52)
    title = f"{CHILD_NAME}'s"
    tw = c.stringWidth(title, "Caveat", 52)
    c.drawString(W/2 - tw/2, H/2 + 60, title)
    
    c.setFont("Caveat", 62)
    title2 = "Morning Menu"
    tw2 = c.stringWidth(title2, "Caveat", 62)
    c.drawString(W/2 - tw2/2, H/2 - 5, title2)
    
    # Decorative line under title
    c.setStrokeColor(SAGE)
    c.setLineWidth(2)
    c.line(W/2 - 100, H/2 - 20, W/2 + 100, H/2 - 20)
    
    # Subtitle
    c.setFont("PatrickHand", 18)
    c.setFillColor(SAGE)
    sub = "🌿 a gentle start to the day 🌿"
    tw3 = c.stringWidth(sub, "PatrickHand", 18)
    c.drawString(W/2 - tw3/2, H/2 - 55, sub)
    
    # Bottom decorations
    for i in range(8):
        x = 100 + i * 60
        draw_leaf(c, x, 80, 12, 30 + i*20)
        if i % 2 == 0:
            draw_small_flower(c, x + 15, 90, 5)

def page_calendar(c, weather_img):
    """Page 2: Calendar, Weather & Seasons."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "Today Is..."
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    # Decorative line
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 80, H - 90, W/2 + 80, H - 90)
    
    y = H - 130
    
    # --- Month section ---
    c.setFont("PatrickHand", 16)
    c.setFillColor(SAGE)
    c.drawString(60, y, "The month is:")
    
    months = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
    
    y -= 10
    col = 0
    row = 0
    for i, m in enumerate(months):
        mx = 70 + col * 140
        my = y - row * 30
        draw_circle_option(c, mx + 45, my - 8, m, radius=28 if len(m) > 7 else 24, font_size=10)
        col += 1
        if col >= 4:
            col = 0
            row += 1
    
    y -= 105
    
    # --- Day of Week section ---
    c.setFont("PatrickHand", 16)
    c.setFillColor(SAGE)
    c.drawString(60, y, "The day is:")
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    y -= 30
    for i, d in enumerate(days):
        dx = 65 + i * 73
        r = 30 if len(d) > 8 else 26
        draw_circle_option(c, dx + 20, y, d, radius=r, font_size=9)
    
    y -= 55
    
    # --- Date writing ---
    c.setFont("PatrickHand", 16)
    c.setFillColor(SAGE)
    c.drawString(60, y, "Today's date is:")
    
    y -= 5
    draw_solid_line(c, 210, y, 450, y)
    draw_dashed_line(c, 210, y + 18, 450, y + 18)
    
    y -= 50
    
    # --- Weather section ---
    c.setFont("PatrickHand", 16)
    c.setFillColor(SAGE)
    c.drawString(60, y, "The weather today is:")
    
    weather_items = [("☀️", "Sunny"), ("⛅", "Cloudy"), ("🌧️", "Rainy"), 
                     ("❄️", "Snowy"), ("🌤️", "Partly\nCloudy"), ("💨", "Windy")]
    y -= 45
    for i, (emoji, label) in enumerate(weather_items):
        wx = 75 + i * 85
        c.setStrokeColor(TAN)
        c.setLineWidth(1)
        c.roundRect(wx - 25, y - 15, 60, 50, 8, fill=0, stroke=1)
        c.setFont("PatrickHand", 20)
        c.setFillColor(BROWN)
        etw = c.stringWidth(emoji, "PatrickHand", 20)
        c.drawString(wx + 5 - etw/2, y + 15, emoji)
        c.setFont("PatrickHand", 9)
        c.setFillColor(BROWN_LIGHT)
        ltw = c.stringWidth(label.split('\n')[0], "PatrickHand", 9)
        c.drawString(wx + 5 - ltw/2, y - 8, label.split('\n')[0])
        if '\n' in label:
            l2 = label.split('\n')[1]
            ltw2 = c.stringWidth(l2, "PatrickHand", 9)
            c.drawString(wx + 5 - ltw2/2, y - 19, l2)
    
    y -= 65
    
    # --- Season section ---
    c.setFont("PatrickHand", 16)
    c.setFillColor(SAGE)
    c.drawString(60, y, "The season is:")
    
    seasons = [("🌸", "Spring"), ("☀️", "Summer"), ("🍂", "Fall"), ("❄️", "Winter")]
    y -= 35
    for i, (emoji, label) in enumerate(seasons):
        sx = 90 + i * 120
        draw_circle_option(c, sx, y, f"{emoji} {label}", radius=35, font_size=12)

def page_feelings(c, feelings_img):
    """Page 3: Today I Feel..."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "Today I Feel..."
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 80, H - 90, W/2 + 80, H - 90)
    
    # Emotion grid - 3 columns x 3 rows with drawn face expressions
    emotions = [
        ("Happy", "smile"),
        ("Sad", "frown"),
        ("Angry", "angry"),
        ("Excited", "excited"),
        ("Tired", "tired"),
        ("Silly", "silly"),
        ("Worried", "worried"),
        ("Loved", "loved"),
        ("Calm", "calm"),
    ]
    
    start_y = H - 150
    cols = 3
    col_w = (W - 120) / cols
    row_h = 140
    
    def draw_face(c, cx, cy, expression, r=22):
        """Draw a simple face with expression for pre-readers."""
        import math as _m
        # Face circle
        c.setStrokeColor(BROWN_LIGHT)
        c.setFillColor(Color(1, 0.95, 0.85, 0.6))
        c.setLineWidth(1.5)
        c.circle(cx, cy, r, fill=1, stroke=1)
        # Eyes
        c.setFillColor(BROWN)
        eye_y = cy + r*0.2
        if expression == "tired":
            c.setStrokeColor(BROWN)
            c.setLineWidth(1.5)
            c.line(cx - r*0.35, eye_y, cx - r*0.1, eye_y)
            c.line(cx + r*0.1, eye_y, cx + r*0.35, eye_y)
        elif expression == "silly":
            c.circle(cx - r*0.25, eye_y, 2.5, fill=1, stroke=0)
            c.setStrokeColor(BROWN)
            c.setLineWidth(1.5)
            c.line(cx + r*0.15, eye_y, cx + r*0.35, eye_y + 2)
        elif expression == "loved":
            for hx in [cx - r*0.25, cx + r*0.25]:
                c.setFillColor(DUSTY_ROSE)
                c.circle(hx - 2, eye_y + 2, 2, fill=1, stroke=0)
                c.circle(hx + 2, eye_y + 2, 2, fill=1, stroke=0)
                p = c.beginPath()
                p.moveTo(hx - 4, eye_y + 1)
                p.lineTo(hx, eye_y - 4)
                p.lineTo(hx + 4, eye_y + 1)
                c.drawPath(p, fill=1, stroke=0)
            c.setFillColor(BROWN)
        else:
            c.circle(cx - r*0.25, eye_y, 2.5, fill=1, stroke=0)
            c.circle(cx + r*0.25, eye_y, 2.5, fill=1, stroke=0)
        # Eyebrows for angry/worried
        if expression == "angry":
            c.setStrokeColor(BROWN)
            c.setLineWidth(1.5)
            c.line(cx - r*0.4, eye_y + r*0.35, cx - r*0.1, eye_y + r*0.2)
            c.line(cx + r*0.1, eye_y + r*0.2, cx + r*0.4, eye_y + r*0.35)
        elif expression == "worried":
            c.setStrokeColor(BROWN)
            c.setLineWidth(1.5)
            c.line(cx - r*0.4, eye_y + r*0.3, cx - r*0.1, eye_y + r*0.15)
            c.line(cx + r*0.1, eye_y + r*0.15, cx + r*0.4, eye_y + r*0.3)
        # Mouth
        mouth_y = cy - r*0.3
        c.setStrokeColor(BROWN)
        c.setLineWidth(1.5)
        if expression in ("smile", "loved"):
            p = c.beginPath()
            p.arc(cx - r*0.3, mouth_y - r*0.15, cx + r*0.3, mouth_y + r*0.15, 180, 180)
            c.drawPath(p, fill=0, stroke=1)
        elif expression == "frown":
            p = c.beginPath()
            p.arc(cx - r*0.3, mouth_y - r*0.3, cx + r*0.3, mouth_y, 0, 180)
            c.drawPath(p, fill=0, stroke=1)
        elif expression == "angry":
            p = c.beginPath()
            p.arc(cx - r*0.25, mouth_y - r*0.25, cx + r*0.25, mouth_y, 0, 180)
            c.drawPath(p, fill=0, stroke=1)
        elif expression == "excited":
            c.setFillColor(Color(1, 0.95, 0.85, 0.6))
            c.ellipse(cx - r*0.2, mouth_y - r*0.2, cx + r*0.2, mouth_y + r*0.1, fill=1, stroke=1)
            c.setFillColor(BROWN)
        elif expression == "tired":
            c.ellipse(cx - r*0.12, mouth_y - r*0.1, cx + r*0.12, mouth_y + r*0.05, fill=0, stroke=1)
        elif expression == "silly":
            p = c.beginPath()
            p.arc(cx - r*0.3, mouth_y - r*0.15, cx + r*0.3, mouth_y + r*0.15, 180, 180)
            c.drawPath(p, fill=0, stroke=1)
            c.setFillColor(DUSTY_ROSE)
            c.ellipse(cx - r*0.1, mouth_y - r*0.25, cx + r*0.1, mouth_y - r*0.05, fill=1, stroke=0)
            c.setFillColor(BROWN)
        elif expression == "worried":
            c.line(cx - r*0.2, mouth_y, cx + r*0.2, mouth_y - r*0.05)
        elif expression == "calm":
            c.line(cx - r*0.2, mouth_y, cx + r*0.2, mouth_y)
    
    for i, (label, expression) in enumerate(emotions):
        col = i % cols
        row = i // cols
        cx = 60 + col * col_w + col_w/2
        cy = start_y - row * row_h
        
        # Draw rounded box
        box_w = col_w - 20
        box_h = 110
        c.setStrokeColor(TAN)
        c.setFillColor(Color(1, 1, 1, 0.4))
        c.setLineWidth(1.5)
        c.roundRect(cx - box_w/2, cy - box_h + 30, box_w, box_h, 12, fill=1, stroke=1)
        
        # Draw face illustration
        draw_face(c, cx, cy - 5, expression, r=24)
        
        # Label
        c.setFont("PatrickHand", 16)
        c.setFillColor(BROWN)
        ltw = c.stringWidth(label, "PatrickHand", 16)
        c.drawString(cx - ltw/2, cy - 58, label)
    
    # Bottom: "I feel ___ because ___"
    y = start_y - 3 * row_h - 20
    c.setFont("PatrickHand", 16)
    c.setFillColor(BROWN)
    c.drawString(60, y, "I feel")
    draw_solid_line(c, 115, y - 2, 250, y - 2)
    c.drawString(260, y, "because")
    draw_solid_line(c, 340, y - 2, W - 60, y - 2)

def page_name_practice(c):
    """Page 4: Name Writing Practice."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "My Name Is..."
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 80, H - 90, W/2 + 80, H - 90)
    
    # Large traced name at top — MANUSCRIPT font, not cursive
    y = H - 150
    c.setFont("PatrickHand", 14)
    c.setFillColor(SAGE)
    c.drawString(60, y, "Trace my name:")
    
    y -= 60
    # Big dotted name to trace — PatrickHand (print/manuscript)
    draw_dotted_text(c, CHILD_NAME, 100, y, "PatrickHand", 72, BROWN_LIGHT)
    # Starting dot on first letter
    c.setFillColor(SAGE)
    c.circle(100, y + 50, 4, fill=1, stroke=0)
    
    # Primary-ruled writing lines (wider spacing for pre-K hands)
    y -= 60
    c.setFont("PatrickHand", 14)
    c.setFillColor(SAGE)
    c.drawString(60, y, "Now write it on your own:")
    
    y -= 55
    draw_writing_lines(c, 60, y, W - 120, count=6, spacing=68)
    
    # Light dotted guide on first line
    draw_dotted_text(c, CHILD_NAME, 70, y + 5, "PatrickHand", 36, Color(0.62, 0.59, 0.54, 0.2))

def page_letters(c):
    """Page 5: Alphabet Reference & Tracing."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "My ABCs"
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 60, H - 90, W/2 + 60, H - 90)
    
    # Alphabet reference grid
    y = H - 120
    c.setFont("PatrickHand", 12)
    c.setFillColor(SAGE)
    c.drawString(60, y, "Trace each letter:")
    
    y -= 15
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    cols = 7
    cell_w = (W - 120) / cols
    cell_h = 55
    
    for i, letter_char in enumerate(letters):
        col = i % cols
        row = i // cols
        cx = 60 + col * cell_w
        cy = y - row * cell_h
        
        # Cell box
        c.setStrokeColor(Color(0.76, 0.68, 0.49, 0.4))
        c.setLineWidth(0.5)
        c.roundRect(cx, cy - cell_h + 15, cell_w - 4, cell_h - 4, 4, fill=0, stroke=1)
        
        # Uppercase dotted
        draw_dotted_text(c, letter_char, cx + 5, cy - 12, "PatrickHand", 22, BROWN_LIGHT)
        
        # Lowercase dotted
        draw_dotted_text(c, letter_char.lower(), cx + cell_w/2 + 2, cy - 12, "PatrickHand", 22, BROWN_LIGHT)
        
        # Baseline
        c.setStrokeColor(Color(0.62, 0.59, 0.54, 0.3))
        c.setLineWidth(0.5)
        c.line(cx + 3, cy - 28, cx + cell_w - 7, cy - 28)
    
    # Tracing lines at bottom
    y_bottom = y - 4 * cell_h - 25
    c.setFont("PatrickHand", 12)
    c.setFillColor(SAGE)
    c.drawString(60, y_bottom, "Practice writing letters:")
    
    y_bottom -= 30
    draw_writing_lines(c, 60, y_bottom, W - 120, count=3, spacing=48)

def page_numbers(c):
    """Page 6: Numbers 1-20 & Counting."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "My 123s"
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 60, H - 90, W/2 + 60, H - 90)
    
    # Number grid 1-20
    y = H - 120
    c.setFont("PatrickHand", 12)
    c.setFillColor(SAGE)
    c.drawString(60, y, "Trace each number:")
    
    y -= 15
    cols = 5
    cell_w = (W - 120) / cols
    cell_h = 65
    
    for i in range(20):
        num = str(i + 1)
        col = i % cols
        row = i // cols
        cx = 60 + col * cell_w
        cy = y - row * cell_h
        
        # Cell box
        c.setStrokeColor(Color(0.76, 0.68, 0.49, 0.4))
        c.setLineWidth(0.5)
        c.roundRect(cx, cy - cell_h + 15, cell_w - 4, cell_h - 4, 4, fill=0, stroke=1)
        
        # Number dotted
        draw_dotted_text(c, num, cx + cell_w/2 - 10, cy - 20, "PatrickHand", 30, BROWN_LIGHT)
        
        # Small dots to count
        dot_count = i + 1
        dot_y = cy - cell_h + 22
        max_dots_per_row = 5
        dot_rows = (dot_count + max_dots_per_row - 1) // max_dots_per_row
        for d in range(min(dot_count, 10)):  # cap visual dots at 10
            dr = d // max_dots_per_row
            dc = d % max_dots_per_row
            dx = cx + 8 + dc * 9
            dy = dot_y + dr * 8
            c.setFillColor(Color(0.76, 0.68, 0.49, 0.5))
            c.circle(dx + 3, dy, 2.5, fill=1, stroke=0)
    
    # Tracing lines at bottom
    y_bottom = y - 4 * cell_h - 15
    c.setFont("PatrickHand", 12)
    c.setFillColor(SAGE)
    c.drawString(60, y_bottom, "Practice writing numbers:")
    
    y_bottom -= 30
    draw_writing_lines(c, 60, y_bottom, W - 120, count=3, spacing=48)

def page_prewriting(c):
    """Page 7: Pre-writing Shapes & Lines."""
    draw_page_bg(c)
    draw_botanical_border(c)
    draw_corner_botanicals(c)
    
    # Title
    c.setFillColor(BROWN)
    c.setFont("Caveat", 38)
    title = "Lines & Shapes"
    tw = c.stringWidth(title, "Caveat", 38)
    c.drawString(W/2 - tw/2, H - 80, title)
    
    c.setStrokeColor(SAGE)
    c.setLineWidth(1.5)
    c.line(W/2 - 80, H - 90, W/2 + 80, H - 90)
    
    # Pre-writing patterns
    patterns = [
        ("Straight lines", "horizontal"),
        ("Vertical lines", "vertical"),
        ("Zigzag", "zigzag"),
        ("Waves", "waves"),
        ("Circles", "circles"),
        ("Curves", "curves"),
    ]
    
    y = H - 130
    row_h = 95
    
    for i, (label, pattern) in enumerate(patterns):
        py = y - i * row_h
        
        # Label
        c.setFont("PatrickHand", 14)
        c.setFillColor(SAGE)
        c.drawString(60, py, label)
        
        # Pattern area box
        box_y = py - 55
        c.setStrokeColor(Color(0.76, 0.68, 0.49, 0.3))
        c.setLineWidth(0.5)
        c.roundRect(60, box_y, W - 120, 50, 6, fill=0, stroke=1)
        
        # Draw guide pattern (dotted)
        c.setStrokeColor(Color(0.62, 0.59, 0.54, 0.3))
        c.setLineWidth(1.5)
        c.setDash([3, 3])
        
        start_x = 75
        end_x = W - 75
        mid_y = box_y + 25
        
        if pattern == "horizontal":
            c.line(start_x, mid_y, end_x, mid_y)
        elif pattern == "vertical":
            for vx in range(int(start_x), int(end_x), 40):
                c.line(vx, box_y + 5, vx, box_y + 45)
        elif pattern == "zigzag":
            p = c.beginPath()
            p.moveTo(start_x, mid_y + 15)
            for zx in range(int(start_x), int(end_x), 30):
                if ((zx - int(start_x)) // 30) % 2 == 0:
                    p.lineTo(zx + 15, mid_y - 15)
                else:
                    p.lineTo(zx + 15, mid_y + 15)
            c.drawPath(p, fill=0, stroke=1)
        elif pattern == "waves":
            import math
            p = c.beginPath()
            p.moveTo(start_x, mid_y)
            for wx in range(int(start_x), int(end_x), 2):
                wy = mid_y + 15 * math.sin((wx - start_x) * 0.06)
                p.lineTo(wx, wy)
            c.drawPath(p, fill=0, stroke=1)
        elif pattern == "circles":
            for cx_pos in range(int(start_x) + 20, int(end_x) - 20, 50):
                c.circle(cx_pos, mid_y, 15, fill=0, stroke=1)
        elif pattern == "curves":
            for cx_pos in range(int(start_x), int(end_x) - 40, 50):
                p = c.beginPath()
                p.moveTo(cx_pos, mid_y - 15)
                p.curveTo(cx_pos + 25, mid_y + 25, cx_pos + 25, mid_y + 25, cx_pos + 50, mid_y - 15)
                c.drawPath(p, fill=0, stroke=1)
        
        c.setDash([])

# =============================================
# MAIN
# =============================================

def main():
    print("🌿 Generating Morning Menu for", CHILD_NAME)
    print()
    
    # Generate images
    print("Generating illustrations...")
    cover_img = generate_image(
        "watercolor botanical wreath frame with sage green leaves, small pink flowers, "
        "cream background, delicate eucalyptus branches arranged in a circle, "
        "soft earthy tones, hand-painted style, empty center space, "
        "do not include any text words letters or captions",
        "cover-wreath.png", w=1024, h=1024
    )
    
    feelings_img = generate_image(
        "watercolor illustration set of nine simple children emotion faces on cream background, "
        "happy sad angry excited tired silly worried loved calm, "
        "soft earthy botanical style, gentle muted colors, "
        "do not include any text words letters or captions",
        "feelings-faces.png", w=1024, h=1024
    )
    
    weather_img = generate_image(
        "watercolor weather icons on cream background, sun cloud rain snow wind, "
        "soft botanical earthy style, muted sage green and tan tones, "
        "simple clean illustrations, gentle hand-painted look, "
        "do not include any text words letters or captions",
        "weather-icons.png", w=1024, h=512
    )
    
    print()
    print("Building PDF...")
    
    c = canvas.Canvas(OUTPUT_PDF, pagesize=letter)
    c.setTitle(f"{CHILD_NAME}'s Morning Menu")
    c.setAuthor("Homa")
    
    # Page 1: Cover
    page_cover(c, cover_img)
    c.showPage()
    
    # Page 2: Calendar & Weather
    page_calendar(c, weather_img)
    c.showPage()
    
    # Page 3: Feelings
    page_feelings(c, feelings_img)
    c.showPage()
    
    # Page 4: Name Practice
    page_name_practice(c)
    c.showPage()
    
    # Page 5: Letters
    page_letters(c)
    c.showPage()
    
    # Page 6: Numbers
    page_numbers(c)
    c.showPage()
    
    # Page 7: Pre-writing
    page_prewriting(c)
    c.showPage()
    
    c.save()
    print(f"\n✅ Done! {OUTPUT_PDF}")
    print(f"   7 pages, ready for restaurant menu covers + dry-erase markers")

if __name__ == "__main__":
    main()
