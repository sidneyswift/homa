# Visual schedule cards

Golden anchor: pass `anchorIds: ["visual-schedule-cards"]` to
generate_image so the output matches the Homa schedule-cards bar
(tall cards with a soft full illustration above a plain activity
label, dashed cut lines, one consistent art style across every card).
Write your own prompt with your own content; the anchor sets the
visual bar, not the specifics.

Daily routine cards showing activity illustrations with time labels.
Designed for cutting apart and sequencing on a board or wall.

Great for: ages 2-7, daily routines, transition support, special
needs, toddler independence. Designed for lamination and Velcro
attachment to a board.

Always hybrid path. Generate the complete sheet of activity illustrations
in one call, already arranged in the page's 2x3 or 2x4 composition with
blank label bands. Place that one image behind the HTML card grid; HTML
owns every activity label, time, and dashed cut line. Never generate one
image per card.

This recipe owns routine and chore charts even when the parent says
"worksheet," "checklist," "morning plan," or "evening plan." Use one
composed sheet for a shared family routine. When sibling pages need different
activity pictures, each distinct page still gets at most one composed sheet,
not one image per task. Keep the illustration object-only when a task needs a
plain visual reference rather than a child character. Text, order, checkboxes,
language, and spacing all belong to HTML, so those revisions reuse the exact
existing image URL. A changed activity picture may replace only that page's
single composed sheet.

Design patterns (all binding for visual-schedule-cards):

- **Card grid**: 2×3 or 2×4 grid on the page. Each card ~3×4 inches.
- **Card structure**: illustration (top 60%), activity name in large
  text (bottom 30%, `font-size: 20px; font-weight: 700;`), optional
  clock icon showing time (bottom corner).
- **Dashed cut borders**: `border: 2.5px dashed var(--homa-control-boundary);` around
  each card.
- **Common activities**: wake up, breakfast, get dressed, brush teeth,
  learning time, lunch, outdoor play, rest time, dinner, bedtime.
  Customizable to the family's routine.
- **Consistent illustration style**: same art style across all cards
  for visual coherence.
- **Lamination-friendly**: white background, no edge-to-edge color.
- **Optional blank cards**: 2-3 blank card templates at the end for
  the parent to customize.
