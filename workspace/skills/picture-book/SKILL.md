---
name: picture-book
description: Generate personalized AI picture books for the child — write story text, generate illustrations with Nano Banana 2 via fal AI, and assemble into print-ready landscape PDFs. Use when asked to create a picture book, storybook, bedtime book, or any illustrated book for the child. Also use when iterating on book illustrations, regenerating pages, or building a PDF from existing images.
---

# Picture Book Creation

Generate personalized picture books: write story → generate illustrations → assemble PDF.

## Quick Reference

- **Image model:** Nano Banana 2 (`fal-ai/nano-banana-2`) — never Flux
- **PDF layout:** 11×8.5" landscape, full-bleed images, text overlay on dark bar
- **Pages:** 10-12 (cover + story pages)
- **Time:** ~30-45 min per book

## Workflow

### 1. Write the child

- Plan arc: beginning → middle → end. 10 story pages is the sweet spot.
- Write text first, illustrations second. 2-4 short lines per page.
- Simple sentences, repetition, rhythm — this is for a 3-year-old.
- End with a warm emotional beat.
- Include character actions (ran, jumped, hugged, flew).

### 2. Write Image Prompts

Append this style directive to every prompt:

```
cartoon watercolor children's picture book illustration, bright vivid colors, soft rounded shapes, gentle textures, expressive characters, professional children's book art quality
```

Append to every prompt:

```
Do not include any text, words, letters, titles, or captions in the image
```

**Character descriptions** (keep identical across all prompts):

See `references/characters.md` for the child, family, and stuffed animal descriptions.

> ⚠️ **NB2 Safety Filter:** Never use specific ages ("3-year-old boy") + physical descriptions — triggers 422. Use "a young boy character with [features]" instead.

### Character Consistency (CRITICAL)

NB2 doesn't have built-in character memory between generations. Every page is independent — so **you** must enforce consistency. Without this, characters shift appearance across pages and the book feels disjointed.

#### Rules

1. **Lock the character sheet before generating anything.** For each character in the book, define a frozen description block that includes:
   - Physical features (hair color/style, eye color, skin tone, build)
   - **Outfit for this book** (specific clothing, colors, accessories — stays the same on every page unless the story requires a change)
   - Any distinguishing props (e.g., backpack, hat, stuffed animal they carry)

2. **Use the EXACT same description string on every page.** Define character constants in your generate script and interpolate them — never rephrase or abbreviate per-page. Even small wording changes ("blonde hair" vs "golden hair") cause drift.

   ```python
   # LOCK these before generation — do not vary per page
   STORY = "a young boy character with shoulder-length wavy blonde hair and bright blue eyes, pale skin, rosy cheeks, wearing a red t-shirt and blue shorts"
   LITTLE = "a small white French Bulldog with a black patch over one eye and big bat ears"
   ```

3. **Outfit is part of the character constant.** Don't leave clothing to NB2's imagination — it will invent different outfits per page. Pick one outfit at story-planning time and bake it into the description.

4. **When a character changes clothes** (e.g., pajamas → daytime), define a second constant (`STORY_PJ`, `STORY_DAY`) and switch explicitly at the right page. Never leave it implicit.

5. **Keep backgrounds/poses varied, characters fixed.** The scene changes — the character descriptions don't.

6. **Review all images together before building the PDF.** Lay them out side-by-side and check:
   - Hair color/length consistent?
   - Outfit consistent page-to-page?
   - Skin tone consistent?
   - Dog/animal markings consistent?
   - Any page where a character looks like a different person?
   
   Regenerate outliers individually, using the same frozen prompt with only the scene/action changed.

#### Template Pattern (generate.py)

```python
# === CHARACTER SHEET (frozen for this book) ===
STORY = "a young boy character with shoulder-length wavy blonde hair and bright blue eyes, pale skin, rosy cheeks, wearing a red t-shirt and blue shorts"
DOG = "a small white French Bulldog with a black patch over one eye, big bat ears with pink inner ears"

# Every page prompt follows this structure:
# f"Children's picture book page. {STORY} [action/pose]. {DOG} [action/pose]. [Scene/background]. {STYLE}"
# Never rewrite the character description inline — always use the constant.
```

#### What to Do When a Character Drifts

If one page comes back with the character looking wrong:
1. **Regenerate that page only** — don't redo the whole book
2. Use the exact same character constant + scene prompt
3. If it keeps drifting on a specific scene, simplify the background/action (complex prompts cause more drift)
4. As a last resort, try adding reinforcing details: "the same young boy with shoulder-length wavy blonde hair" (repeat key features)

### 3. Generate Images

**API call pattern:**

```python
payload = {
    "prompt": prompt,
    "aspect_ratio": "16:9",
    "output_format": "jpeg",
    "resolution": "1K",       # 2K available but slower/more timeouts
    "num_images": 1,
}
# POST to https://fal.run/fal-ai/nano-banana-2
```

- Retry failed prompts 2-3x before simplifying
- `time.sleep(2)` between requests to avoid rate limits
- Generation takes 15-40 seconds per image
- 422 on complex prompts → shorten, remove complex descriptions

**Reference images for character consistency** (optional, slower):

```python
import fal_client
url = fal_client.upload_file('path/to/photo.jpg')
# Use edit endpoint: fal-ai/nano-banana-2/edit with image_urls
```

Note: Text-to-image with detailed descriptions often works better than edit+reference.

See `scripts/generate.py` for a complete generation script template.

### 4. Validate Images

Before building PDF: check every image exists and is >50KB. Visually scan for text artifacts, wrong character features, broken compositions. Regenerate bad ones individually.

### 5. Assemble PDF

Use `scripts/build_pdf.py` as the template. Key specs:

- **Page size:** 11×8.5" landscape letter
- **Image:** full-bleed, scaled to cover (may crop edges)
- **Text:** white on semi-transparent dark bar (`#1A1A2E` at 70% opacity)
- **Font:** Georgia (Times-Roman fallback), 19pt body
- **Dialogue:** italic font
- **Cover:** dark overlay on top half, large title, subtitle in light blue italic (`#7FD4FF`)
- **Final page:** "The End" in accent color
- **Page numbers:** small, bottom-right, 40% opacity

### 6. Deliver

Upload PDF to Slack. Note any known limitations (character consistency, etc.).

## Lessons Learned

- NB2 produces warm watercolor illustrations — perfect for kids' books
- Landscape + full-bleed is dramatically better than portrait
- **Character consistency is the #1 quality issue.** NB2 has no memory between generations — faces, hair, and especially clothing shift page-to-page. The fix: freeze character descriptions as constants (including outfit), use the exact same string on every page, and review all images side-by-side before building the PDF. See "Character Consistency" section above.
- Long/complex prompts fail more often — keep focused, one scene per prompt
- "Blowing out candle" type action prompts sometimes trigger safety filters — rephrase
