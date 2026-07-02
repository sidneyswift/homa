#!/usr/bin/env python3
"""
Morning Binder PDF — Co-op Pre-K
Recreates the LifeAbundantly Kindergarten Morning Binder style:
  Page 1: Full calendar page (days, date grid, months, years, weather) — all on one page
  Page 2: "All About Me!" (dotted-line name x3, age circles, emotions)

Each child gets a personalized copy with their name as dotted traceable text.
"""

import os
import sys
import math
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

# --- Config ---
CHILD_NAMES = sys.argv[1:] if len(sys.argv) > 1 else ["the child"]
OUTPUT_DIR = os.path.expanduser("~/.openclaw/workspace/content/curriculum/co-op/morning-binders")
ASSET_DIR = os.path.expanduser("~/.openclaw/workspace/content/fun/rewards/morning-menu")
FONT_DIR = os.path.expanduser("~/.openclaw/workspace/fonts")

YEARS = ["2026", "2027"]
AGES = [3, 4, 5, 6, 7, 8]

W, H = letter  # 612 x 792

# Colors
DARK = HexColor("#3C3C3C")
CIRCLE_PURPLE = HexColor("#7B68AE")
WAVY_PURPLE = HexColor("#9B8EC4")
LIGHT_GRAY = HexColor("#D0D0D0")
MED_GRAY = HexColor("#888888")
DOT_GRAY = HexColor("#999999")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Register fonts
pdfmetrics.registerFont(TTFont("PatrickHand", os.path.join(FONT_DIR, "PatrickHand-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Caveat", os.path.join(FONT_DIR, "Caveat.ttf")))
pdfmetrics.registerFont(TTFont("ABeeZee", os.path.join(FONT_DIR, "ABeeZee-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Quicksand", os.path.join(FONT_DIR, "Quicksand.ttf")))
pdfmetrics.registerFont(TTFont("EduDots", os.path.join(FONT_DIR, "EduDots.ttf")))

TRACE_FONT = "EduDots"

TITLE_FONT = "PatrickHand"
BODY_FONT = "PatrickHand"
LABEL_FONT = "ABeeZee"

# --- Asset helpers ---
def img(name):
    """Get image path — prefer _sm.jpg for smaller file, fall back to .png"""
    sm = os.path.join(ASSET_DIR, f"{name}_sm.jpg")
    if os.path.exists(sm):
        return sm
    full = os.path.join(ASSET_DIR, f"{name}.png")
    if os.path.exists(full):
        return full
    print(f"  [WARN] Missing asset: {name}")
    return None

def img_clip(name):
    """Get clipart image from morning-binders dir."""
    path = os.path.join(OUTPUT_DIR, f"{name}.jpg")
    if os.path.exists(path):
        return path
    path2 = os.path.join(OUTPUT_DIR, f"{name}.png")
    if os.path.exists(path2):
        return path2
    # Fall back to asset dir
    return img(name)

def draw_wavy_line(c, x_start, y, x_end, amplitude=2.5, wavelength=10, color=WAVY_PURPLE):
    """Draw a wavy/scalloped decorative line."""
    c.setStrokeColor(color)
    c.setLineWidth(1.2)
    p = c.beginPath()
    p.moveTo(x_start, y)
    x = x_start
    while x <= x_end:
        yy = y + amplitude * math.sin(2 * math.pi * (x - x_start) / wavelength)
        p.lineTo(x, yy)
        x += 1
    c.drawPath(p)

def draw_circle_marker(c, x, y, r=10, stroke_color=CIRCLE_PURPLE):
    """Draw an empty circle (for dry-erase marking)."""
    c.saveState()
    c.setStrokeColor(stroke_color)
    c.setFillColor(white)
    c.setLineWidth(1.5)
    c.circle(x, y, r, fill=0, stroke=1)
    c.restoreState()

def draw_dotted_name(c, name, x, y, font_name, font_size, color=DOT_GRAY):
    """Draw name as dashed-outline uppercase letters for tracing — professional tracing template style."""
    upper_name = name.upper()
    c.saveState()
    c.setStrokeColor(HexColor("#444444"))
    c.setLineWidth(1.5)  # Bold enough to see clearly
    c.setLineCap(1)  # Round caps for smooth dashes
    c.setDash(5, 4)  # Medium-long dashes with clear gaps
    text_obj = c.beginText(x, y)
    text_obj.setFont("ABeeZee", font_size)
    text_obj.setTextRenderMode(1)  # Stroke only (no fill)
    text_obj.textLine(upper_name)
    c.drawText(text_obj)
    c.setDash()

    # Add starting dots for each letter (small filled circles at top-left of each letter)
    c.setFillColor(HexColor("#444444"))
    cursor_x = x
    for ch in upper_name:
        char_w = pdfmetrics.stringWidth(ch, "ABeeZee", font_size)
        # Starting dot at top-left of each letter
        dot_x = cursor_x + 2
        dot_y = y + font_size * 0.65
        c.circle(dot_x, dot_y, 2.5, fill=1, stroke=0)
        cursor_x += char_w
    c.restoreState()

def draw_writing_guidelines(c, x_start, x_end, baseline_y, line_height, color=LIGHT_GRAY):
    """Draw handwriting guidelines: top line, dashed midline, baseline."""
    c.saveState()
    c.setStrokeColor(color)
    # Baseline (solid)
    c.setLineWidth(0.75)
    c.setDash()
    c.line(x_start, baseline_y, x_end, baseline_y)
    # Top line (solid)
    c.line(x_start, baseline_y + line_height, x_end, baseline_y + line_height)
    # Midline (dashed)
    c.setLineWidth(0.5)
    c.setDash(4, 4)
    mid_y = baseline_y + line_height / 2
    c.line(x_start, mid_y, x_end, mid_y)
    # Vertical center dashed line
    center_x = (x_start + x_end) / 2
    c.line(center_x, baseline_y, center_x, baseline_y + line_height)
    c.setDash()
    c.restoreState()


# ===========================================
# COVER PAGE: Botanical wreath with child's name
# ===========================================
COVER_WREATH = os.path.join(OUTPUT_DIR, "cover-wreath.jpg")

def draw_cover(c, child_name):
    # Full-page botanical wreath background
    if os.path.exists(COVER_WREATH):
        # Draw wreath centered, filling the page
        c.drawImage(ImageReader(COVER_WREATH), 0, 0, width=W, height=H,
                    preserveAspectRatio=True, anchor='c', mask='auto')

    # Child's name — big, centered in the wreath opening
    font_size = 64
    while c.stringWidth(child_name, TITLE_FONT, font_size) > W * 0.5 and font_size > 36:
        font_size -= 4
    c.setFont(TITLE_FONT, font_size)
    c.setFillColor(DARK)
    c.drawCentredString(W / 2, H / 2 + 15, child_name)

    # Subtitle below name
    c.setFont(BODY_FONT, 20)
    c.setFillColor(MED_GRAY)
    c.drawCentredString(W / 2, H / 2 - 25, "Morning Binder")

    c.showPage()


# ===========================================
# PAGE 1: Days of the Week + Months (spacious)
# ===========================================
def draw_page1(c):
    margin = 0.6 * inch
    content_w = W - 2 * margin

    # Title
    c.setFont(TITLE_FONT, 36)
    c.setFillColor(DARK)
    c.drawCentredString(W / 2, H - margin - 36, "I know what today is!")
    draw_wavy_line(c, margin + 20, H - margin - 48, W - margin - 20)

    # Days of week — two columns, spacious
    days_left = ["Sunday", "Monday", "Tuesday", "Wednesday"]
    days_right = ["Thursday", "Friday", "Saturday"]

    y_start = H - margin - 82
    line_h = 42
    c.setFont(BODY_FONT, 26)

    col1_x = margin + 20
    col2_x = W / 2 + 10

    for i, day in enumerate(days_left):
        y = y_start - i * line_h
        c.setFillColor(DARK)
        c.drawString(col1_x, y, day)
        draw_circle_marker(c, col1_x + c.stringWidth(day, BODY_FONT, 26) + 18, y + 8, r=12, stroke_color=CIRCLE_PURPLE)

    for i, day in enumerate(days_right):
        y = y_start - i * line_h
        c.setFillColor(DARK)
        c.drawString(col2_x, y, day)
        draw_circle_marker(c, col2_x + c.stringWidth(day, BODY_FONT, 26) + 18, y + 8, r=12, stroke_color=CIRCLE_PURPLE)

    wavy_y = y_start - 4 * line_h + 8
    draw_wavy_line(c, margin + 20, wavy_y, W - margin - 20)

    # Months grid — 4 rows x 3 columns, BIG illustrations
    months = [
        ("January", "month_january"), ("February", "month_february"), ("March", "month_march"),
        ("April", "month_april"), ("May", "month_may"), ("June", "month_june"),
        ("July", "month_july"), ("August", "month_august"), ("September", "month_september"),
        ("October", "month_october"), ("November", "month_november"), ("December", "month_december"),
    ]

    grid_top = wavy_y - 15
    cell_w = content_w / 3
    # Use all remaining space for month grid
    available_h = grid_top - margin
    cell_h = available_h / 4
    img_size = cell_h - 24  # Big illustrations

    for idx, (month_name, asset_name) in enumerate(months):
        row = idx // 3
        col = idx % 3
        cell_x = margin + col * cell_w
        cell_y = grid_top - (row + 1) * cell_h

        c.setStrokeColor(LIGHT_GRAY)
        c.setLineWidth(0.5)
        c.rect(cell_x, cell_y, cell_w, cell_h)

        c.setFont(BODY_FONT, 15)
        c.setFillColor(DARK)
        c.drawString(cell_x + 6, cell_y + cell_h - 19, month_name)

        img_path = img(asset_name)
        if img_path:
            try:
                c.drawImage(ImageReader(img_path), cell_x + 6, cell_y + 4, width=img_size, height=img_size,
                            preserveAspectRatio=True, anchor='sw', mask='auto')
            except Exception as e:
                print(f"  [WARN] {asset_name}: {e}")

    c.showPage()


# ===========================================
# PAGE 2: Date grid (1–31) + Years
# ===========================================
def draw_page2_calendar(c):
    margin = 0.6 * inch
    content_w = W - 2 * margin

    # Date number grid — spacious, 4 rows x 8 cols
    numbers = list(range(1, 32))
    cols = 8
    cell_w = content_w / cols
    cell_h = 52
    grid_top = H - margin - 10

    c.setFont(BODY_FONT, 30)

    for idx, num in enumerate(numbers):
        row = idx // cols
        col = idx % cols
        x = margin + col * cell_w
        y = grid_top - (row + 1) * cell_h

        if col > 0:
            c.setStrokeColor(LIGHT_GRAY)
            c.setLineWidth(0.5)
            c.line(x, y, x, y + cell_h)
        if col == 0:
            c.setStrokeColor(LIGHT_GRAY)
            c.setLineWidth(0.5)
            c.line(margin, y + cell_h, margin + content_w, y + cell_h)

        c.setFillColor(DARK)
        num_str = str(num)
        tw = c.stringWidth(num_str, BODY_FONT, 30)
        c.drawString(x + (cell_w - tw) / 2, y + 13, num_str)

    last_row = (len(numbers) - 1) // cols
    bottom_y = grid_top - (last_row + 1) * cell_h
    c.setStrokeColor(LIGHT_GRAY)
    c.line(margin, bottom_y, margin + content_w, bottom_y)

    # Wavy line
    wavy_y1 = bottom_y - 15
    draw_wavy_line(c, margin + 20, wavy_y1, W - margin - 20)

    # Years — big and centered
    year_y = wavy_y1 - 60
    c.setFont(BODY_FONT, 48)
    c.setFillColor(DARK)
    gap = 30
    total_w = sum(c.stringWidth(y, BODY_FONT, 48) for y in YEARS) + gap
    start_x = (W - total_w) / 2
    for i, year in enumerate(YEARS):
        yw = c.stringWidth(year, BODY_FONT, 48)
        c.drawString(start_x, year_y, year)
        if i < len(YEARS) - 1:
            sep_x = start_x + yw + gap / 2
            c.setStrokeColor(LIGHT_GRAY)
            c.setLineWidth(1)
            c.line(sep_x, year_y - 5, sep_x, year_y + 40)
        start_x += yw + gap

    c.showPage()


# ===========================================
# PAGE 3: Weather paintings
# ===========================================
def draw_page3_weather(c):
    margin = 0.6 * inch
    content_w = W - 2 * margin

    # Title
    c.setFont(TITLE_FONT, 32)
    c.setFillColor(DARK)
    c.drawCentredString(W / 2, H - margin - 32, "What's the weather today?")
    draw_wavy_line(c, margin + 20, H - margin - 44, W - margin - 20)

    weather = [
        ("Cloudy", "weather_clip_cloudy"),
        ("Partly Cloudy", "weather_clip_partly_cloudy"),
        ("Rainy", "weather_clip_rainy"),
        ("Snowy", "weather_clip_snowy"),
        ("Windy", "weather_clip_windy"),
        ("Sunny", "weather_clip_sunny"),
    ]

    # 2x3 grid — centered, with padding between cells
    wcell_w = content_w / 3
    weather_top = H - margin - 60
    available_h = weather_top - margin
    wcell_h = available_h / 2
    label_h = 24
    pad = 8

    for idx, (label, asset_name) in enumerate(weather):
        row = idx // 3
        col = idx % 3
        x = margin + col * wcell_w
        y = weather_top - (row + 1) * wcell_h

        # Cell border
        c.setStrokeColor(LIGHT_GRAY)
        c.setLineWidth(0.75)
        c.rect(x, y, wcell_w, wcell_h)

        # Label centered at top of cell
        c.setFont(BODY_FONT, 18)
        c.setFillColor(DARK)
        lw = c.stringWidth(label, BODY_FONT, 18)
        c.drawString(x + (wcell_w - lw) / 2, y + wcell_h - label_h, label)

        # Clipart image — centered in cell, square, below label
        img_path = img_clip(asset_name)
        if img_path:
            try:
                img_area_h = wcell_h - label_h - pad * 2
                img_size = min(wcell_w - pad * 2, img_area_h)
                ix = x + (wcell_w - img_size) / 2
                iy = y + pad + (img_area_h - img_size) / 2
                c.drawImage(ImageReader(img_path), ix, iy, width=img_size, height=img_size,
                            preserveAspectRatio=True, anchor='c', mask='auto')
            except Exception as e:
                print(f"  [WARN] {asset_name}: {e}")

    c.showPage()


# ===========================================
# PAGE 2: "All About Me!" — personalized
# ===========================================
def draw_page_aboutme(c, child_name):
    margin = 0.5 * inch
    content_w = W - 2 * margin

    # Title
    c.setFont(TITLE_FONT, 38)
    c.setFillColor(DARK)
    c.drawCentredString(W / 2, H - margin - 38, "All About Me!")
    draw_wavy_line(c, margin + 30, H - margin - 52, W - margin - 30)

    # "My Name Is:"
    name_label_y = H - margin - 85
    c.setFont(BODY_FONT, 26)
    c.setFillColor(DARK)
    c.drawString(margin + 15, name_label_y, "My Name Is:")

    # Dotted traceable name — 3 repetitions with writing guidelines
    name_font_size = 52
    line_height = name_font_size * 0.85  # Height of the guideline box
    row_spacing = line_height + 20  # Space between rows
    name_start_y = name_label_y - 60
    guide_x_start = margin + 15
    guide_x_end = W - margin - 15

    for i in range(3):
        baseline_y = name_start_y - i * row_spacing
        # Draw writing guidelines first (behind the text)
        draw_writing_guidelines(c, guide_x_start, guide_x_end, baseline_y, line_height)
        # Draw dotted name centered on the guidelines
        name_w = pdfmetrics.stringWidth(child_name.upper(), "ABeeZee", name_font_size)
        name_x = (W - name_w) / 2
        draw_dotted_name(c, child_name, name_x, baseline_y, BODY_FONT, name_font_size)

    # "I am ___ years old."
    age_y = name_start_y - 3 * row_spacing - 10
    c.setFont(BODY_FONT, 24)
    c.setFillColor(DARK)

    text1 = "I am "
    text2 = " years old."
    tw1 = c.stringWidth(text1, BODY_FONT, 24)
    tw2 = c.stringWidth(text2, BODY_FONT, 24)

    circle_r = 15
    circle_gap = 8
    total_circles_w = len(AGES) * (circle_r * 2 + circle_gap) - circle_gap
    total_w = tw1 + total_circles_w + tw2
    start_x = (W - total_w) / 2

    c.drawString(start_x, age_y, text1)

    cx = start_x + tw1 + circle_r
    for age in AGES:
        draw_circle_marker(c, cx, age_y + 9, r=circle_r, stroke_color=CIRCLE_PURPLE)
        c.setFont(BODY_FONT, 18)
        c.setFillColor(DARK)
        age_str = str(age)
        aw = c.stringWidth(age_str, BODY_FONT, 18)
        c.drawString(cx - aw / 2, age_y + 2, age_str)
        cx += circle_r * 2 + circle_gap

    c.setFont(BODY_FONT, 24)
    c.setFillColor(DARK)
    c.drawString(cx - circle_r + circle_gap, age_y, text2)

    # "How do you feel today?" prompt
    feel_y = age_y - 40
    c.setFont(BODY_FONT, 26)
    c.setFillColor(DARK)
    c.drawCentredString(W / 2, feel_y, "How do you feel today?")
    draw_wavy_line(c, margin + 40, feel_y - 12, W - margin - 40)

    # Emotions grid — 2 rows x 3 cols
    emotions = [
        ("Happy", "emotion_happy"),
        ("Sad", "emotion_sad"),
        ("Tired", "emotion_tired"),
        ("Bored", "emotion_bored"),
        ("Angry", "emotion_angry"),
        ("Silly", "emotion_silly"),
    ]

    emotion_top = feel_y - 22
    ecell_w = content_w / 3
    remaining_h = emotion_top - margin
    ecell_h = remaining_h / 2
    eimg_h = ecell_h - 18

    for idx, (label, asset_name) in enumerate(emotions):
        row = idx // 3
        col = idx % 3
        x = margin + col * ecell_w
        y = emotion_top - (row + 1) * ecell_h

        c.setStrokeColor(DARK)
        c.setLineWidth(0.6)
        c.rect(x, y, ecell_w, ecell_h)

        c.setFont(LABEL_FONT, 11)
        c.setFillColor(DARK)
        c.drawString(x + 4, y + ecell_h - 14, label)

        img_path = img(asset_name)
        if img_path:
            try:
                c.drawImage(ImageReader(img_path), x + 2, y + 2, width=ecell_w - 4, height=eimg_h - 4,
                            preserveAspectRatio=True, anchor='sw', mask='auto')
            except Exception as e:
                print(f"  [WARN] {asset_name}: {e}")

    c.showPage()


# ===========================================
# BUILD
# ===========================================
def build_binder(child_name):
    safe_name = child_name.lower().replace(" ", "-")
    pdf_path = os.path.join(OUTPUT_DIR, f"{safe_name}-morning-binder.pdf")

    c = canvas.Canvas(pdf_path, pagesize=letter)
    c.setTitle(f"{child_name}'s Morning Binder")

    draw_cover(c, child_name)
    draw_page1(c)           # Days + Months
    draw_page2_calendar(c)  # Date grid + Years
    draw_page3_weather(c)   # Weather paintings
    draw_page_aboutme(c, child_name)  # All About Me

    c.save()
    print(f"✅ Built: {pdf_path}")
    return pdf_path


if __name__ == "__main__":
    for name in CHILD_NAMES:
        build_binder(name)
