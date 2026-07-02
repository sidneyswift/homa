---
name: homa-track-syllabus
description: Generate and maintain the parent's Charlotte Mason co-op syllabus — one fillable submission per subject she teaches (phonics, science & nature, sensory, etc.), drawn from the 22-week co-op curriculum we already built. Use when the co-op asks for a syllabus, the parent says "help me fill out the syllabus/forms," a co-op subject is added or changed, or the curriculum is revised and the syllabus needs to re-sync. Outputs a clean Google Doc (editable on her phone) + a printable PDF.
---

# Co-op Syllabus Builder & Maintainer

The parent teaches at a Charlotte Mason homeschool co-op. The co-op periodically asks her to
**submit a syllabus** — one per subject she teaches. We already built the full **22-week co-op
curriculum** together; this skill turns that into the submission they want, and keeps it in sync
when the curriculum changes. It does the assembling so the parent just reviews and submits.

**Grounding:** the parent, 2026-06-26 voice note — "the co-op emailed asking me to submit my
syllabus… a form for each co-op subject I'm teaching: phonics in the morning, then science &
nature, then sensory, maybe a couple more. Can you help me fill out the forms and reference the
co-op curriculum we built together?"

## Quick Reference

- **Source of truth (the curriculum we built):** `content/curriculum/co-op/22-week-*-curriculum.md`
  - `22-week-master-curriculum.md` — combined weekly schedule + block structure (use for the day plan)
  - `22-week-literacy-curriculum.md` — **phonics** (letter sequence, sensory rotation, materials)
  - `22-week-science-curriculum.md` — **science & nature** + the **sensory** science block
  - `22-week-art-curriculum.md` — art (if she lists art as a subject)
- **Subjects the parent teaches** (from the voice note): **phonics** (morning), **science & nature**,
  **sensory** — "maybe a couple more." Always confirm the live list with the parent before generating.
- **Per-subject field map / template:** `references/syllabus-template.md`
- **Subject → curriculum source map:** `references/subject-source-map.md`
- **Output:** one Google Doc per subject (editable on her phone) + a combined printable PDF.
  Build the PDF with `scripts/build-syllabus-pdf.py`.

## Workflow

### 1. Confirm the subject list + the form's fields
- Ask the parent which subjects she's submitting this round (phonics / science & nature / sensory / + any).
- If the co-op sent an actual **form** (PDF/Google Form/attachment), read its real fields first and map
  to those exactly — the field list in `references/syllabus-template.md` is the fallback when we
  don't have their form. The CM emphasis is **living books, narration, nature study, short lessons,
  habit training** — frame every subject in that language (it's their rubric).

### 2. Pull the content per subject from the curriculum we built
For each subject, open its source file (see the source map) and extract:
- **Course description** (2–4 sentences, CM-flavored)
- **Aims / goals** for a mixed 3–4yo group
- **Scope & sequence** — the 22-week arc, condensed to a readable table or bullet list
- **Weekly structure / time blocks** (from the master curriculum)
- **Materials** (from each curriculum's materials list)
- **Books / living books** used (CM cares about this — list real titles)
- **Assessment / narration approach** (CM = oral narration + observation, not testing)

Do NOT invent content the curriculum doesn't have. If a field has no source, mark it
`[parent to confirm]` rather than fabricating.

### 3. Emit the deliverables
- **Google Doc per subject** (so the parent edits/submits from her phone):
  `gog docs create "Co-op Syllabus — <Subject> (the child's co-op, <term>)" -a {{PARENT_EMAIL}}`
  then insert the assembled sections. One doc per subject = one form per subject.
- **Combined PDF** for printing / a single attachment:
  `python3 scripts/build-syllabus-pdf.py` (reads the assembled markdown in
  `output/syllabus/<subject>.md`, writes `output/syllabus/coop-syllabus-<term>.pdf`).
- Tell the parent exactly which doc maps to which form, and what (if anything) she needs to confirm.

### 4. Maintain (the "track" half)
- When the **co-op curriculum changes** (a letter sequence tweak, a new science theme, an added
  subject), re-run the affected subject and update its Doc + the PDF. Note the change in the doc's
  header (`Updated YYYY-MM-DD`).
- When the parent **adds/drops a subject**, add/remove its Doc and re-emit the combined PDF.
- Log a one-liner to the Obsidian co-op page so the submission history is durable.

## Rules / gotchas
- **Confirm the subject list and the real form fields with the parent before submitting anything** — never
  auto-submit a form on her behalf (outward action). Build the Doc/PDF ready; she submits.
- **CM framing is the rubric.** Living books (real titles), oral narration, nature study, short
  lessons (15–20 min for this age), habit training. Don't write it like a public-school standards doc.
- **`gog docs` title is positional**, not a flag. **No `gog sheets create`** if a roster sheet is ever
  needed — upload a CSV with `--convert-to sheet` (see `homa-google-sheets`).
- Source content from `content/curriculum/co-op/22-week-*-curriculum.md` only; mark unknowns `[parent to confirm]`.
- This is co-op *content* — surface drafts and let the parent own the final wording; don't silently rewrite
  the curriculum here.

Added 2026-06-27 (homa-system-reflect, Lens B) — grounded in the parent's 2026-06-26 syllabus-help request;
curriculum source files already existed, so this was assembly + maintenance, not new curriculum.
