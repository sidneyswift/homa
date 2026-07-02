#!/usr/bin/env python3
"""
Word of the Week — fridge card generator (5x7 inch) for the child's vocabulary enrichment.
Watercolor/botanical aesthetic: cream background, sage green accents, handwritten fonts.
"""

import argparse
import os
import sys
import json
import urllib.request
import time
import math

def generate_image(prompt: str, output_path: str) -> str:
    """Generate illustration via fal AI Nano Banana 2."""
    api_key = os.environ.get("FAL_API_KEY")
    if not api_key:
        print("WARNING: No FAL_API_KEY — skipping image generation", file=sys.stderr)
        return None

    url = "https://queue.fal.run/fal-ai/nano-banana"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({
        "prompt": prompt,
        "negative_prompt": "text, words, letters, captions, labels, watermark, signature, blurry, low quality",
        "image_size": "landscape_4_3",
        "num_images": 1,
        "seed": int(time.time()) % 1000000,
    }).encode()

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"Queue submit failed: {e}", file=sys.stderr)
        return None

    request_id = data.get("request_id")
    if not request_id:
        images = data.get("images", [])
        if images:
            img_url = images[0].get("url")
            if img_url:
                urllib.request.urlretrieve(img_url, output_path)
                return output_path
        return None

    status_url = f"https://queue.fal.run/fal-ai/nano-banana/requests/{request_id}/status"
    result_url = f"https://queue.fal.run/fal-ai/nano-banana/requests/{request_id}"

    for _ in range(60):
        time.sleep(5)
        status_req = urllib.request.Request(status_url, headers={"Authorization": f"Key {api_key}"})
        try:
            with urllib.request.urlopen(status_req, timeout=15) as resp:
                status = json.loads(resp.read())
            if status.get("status") == "COMPLETED":
                break
            elif status.get("status") in ("FAILED",):
                print(f"Generation failed: {status}", file=sys.stderr)
                return None
        except:
            pass
    else:
        print("Timeout waiting for image", file=sys.stderr)
        return None

    result_req = urllib.request.Request(result_url, headers={"Authorization": f"Key {api_key}"})
    with urllib.request.urlopen(result_req, timeout=15) as resp:
        result = json.loads(resp.read())

    images = result.get("images", [])
    if images:
        img_url = images[0].get("url")
        if img_url:
            urllib.request.urlretrieve(img_url, output_path)
            return output_path
    return None


