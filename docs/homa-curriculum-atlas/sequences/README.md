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

| Curriculum | Status |
|---|---|
| `dimensions-math.yaml` | Grade 2 at lesson level; grades 6-8 at chapter level; PK-1 and 3-5 pending (source PDFs linked) |

## Roadmap

Next extractions, in atlas-priority order: Saxon (placement-banded
lesson lists), Math with Confidence, All About Reading levels, Story of
the World chapter lists, TGTB language arts levels. The wave 3 goal in
`../backlog.md` is mapping these sequences onto `packages/taxonomy/`
skill nodes so a family's "we finished 2A" resolves to skill states.
