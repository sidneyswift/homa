---
name: homa-copy-writer
description: The Homa copy rulebook. Read BEFORE writing or editing any parent-facing words anywhere in the product or marketing: progress reports, four-week plans, dashboard cards, UI microcopy, chat/SMS/voice prompts, emails, landing and marketing pages. Clarity and low cognitive load beat personality, and fewer words is NOT the goal (a 3-word sentence can confuse as hard as a 20-word one). Also the router for WHERE a copy fix belongs: generator prompt, template sentence bank, component string, or the page itself. Pairs with homa-copy-reviewer (ICP read-along gate) and homa-copy-editor (senior editor gate). Layers on top of marketing/voice/house-style.md; never replaces its bans or format limits.
---

# Homa copy writer · the rulebook

Homa's reader is a busy, non-technical homeschool mom with five stolen
minutes and half her attention. Every rule here serves one goal: she
understands each sentence on the first pass, knows what it means for her,
and never feels judged.

## The priority law

Clarity and low cognitive load beat personality, every time. Warmth is the
tone of a clear sentence, never decoration added to one. If a charming line
and a plain line carry the same fact, ship the plain one. (Founder ruling
2026-07-08, logged in docs/homa-planning/build-log.md.)

## What cognitive load actually is

Load is measured in re-reads and pauses, never in word count. Cutting words
that carry meaning RAISES load. Never trade clarity for brevity to fit a
length cap; cut a whole idea instead, or split the sentence.

- One idea per sentence. Two ideas get two sentences.
- Front-load the point. The fact or action comes first, color after.
- Subject, verb, object. No inverted syntax for flair ("Strengths, first").
- No garden paths: a list inside a clause inside a list forces a re-read.
- The em dash ban is not a license for comma splices. Three or more clauses
  glued by commas is a run-on; use a period.
- One name per concept, everywhere: "progress report" never "map",
  "subject" never "domain", plain age words never "band", colors in copy
  are yellow / green / blue.
- No meta-commentary about the copy itself: "here's the honest picture",
  "the part worth circling", "the real story is". Just say the thing.
- Metaphors are a budget of one per surface, zero in a tie. Stacked images
  ("a starting line, not a verdict, watch the numbers move") make her
  translate instead of read.
- Reassure before inform means ORDER, not padding: one reassurance up
  front, then plain facts. Never wrap every fact in its own cushion.
- Plain words beat clever euphemisms. When a banned word forces a
  workaround, the replacement must still say something concrete ("growing
  right now" always arrives with the named next step).

## Hard laws (never bend, from AGENTS.md and copy-laws.ts)

- No em dash, ever. Comma, period, colon, or mid-dot.
- "Homa" in prose; "HOMA" only in wordmark UI treatments. Sentence case
  everywhere; all-caps appears only inside styled uppercase treatments
  (mono eyebrows and labels, per the design system), never in prose.
- Never "behind" (in ANY sense), no deficit words, no diagnosis or testing
  vocabulary, no percentiles. Growth framing only.
- Never compare siblings. Never a verdict on a child.
- Offers, never commands. Temporal never causal ("since June", never
  "because you did X").
- No invented numbers, testimonials, or social proof. Child pronouns follow
  the parent's own words or stay "they".

## Guidelines per point of use

- Headings: name the section's content plainly ("Subject by subject"), no
  puns, no suspense.
- Buttons and CTAs: verb first, name the real action, one per moment
  ("Build the 4-week plan"). A button label never promises what the tap
  does not do.
- Badges and chips: two or three words, one fixed vocabulary per surface,
  each paired with a plain sentence nearby that says what it means.
- Card body copy: 1 to 2 sentences. First sentence is the fact for HER
  child; second is the next step or nothing.
- Notes and letters (note from Homa, keepsake): warm, but every sentence
  still carries one fact or one action. No adjective trains.
- Error and empty states: the copy-kit shape holds, in this order: name it
  plainly, settle the nerves, offer the next step ("That didn't save. Your
  work is safe, try once more.").
- Methodology, legal, state compliance: short declarative sentences, no
  hedging chains. One boundary statement said once, plainly, beats four
  qualifiers.
- Emails: subject under 50 chars, written like a person; body under 200
  words; exactly one CTA.
- Marketing pages: one idea per section, claim then proof, CTA names the
  destination. house-style.md bans and format limits always apply.

## Where the words live (fix the cause, not the artifact)

Generated copy is fixed at its producer. One-off copy is fixed in place.
Decide which BEFORE editing:

| Surface | Kind | Fix it in |
|---|---|---|
| Report narrative (note, subject lines, synthesis, drawers, keepsake) | Generated per family | `apps/web/agent/report-writer.md` (the prompt) |
| Report template sentences, badges, email subject | Generated (deterministic templates) | `packages/core/src/map/sentences.ts` |
| Four-week plan activities and style notes | Generated (templates) | `packages/core/src/map/plans.ts` |
| Checklist questions and activities | Generated (bank content) | `packages/core/src/map/bank.ts` |
| Report page persistent strings (headings, buttons, methodology, cards) | One-off | `apps/web/app/onboarding/r/[token]/*.tsx` |
| Dashboard cards | Mixed: sentences composed in components | `apps/web/app/home/dashboard/*.tsx` |
| Chat, SMS, voice | Generated | `apps/web/agent/instructions.md`, `instructions/sms-mode.ts`, `curriculum-call-instructions.md`, `curriculum-writer.md` |
| Landing and marketing pages | One-off | Edit the page itself (`apps/web/app/page.tsx`, etc.) |
| Marketing bundles (articles, captions, emails) | Staged drafts | The draft file, through the marketing-* gates |

A generated report on someone's permanent URL is never the thing to fix:
improving one family's report while the generator keeps producing the same
problem fixes nothing. Fixture files are generated too: never hand-edit
`narrative.fixture.ts` or `red-team-narrative.json`; change the producer
and regenerate.

## Chores that come with a generator fix

- Any change to `report-writer.md` or the generation schema: bump
  `REPORT_PROMPT_VERSION` in `apps/web/agent/report-writer-version.ts`,
  regenerate fixtures (`pnpm tsx scripts/map-narrative-fixtures.mts`, needs
  gateway credentials), then the founder re-reads the new fixtures (STOP 1
  gate). `pnpm check:map` enforces the version lock.
- The Voice (binding) section is hand-mirrored across `instructions.md`,
  `report-writer.md`, and `curriculum-writer.md`. Change one, change all
  three.
- Template changes in `packages/core/src/map/*`: run `pnpm check:map`.
- Marketing voice mechanics (banlist, limits) live ONLY in
  `marketing/voice/house-style.md`; add new bans there, never restate them.

## The gates

For any copy that matters (a report surface, a landing page, an email, a
new set of cards), run both gates in this order, no exceptions:

1. `homa-copy-reviewer`: a fresh subagent role-plays the ICP and reads the
   copy sentence by sentence, thinking aloud. Comprehension problems
   surface here.
2. Implement the accepted feedback (at the right layer, table above), then
   `homa-copy-editor`: a fresh subagent role-plays a senior copy editor and
   checks the post-fix copy against this rulebook. Craft problems surface
   here.

Reader first, editor second: polishing style before checking comprehension
hides the comprehension problem. The main agent implements feedback it
agrees with and rewrites copy itself; gate subagents never touch files.

These gates read WORDS. When the rendered interface changed too (layout,
cards, charts, flows, motion), run `homa-uxui-reviewer` on screenshots of
the real surface as its own read; neither gate substitutes for the other.
