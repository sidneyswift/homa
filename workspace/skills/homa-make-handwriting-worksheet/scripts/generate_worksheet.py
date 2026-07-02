#!/usr/bin/env python3
"""
Generate an HWT-style letter practice worksheet.

Usage:
  python3 generate_worksheet.py --letter F --animal flamingo --image /tmp/flamingo.png --output /tmp/worksheet.pdf
  python3 generate_worksheet.py --letter L --animal lion --image /tmp/lion.png --copies 2
"""

import argparse
import subprocess
import sys

from reportlab.lib.pagesizes import letter as LETTER_SIZE
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, white


# --- Colors ---
LIGHT_GREY = Color(0.82, 0.82, 0.82)   # guidelines & trace strokes
MID_GREY = Color(0.50, 0.50, 0.50)     # smiley face
TRACE_GREY = Color(0.82, 0.82, 0.82)   # letter strokes

WIDTH, HEIGHT = LETTER_SIZE  # 8.5 x 11 inches


# --- HWT letter stroke definitions ---
# Each letter: list of strokes. Each stroke is a list of (x, y) tuples
# in unit coords (0,0)=bottom-left, (1,1)=top-right of the letter box.
# Also: smiley_pos (x, y) in unit coords for the starting point.

LETTER_STROKES = {
    'A': {
        'strokes': [
            [(0.5, 1.0), (0.0, 0.0)],
            [(0.5, 1.0), (1.0, 0.0)],
            [(0.2, 0.5), (0.8, 0.5)],
        ],
        'smiley': (0.5, 1.0),
    },
    'B': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.6, 1.0), (0.85, 0.85), (0.85, 0.65), (0.6, 0.5), (0.15, 0.5)],
            [(0.15, 0.5), (0.65, 0.5), (0.9, 0.35), (0.9, 0.15), (0.65, 0.0), (0.15, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'C': {
        'strokes': [
            [(0.85, 0.85), (0.6, 1.0), (0.3, 1.0), (0.1, 0.75), (0.1, 0.25), (0.3, 0.0), (0.6, 0.0), (0.85, 0.15)],
        ],
        'smiley': (0.85, 0.85),
    },
    'D': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.55, 1.0), (0.85, 0.75), (0.85, 0.25), (0.55, 0.0), (0.15, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'E': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.85, 1.0)],
            [(0.15, 0.5), (0.7, 0.5)],
            [(0.15, 0.0), (0.85, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'F': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.85, 1.0)],
            [(0.15, 0.5), (0.65, 0.5)],
        ],
        'smiley': (0.15, 1.0),
    },
    'G': {
        'strokes': [
            [(0.85, 0.85), (0.6, 1.0), (0.3, 1.0), (0.1, 0.75), (0.1, 0.25), (0.3, 0.0), (0.6, 0.0), (0.85, 0.25), (0.85, 0.5)],
            [(0.55, 0.5), (0.85, 0.5)],
        ],
        'smiley': (0.85, 0.85),
    },
    'H': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.85, 1.0), (0.85, 0.0)],
            [(0.15, 0.5), (0.85, 0.5)],
        ],
        'smiley': (0.15, 1.0),
    },
    'I': {
        'strokes': [
            [(0.5, 1.0), (0.5, 0.0)],
            [(0.3, 1.0), (0.7, 1.0)],
            [(0.3, 0.0), (0.7, 0.0)],
        ],
        'smiley': (0.5, 1.0),
    },
    'J': {
        'strokes': [
            [(0.65, 1.0), (0.65, 0.2), (0.45, 0.0), (0.2, 0.0)],
        ],
        'smiley': (0.65, 1.0),
    },
    'K': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.85, 1.0), (0.15, 0.5)],
            [(0.15, 0.5), (0.85, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'L': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 0.0), (0.85, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'M': {
        'strokes': [
            [(0.1, 1.0), (0.1, 0.0)],
            [(0.1, 1.0), (0.5, 0.4)],
            [(0.5, 0.4), (0.9, 1.0)],
            [(0.9, 1.0), (0.9, 0.0)],
        ],
        'smiley': (0.1, 1.0),
    },
    'N': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.85, 0.0)],
            [(0.85, 0.0), (0.85, 1.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'O': {
        'strokes': [
            [(0.5, 1.0), (0.2, 0.9), (0.1, 0.5), (0.2, 0.1), (0.5, 0.0), (0.8, 0.1), (0.9, 0.5), (0.8, 0.9), (0.5, 1.0)],
        ],
        'smiley': (0.5, 1.0),
    },
    'P': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.6, 1.0), (0.85, 0.85), (0.85, 0.65), (0.6, 0.5), (0.15, 0.5)],
        ],
        'smiley': (0.15, 1.0),
    },
    'Q': {
        'strokes': [
            [(0.5, 1.0), (0.2, 0.9), (0.1, 0.5), (0.2, 0.1), (0.5, 0.0), (0.8, 0.1), (0.9, 0.5), (0.8, 0.9), (0.5, 1.0)],
            [(0.6, 0.2), (0.9, -0.05)],
        ],
        'smiley': (0.5, 1.0),
    },
    'R': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.0)],
            [(0.15, 1.0), (0.6, 1.0), (0.85, 0.85), (0.85, 0.65), (0.6, 0.5), (0.15, 0.5)],
            [(0.5, 0.5), (0.85, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'S': {
        'strokes': [
            [(0.75, 0.9), (0.5, 1.0), (0.25, 0.9), (0.15, 0.7), (0.25, 0.55), (0.5, 0.5),
             (0.75, 0.45), (0.85, 0.3), (0.75, 0.1), (0.5, 0.0), (0.25, 0.1)],
        ],
        'smiley': (0.75, 0.9),
    },
    'T': {
        'strokes': [
            [(0.1, 1.0), (0.9, 1.0)],
            [(0.5, 1.0), (0.5, 0.0)],
        ],
        'smiley': (0.1, 1.0),
    },
    'U': {
        'strokes': [
            [(0.15, 1.0), (0.15, 0.2), (0.35, 0.0), (0.65, 0.0), (0.85, 0.2), (0.85, 1.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'V': {
        'strokes': [
            [(0.1, 1.0), (0.5, 0.0)],
            [(0.5, 0.0), (0.9, 1.0)],
        ],
        'smiley': (0.1, 1.0),
    },
    'W': {
        'strokes': [
            [(0.05, 1.0), (0.3, 0.0)],
            [(0.3, 0.0), (0.5, 0.6)],
            [(0.5, 0.6), (0.7, 0.0)],
            [(0.7, 0.0), (0.95, 1.0)],
        ],
        'smiley': (0.05, 1.0),
    },
    'X': {
        'strokes': [
            [(0.15, 1.0), (0.85, 0.0)],
            [(0.85, 1.0), (0.15, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'Y': {
        'strokes': [
            [(0.15, 1.0), (0.5, 0.5)],
            [(0.85, 1.0), (0.5, 0.5)],
            [(0.5, 0.5), (0.5, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
    'Z': {
        'strokes': [
            [(0.15, 1.0), (0.85, 1.0)],
            [(0.85, 1.0), (0.15, 0.0)],
            [(0.15, 0.0), (0.85, 0.0)],
        ],
        'smiley': (0.15, 1.0),
    },
}


def draw_smiley(c, x, y, radius=6):
    """Small smiley face — HWT starting point indicator."""
    c.setStrokeColor(MID_GREY)
    c.setFillColor(white)
    c.setLineWidth(1)
    c.circle(x, y, radius, fill=1, stroke=1)
    c.setFillColor(MID_GREY)
    c.circle(x - 2, y + 1.5, 0.8, fill=1, stroke=0)
    c.circle(x + 2, y + 1.5, 0.8, fill=1, stroke=0)
    c.setLineWidth(0.7)
    p = c.beginPath()
    p.arc(x - 3, y - 3, x + 3, y + 0.5, 200, 140)
    c.drawPath(p, fill=0, stroke=1)


def unit_to_abs(ux, uy, box_x, box_y, box_w, box_h, pad_frac=0.12):
    """Convert unit coords (0-1) to absolute page coords within a box."""
    pad = box_w * pad_frac
    inner_w = box_w - 2 * pad
    inner_h = box_h - 2 * pad
    return box_x + pad + ux * inner_w, box_y + pad + uy * inner_h


def draw_letter_trace(c, letter, box_x, box_y, box_w, box_h):
    """Draw one HWT-style trace letter with guidelines and smiley."""
    pad = box_w * 0.12
    top_y = box_y + box_h - pad
    bot_y = box_y + pad
    mid_y = box_y + box_h * 0.5

    # Guidelines
    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.5)
    c.line(box_x, top_y, box_x + box_w, top_y)   # top
    c.line(box_x, bot_y, box_x + box_w, bot_y)   # bottom
    c.setDash(4, 4)
    c.line(box_x, mid_y, box_x + box_w, mid_y)   # dashed mid
    c.setDash()

    info = LETTER_STROKES.get(letter.upper())
    if not info:
        return

    # Draw strokes
    c.setStrokeColor(TRACE_GREY)
    c.setLineWidth(5)
    c.setLineCap(1)  # round caps

    for stroke in info['strokes']:
        if len(stroke) == 2:
            # Simple line
            x1, y1 = unit_to_abs(stroke[0][0], stroke[0][1], box_x, box_y, box_w, box_h)
            x2, y2 = unit_to_abs(stroke[1][0], stroke[1][1], box_x, box_y, box_w, box_h)
            c.line(x1, y1, x2, y2)
        else:
            # Multi-point polyline
            pts = [unit_to_abs(p[0], p[1], box_x, box_y, box_w, box_h) for p in stroke]
            p = c.beginPath()
            p.moveTo(pts[0][0], pts[0][1])
            for pt in pts[1:]:
                p.lineTo(pt[0], pt[1])
            c.drawPath(p, fill=0, stroke=1)

    c.setLineCap(0)

    # Smiley at starting point
    sx, sy = info['smiley']
    abs_x, abs_y = unit_to_abs(sx, sy, box_x, box_y, box_w, box_h)
    draw_smiley(c, abs_x, abs_y + 10, 6)


def build_worksheet(letter, animal_name, image_path, output_path):
    """Build the full worksheet PDF."""
    c = canvas.Canvas(output_path, pagesize=LETTER_SIZE)

    # Layout constants
    left_margin = 0.5 * inch
    f_size = 1.6 * inch
    f_gap = 0.35 * inch
    row_gap = 0.35 * inch
    top_y = HEIGHT - 0.6 * inch

    # 4 rows × 2 cols of letter traces
    for row in range(4):
        row_bottom = top_y - (row + 1) * f_size - row * row_gap
        for col in range(2):
            bx = left_margin + col * (f_size + f_gap)
            draw_letter_trace(c, letter, bx, row_bottom, f_size, f_size)

    # Illustration — big, right side, spanning full height
    img_w = 4.2 * inch
    img_h = 7.5 * inch
    img_x = left_margin + 2 * (f_size + f_gap) + 0.15 * inch
    img_y = top_y - img_h + 0.3 * inch

    c.drawImage(image_path, img_x, img_y, width=img_w, height=img_h,
                preserveAspectRatio=True, anchor='c', mask='auto')

    # Label
    c.setFont("Helvetica-Bold", 22)
    from reportlab.lib.colors import black
    c.setFillColor(black)
    c.drawCentredString(img_x + img_w / 2, img_y - 10, animal_name.upper())

    c.save()
    print(f"Saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate HWT letter worksheet")
    parser.add_argument("--letter", required=True, help="Capital letter (A-Z)")
    parser.add_argument("--animal", required=True, help="Animal/object name")
    parser.add_argument("--image", required=True, help="Path to coloring illustration PNG/JPG")
    parser.add_argument("--output", default="/tmp/hwt-worksheet.pdf", help="Output PDF path")
    parser.add_argument("--copies", type=int, default=0, help="Print N copies (0=don't print)")
    args = parser.parse_args()

    if len(args.letter) != 1 or not args.letter.isalpha():
        print(f"Error: --letter must be a single letter, got '{args.letter}'")
        sys.exit(1)

    build_worksheet(args.letter.upper(), args.animal, args.image, args.output)

    if args.copies > 0:
        subprocess.run(["lpr", "-#", str(args.copies), args.output], check=True)
        print(f"Printed {args.copies} copies")


if __name__ == "__main__":
    main()
