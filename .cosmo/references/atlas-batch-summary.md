# Atlas Batch Ingestion Summary

**Date:** 2026-07-17
**Source:** Atlas curriculum publisher scrape
**Total references created:** 33

## Breakdown by Publisher

| Publisher | Count | Subjects | Grade Range |
|-----------|-------|----------|-------------|
| Beast Academy (AoPS) | 17 | Math | 2-5 |
| Dimensions Math (Singapore Math Inc.) | 11 | Math | PreK-5 |
| All About Learning | 1 | English (reading readiness) | PreK-K |
| Oak Meadow | 4 | Art (unmapped) | High School |

## Taxonomy Gaps

### Unmapped Subjects
- **Art** — not in taxonomy (Computing, English, History, Learning to Learn, Life Skills, Mathematics, Personal & Social Development, Science). All 4 Oak Meadow coursebooks target art disciplines (drawing, painting, photography, integrated drawing).

### Unmapped Skills
- `maze-angle-tracing` — navigating mazes by classifying angles (BA 3A)
- `fraction-link-chain` — connecting equivalent fractions in chains (BA 3D)
- `spatial-decomposition` — decomposing/recomposing shapes from fragments (BA 3D)
- `hive-constraint-puzzle` — hexagonal grid puzzles with adjacency constraints (BA 4B, 5A)
- `fraction-maze` — maze navigation via fraction comparison (BA 4C)
- `decimal-path-tracing` — ordering decimals on hex paths (BA 4D)
- `product-path-puzzle` — finding paths with increasing products (BA hive variants)
- `averatile-constraint-puzzle` — tessellation puzzles with averaging constraints (BA 5B)
- `comparing-attributes` — pre-math comparison of object properties (DM WPKA)

## Recipe Gaps (formats materials-studio can't produce)

### Novel Puzzle Types from Beast Academy
| Gap | Description | Closest Existing |
|-----|-------------|-----------------|
| cross-number-puzzle | Grid-based puzzles with row+column sum constraints | themed-worksheet |
| hive-puzzle / hexagonal-grid | Hexagonal tessellation with adjacency rules | none |
| fraction-link-puzzle | Chain puzzles connecting equivalent fractions | none |
| fragment-puzzle / spatial | Shape decomposition/composition puzzles | none |
| angle-maze | Maze where path depends on angle classification | maze-practice |
| decimal-path-puzzle | Hex grid path ordering by decimal value | none |
| averatile-puzzle | Squares+triangles with averaging constraints | none |
| manipulative-cutout | Physical cut-out pieces for hands-on proof | cut-and-paste |

### Format Gaps from Other Publishers
| Gap | Description | Source |
|-----|-------------|--------|
| checklist/assessment | Parent-facing readiness checklist with checkboxes | AAL Reading Readiness |
| art-lesson/studio-project | Progressive lesson-based studio art courses | Oak Meadow |
| photography-lesson | Technology-dependent art instruction | Oak Meadow Photography |

**Only 3 of 12 existing recipes matched Beast Academy** (themed-worksheet, maze-practice, cut-and-paste). Singapore Math workbooks matched 6 recipes (themed-worksheet, structured-outline, counting-mat, flash-cards, notes-and-practice-bundle, cut-and-paste).

## Key Design Patterns Discovered

### Beast Academy
- **All black-and-white, minimalist** — no color needed, light ink density
- **No characters on worksheets** — despite BA's cartoon monster brand, practice sheets are neutral/clean
- **Puzzle-heavy** — 11/17 are novel puzzle formats, not standard drill
- **Hexagonal grids recur** across grades 2-5 (hive puzzles, decimal paths, product paths)
- **Cross-number grids** appear at both grade 2 and 4 (with negatives added)
- **Low scaffolding on puzzles** — rules stated once, then pure practice
- **High scaffolding on drill** — guided algorithm steps for multiplication/division

### Dimensions Math (Singapore Math)
- **CPA progression** (Concrete → Pictorial → Abstract): PreK/K = full-color manipulatives; Grade 1-2 = grayscale pictorial; Grade 3-5 = mostly abstract
- **3-tier scaffolding**: Basics (guided) → Practice (independent) → Challenge (extension) on every topic
- **Number bonds**: Signature visual scaffold used K through Grade 2
- **Color cliff**: PreK/K = full color; Grade 1+ = entirely grayscale/B&W
- **Decreasing white space**: ~55% at PreK → ~30% at Grade 5
- **No character-driven theming**: Illustrations serve the math (counting objects, base-10 blocks), not decoration

### All About Learning
- **Parent-facing assessment** — checklist format with bold headers and checkboxes
- **Very airy layout** — designed for quick parent scanning, not child interaction

### Oak Meadow
- **Consistent minimalist design** — dark red titles, tree logo, text-heavy instruction
- **Progressive skill-building** with portfolio/final project culmination
- **All high school level** — 18-36 lessons per course

## Errors or Issues
- None. All 33 PDFs processed successfully.
- Page images were available for all PDFs in the pages/ subdirectories.
