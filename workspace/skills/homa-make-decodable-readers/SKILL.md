---
name: homa-make-decodable-readers
description: Generate personalized decodable readers for the child — illustrated books where EVERY word is either a decodable word at the target phonics level or a known sight word, so the child can read the book himself. Use when asked to create a decodable reader, CVC book, phonics reader, early reader, or any book the child reads independently. Also use when building the next level in the reading progression. NOT for read-aloud picture books (use homa-make-picture-book skill for those).
---

# Decodable Readers

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

> **FILE OUTPUT TO THE BINDER.** The finished PDF MUST be saved under `content/curriculum/<subject>/worksheets/<artifact-name>/` (subject = phonics; e.g. `content/curriculum/phonics/worksheets/`), NOT to root `output/`. The binder is the parent's frontend — root `output/` gets lost in Slack (her #1 pain, transcript 2026-06-28). Pick the subject folder from `content/curriculum/` (art-creative, literacy, math, phonics, science, spanish, social-studies, writing-fine-motor, self-care-independence). Still deliver to Slack + print as asked.

Create illustrated books the child can read *himself*. The critical constraint: **every word must be decodable at his current phonics level or a confirmed sight word.** No exceptions.

## Key Difference from Picture Books

| | Picture Book | Decodable Reader |
|---|---|---|
| **Who reads** | Parent reads to the child | the child reads himself |
| **Vocabulary** | Rich, complex | Strictly controlled |
| **Text size** | 19pt (parent reads) | 28pt (child reads) |
| **Purpose** | Enjoyment, exposure | Reading practice |
| **Word constraint** | None | Every word decodable or sight word |
| **Back matter** | None | Word list (CVC + sight words) |

## Workflow

### 1. Determine the Level

Check the child's current phonics level in `story-profile.json` → `phonics` subdomains. See `references/phonics-levels.md` for the full 6-level progression.

Currently: **Level 1 (CVC)** — all short vowels, consonant-vowel-consonant only.

### 2. Write the story — TEXT FIRST

This is the hardest part. Every word must pass the filter:

- Is it a CVC word at this level? → allowed
- Is it in `references/sight-words.md`? → allowed
- Is it the character's name (the child's name)? → allowed
- Otherwise → **rewrite the sentence**

**Rules:**
- 1-3 short lines per page, 8-10 story pages per book
- Simple narrative arc (problem → action → resolution)
- Use the child's interests (Paw Patrol, monster trucks, rescue missions, animals)
- the child is the main character — he sees himself in the book
- Repetition is good ("ran and ran", "big, big")
- Use dialogue (builds engagement)

**CVC word bank (Level 1 starters):** bat, bed, big, bit, box, bug, bun, bus, but, cab, can, cap, cat, cob, cop, cot, cub, cup, cut, dad, den, did, dig, dim, dip, dog, dot, dug, dun, fan, fat, fed, fig, fin, fit, fix, fog, fox, fun, gap, gas, get, got, gum, gun, gut, had, ham, has, hat, hen, hid, him, hip, his, hit, hog, hop, hot, hub, hug, hum, hut, jab, jam, jet, jig, job, jog, jot, jug, jut, kid, kit, lab, lap, led, leg, let, lid, lip, lit, log, lot, lug, mad, man, map, mat, men, met, mix, mob, mom, mop, mud, mug, nab, nap, net, nip, nod, not, nun, nut, pad, pan, pat, peg, pen, pet, pig, pin, pit, pod, pop, pot, pub, pug, pun, pup, put, rag, ram, ran, rap, rat, red, rib, rid, rig, rim, rip, rob, rod, rot, rug, run, rut, sad, sag, sap, sat, set, sip, sit, six, sob, sod, son, sop, sub, sum, sun, tab, tag, tan, tap, ten, tin, tip, top, tub, tug, van, vat, vet, wag, web, wed, wet, wig, win, wit, won, zip, zit

### 3. Write Image Prompts

Same pipeline as homa-make-picture-book skill:
- Nano Banana 2 (`fal-ai/nano-banana-2`), never Flux
- 16:9 landscape, 1K resolution
- Append style directive + no-text directive to every prompt
- Use the child's character description from `picture-book/references/characters.md`
- Include Biscuit (the Frenchie) when the story calls for a dog

Style directive:
```
cartoon watercolor children's picture book illustration, bright vivid colors, soft rounded shapes, gentle textures, expressive characters, professional children's book art quality
```

No-text directive:
```
Do not include any text, words, letters, titles, or captions in the image
```

### 4. Generate Images

Use `scripts/generate_images.py` as template. Copy to book project dir and customize PAGES.

### 5. Build PDF

Use `scripts/build_pdf.py` as template. Copy to book project dir and customize:
- TITLE, SUBTITLE, LEVEL_LABEL
- PAGES (image filenames + decodable text lines)
- CVC_WORDS and SIGHT_WORDS lists for the back page

Key PDF specs (different from picture books):
- **Text: 28pt** (not 19pt) — large enough for a child to read
- **Dark bar at bottom: 75% opacity** (slightly more opaque for readability)
- **Word list page** at the end showing all CVC and sight words used
- **Level indicator** on cover ("⭐ Level 1: CVC Words ⭐")

### 6. Deliver and Track

- Upload PDF to Slack
- Note the level and word list
- Track in `story-profile.json` which levels have been completed
- Advance to next level only when the parent confirms mastery

## Personalization Hooks

Make every book about the child's world:
- **Paw Patrol**: rescue missions with pups, the child as team leader
- **Monster trucks**: races, jumps, mud, loud sounds
- **Animals**: the child's stuffed animals as characters (Mr Moo, Berry, etc.)
- **Family**: Biscuit the Frenchie, going to the park, home routines
- **Friends**: Sofia, Leo, etc. as characters

## Quality Checks

Before delivering, verify:
1. **Every word** passes the decodable/sight-word filter — no exceptions
2. Text is large and readable in the PDF
3. Images match the text on each page
4. Word list at back is complete and accurate
5. The story arc makes sense and has a satisfying ending
