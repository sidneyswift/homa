# Name tracing page

Use for a whole name or short word on writing guides. Individual letters
in curriculum formation boxes belong to `letter-number-formation-practice`.
Read the family's source when she names one; do not imply this profile is
that curriculum's official handwriting or a stroke-order lesson.

## Build from the exact spelling

Keep the parent's spelling and case. For a correction, preserve the rest
of the page and its original sources. The tool supports A-Z, a-z, space,
straight apostrophe, hyphen, and À à È è, supplied as exact NFC text.
It refuses other characters and decomposed spellings. Never remove an
accent, substitute a letter, capitalize a name, or draw a manual tracing
row to bypass that refusal. Explain the limit and offer a different
activity that keeps her child's name intact; ask before changing the task.

Use `create_printable` with `recipe: "name-tracing-page"` and fresh HTML.
Put a `handwritingRows` array beside that HTML, including inside a `pages`
entry. For each declared ID, place exactly one comment:
`<!-- homa:handwriting row-id -->`. Fresh IDs must be unique across the packet. Saved rows keep their original
IDs and are identified by page when they are carried. The tool creates the outlines, guides and receipt.
Do not copy its expanded markup back as fresh HTML.

Each row declares:

- `text`: the literal name or word. Independent rows require `""`.
- `style`: `model` for a dark example, `dotted` for dotted outlines,
  `pale` for tracing over pale letters, or `independent` for empty guides.
- `capHeight`: top guide to baseline, 64 through 128 CSS px. There are
  96 CSS px to a printed inch. The complete row is 1.9375 times this
  height to leave room for accents and descenders.
- `width`: 240 through 700 CSS px, default 700.

Choose the amount of practice and support from this child's evidence.
A model followed by dotted or pale support and an empty row is one useful
progression, not a fixed worksheet. Dots follow the outline; they do not
show where to start or which stroke comes next. Do not add starting dots,
arrows, or claims of stroke order to this profile.

For example, one row in the array can be
`{ "id": "amalia-pale", "text": "Amalia", "style": "pale", "capHeight": 96, "width": 700 }`.
Its HTML location is `<!-- homa:handwriting amalia-pale -->`.
The model still designs the title, directions, page rhythm and any art.
If you generate art, pass `anchorIds: ["name-tracing-page"]` for the
format reference, keeping the child's actual spelling and the measured
rows authoritative when the reference differs.

## Fit the practice to the paper

Budget the complete row height, spacing, title and directions inside the
printable shell. Give rows distinct space. A 96 px cap height makes a
186 px row, so seven such rows cannot fit on one letter page. Use fewer
rows or another page instead of squeezing the name. For a short name,
you may repeat the exact spelling separated by a space when the whole
literal row fits, or choose a shorter writing row. Do not spread glyphs
with CSS, compress them horizontally, or shrink them to fill space.

Keep row containers at their declared size, with no transforms, masks,
clipping or animation. Use inline, locally inspectable styles and the
existing shell's page size and margins. External stylesheets and executable
markup cannot be proved stable on guided documents, including carried
pages in a mixed packet; the tool refuses instead of changing those pages.
An image used for decoration remains a family-authorized image under the
usual material rules. It does not replace the measured writing rows.

On refusal, fix the specific layout problem while keeping spelling and
guide height. The existing two-strike stop rule still applies. The tool
has no fallback handwriting font. A fit refusal is not permission to set
`allowSizeReduction`; the parent's actual request controls that flag.

For a one-page packet correction, carry every untouched page through
`fromMaterialId` plus its 1-based `pageIndex`. Declare rows only beside
fresh HTML. The tool validates saved guided rows against their server
receipts and preserves carried HTML. Carried rows keep their original IDs and HTML, even when two saved
materials used the same local row IDs.

Read the actual PDF preview after rendering. The exact check proves the
pinned outline geometry and printed bounds; it does not prove that the
practice is comfortable for this child or that a home printer used 100%
scale. The normal draft, critique, revision and parent-approval loop stays.

```homa-checklist
- blocking guide-lines: Each writing row has a solid top guide, a dashed midpoint, a solid baseline, and room below for descenders.
- blocking letters-on-guides: Letters meet the appropriate cap, body, baseline and descender bands without clipping, including dots and accents.
- blocking literal-spelling: The name keeps the parent's exact spelling, accents and case on every guided row.
- blocking fade-to-empty: After any model row, tracing support precedes at least one empty guide row for writing alone, unless the brief says otherwise.
- advisory trace-style: Tracing uses dotted outlines or pale fill; solid dark ink is an example, and no starting point or stroke order is invented.
- advisory row-spacing: Rows have distinct space and readable full-size lettering; a short name need not stretch across the page.
```

## Preserve the predecessor's physical writing size

For a revision, reopen the exact material with `find_materials(materialId, pageIndex)` before composing. `revisesId` identifies the authenticated predecessor. Select the old row through each replacement declaration's `predecessor`; its size comes from the saved server/print receipt, never a guessed font-size or a matching title.

- A guided predecessor uses `{ "kind": "guided", "page": 1, "rowId": "practice" }`. Retain its measured cap, small-letter body and descender bands. You can move the replacement to another page; identify its original page/row. Carry unchanged pages normally. Every old guided row must remain accounted for. A renamed ID or more pages does not establish preservation.
- An old SVG uses `{ "kind": "legacy-svg", "page": 1, "svgOrdinal": 2 }`, counting all SVG elements within the saved page body from 1. This route accepts only the exact static three-guide Fredoka structure with verified embedded font bytes and an offline replay matching the saved size signals. Replace only the selected SVG bytes with the declared placeholder; keep all surrounding HTML unchanged. The target is the original guide spacing, not faulty glyph ink or nominal font-size. The known 2/66/130 guides require cap128/body64 and the complete248px row frame. A new fetch of Google Fonts is not historical font evidence.
- If a legacy row's source/font/layout cannot be verified, or the full frame will not fit without rearranging that legacy page, explain that specific limit and preserve the original. Do not relabel it as a new page, switch recipes to escape comparison, add giant text to satisfy a maximum, or set `allowSizeReduction` to get past a refusal. The current exact conversion does not certify legacy multi-page rearrangement.

For guided revisions that need more space, move rows to another page at their original band sizes. Fewer repetitions or smaller letters require the parent's actual requested/accepted change and the existing explicit size-reduction authorization. Report any authorized reduction from the returned comparison. Code verifies correspondence and dimensions; the model owns the interpretation of the parent's request. The ordinary picture/text/box floor continues to apply.
