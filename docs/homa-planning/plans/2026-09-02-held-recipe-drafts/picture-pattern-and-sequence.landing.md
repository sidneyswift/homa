# Picture pattern and sequence: landing edits

Staged beside `cut-and-paste-word-work.variant-picture-pattern-and-sequence.md`.
None of these lines belongs inside the variant section; each is a small
edit to an existing file, applied in the same landing commit so the base
recipe stays consistent with its new variant and a picture request can
route to it at all. Delete the closing pointer paragraph of the variant
file when these land.

## `references/recipes/cut-and-paste-word-work.md` (base recipe)

- Append the variant section as `## Variant: picture pattern and sequence`
  at the end of the file.
- Replace the sentence `Always html path.` with
  `Always html path for the word form (the picture variant below adds hybrid).`
- Replace the sentence `Path choice: html, always.` with
  `Path choice for the word form: html, always.`
- Both replacements land in the same commit as the appended section:
  without them the base recipe says html always while its own variant
  says hybrid, and the file contradicts itself.

## `references/recipes/picture-pattern-and-sequence.variants.md`

Lands as a new sibling file. `pnpm check:fleet-skills`
(`scripts/fleet-skills-check.mts`) fails on any `references/` file whose
basename slug never appears in SKILL.md, so SKILL.md must contain the
string `picture-pattern-and-sequence.variants`; the Format library row
below carries it.

## `SKILL.md`, Format library row for cut-and-paste-word-work

Replace the row
`| Cut-and-paste word work | reinforce one word four ways (see, write, cut, paste); early phonics | cut-and-paste-word-work |`
with
`| Cut-and-paste word work | reinforce one word four ways (see, write, cut, paste), or glue wordless picture pieces into an AB pattern or a numbered sequence (variant rules in picture-pattern-and-sequence.variants) | cut-and-paste-word-work |`

## `apps/web/agent/activity-formats.md`, `### cut-and-paste` entry

- Append to **What it is:** `The picture variant drops the words: wordless
  picture or shape pieces glued into AB pattern rows or numbered sequence
  slots (planets, lifecycles, seasons).`
- Append to **Best for:** `AB patterns and science ordering for
  pre-readers.`
- Change **Ages:** to `4-10 (word form 4-8; picture pattern 4-7; picture
  sequence 4-10).`
- Change **Creation path:** to `html for the word form and CSS-shape
  patterns; hybrid for themed patterns and picture sequences (one
  landscape composed piece sheet under an HTML 3 x 2 cut grid).`

## `references/recipes/classification-sorting-mat.md`

Append one sentence to the opening paragraph, after "Designed for
lamination and reuse with cut-out manipulatives.":
`It works glued as a one-and-done page too: a sort into labeled boxes (hot/cold, up/down, living/nonliving) is this mat whether the parent says laminate or glue.`
