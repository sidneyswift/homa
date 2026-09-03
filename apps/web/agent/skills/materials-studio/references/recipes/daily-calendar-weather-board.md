# Daily calendar and weather board

Golden anchor: pass `anchorIds: ["daily-calendar-weather-board"]` to
generate_image so the output matches the Homa circle-time board bar (one
tall stack of labeled bands, every option a rounded outline chip with room
to circle it, one line-art symbol per weather and season chip, a name line
up top, no fills anywhere so a dry-erase marker wipes clean). Write your
own prompt with your own content; the anchor sets the visual bar, not the
specifics.

One reusable page a child fills in every morning: circle the day, circle
the month, mark the date, circle the season, circle the weather. Every
answer is a choice from a complete closed set printed on the page, so the
child never has to spell or recall anything; the board teaches calendar
and weather vocabulary through the same two minutes every day. It is a
daily ritual, not a worksheet: nothing is finished, checked, or scored.
Mechanic sourced from `ref-2026-07-18-morning-menu-starter` (a 13-page
morning-menu workbook: name page, month/day/year/day-of-week date
selector, season and weather tracker, hot/warm/cool/cold temperature
categories, airy sectioned layout, prints well in black and white) and the
"Morning Calendar Routine" opening in `cur-2026-07-19-playing-preschool-y1`
(days, months, weather, counting on; a 2-minute daily opening with no
recipe). Chip geometry, circle-in-place marking, day order, the
two-rows-of-six month layout, the this-week strip, and bilingual stacking
are Homa design decisions, not transcribed patterns. The year is one write
line on the full board (the source has it) and is omitted on the starter
board, where a 3-year-old is not yet writing four digits.

Great for: ages 3-7, circle time and morning meeting, life skills and
daily living (calendar awareness, weather observation), early name
writing, play-based and Playing Preschool style openings, any family that
wants the day to start the same way every day.

Creation path: always html. Every set must be exactly complete and exactly
spelled (7 days, 12 months, 31 dates, 4 seasons, 6 weathers, 4
temperatures), the page is text-dominant, and the family will revise
wording, language, and chip order surgically for months. The image model
drops or misspells one month in a row of twelve often enough that a board
built from it cannot be trusted blind, and a wrong board is wrong every
single morning. Weather and season symbols are the inline SVG paths in the
worked HTML (variants file below); when a family asks for "pictures", the
answer is those symbols scaled up by the scale-to-fill rule, never a
generate_image call. There is no hybrid path: no generate_image shape
matches a 700px-wide chip row (the nearest, `wide`, renders 400px tall at
that width, more than the 178px a full-board band has), and a picture
strip that drifts even one cell off the chips under it is wrong every
morning.

Design patterns (all binding for daily-calendar-weather-board):

- **One board, one page, same order every day.** Bands stack top to
  bottom in this fixed order: name, day, month, date, season (with
  temperature when the family wants it), weather. A board that omits a
  band keeps the order of the bands it has. Predictability is the
  teaching mechanism; do not reorder bands between revisions or siblings.
- **Name line up top**: a plain "My name" writing line, a single
  `border-bottom: 2px solid var(--homa-ink)` line at least 44px tall with
  no model text on it. For a traceable name model use the
  name-tracing-page SVG guide row, never HTML text on a CSS border (the
  three-day family correction, 2026-07-28 to 07-31). The name, wherever
  it appears, is spelled exactly as the family spells it.
- **One instruction per band, written to the child**, one short line:
  "Circle today." "Circle the month." "Circle the date." "Circle the
  season." "Circle the weather." Never a paragraph, never a parent voice.
- **Closed sets, complete and in canonical order.** Days: Sunday through
  Saturday, seven chips in one row, two rows only when the day-row fit
  rule below calls for them (start on Monday only when the family says
  so; five school days only when the family says so). Months:
  January through December, twelve chips in two rows of six. Seasons:
  winter, spring, summer, fall, four chips, one symbol each. Weather:
  sunny, cloudy, rainy, snowy, windy, stormy, six chips, one symbol each,
  every symbol a different path (summer is a sun over waves, sunny is a
  sun with rays; no two chips on one page share a symbol). Temperature
  (optional): hot, warm, cool, cold, four text chips. Year (ages 5-7): one
  "Write the year: ____" blank at least 34px tall on the date band. Never
  drop an option to save room and never add one; a set the child can
  finish learning is the point.
- **Day-row fit rule.** Seven day chips share the 7.3in (700px) width, so
  the longest label sets the size: gap 8px, side padding 2px, day label
  20px Fredoka 600, same floor as every other chip. Measured from the
  font at 20px: Wednesday is 106px of text and its `1fr` column grows to
  114px; Thursday's column takes 95px, Saturday's 92px, and the other
  four get 88px each (min-content total about 609px of the 652px the row
  has after its gaps, so `1fr` shares the rest). Month chips are 110px
  wide at 8px gaps, so September (98px of text) holds the 20px floor with
  2px side padding. A label is always one horizontal line of whole words
  at the floor or bigger: never abbreviate a day or month, never let a
  name wrap (`white-space: nowrap` on every chip makes a wrap show up as
  overflow at the render check instead of a silent second line), never
  rotate or stack a label to buy width (no `writing-mode`, no
  `transform: rotate`; a sideways word is not a word a 4-year-old reads),
  and never set one label smaller than its neighbors. When a
  home-language set's min-content total passes the 652px (measure its
  longest label the same way), the day band takes two chip rows, four
  over three, at the same 20px label, and the band grows by one chip
  height taken from the flexible bands. The ask stacks above the chips
  on both bands; an inline ask would steal the width Wednesday needs.
