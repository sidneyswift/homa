# Copy-work pages

Golden anchor: pass `anchorIds: ["copy-work-pages"]` to generate_image
so the output matches the Homa copy-work bar (model passage in a
thin-bordered rounded box at the top with an italic attribution, exactly
four tall empty three-line guide rows with solid top and baseline and a
dashed midline, cream paper with brown and charcoal ink, a Name line in
the header, one pencil and one star in the corners only). Write your own
prompt with your own content; the anchor sets the visual bar, not the
specifics.

Handwriting practice using curated quotes, poems, or literature passages.
Model text at top, practice lines below. Print and cursive versions.

Great for: ages 5-12, Charlotte Mason families, handwriting practice
with meaningful content, poetry memorization, beautiful penmanship
development.

Always html path. Precise line spacing and font control are essential
for handwriting guides.

Design patterns (all binding for copy-work-pages):

- **Model text**: in clear, beautiful typography at top of page inside
  a lightly bordered box (`border: 1px solid #e0dcd6; padding: 16px;
  border-radius: 6px; background: #faf9f7;`). Source attribution below
  in smaller italic text.
- **Practice lines**: 3-line guide rows (top, mid, baseline) for the
  child to copy, built as the name-tracing-page recipe's SVG guide row
  (exact centered midline, pinned baseline); empty rows here, since the
  child copies rather than traces.
- **Age-appropriate sizing**: younger children (5-7) get one short
  sentence per page with large guides (`line-height: 48px;`). Older
  children (8-12) get a full paragraph with standard-size lines
  (`line-height: 32px;`).
- **Print vs cursive**: specify in the header. For cursive, the model
  text uses a cursive font family; for print, use Andika or similar.
- **Optional thematic illustration**: small corner illustration via
  hybrid path, related to the passage content.
- **No distracting decoration**: the page should feel calm and focused.
  Generous margins, ample white space.
