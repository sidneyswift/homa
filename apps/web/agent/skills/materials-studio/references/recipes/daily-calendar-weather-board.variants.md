# Daily calendar and weather board: variants and worked HTML

Companion to `daily-calendar-weather-board.md`. Every binding pattern
there (fixed band order, closed sets, day-row fit rule, chip geometry as
floors, scale to fill, ink-light, one parent line, chips-not-bands
density) still binds here; this file carries the per-age boards, the
measured row arithmetic, and the complete starter HTML with every symbol
path. Pixel figures are at 96px per inch on the 7.3in x 9.5in
(700px x 912px) content box.

## Starter board (ages 3-4)

Three bands: name, day, weather. Rows `48px 74px minmax(0, 1fr) 16px` at
12px row gaps, so the weather band gets 738px (28px ask, 6px gap, 704px of
chips). Weather chips sit in two rows of three (`.six.stacked`), each chip
228px x 348px with a 183px symbol and a 20px label: giant on purpose,
because a 3-year-old is circling with a whole fist. Day chips are 40px
tall at the 20px label floor (Wednesday's column 114px, the rest 88-95px).
The parent reads each band aloud ("Today is... Monday!") while the child
points, then circles; the child is not expected to read a day name at 3.
Months are said aloud and not printed yet.

The page carries 13 chips and the child marks two. Two opt-ins the parent
asks for, never offered by default, each named with its chip count:

- **Weather-only starter** (6 chips, one choice): drop the day band for a
  child not ready for two choices. Rows `48px minmax(0, 1fr) 16px`; the
  weather chips grow to 228px x 391px and the symbol hits its 2in cap.
- **Season band** (+4 chips): rows `48px 74px minmax(0, 1fr) minmax(0, 1fr) 16px`;
  season and weather each get 363px, weather returns to one row of six
  (110px x 329px chips, 172px symbols), season chips 169px x 329px.
- **Date box** (no chips): one empty 110px-square box after the day band
  under "Write the date."; it takes a 144px band (`28px + 6px + 110px`)
  out of the weather band's height. With both opt-ins on, the board is
  the full board minus months, and the parent should hear that.

Five school days instead of seven only when the family says so; the row
then has 134px chips and the fit rule is trivially met.

## Full board (ages 5-7)

Six bands fill the 912px box at the floors: rows
`48px 74px 122px 224px minmax(0, 1fr) minmax(0, 1fr) 16px` with six 12px
gaps. Arithmetic: name 48, days 74 (ask 28 + 6 gap + chips 40), months
122 (28 + 6 + two rows of 40 + 8 gap), date 224 (five 40px rows + four
6px gaps, ask and year line to the left), parent line 16, gaps 72; that is
556, leaving 356 for season and weather, 178 each (144px chips, 70px
symbols). Season chips are 169px wide (four across), weather chips 110px
(six across), month chips 110px (September's 98px of text fits with 2px
side padding), and the year blank is 120px wide by 34px tall.

Temperature never gets its own band: when the family wants it, season and
temperature share the season band under one ask ("Circle the season and
how it feels."). Layout inside the band: `grid-template-columns: 1fr 24px auto`;
the four season chips fill the left column with `repeat(4, 1fr)`, the 24px
column is the gutter, and the right column is a 2 x 2 block of text chips
(hot, warm over cool, cold) at 8px gaps, each chip at least 90px wide and
`(144 - 8) / 2 = 68px` tall. That leaves 488px for the four season
chips, 116px each at 8px gaps, still past the 1.1in (106px) floor.

## This-week strip (print daily)

The full or starter board with, under each day chip's label, the date that
day falls on this week, computed from today's date in your context (the
child circles the day and reads its date). Day chips grow to 64px tall to
hold the second line (date numeral 20px); the day band becomes 98px and
the flexible bands give up 24px. Compute the seven dates exactly; never
guess a weekday from memory, and never print a date on the reusable board.

## Home language

The same closed sets in the family's language (Spanish days and months,
for example), spelled and ordered the way the family spells and orders
them, still complete. Bilingual boards stack the two labels inside one
chip (two 20px lines, chip at least 64px tall), never two boards' worth
of chips; re-run the fit rule on the longest label (miércoles, and
septiembre on the month band) before shipping and confirm at the render
check that nothing overflows.

