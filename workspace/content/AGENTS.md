# content/ — filing rules (the child's schoolwork, organized for Homa)

`content/` is **Homa's store** for the homeschool — organized the way Homa needs to find and reuse
things, NOT a mirror of the parent's Obsidian. The Obsidian vault is a *rendered view* (the parent's
"binder"); it shows her the curriculum + worksheets and nothing she doesn't use. The spine (`scripts/`,
`skills/`, `children/<child>.json`, state, `memory/`…) is Homa's machinery — never in `content/`.

**Ground truth (how the parent actually works):** she works **curriculum-first**. A curriculum = a *book
she bought* (e.g. Art Everywhere, Dimensions Math, HWT, Hegerty Phonics, Science Fusion, Social Studies)
OR something Homa researched. The book presents the *subject*; the parent builds the *day-to-day* by
supplementing (Pinterest, Instagram educators, recreating Teachers Pay Teachers worksheets). **She opens
Obsidian only for curriculum, and wants the worksheets right there with it.** Her #1 pain: she can't find
the worksheets Homa makes. So: **every worksheet files with its curriculum.**

## The two halves (this is the multi-kid backbone)

- **`curriculum/` = the LIBRARY — compounds, shared across kids.** Built once, reused for the next child.
- **`learners/<child>/` = the CURSOR — flows, per child.** Where each kid is + how each kid learns.

```
content/
  curriculum/<subject>/          ← by subject (kebab-case; align to benchmark slugs where they map)
    README.md                    ← which book is in use, what it covers, current position notes
    source/                      ← the book's ToC photo, page transcripts, research ("what it presents")
    worksheets/                  ← EVERY worksheet/material built for it — kept, reusable for kid #2
  learners/
    <child>/  README.md (cursor) + what-works.md (how they learn — READ before suggesting)
    _TEMPLATE/                   ← copy to onboard a second child
  sources/                       ← raw captures: ToC photos, TPT/Pinterest screenshots, lesson transcripts
  fun/                           ← delight-first: books/coloring/rewards (not tied to a subject)
  compliance/                    ← state-report capture (dormant; assembled when the child reaches compulsory age)
  finance/                       ← curriculum spend (stub until a real receipt)
```

## Filing decision tree — answer in order, first match wins

1. **A worksheet / learning material you built for a subject?**
   → `content/curriculum/<subject>/worksheets/<artifact>/`. **This is the #1 rule** (worksheet
   findability — the parent's top complaint). Deliverable PDFs there **auto-sync to her Obsidian binder**
   (into `Curriculum/<tab>/Worksheets/`, on her phone) via `scripts/sync-worksheets-to-vault.py` in the
   `regenerate_vault.py` pipeline — but only ≤5MB + recent (Sync limits), so keep the printable PDF
   small and put big image intermediates in a skipped subdir (`images/`). Group multi-filetype together;
   current cut + `versions/` for old ones (never a `-v2/` folder).
2. **A curriculum's own material** (ToC photo, transcribed pages, the book's research/plan)?
   → `content/curriculum/<subject>/source/`.
3. **Where a child *is*, or *how a child learns*?**
   → `content/learners/<child>/` (`README.md` cursor / `what-works.md` model). Label by the child's
   **year/pace, never grade level.**
4. **Raw inbound** (voice note, ToC photo, TPT/Pinterest screenshot, lesson recording/transcript)?
   → `content/sources/<type>/<YYYY-MM-DD-topic>/` — immutable; never edit, only reference/derive.
5. **Delight-first** (birthday/holiday book, character coloring, reward chart), not advancing a subject?
   → `content/fun/<books|coloring|rewards>/`.
6. **Compliance** (the "what we did + hours" log) → `content/compliance/` (capture now, surface at
   compulsory age). **Money** → `content/finance/<year>/` (only once a real amount needs a home).
7. **Code / shared asset / Homa state** → it is **SPINE**, stays in `scripts/`/`fonts/`/state/`memory/`.
   Not `content/`.
8. **Novel / none of the above?** Don't invent a top-level folder — park it in the closest tier and log
   the friction in `operations/roadmap.md`. New folders are earned by the **two-strike rule** below.

## Read `what-works.md` before you suggest

Before Homa suggests an activity, builds a worksheet, or researches for a child, **read
`content/learners/<child>/what-works.md`** and tailor to it. The parent's complaint is that Homa picks the
*obvious* suggestion; the model is how Homa picks the one the child will actually sit down for. Every
👍/👎 the parent gives and every lesson transcript updates the model.

## Anti-clutter law (so we never ask "why is this messy?" again)
- **Nothing loose at the workspace root** except the spine (doctor `check_root_hygiene`).
- **Two-strike rule:** one artifact never earns a new folder; the *second* of a kind does. New top-level
  folders are proposed by `homa-system-reflect` from recurring roadmap entries, declared here first.
- **Lazy subjects:** a `curriculum/<subject>/` folder is created the first time a real artifact for it
  exists — not pre-scaffolded.
- **Versioning is never a `-v2/` sibling folder** — one folder + a `versions/` subfolder. Curriculum
  progression (Art 1 → Art 2 at the child's pace) is the *next book* in `curriculum/<subject>/`, tracked
  by the learner cursor — not a version pile. Doctor flags any `<x>` + `<x>-v2` pair.
