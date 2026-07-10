# Report simplification pass (founder ask, 2026-07-08 late)

Goal: the post-questionnaire progress report is redundant and heavy. Simplify it
with progressive disclosure: say each thing once, keep collapsed surfaces bare,
personalize everywhere, and give every expanded surface a single clear job.

Source of truth for the ask: founder message 2026-07-08 (this session). Where a
requested removal touches an existing feature, the conservative call and its
reasoning are logged per ticket. Copy work follows
`.agents/skills/homa-copy-writer/SKILL.md`; UI stays inside the design system.

## Tickets

### RS-1 · Personalize the subtitle (and sweep the report for "they")

- `reportSubtitle(months)` becomes `reportSubtitle(months, childName)`:
  "A first look at where Maya stands at 4y 2m, from what you've seen them do."
- Sweep report surfaces for generic "they/their" where the child's name fits
  better. Pronouns for the child stay they/them by law; this ticket is about
  the places a NAME can carry the sentence.
- Files: `packages/core/src/map/sentences.ts`, `report-view.tsx`.

### RS-2 · Note from Homa: one sentence + the month button + P.S. call me

- Note text is ONE conversational sentence (template `homaNote()` rewritten;
  model note spec in `report-writer.md` re-specced to one sentence).
- The month offer moves INTO the note card: one plain sentence ("I took
  everything you told me and turned it into a month plan for Maya.") plus ONE
  button ("Open Maya's month"). Button = the existing consent flow when no
  plan exists yet (tap builds, then navigates), or a plain link when the month
  is already built. The standalone ConsentCard section and the "Open month"
  button row below the note are removed.
- The bottom "Want me to call you?" card is removed; a P.S. line inside the
  note card replaces it ("P.S. Want to talk it through? I can call you.")
  with a small "Call me" action. No phone input: the number from onboarding is
  used. Errors keep the existing quiet fallbacks.
- Removed from the note card (redundancy, logged): the movement paragraph
  (the growth story section already tells movement), the re-checked line
  (growth story covers holding steady), and the practice check-off line (the
  plan page owns plan progress).
- Files: `sentences.ts`, `report-view.tsx`, `consent-card.tsx` (reworked into
  the note), `call-homa-card.tsx` (reworked into the P.S.),
  `agent/report-writer.md`.

### RS-3 · Snapshot: chart, one sentence, tap to enlarge

- The snapshot card becomes: one sentence about what the chart shows, the
  trajectory chart, and tap-to-open-larger (a full-screen dialog).
- Removed: the strengths / growing / closest-to-age row lists (the whole
  picture chart and subject cards already carry standing), the age and
  subjects-mapped meta line (the header band already says it), and the
  next re-check line (the chart itself marks the re-check).
- Files: `report-snapshot.tsx`, new `chart-lightbox.tsx` (client).

### RS-4 · Remove the strengths section

- The "{child}'s strengths" three-card section is removed completely.
  Strength standing still lives in the whole picture chart and each subject
  card's badge and number.
- Files: `report-view.tsx` (section removed; `SubjectJump` becomes unused and
  is deleted with the snapshot rows in RS-3).

### RS-5 · The whole picture chart is phone-sized

- `ReportChart` redrawn mobile-first: labels above each row's track instead of
  a squeezed left column, a ~360 viewBox so type renders at native size on a
  phone, at-age line and dots unchanged in meaning. No red, no negatives,
  growing stays a word.
- Files: `report-chart.tsx` (also used by the one-pager, which keeps working).

### RS-6 · Subject cards: bare when closed, one story when open

- Collapsed summary: badge + subject name + number (+ movement chip). The
  per-subject sentence no longer renders collapsed.
- Expanded drawer, in order:
  1. What this subject is at this age: 1 to 2 plain sentences, new per-domain
     `whatItIs` content in the bank, rendered with the child's age.
  2. What I asked, what you answered: plain question and answer rows. The
     per-row benchmark age-strip chart is removed (the whole picture chart is
     the chart; receipts read as text). The change-an-answer flow stays.
  3. Why this is interesting: the model-written drawer piece (re-specced to
     connect the subject, the answers, and one concrete direction), template
     fallback = the subject sentence that used to sit on the collapsed card.
  4. Benchmarks: the source links, one per line, shortened to just the
     hyperlinked source names.
  5. The two buttons: "Build the 4-week plan" and "Answer a few deeper
     questions" (unchanged).
- Removed from the drawer (logged, reachable elsewhere): the inline sharpen
  probe and "Next up" rung (the deep-dive button covers going deeper), the
  whats-working form, the growing activity callout (Things to try section
  keeps the activity), and the observations-count kicker.
- Files: `report-view.tsx`, `receipts-list.tsx`, `content.ts` + `bank.ts`
  (whatItIs), `sentences.ts` (explainer renderer), `map-check.mts` (lint the
  new content), `report-writer.md` (drawer spec).

### RS-7 · Your state: collapsed by default

- The state requirements card renders inside a closed `<details>`; the summary
  row is the card title. Content unchanged.
- Files: `state-card.tsx`.

### RS-8 · How this report is made: collapsed, one paragraph, expandable sources

- Closed by default. Open = ONE short plain-language paragraph (built from
  answers + national benchmarks + not a test + sharpens as you answer), then a
  nested "Sources" expander listing each source as a real hyperlink.
- The "how the report works, in full" link is removed.
- Files: `report-view.tsx`.

### RS-9 · Nav bar on the report page

- The live report gets a slim sticky top bar: logo home link, Dashboard, and
  Settings (`/home`, `/home#settings`). Hidden on print and on the public
  sample (the sample keeps its own banner and CTAs).
- Files: `report-view.tsx` (or a small `report-nav.tsx`).

### RS-10 · Prompt + fixtures + guards

- `report-writer.md`: note = one sentence; drawer = the why-it's-interesting
  connector. Bump `REPORT_PROMPT_VERSION`, regenerate fixtures
  (`pnpm tsx scripts/map-narrative-fixtures.mts`), founder re-reads (STOP 1).
- Guards stay green: `pnpm typecheck`, `pnpm lint`, `pnpm check:map`,
  `pnpm build`.

### RS-11 · Gates + e2e

- `homa-copy-reviewer` then `homa-copy-editor` on the changed words;
  `homa-uxui-reviewer` on phone screenshots of the reworked sample report.
- E2E with Playwright against the dev server: sample report renders, cards
  open and close, state and methodology expanders work, nav links present on
  the live-report variant, phone and desktop screenshots captured.

## Status

- [x] RS-1 subtitle personalization
- [x] RS-2 note card rework
- [x] RS-3 snapshot simplification
- [x] RS-4 strengths section removed
- [x] RS-5 whole picture chart phone-sized
- [x] RS-6 subject card progressive disclosure
- [x] RS-7 state card collapsed
- [x] RS-8 methodology collapsed
- [x] RS-9 report nav bar
- [x] RS-10 prompt version + fixtures + guards (prompt v2026.07.17, bank v2026.07.5)
- [x] RS-11 gates + e2e (copy reader, copy editor, UX read; 30-check Playwright pass, phone + desktop)

All eleven tickets executed 2026-07-08/09. Gate feedback implemented: lightbox
centers content-sized (no dead panel), trajectory type bumped to readable
sizes, "rescores" jargon replaced, "age norm" replaced, state card meta-opener
and hedging trimmed, drawer prompt got a one-reassurance budget and a 320-char
budget. Founder re-read of the regenerated fixtures (STOP 1) is the one open
human step.

## Round 2 (founder ask, 2026-07-09 night): the note becomes a letter, one flow

Even after round 1, the note still read as a note plus a bolted-on plan
paragraph plus a boxed P.S., the snapshot's arc repeated itself twice more
(the whole picture, then "stories so far"), and "things to try" plus the
memory-box letter sat between subject cards and the state/methodology pair
the founder wanted them to flow straight into.

### RS-12 · Drop the header subtitle

- `reportSubtitle()` and its call site removed: the h1 flows straight into
  the age/subjects/answers/benchmarks meta line. Files: `report-view.tsx`,
  `sentences.ts`, `packages/core/src/index.ts`.

### RS-13 · Note from Homa becomes a letter

- Structure: "Hey {parent},"greeting, the note sentence (template or
  model), the month-plan sentence + button when offered, one inline
  call-me line, "Thanks, Homa" sign-off. New `noteGreeting()` and
  `notePlanSentence()` template sentences in `sentences.ts`; `homaNote()`
  drops its `parentName` param now that the greeting owns the name.
  `call-homa-ps.tsx` reworded from its own boxed P.S. into one inline
  "BTW, click if you'd rather I give you a call" sentence, same behavior.
  The model's `note` prompt now explicitly forbids opening with the
  parent's name (the greeting already says it once); the two committed
  fixtures were regenerated at prompt v2026.07.18 and both passed the
  gate clean on the first try. `kid-view.tsx`'s dashboard note picked up
  the same greeting for consistency (it quotes the same reviewed
  sentence).

### RS-14 · "Stories so far" removed, snapshot flows straight into the whole picture

- The chapter-by-chapter growth story and its rising-subject sparklines
  are gone (redundant with the snapshot's trajectory chart and the whole
  picture chart, per the founder). `GrowthEra` and `movementBetween` stay
  exported from `growth-story.tsx`: the snapshot chart and the separate
  `/evidence` archive page both still need them.

### RS-15 · The model's synthesis piece retired too, not just unrendered

- Confirmed with the founder: rather than leave `synthesis` and `keepsake`
  generating unread content, they're gone from the contract end to end
  (`ReportNarrative`, the gate, the generation schema, `map-check.mts`'s
  fixture and unit tests, `report-writer.md`). The whole picture now
  flows directly into subject by subject with nothing in between.
  `lastLetter`/`priorLetter` memory carries the prior `note` only now.

### RS-16 · "Things to try" and the memory-box keepsake removed

- Subject by subject now flows straight into the state card, then
  methodology. `tryHeading()` deleted (dead after its only call site
  went); `growingActivityFor` stays in the facts payload (the model may
  still draw on it) but is no longer rendered as its own section.

### RS-17 · Regenerate + verify

- `pnpm tsx scripts/map-narrative-fixtures.mts` (real model call): both
  fixtures regenerated at prompt v2026.07.18, gate clean, no parent-name
  repeat in either note. Typecheck, lint, `check:map`, and build all
  green; sample report and a forced-editable render (month button + call
  line visible) screenshotted before committing to the layout.

### Status

- [x] RS-12 through RS-17, executed 2026-07-09 night.
