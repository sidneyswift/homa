# Structured scope and sequence data

Machine-readable curriculum sequences extracted from publisher scope and
sequence documents. This folder is wave 3 seed work: the pattern is proven
on the flagship (Dimensions Math) and scales to other flagship and deep
profiles from here.

## What this is and is not

- Chapter and lesson titles and pacing counts are facts about a
  curriculum's organization, extracted from documents the publisher
  publishes freely for exactly this purpose. That is what lives here.
- Lesson content, objectives text, teaching scripts, and exercises are
  the publisher's expression and never get copied here (see
  `../methodology.md` copyright policy).

## Schema

One YAML file per curriculum, named by profile id. Shape:

```yaml
id: dimensions-math          # matches the profile id in curricula/
name: Dimensions Math
extracted: 2026-07-13
sources:                     # the publisher documents parsed
  - https://...
notes: extraction caveats, normalizations, verification status
levels:
  - level: "2A"              # the publisher's own level naming
    grade: 2                 # US grade anchor per the publisher
    status: lessons          # lessons | chapters | pending
    chapters:
      - n: 1
        title: Numbers to 1,000
        periods: "8-9"       # publisher-suggested class periods, if given
        lessons:             # numbered lessons only, per publisher tables
          - Tens and Ones
          - ...
```

`status` values: `lessons` (chapter and lesson titles extracted and
cross-checked), `chapters` (chapter titles extracted, lessons pending),
`pending` (source linked, extraction not yet trustworthy).

Lesson granularity note: "lessons" means the publisher's numbered lesson
or section titles. Some programs nest lettered sub-parts beneath numbered
sections (Dimensions Math 6-8); sub-parts are not itemized unless a
product need appears.

Flat-structure variant: programs with no chapter layer (Saxon's lesson
1 to 120 ladder, All About Reading's lesson-numbered levels) set
`structure: flat` on the level and carry `lessons` directly:

```yaml
  - level: "Math 5/4"
    grade: 4
    status: lessons
    structure: flat
    lessons:
      - ...
```

Named non-lesson units (Saxon investigations, cumulative reviews) may be
included as entries when the publisher numbers or names them; note the
convention used in the file's `notes`.

Multi-program files: when one atlas profile covers sibling programs (All
About Reading and All About Spelling share `all-about-learning`), one
sequence file covers both, with program-qualified level names ("AAR
Level 1", "AAS Level 1").

## Shared-file rule for extraction agents

Extraction agents write exactly one file: `sequences/<profile-id>.yaml`.
Never edit this README, the coverage table, `backlog.md`, or any other
shared file; report coverage rows in the completion manifest and the
close-out pass updates the table.

## Extraction protocol

1. Prefer the publisher's own scope and sequence PDFs and overview
   documents; scrape via Firecrawl, parse tables, and cross-check between
   independent documents where two exist.
2. Publish only what parses coherently. Multi-column PDF layouts scramble
   text extraction; scrambled levels stay `pending` with the source
   linked rather than being published wrong.
3. Normalize punctuation to repo law: publisher titles that use an em
   dash (for example a title ending in "Part 1" after a dash) are written
   with a comma instead. No other wording changes.
4. Record every caveat in the file's `notes` field. Verify against a
   printed table of contents before any product use.

## Coverage

Validated 2026-07-13 (late night): 11 files, 109 levels, 640 chapters,
5,171 lesson entries, all parsing with zero dash-law violations.

| Curriculum | Status |
|---|---|
| `dimensions-math.yaml` | COMPLETE: all 20 levels (PK-8) at lesson level; 152 chapters, 971 lessons, publisher pacing where published. Cross-checked between the scope charts, all 14 per-level overview PDFs, and independent tables of contents for the levels the scope chart scrambled. |
| `saxon-math.yaml` | PARTIAL by publication: Math 5/4 through Algebra 1 (6 levels) at lesson level, 723 lessons plus 48 investigations, dual-source cross-checked with student-text TOC arbitration; K-3 pending (kit lesson titles unpublished, counts sourced). |
| `math-u-see.yaml` | COMPLETE through Algebra 1: 10 levels at lesson level, 305 lessons; publisher site and store lists matched exactly. Grade anchors are community mappings, not publisher claims. Geometry to Calculus pending. |
| `math-with-confidence.yaml` | PARTIAL by publication: all 8 levels; Preschool at activity level, K-2 at week level (32 weeks per grade), 3-6 at unit level (titles only in printed unit intros). |
| `simply-good-and-beautiful-math.yaml` | COMPLETE: 9 levels (Math K through Pre-Algebra) at lesson level, 1,080 numbered lessons; double-parser verified against publisher sample TOCs; per-level edition register in notes. |
| `all-about-learning.yaml` | COMPLETE: both programs (AAR Pre-reading plus 1-4, AAS 1-7), 12 levels at lesson level, 517 lessons/steps; scope PDFs, manual TOCs, and product counts all agree. |
| `the-good-and-the-beautiful-language-arts.yaml` | PARTIAL: Levels K-3 at lesson level (480 lessons), 4-6 at unit level (TOCs print bare lesson numbers), Level 8 book studies at chapter level; Level 7 pending (old edition withdrawn 2026-06-19 ahead of the July replacement). |
| `story-of-the-world.yaml` | COMPLETE: all 4 volumes at chapter and section level, 168 chapters, 359 sections, publisher TOCs cross-checked; 25th Anniversary edition caveats in notes. |
| `mystery-of-history.yaml` | COMPLETE: all 4 volumes at lesson level, 360 lessons in publisher quarters; volume II quarter-naming caveat in notes. |
| `apologia.yaml` | COMPLETE elementary / PARTIAL upper: all 8 Young Explorer courses at lesson level (112 lessons), 6 middle/high courses at module level (93 modules); advanced electives pending. |
| `mystery-science.yaml` | COMPLETE: K-5 as current-site units and Mysteries (32 units, 137 Mysteries); 2019 NGSS planning guide as structural cross-check; site reorganization caveats in notes. |

## Roadmap

The first eleven programs are extracted (see coverage). Next candidates,
in atlas-priority order: Teaching Textbooks, Beast Academy, Math
Mammoth, IEW's core units, Logic of English, Explode the Code, Notgrass,
BJU and Abeka course structures, plus the pending levels above as
publishers publish them. The wave 3 goal in `../backlog.md` is mapping
these sequences onto `packages/taxonomy/` skill nodes so a family's "we
finished 2A" resolves to skill states; the first crosswalk seed lives in
`crosswalks/`.
