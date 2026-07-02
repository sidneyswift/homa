---
name: homa-make-sentence-pyramids
description: Generate Sentence Pyramid phonics worksheets (or pyramid-only print sets) for the child. A sentence pyramid builds one decodable sentence cumulatively, one word per line, from a single word up to the full sentence — pinned to a focus sound. Use when the parent asks for a sentence pyramid, word pyramid, "pyramids like this," or N versions of pyramids. Two modes: PYRAMID-ONLY (just the centered pyramids, multiple per page — what the parent usually wants) and FULL WORKSHEET (the complete 6-section Lyndsey-Kuster-style page).
---

# Sentence Pyramids

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

> **FILE OUTPUT TO THE BINDER.** The finished PDF MUST be saved under `content/curriculum/<subject>/worksheets/<artifact-name>/` (subject = phonics; e.g. `content/curriculum/phonics/worksheets/`), NOT to root `output/`. The binder is the parent's frontend — root `output/` gets lost in Slack (her #1 pain, transcript 2026-06-28). Pick the subject folder from `content/curriculum/` (art-creative, literacy, math, phonics, science, spanish, social-studies, writing-fine-motor, self-care-independence). Still deliver to Slack + print as asked.

A **sentence pyramid** stacks a sentence word-by-word so each line adds the next word, forming a triangle. Built around a **focus phonics sound** and a **decodable target word**.

```
Pip
Pip the
Pip the Pup
Pip the Pup hops
Pip the Pup hops in
Pip the Pup hops in the
Pip the Pup hops in the tub.
```

Reading benefit: the child re-reads the growing line each time, building fluency, tracking, and confidence — and the final line is a complete decodable sentence at the focus sound.

## Two Modes — INFER WHICH

| Mode | What it is | When |
|---|---|---|
| **PYRAMID-ONLY** (default) | Just the centered pyramids, several per page, N versions. No mapping dots / stars / writing lines / draw box. | The parent says "just the word pyramid", "N versions", "pyramids like this". This is what she asked for 2026-06-28. |
| **FULL WORKSHEET** | The complete single-page 6-section layout (focus letter box, word-mapping dots + circle-the-picture, pyramid, 3-star reread tracker, writing lines, draw box). | The parent wants the whole Lyndsey-Kuster-style page. |

When unsure, default to PYRAMID-ONLY — it's the lighter, more-used artifact.

## Step 1 — Write the Pyramid (TEXT FIRST, decodable)

**Every word must be decodable at the child's current phonics level or a confirmed sight word.** Same constraint as `homa-make-decodable-readers` — reuse its CVC word bank + `references/sight-words.md`. The final line must end with the **target word** that contains the **focus sound**.

Rules:
- Pick a **focus sound** (e.g. short u) and a **target CVC word** (e.g. `tub`).
- Build a short sentence (5–8 words) ending in the target word.
- Each line adds exactly one word, top = first word, bottom = full sentence with end punctuation.
- Keep function words to confirmed sight words (the, a, in, is, on, can, etc.).
- Personalize with the child's world: Paw Patrol pups (Skye, Marshall, Chase), his stuffed animals (Mr Cow, Candy, Flamingo…), Little the Frenchie, space, frogs, monster trucks.
- For an N-version set, vary the focus sound or target word per page (e.g. tub, sun, bug, mud, pup, cup…), or keep one focus sound with different sentences. Match what the parent asked.

Sanity-check each pyramid: read every word — is it CVC at level OR a sight word OR a name? If not, rewrite.

## Step 2 — Generate the PDF

Use `scripts/generate_pyramids.py`. It takes a JSON list of pyramids and lays them out.

PYRAMID-ONLY (multiple pyramids, here 10 across pages, 2 per page):
```bash
python3 scripts/generate_pyramids.py \
  --mode pyramids \
  --data /tmp/pyramids.json \
  --per-page 2 \
  --output content/curriculum/phonics/worksheets/sentence-pyramids/pyramids-set.pdf
```

FULL WORKSHEET (one page per pyramid, all 6 sections; needs a focus letter + two picture images for the circle-the-picture mapping — generate via Nano Banana 2 coloring-style, never Flux):
```bash
python3 scripts/generate_pyramids.py \
  --mode worksheet \
  --data /tmp/pyramids.json \
  --output content/curriculum/phonics/worksheets/sentence-pyramids/tub-worksheet.pdf
```

`/tmp/pyramids.json` format:
```json
[
  {
    "focus": "u",
    "target": "tub",
    "lines": ["Pip", "Pip the", "Pip the Pup", "Pip the Pup hops",
              "Pip the Pup hops in", "Pip the Pup hops in the",
              "Pip the Pup hops in the tub."],
    "map_word": "tub",
    "pic_correct": "/tmp/tub.png",
    "pic_distractor": "/tmp/barrel.png"
  }
]
```
(`map_word`/`pic_*` only needed for `--mode worksheet`.)

## Step 3 — Preview, Deliver, Track

1. Convert page 1 to PNG and eyeball: pyramid centered, triangle shape clean, text readable, nothing cut off. (Rasterize with `qlmanage -t -s 1000 -o <dir> file.pdf`.)
2. Upload PDF to Slack. If the parent says "print" / "great print", run `lpr` (or `--copies N`).
3. Log to the vault: lesson entry + link `[[Subjects/Phonics]]`; note focus sounds covered so the progression compounds.

## Style

- White background, clean, no decorative borders/footers (matches the parent's worksheet preference for phonics drills — NOT the watercolor/botanical style; that's for botanical flash cards. Phonics worksheets are clean black-on-white like HWT).
- Pyramid font: rounded, friendly, large (~13–17pt), centered.
- Section number badges (full worksheet): white digit in a filled black circle.
- Title banner "Sentence Pyramids" with the small striped-pyramid icon (full worksheet only).
- Primary writing lines = solid baseline + dashed midline.

## Mistakes to Avoid

| Mistake | Fix |
|---|---|
| A pyramid word that isn't decodable/sight-word | Rewrite — every word must pass the filter. |
| Final line missing the focus-sound target word | The bottom line MUST contain the target word. |
| Giving the full worksheet when the parent wanted "just the pyramid" | Default to PYRAMID-ONLY unless she asks for the whole page. |
| Watercolor/botanical styling on a phonics drill | Keep it clean black-on-white. |
| Flux for the circle-the-picture images | Nano Banana 2 only. |
| Left/right-leaning pyramid | Center every line on the column center — that's what makes the triangle. (Section-3 centering bug was fixed in v1.) |

## Delivery Checklist

- [ ] Every word decodable at level or sight word
- [ ] Bottom line = full sentence ending in focus-sound target word + punctuation
- [ ] Pyramids centered, clean triangle
- [ ] Correct mode (pyramid-only vs full worksheet)
- [ ] White bg, no clutter
- [ ] PDF in `content/curriculum/phonics/worksheets/sentence-pyramids/` (the binder — NOT root `output/`)
- [ ] Delivered to Slack, printed if asked
- [ ] Logged to `[[Subjects/Phonics]]` with focus sounds covered