## Worked HTML (starter board; comments give the full board)

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap" rel="stylesheet">
<style>
  /* Full board (ages 5-7): grid-template-rows: 48px 74px 122px 224px minmax(0, 1fr) minmax(0, 1fr) 16px;
     bands in order: name, days, months (.chips.months: repeat(6, 1fr) columns, 40px 40px rows),
     date grid (repeat(7, 40px) columns, 40px rows, 6px gaps, ask + year line at left),
     season (.chips.four), weather (.chips.six, one row), parent line. */
  .board { display: grid; height: 9.5in; grid-template-rows: 48px 74px minmax(0, 1fr) 16px;
    row-gap: 12px; font-family: Fredoka, sans-serif; color: var(--homa-ink); }
  .board * { box-sizing: border-box; }
  .name { display: flex; align-items: flex-end; gap: 16px; font-size: 22px; }
  .name .line { flex: 1; min-height: 44px; border-bottom: 2px solid var(--homa-ink); }
  .band { display: grid; grid-template-rows: 28px minmax(0, 1fr); row-gap: 6px; min-height: 0; }
  .ask { font-size: 22px; font-weight: 600; line-height: 28px; }
  .chips { display: grid; gap: 8px; align-items: stretch; }
  .days { grid-template-columns: repeat(7, 1fr); }
  .four { grid-template-columns: repeat(4, 1fr); }
  .six { grid-template-columns: repeat(6, 1fr); }
  .six.stacked { grid-template-columns: repeat(3, 1fr); }
  .chip { border: 2px solid var(--homa-control-boundary); border-radius: 12px; min-height: 40px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    font-size: 20px; font-weight: 600; text-align: center; padding: 6px 2px; white-space: nowrap; }
  .chip svg { height: clamp(0.6in, 55%, 2in); width: auto; stroke: var(--homa-ink); stroke-width: 3;
    fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .date { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 16px; }
  .date .box { width: 110px; height: 110px; border: 3px solid var(--homa-ink); border-radius: 12px; }
  .parent { font-size: 11px; color: var(--homa-control-boundary); text-align: center; }
</style>
<div class="board">
  <div class="name"><span>My name</span><span class="line"></span></div>
  <div class="band"><div class="ask">Circle today.</div>
    <div class="chips days">
      <div class="chip">Sunday</div><div class="chip">Monday</div><div class="chip">Tuesday</div>
      <div class="chip">Wednesday</div><div class="chip">Thursday</div><div class="chip">Friday</div>
      <div class="chip">Saturday</div>
    </div></div>
  <!-- Date box opt-in goes here: <div class="band"><div class="ask">Write the date.</div>
       <div class="date"><div class="box"></div><div></div></div></div> -->
  <!-- Season band (opt-in on the starter, always on the full board):
  <div class="band"><div class="ask">Circle the season.</div>
    <div class="chips four">
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M24 44V12M24 26l-8-8M24 22l8-8M24 34l-9-9M24 30l9-9"/></svg>winter</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M24 44V26M24 30c-8 0-12-5-12-12 7 0 12 5 12 12zM24 26c8 0 12-5 12-12-7 0-12 5-12 12z"/></svg>spring</div>
      <div class="chip"><svg viewBox="0 0 48 48"><circle cx="24" cy="18" r="8"/><path d="M24 3v4M9 18h4M35 18h4M13 7l3 3M35 7l-3 3M6 32c4-3 8-3 12 0s8 3 12 0 8-3 12 0M6 41c4-3 8-3 12 0s8 3 12 0 8-3 12 0"/></svg>summer</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M10 38C8 22 20 8 38 8c2 18-12 30-28 30zM10 38l28-30"/></svg>fall</div>
    </div></div> -->
  <div class="band"><div class="ask">Circle the weather.</div>
    <div class="chips six stacked">
      <div class="chip"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="9"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/></svg>sunny</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M12 34h24a7 7 0 0 0 0-14 9 9 0 0 0-17-3 8 8 0 0 0-7 17z"/></svg>cloudy</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M13 30h22a7 7 0 0 0 0-14 9 9 0 0 0-17-2 8 8 0 0 0-5 16zM16 36v6M24 36v6M32 36v6"/></svg>rainy</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M24 6v36M8 15l32 18M8 33l32-18"/></svg>snowy</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M6 16h22a4 4 0 1 0-4-4M6 24h30a4 4 0 1 1-4 4M6 32h18a4 4 0 1 1-4 4"/></svg>windy</div>
      <div class="chip"><svg viewBox="0 0 48 48"><path d="M13 30h22a7 7 0 0 0 0-14 9 9 0 0 0-17-2 8 8 0 0 0-5 16zM26 30l-6 9h8l-6 6"/></svg>stormy</div>
    </div></div>
  <div class="parent">Laminate it or slip it in a sheet protector; a dry-erase marker resets it each morning.</div>
</div>
```

Every symbol stays inside its `0 0 48 48` viewBox with the 3px round-cap
stroke (the stormy bolt ends at y=45, the sun rays start at y=3 or 4), and
no two chips on one page share a path: summer is a sun over two wavy
lines, sunny is the full-ray sun.
