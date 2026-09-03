# Held recipe drafts (materials-studio recipes wave 1, 2026-09-02)

Three drafts from the wave 1 judge rounds did not land in the skill. Each
survived every other round but kept one blocking geometry contradiction,
quoted below from the last judge verdict. The files here are the staged
drafts byte for byte, plus the staging lane's landing notes
(`*.landing.md`) where one existed, so the next lander starts from the
judged text instead of a rewrite. Nothing in this directory is read by
the skill, its checks, or the recipe registry.

| Draft | Files | Tracker |
| --- | --- | --- |
| Coloring page | `coloring-page.md`, `coloring-page.variants.md`, `coloring-page.landing.md` | gh#1070 |
| Reference poster | `reference-poster.md`, `reference-poster.variants.md` | gh#1071 |
| Picture pattern and sequence (variant of cut-and-paste-word-work) | `cut-and-paste-word-work.variant-picture-pattern-and-sequence.md`, `picture-pattern-and-sequence.variants.md`, `picture-pattern-and-sequence.landing.md` | gh#1072 |

## The blocking problem, per draft (judge text, last round)

### coloring-page (score 7, gh#1070)

> Subject-size floors, supporting-object minimums, and placements are not
> simultaneously satisfiable as written, and the quality gate then
> punishes the model's natural resolution. Arithmetic: with a caption the
> art zone is 1344 px; the subject must span >= 6/7 x 1344 = 1152 px tall
> and >= 4/5 x 1024 = 819 px wide, leaving at most a 192 px top band and
> ~102 px side strips (1024 - 819 = 205 total). When a ground line sits in
> the bottom tenth (y >= 1382) and the subject stands on it, the subject's
> top reaches y <= 1382 - 1152 = 230, so the band above it is <= 38 px.
> Yet ages 2-3 require 1 or 2 supporting objects each >= 243 px (worked
> object prompt: >= 256 px, 'at the top right' and 'at the top left'), and
> the scene worked prompt places a sun, two clouds, and a bush around a
> puppy that also 'runs to the bottom edge'. None of those fit the free
> strips, so the model must either overlap the subject's bounding box (the
> recipe never says supporting objects may sit in the subject's empty
> corners or be partly hidden behind it) or shrink the subject, which the
> gate rejects as a failed composition, sending Homa into the
> regenerate-then-ask-the-parent loop the recipe exists to avoid. Fix:
> state explicitly that supporting objects occupy the empty corners of the
> subject's bounding box or may overlap/peek behind the subject, or lower
> the height floor (about 3/4 of the art zone when N >= 2) and recompute
> the stated px/in numbers (coloring-page.md lines 69-76, 100-108;
> coloring-page.variants.md lines 143-163).

### reference-poster (score 6, gh#1071)

> Short facts break the recipe's own gate with no rule to resolve it. The
> ladder fixes type per rung (34px at 3 facts), 'Scale to the bottom' says
> type is set so facts written TO THEIR CAP end within 0.5in of the band's
> bottom, and the quality gate requires 'no dead band'. But the recipe
> itself names 'a toddler poster whose three facts are a label and a word
> each' as a supported hybrid poster. Arithmetic at the 3-fact rung: three
> one-line facts = 3 x 44.2px + 2 x 10px + 12px = 164.6px of the 316.8px
> band, leaving 152.2px (1.58in) of dead band, three times the gate's
> 0.5in. 'Size is a floor, not a target' forbids shrinking and 'type size
> ... from the ladder, never from habit' forbids deviating, so Homa has no
> sanctioned move (grow the type? add facts? shorten the band?) and must
> invent one. Either state a rule for facts shorter than cap-minus-one
> (e.g. raise the rung's type until the last fact lands within 0.5in, the
> illustration never shrinking) or remove the label-and-a-word toddler
> example and require facts near the cap.

### cut-and-paste-word-work.variant-picture-pattern-and-sequence (score 6, gh#1072)

> The `pattern` page's binding geometry leaves a dead band the skill
> forbids. The recipe pins every dimension (1.25in cells, 1.375in gap, 22px
> row margins, exactly three rows, 'never a fourth pattern row', no
> scale-up rule) and its own arithmetic lands at 738.5px of the 912px
> (9.5in) box: 173.5px, about 1.8in or 19 percent of the printable height,
> empty at the bottom. SKILL.md's binding design rule (founder ruling
> 2026-07-29, worksheet-scale-to-fill) says blank space at the bottom is
> items or row spacing that should have been scaled until content reaches
> the bottom. The recipe's 'Fill the sheet with bigger pieces, never more'
> cannot be honored either: the 7.3in width caps a four-cells-plus-gap row
> at about 1.33in cells (4c + 1.1c + 0.5in = 7.3in), which still stops
> near 7.9in tall. Homa following the recipe as written builds a page the
> skill's own law and the co-founder complaint behind it call defective,
> or must invent a fix (larger row margins, a 'try this together' box, a
> scaled strip) the recipe never authorizes. State how the pattern page
> reaches the bottom (for example row margins sized to fill, or the
> optional try-this-together box the SKILL.md design rules already permit)
> and redo the height arithmetic in the sibling.

## Landing one of these later

Fix the blocking problem in the draft, get a passing judge round, then
follow the same steps wave 1 used: copy the recipe and its `.variants.md`
sibling into `apps/web/agent/skills/materials-studio/references/recipes/`,
add its Format library row to the materials-studio `SKILL.md` (the row's
second cell must name the `<name>.variants` slug or `pnpm check:fleet-skills`
reports the sibling as an orphan), add or update its
`apps/web/agent/activity-formats.md` entry, land its anchor
(`apps/web/lib/materials/anchor-sources/<slug>.jpg`, a REGISTRY entry in
`apps/web/lib/materials/anchors.ts`, `pnpm build:material-anchors`), and
run `pnpm check:fleet-skills`, `pnpm check:materials`, and
`pnpm build:recipe-registry --check`. The `*.landing.md` notes carry each
draft's specific rows and base-recipe edits. Close the issue from the PR.
