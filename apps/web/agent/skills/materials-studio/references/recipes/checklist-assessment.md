# Checklist assessment

Golden anchor: pass `anchorIds: ["checklist-assessment"]` to
generate_image so the output matches the Homa readiness checklist bar
(bold domain headers on light tint bands, three Not Yet / Sometimes /
Consistently columns of empty aligned checkboxes, a wide skill column
with one observable behavior per airy row, Name / Date / Filled in by
header lines, a Notes footer of writing lines, corner-only pencil and
star motifs). Write your own prompt with your own content; the anchor
sets the visual bar, not the specifics.

Parent-facing readiness checklist with bold section headers and
checkboxes. Tracks 10-15 whole-child skills (academic +
social-emotional + executive function). Designed for periodic
re-assessment.

Great for: ages 3-7 (parent fills in, not child), Montessori
observation records, developmental screening, beginning-of-year
assessment, portfolio evidence.

Always html path. Text precision and checkbox alignment are critical.

Design patterns (all binding for checklist-assessment):

- **Section headers**: skill domains in bold (`font-size: 18px;
  font-weight: 700;`): Language, Math, Motor, Social-Emotional,
  Executive Function.
- **Checkbox items**: 3-5 per section. Clear, observable behavior
  descriptions ("Can count objects to 10 with one-to-one
  correspondence"). Checkbox style: `□` character or styled box.
- **Three assessment columns**: "Not Yet", "Sometimes",
  "Consistently", with column headers at top and checkboxes in each row.
  `display: grid; grid-template-columns: 55% 15% 15% 15%;`
- **Name/date header**: child's name, assessment date, assessor name.
- **Footer**: notes field with 4-5 blank lines for free-form
  observations.
- **Airy layout**: generous line spacing (`line-height: 2.0;`),
  designed for quick parent scanning. No dense text blocks.
- **Repeat-friendly**: include a "Date" column so the same form can
  be printed multiple times across the year for progress comparison.
