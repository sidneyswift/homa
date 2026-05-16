---
name: flash-cards
description: Generate printable flash card PDFs for the child's learning — vocabulary (Spanish, English), math concepts, or any subject. Use when asked to create flash cards, vocab cards, study cards, or printable learning cards. Also use when adding to existing flash card sets or reprinting.
---

# Flash Card Generation

Create printable flash card PDFs with AI-generated illustrations.

## Quick Reference

- **Image model:** Nano Banana 2 (`fal-ai/nano-banana-2`) — never Flux
- **Layout:** 3 cards per page (large, toddler-friendly) or 6 per page (compact)
- **Output:** Letter-size PDF, ready to print

## Workflow

### 1. Get the Word List

From the parent, from curriculum progression, or from the relevant Obsidian subject page (e.g., `Subjects/Spanish.md`).

### 2. Generate Illustrations

For each word/concept, generate a simple, bold illustration:

```python
payload = {
    "prompt": f"Simple bold illustration of {concept}, colorful, clean white background, children's educational flash card art style, no text or words or letters",
    "aspect_ratio": "1:1",
    "output_format": "jpeg",
    "resolution": "1K",
    "num_images": 1,
}
# POST to https://fal.run/fal-ai/nano-banana-2
```

- White background works best for flash cards
- Add "no text or words or letters" to every prompt
- `time.sleep(2)` between requests

### 3. Build the PDF

Use `scripts/build_flashcards.py` as the template. Key specs:

**Large cards (3 per page — preferred for toddlers):**
- Letter portrait (8.5×11")
- 3 cards per page, evenly spaced
- Large image centered in card area
- Word in bold below image, 28pt+
- For bilingual: target language large, English smaller below
- Light border or rounded rect around each card
- Cut lines between cards (dashed, light gray)

**Compact cards (6 per page):**
- 2 columns × 3 rows
- Smaller images, 18pt text

### 4. Deliver

Upload PDF to Slack. Offer to print immediately — the parent prefers it.

### 5. Log

Update the relevant Obsidian subject page with new vocab added and date.

## Design Tips

- Bold, simple illustrations a 3-year-old can identify instantly
- High contrast — avoid subtle or complex scenes
- For Spanish cards: Spanish word large + bold, English translation smaller/lighter
- Consistent art style within a set (same prompt suffix)

## Sets Created

Track in the relevant Obsidian subject page. Known sets:
- Spanish weather vocab
- Spanish verbs (borrar, limpiar, ordenar, lanzar)
- Spanish emotions (18 words, 3-page PDF) — 2026-04-02
