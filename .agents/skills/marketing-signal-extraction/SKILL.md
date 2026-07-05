---
name: marketing-signal-extraction
description: Turn one raw marketing source file (field notes, keyword export, planning-doc excerpt in marketing/raw/) into atomic, sourced signal files in marketing/signals/, one idea per file with quotable provenance and anonymization. Use when new raw material lands or the founder says "extract signals". NOT for inventing ideas without a raw source (marketing-idea-generator does that) and NOT for drafting content (marketing-demand-engine).
---

# Marketing signal extraction

The prep cook of the pipeline: raw material in, labeled single-idea containers
out. Drafting never reads `raw/` directly; it shops from `signals/`.

## Procedure

1. Read `marketing/AGENTS.md` (the laws) if not already in context.
2. Read the one raw file you were pointed at in `marketing/raw/`.
3. **Anonymize as you read.** Real names of moms or kids become roles: "a mom of
   three at the conference", "her 6-year-old". If a detail could identify a
   family (a town + kid count + story), blur it to the role level.
4. Split the file into atomic ideas. Atomic means: one hook, one claim, one
   piece of evidence. A paragraph with two insights becomes two signals.
5. Dedup before writing: skim existing `marketing/signals/` hooks (every
   status). Same idea already captured = skip it, do not write a twin.
6. For each new idea, write `marketing/signals/<yyyy-mm-dd>-<kebab-hook>.md`:

```yaml
id: 2026-07-08-moms-fear-gaps-not-curriculum
type: insight            # insight | content-idea | seo-keyword | market-signal | engagement
hook: "Moms don't fear the curriculum, they fear invisible gaps."
formats: [article, video]   # which lanes this could feed
source:
  type: field-note       # field-note | planning-doc | keyword-research | engagement-report
  ref: marketing/raw/2026-07-06-conference-prep-notes.md
  locator: "L41-52"      # verbatim quote or line range, never a paraphrase
status: new              # new -> queued -> used -> archived (or evergreen)
used_by: null
```

   Below the frontmatter: 2 to 5 lines of context, including the verbatim quote
   the locator points at.
7. Report what was written and what was skipped as duplicate.

## Rules that make signals trustworthy

- `source.ref` must be a real file in this repo; `locator` must let a reader
  find the exact words. A signal you cannot source does not get written. This
  is what makes unattended drafting safe later.
- One file, one idea. Never a batch document.
- `status: new` always; only the orchestrator moves statuses.
- Mark `evergreen` only for ideas that stay true forever (positioning truths),
  not seasonal or newsy ones.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish. No source, no signal. No family data: banned paths
(`homa-macmini/`, `homa-research/`, `homa-template/`) are never sources, real
names never survive extraction. Voice per `marketing/voice/house-style.md`.