- **Date band by age.** Ages 3-4 (opt-in, see variants): one big empty
  write box (at least 110px square) where the child writes or traces the
  numeral the parent says. Ages 5-7: a 1 to 31 grid in seven columns
  (five rows, the last row holds 29, 30, 31 and four empty cells), every
  cell 40px square border-box, 6px gaps, the child circles today. The ask
  and the year line sit to the left of the grid, the one band with room
  for an inline ask. Numbers run in exact order; this is where html earns
  its keep.
- **Chip geometry**: every option is a rounded outline chip
  (`border: 2px solid var(--homa-control-boundary); border-radius: 12px;
  box-sizing: border-box;`), at least 40px tall including border and
  padding, label at least 20px in a round display face, text chips 2px
  side padding, at least 8px of clear space between chips so a circle
  drawn around one never touches its neighbor. Symbol chips are at least
  1.1in wide with the symbol at least 0.6in tall and the label under it;
  both of those are floors the chip grows past whenever its band has the
  room (next bullet). No fill on any chip.
- **Size is a floor, not a target.** Once chip text, symbol size, date
  cells, and the name line have rendered at a size a small hand can circle
  and write in, that size is a floor for every later revision of the same
  board. Adding temperature, a second language, or a week strip never
  shrinks the existing chips to make room: drop the optional band, or ask
  the parent which band matters more, never trade size away silently.
- **Scale to fill**: the bands stretch to the 7.3in x 9.5in box with
  `grid-template-rows` (`minmax(0, 1fr)` for the flexible bands, never
  bare `1fr`, or a symbol's intrinsic size inflates the track and the
  board overflows the sheet) so the board reaches the bottom of the sheet.
  Chips fill their row with `repeat(n, 1fr)` columns and the 8px gap, so
  four season chips are 169px wide and six weather chips 110px on a
  one-row band; the symbol grows with the band
  (`height: clamp(0.6in, 55%, 2in); width: auto`), so a 144px chip carries
  a 70px symbol and a 348px chip a 183px one. Never fix chips at the 1.1in
  floor and spread them across the width with inches of air between them,
  never pad with an unasked-for band.
- **Ink-light and dry-erase ready**: white background, boundary lines and
  grayscale line symbols only, no shaded bands, no color fills. Color, when
  the family wants it, is a thin accent on chip borders only.
- **One parent line at the very bottom**, small and plain: "Laminate it or
  slip it in a sheet protector; a dry-erase marker resets it each morning."
  Nothing else addressed to the parent on the child's page.
- **Page density is counted in chips, not bands.** The starter board
  carries 13 chips (7 days, 6 weathers) and the child marks two of them
  each morning; the full board carries 60 (plus 4 temperature chips when
  asked). Both sit above the page-density table (3-5 items at ages 4-5,
  4-6 at 6-7) because a closed set cannot be trimmed, so the trade is
  made in size and choice count instead: the starter never holds more
  than two choice bands by default, every starter chip is giant, and a
  child who is not ready for two choices gets the weather-only starter
  (6 chips, one choice). Say the chip count to the parent when offering
  an optional band.

Variants and worked HTML: the starter, full, this-week, and home-language
boards, the season-plus-temperature layout, the full board's measured row
arithmetic, and the complete starter HTML with every symbol path live in
`/workspace/skills/materials-studio/references/recipes/daily-calendar-weather-board.variants.md`;
read it before building any version of this board.

What not to do:

- No cut lines, cards, or Velcro tabs: a routine sequenced from moveable cards is daily-rhythm-cards or visual-schedule-cards.
- No chore or routine-step checkboxes (brush teeth, breakfast): that is a chore chart, and visual-schedule-cards owns it.
- No "read a calendar" questions ("What day is the 14th?"): chart-and-graph-skill-practice's calendar variant; this board has no questions.
- Never pre-circle today, pre-fill weather from a forecast, or print the date on the reusable board. Choosing is the activity.
- No 13-page workbook: one board covers every morning; a fresh printout per day is the this-week strip, not a packet.
- No scores, stars per day, or streak counters.
- No generate_image call for weather or season pictures: the inline symbols are the pictures.

Final quality gate: every set is complete and in order (count them: 7, 12,
31, 4, 6, 4); render once and confirm no label wraps, rotates, or
overflows its chip
(Wednesday, September, and the longest home-language word) and the board
does not overflow the 9.5in box; every chip has clear space to be
circled; no two chips share a symbol; the name line is empty and at least
44px tall; nothing on the page is pre-answered; the board reaches the
bottom of the sheet with bigger chips, not more bands.
