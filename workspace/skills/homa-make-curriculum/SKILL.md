---
name: homa-make-curriculum
description: Build curriculum lesson plans from textbook pages or topic requests. Use when the parent sends textbook photos to transcribe, asks for lesson plans, requests a scope & sequence, or wants curriculum built around a subject. Also use when adding artists, images, or visual references to lessons. Covers full workflow from textbook transcription → lesson plan creation → artist/image sourcing → Obsidian vault storage.
---

# Curriculum Builder

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

Build structured, visual-first lesson plans for the child's homeschool curriculum.

## Core Workflow

1. **Receive input** — textbook photos, topic request, or scope/sequence outline
2. **Transcribe** — if textbook pages, transcribe content to Obsidian `Curriculum/<Subject>/`
3. **Build lesson plans** — structured lessons with Look & Talk, activities, materials
4. **Source visuals** — find artwork/image links for every referenced artist or concept
5. **Save to vault** — all files go to `~/Documents/the Obsidian vault/Curriculum/<Subject>/`

## Transcription Rules

When the parent sends textbook photos:
- Transcribe ALL text content faithfully — vocabulary, activities, featured artworks, page numbers
- Preserve the textbook's lesson structure (lesson numbers, page ranges)
- Note featured artists and artworks by name
- Add a teaching notes section at the bottom with child-specific adaptations

## Lesson Plan Structure

Each lesson follows this format:

```markdown
## Lesson N: Title
**Textbook pp. XX–YY | Element/Concept: NAME | Vocabulary: terms**

### Look & Talk (5 min)
[Artist entries with links — see Visual References below]

**Conversation starters:**
- [2-3 open-ended questions for the parent to ask the child]

### Make Art (15–20 min)
**Option A — [Name] (kinesthetic):**
[Steps]

**Option B — [Name] (textbook activity):**
[Steps]

### Materials
- [Bulleted list]
```

### Key Principles

- **Multiple activity options per lesson** — the parent picks based on the child's mood/energy
- **Kinesthetic options first** — the child learns best through movement and hands-on
- **15-20 min activities max** — match the child's attention span
- **Skip written work** — do verbally at age 3.5 (detail webs, vocabulary checks, reflections)
- **Thick markers/oil pastels over crayons** — easier grip for fine motor development
- **Connect to the child's interests** — Paw Patrol, insects, animals, Mondrian, monster trucks, space

## Visual References — CRITICAL

the child is a visual learner. Every lesson plan MUST include clickable links to artwork images.

### Artist Entry Format

Do NOT use tables for artist entries. Use this format:

```markdown
**Artist Name** — *Work Title* — One-line description of what to notice
🔗 [Museum/Gallery Name](https://direct-url-to-artwork-page)
```

### Image Sourcing Rules

1. **Always link to museum/gallery collection pages** — these show the artwork image front and center and are stable URLs
2. **Preferred sources (in order):**
   - Museum collection pages (MoMA, Met, Guggenheim, Whitney, The Broad, LACMA, SFMOMA, Smithsonian)
   - Artist foundation/estate websites
   - Smarthistory (great analysis + images)
   - Artist's own website
   - Gallery representation pages (Gagosian, Hauser & Wirth, David Kordansky, Pace, Lisson)
   - Wikimedia Commons (for public domain works)
   - WikiArt (good fallback for older works)
3. **Never use** Google Images links, Pinterest, or social media
4. **VERIFY EVERY LINK IN A REAL BROWSER** — open each URL with the browser tool and confirm the correct artwork/artist appears. `curl` is NOT sufficient (many museums return 200 for wrong content or use JS rendering). Visually confirm: does the page show the CORRECT artist and artwork? A link to the wrong artist's work is worse than no link at all. 404s and mismatched content are unacceptable.
5. **Test mental model:** "Will this link show the artwork when the parent taps it on her phone?" If yes, use it.
6. **Multiple links per artist are fine** — especially when different works appear at different museums
7. **Wikipedia is a reliable fallback** — if a museum URL can't be verified, use the Wikipedia article for the artwork or artist. It always has images and always works.

### Artist Selection — the parent's Preferences

Go beyond textbook artists. Include a broad range across:
- **Contemporary** — artists showing in NYC and LA galleries RIGHT NOW
- **Modern / Post-war / Postmodern** — the canon plus underrepresented voices
- **Street art / industrial / installation** — living art in those cities
- **Diversity** — not just dead European men. Represent gender, race, nationality, medium
- **NYC/LA bias** — heavy focus on artists popular in New York City and Los Angeles currently

For each element/concept being taught, pair the textbook artist(s) with 2-4 contemporary artists whose work demonstrates the same concept.

### Artist Gallery Page

For any unit with 10+ artists, create a separate `Unit-N-Artist-Gallery.md` with ALL artwork links organized by lesson. This serves as the parent's phone-friendly reference during teaching.

## Create Dedicated Gallery File

When a unit has many artists, create:

```markdown
# Unit N: Artist Gallery — [Theme]

Tap any link to see the artwork. Show these to the child during Look & Talk time.

---

## Lesson N: [Title]

### Artist Name — *Work Title*
Description
🔗 [Museum](url)

---

## How to Use This Page
1. Open on your phone during Look & Talk time
2. Tap the 🔗 links to show the child each artwork
3. Pick 2-3 per lesson — don't need to show all
```

## Vault Organization

All curriculum files go to `~/Documents/the Obsidian vault/Curriculum/<Subject>/`:

```
Curriculum/
├── Art-Everywhere/
│   ├── Table-of-Contents.md
│   ├── Unit-1-Line-and-Shape.md      (textbook transcription)
│   ├── Unit-1-Lesson-Plans.md         (full lesson plans)
│   └── Unit-1-Artist-Gallery.md       (clickable image links)
├── Dimensions-Math-PKA/
├── Hegg-Phonics/
├── HWT/
├── Science-Fusion/
└── ...
```

Naming: `Table-of-Contents.md`, `Unit-N-[Topic].md`, `Unit-N-Lesson-Plans.md`, `Unit-N-Artist-Gallery.md`

## Adapting for the child (Age 3.5)

See `references/story-adaptations.md` for age-specific modifications. Key points:
- Written activities → verbal
- Fine motor challenges → gross motor alternatives
- Abstract concepts → concrete/physical examples
- Reading comprehension → picture-based discussion
- Assessment → verbal vocabulary checks, portfolio photos
