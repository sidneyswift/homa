---
name: homa-make-handwriting-worksheet
description: Generate HWT (Handwriting Without Tears) letter practice worksheets with coloring illustrations. Use when the parent asks for a handwriting worksheet, letter practice page, HWT-style worksheet, or "a worksheet like this one" referencing the HWT book. Covers any uppercase letter paired with an animal or object starting with that letter.
---

# HWT Letter Practice Worksheet

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

Generate worksheets matching HWT "My First School Book" style — grey trace letters with smiley starting points plus a large coloring illustration.

## Layout Spec

- **White background, no borders, no decorations, no footer**
- **Left side:** 8 trace letters in a 4×2 grid (4 rows, 2 columns)
- **Right side:** One large coloring illustration spanning the full right column
- **Label:** Animal/object name in all caps, centered below illustration

### Letter Trace Boxes

Each box is an implied square (~1.8 inch). No visible box border — only guidelines:
- **Top guideline:** light grey solid line
- **Midline:** light grey dashed line (halfway)
- **Baseline:** light grey solid line
- **Letter strokes:** light grey (#D0D0D0), 5pt line width, round caps
- **Smiley face:** small smiley at the letter's stroke-1 starting point (top-left for most capitals)

### Smiley Starting Point

The smiley sits just above the letter's first-stroke start point. For HWT capitals:
- **Letters starting top-left (big line down):** F, E, D, P, B, R, N, M, K, H, L, U, J, I, T
- **Letters starting top-center/right:** varies — check HWT stroke order

The smiley is a small circle (~6pt radius) with dot eyes and arc smile, drawn in mid-grey.

### Coloring Illustration

- Generated via Nano Banana 2 (never Flux)
- Prompt template: `Simple black outline coloring page illustration of a cute [ANIMAL/OBJECT], clean thick black lines on pure white background, no shading, no color fill, cartoon style suitable for a 3 year old to color in, no text no words no letters no captions no labels`
- Negative prompt: `text, words, letters, captions, labels, watermark, color, shading, gradient, realistic, photograph`
- Size: fills right column, roughly 4-5 inches tall
- Aspect ratio: 1:1 (square)

## Step-by-Step

1. **Generate illustration** via Nano Banana 2 — save to /tmp/
2. **Build PDF** using the script template below
3. **Preview** — convert to PNG and verify: white bg, smiley placement, letter strokes visible, illustration large enough, no cut-off
4. **Deliver** to Slack + offer to print

## Mistakes to Avoid

These were real mistakes from the F+Flamingo session:

| Mistake | Fix |
|---------|-----|
| Smiley placed at top-RIGHT of letter | Smiley goes at stroke-1 START point (top-LEFT for F) |
| Cream/colored background | Always white — easy printing |
| Decorative borders, leaves, footer text | None. Clean page only. |
| Flamingo too small | Illustration must be BIG — fill the right column |
| "Trace and practice" label, vault-name footer text | No extra text. Just the letter boxes + illustration + animal name |

## Script

Run `scripts/generate_worksheet.py` with these arguments:

```bash
python3 scripts/generate_worksheet.py --letter F --animal flamingo --image /tmp/flamingo_coloring.png --output /tmp/letter-f-flamingo-worksheet.pdf
```

If the script doesn't exist or needs updating, read `scripts/generate_worksheet.py` and patch. The script handles:
- Drawing 8 trace letters (4×2 grid)
- Guidelines (top, dashed mid, bottom)
- Grey letter strokes with correct formation
- Smiley at starting point
- Placing the illustration on the right
- Label below illustration

## HWT Letter Formations

Reference for drawing each capital letter's strokes. Read `references/letter-strokes.md` when generating a letter you haven't done before.

## Delivery Checklist

- [ ] White background
- [ ] 8 practice letters, grey trace, smiley at correct start point
- [ ] Large illustration on right (coloring-page style, no fills)
- [ ] Animal/object name label below illustration
- [ ] No borders, no decorations, no footer text
- [ ] PDF saved to `content/curriculum/writing-fine-motor/worksheets/` directory
- [ ] Printed if requested
