# Cut-and-assemble craft

Golden anchor: pass `anchorIds: ["cut-and-assemble-craft"]` to
generate_image so the output matches the Homa cut-and-assemble craft bar
(labeled flat cutout pieces with dashed cut borders, dotted fold lines,
gray glue tabs, and a numbered assembly-step panel). Write your own
prompt with your own content; the anchor sets the visual bar, not the
specifics.

A page of labeled cutout pieces that the child colors, cuts, and
assembles into a 3D model or layered diagram. Combines art + motor
skills + spatial reasoning + content knowledge.

Great for: ages 4-10, science (skeleton, solar system), art projects,
holiday crafts. The tactile assembly reinforces spatial understanding.

Always hybrid path. generate_image produces detailed piece illustrations;
HTML handles cut lines, fold lines, tabs, and assembly labels.

Design patterns (all binding for cut-and-assemble-craft):

- **Piece layout**: maximize use of page space. Pieces arranged in a
  grid or tessellated layout with dashed cut borders
  (`border: 2.5px dashed var(--homa-control-boundary);`).
- **Labels on every piece**: "Tab A", "Fold here", "Glue to B" in
  small text (`font-size: 11px; color: var(--homa-control-boundary);`).
- **Assembly instructions**: at top of page or on a separate guide
  panel. Numbered steps with small diagrams if needed.
- **Tabs for gluing**: small rectangular extensions on pieces where
  glue goes. Marked with a different background
  (`background: #f0ede8;`).
- **Fold lines**: gray dotted (`border: 2px dotted var(--homa-control-boundary);`), labeled
  "fold".
- **Cut lines**: dashed (`border: 2.5px dashed var(--homa-control-boundary);`), labeled
  with scissors icon "✂️".
- **B&W line art**: all pieces are outline-only for coloring before
  assembly.