def build_card(word, definition, kid_definition, context, conversations, try_it, image_path, output_path):
    """Build a 5x7 inch PDF fridge card with watercolor/botanical aesthetic."""
    from reportlab.lib.pagesizes import inch
    from reportlab.lib.colors import HexColor, Color
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.utils import ImageReader
    import textwrap

    W, H = 5 * inch, 7 * inch

    # Register fonts
    font_dir = os.path.expanduser("~/.openclaw/workspace/fonts")
    has_caveat = False
    has_patrick = False

    for fname, alias in [("Caveat-Bold.ttf", "Caveat-Bold"), ("Caveat-Regular.ttf", "Caveat"),
                          ("PatrickHand-Regular.ttf", "PatrickHand")]:
        fpath = os.path.join(font_dir, fname)
        if os.path.exists(fpath):
            try:
                pdfmetrics.registerFont(TTFont(alias, fpath))
                if alias == "Caveat-Bold":
                    has_caveat = True
                if alias == "PatrickHand":
                    has_patrick = True
            except:
                pass

    title_font = "Caveat-Bold" if has_caveat else "Helvetica-Bold"
    body_font = "PatrickHand" if has_patrick else "Helvetica"
    accent_font = "Caveat" if has_caveat else "Helvetica"

    # Colors
    cream = HexColor("#FDF6EC")
    sage = HexColor("#8BA888")
    dark_sage = HexColor("#5C7A5C")
    brown = HexColor("#6B4C3B")
    dark = HexColor("#3B2F2F")
    tan = HexColor("#C4A97D")
    light_sage = HexColor("#D4E4D1")
    warm_white = HexColor("#FFFEF9")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    c = canvas.Canvas(output_path, pagesize=(W, H))

    # === BACKGROUND ===
    c.setFillColor(cream)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # Subtle border
    margin = 0.3 * inch
    c.setStrokeColor(sage)
    c.setLineWidth(1.5)
    c.roundRect(margin, margin, W - 2 * margin, H - 2 * margin, 8, fill=0, stroke=1)

    # Inner decorative line
    inner = margin + 6
    c.setStrokeColor(light_sage)
    c.setLineWidth(0.5)
    c.roundRect(inner, inner, W - 2 * inner, H - 2 * inner, 6, fill=0, stroke=1)

    # === HEADER ===
    y = H - 0.55 * inch
    c.setFont(accent_font if has_caveat else "Helvetica", 11)
    c.setFillColor(sage)
    c.drawCentredString(W / 2, y, "Word of the Week")

    # Small leaf decorations around header
    c.setFont("Helvetica", 8)
    header_w = c.stringWidth("Word of the Week", accent_font if has_caveat else "Helvetica", 11)
    leaf_x_left = W / 2 - header_w / 2 - 14
    leaf_x_right = W / 2 + header_w / 2 + 6
    c.drawString(leaf_x_left, y, "\u2022")
    c.drawString(leaf_x_right, y, "\u2022")

    # === WORD ===
    y -= 36
    c.setFont(title_font, 34)
    c.setFillColor(brown)
    c.drawCentredString(W / 2, y, word.upper())

    # Wavy line under word
    y -= 10
    c.setStrokeColor(tan)
    c.setLineWidth(1)
    line_w = 1.8 * inch
    start_x = W / 2 - line_w / 2
    p = c.beginPath()
    p.moveTo(start_x, y)
    for i in range(int(line_w)):
        px = start_x + i
        py = y + 2 * math.sin(i * 0.15)
        p.lineTo(px, py)
    c.drawPath(p, stroke=1, fill=0)

    # === DEFINITION ===
    y -= 18
    c.setFont(body_font, 11)
    c.setFillColor(dark)
    c.drawCentredString(W / 2, y, definition)

    # === KID DEFINITION ===
    y -= 22
    c.setFont(body_font, 10)
    c.setFillColor(brown)

    # Wrap kid definition
    max_chars = 48
    kid_lines = textwrap.wrap(kid_definition, max_chars)
    for line in kid_lines:
        c.drawCentredString(W / 2, y, line)
        y -= 14

    # === IMAGE ===
    if image_path and os.path.exists(image_path):
        y -= 6
        img_w = 3.2 * inch
        img_h = img_w * 0.55
        img_x = (W - img_w) / 2

        # Soft rounded border behind image
        c.setFillColor(warm_white)
        c.setStrokeColor(sage)
        c.setLineWidth(1)
        c.roundRect(img_x - 4, y - img_h - 4, img_w + 8, img_h + 8, 6, fill=1, stroke=1)

        try:
            img = ImageReader(image_path)
            c.drawImage(img, img_x, y - img_h, width=img_w, height=img_h,
                       preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Warning: could not embed image: {e}", file=sys.stderr)

        y -= img_h + 14
    else:
        y -= 10

    # === USE IT SECTION ===
    left = 0.55 * inch
    right_edge = W - 0.55 * inch
    text_width = right_edge - left

    c.setFont(title_font, 13)
    c.setFillColor(dark_sage)
    c.drawString(left, y, "\u2728 Use It")
    y -= 16

    c.setFont(body_font, 10)
    c.setFillColor(dark)
    context_lines = textwrap.wrap(context, 52)
    for line in context_lines:
        c.drawString(left + 8, y, line)
        y -= 13

    # === ASK STORY SECTION ===
    y -= 8
    c.setFont(title_font, 13)
    c.setFillColor(dark_sage)
    c.drawString(left, y, "\U0001F5E3 Ask the child")
    y -= 16

    c.setFont(body_font, 9.5)
    c.setFillColor(dark)
    for conv in conversations:
        conv_lines = textwrap.wrap(conv.strip(), 50)
        for j, line in enumerate(conv_lines):
            prefix = "\u2022 " if j == 0 else "  "
            c.drawString(left + 8, y, prefix + line)
            y -= 12

    # === TRY IT BOX ===
    y -= 10
    box_h = 36
    box_x = left
    box_w = text_width

    # Filled rounded box
    c.setFillColor(light_sage)
    c.setStrokeColor(sage)
    c.setLineWidth(1)
    c.roundRect(box_x, y - box_h + 10, box_w, box_h, 6, fill=1, stroke=1)

    c.setFont(title_font, 11)
    c.setFillColor(brown)
    c.drawString(box_x + 10, y - 4, "\u2B50 Try it!")

    c.setFont(body_font, 9.5)
    c.setFillColor(dark)
    try_lines = textwrap.wrap(try_it, 52)
    ty = y - 18
    for line in try_lines:
        c.drawString(box_x + 10, ty, line)
        ty -= 12

    # === FOOTER ===
    c.setFont(accent_font if has_caveat else "Helvetica", 7.5)
    c.setFillColor(tan)
    c.drawCentredString(W / 2, margin + 4, "Homa's Word of the Week  \u00b7  the child's Vocabulary Adventure")

    c.save()
    print(f"\u2705 Card saved: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Word of the Week card generator")
    parser.add_argument("--word", required=True)
    parser.add_argument("--definition", required=True, help="Standard definition")
    parser.add_argument("--kid-definition", required=True, help="Kid-friendly explanation")
    parser.add_argument("--context", required=True, help="Example sentence for the parent to use")
    parser.add_argument("--conversations", required=True, help="Comma-separated conversation starters")
    parser.add_argument("--try-it", required=True, help="Activity/challenge for the week")
    parser.add_argument("--image-prompt", required=True, help="Prompt for NB2 illustration")
    parser.add_argument("--output", required=True, help="Output PDF path")
    parser.add_argument("--skip-image", action="store_true", help="Skip image generation")
    parser.add_argument("--image-path", default=None, help="Use existing image instead of generating")
    args = parser.parse_args()

    conversations = [c.strip() for c in args.conversations.split(",") if c.strip()]

    image_path = args.image_path
    if not image_path and not args.skip_image:
        img_dir = os.path.join(os.path.dirname(args.output), "images")
        os.makedirs(img_dir, exist_ok=True)
        img_file = os.path.join(img_dir, f"{args.word.lower()}.png")
        if os.path.exists(img_file):
            print(f"Using existing image: {img_file}")
            image_path = img_file
        else:
            print(f"Generating illustration for '{args.word}'...")
            image_path = generate_image(args.image_prompt, img_file)
            if image_path:
                print(f"\u2705 Image saved: {image_path}")
            else:
                print("\u26a0\ufe0f Image generation failed - building card without illustration")

    build_card(
        word=args.word,
        definition=args.definition,
        kid_definition=args.kid_definition,
        context=args.context,
        conversations=conversations,
        try_it=args.try_it,
        image_path=image_path,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
