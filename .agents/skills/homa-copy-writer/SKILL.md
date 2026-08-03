---
name: homa-copy-writer
description: The Homa copy rulebook. Read before writing or editing parent-facing words anywhere in the product or marketing. Copy must be true, clear, and memorable; boring is a failure state, and fewer words is not the goal. Also routes each fix to its producer: generator prompt, template sentence bank, component string, or page. Pairs with homa-copy-reviewer then homa-copy-editor. Layers on top of marketing/voice/house-style.md; never replaces its bans or format limits.
---

# Homa copy writer · the rulebook

Homa's reader is a busy, non-technical homeschool mom with five stolen
minutes and half her attention. Every rule here serves one goal: she
understands each sentence on the first pass, knows what it means for her,
and never feels judged.

## The priority law

**Clear AND memorable. Boring is a failure state.** (Founder ruling
2026-07-29, `copy-voice-memorable`, which overturns the 2026-07-08
`copy-clarity` law that ranked clarity above personality. Both logged in
docs/homa-planning/build-log.md.)

She has a hundred tabs open and no reason to come back to something that
reads like a form letter. Copy she understands and forgets did not do its
job. Personality is not decoration added to a clear sentence; it is what
makes her read the second sentence.

Clarity is still the floor. It stopped being the ceiling. When a charming
line and a plain line carry the same fact, ship the one she will still be
able to quote tomorrow, and if the charming one costs her a re-read, it was
not charming, it was showing off.

The order when they genuinely conflict: **true, then clear, then
memorable, then short.** Never buy memorable with accuracy, and never buy
short with meaning.

## What cognitive load actually is

Load is measured in re-reads and pauses, never in word count. Cutting words
that carry meaning RAISES load. Never trade clarity for brevity to fit a
length cap; cut a whole idea instead, or split the sentence.

- One idea per sentence, when the idea is load-bearing. This is a default
  for facts and instructions, not a ban on rhythm: vary sentence length,
  because a short one lands harder after a long one.
- Front-load the point. The fact or action comes first, color after.
- Subject, verb, object. No inverted syntax for flair ("Strengths, first").
- No garden paths: a list inside a clause inside a list forces a re-read.
- The em dash ban is not a license for comma splices. Three or more clauses
  glued by commas is a run-on; use a period.
- One name per concept, everywhere: "progress report" never "map",
  "subject" never "domain", plain age words never "band", colors in copy
  are yellow / green / blue.
- The countable datum is an "answer", never "observation" (founder ruling
  2026-07-14): what an adult said or showed about one skill, whatever the
  channel (checklist tap, deeper question, report correction, check-in
  reply, journal note or lesson Homa matched to a skill). Counts read
  "N answers"; the source label next to an answer says where it came
  from. This vocabulary must survive past onboarding: never count
  "questions answered" (later answers arrive without questions). The
  formal third-party artifacts (evidence pack, one-pager, method page,
  terms) may keep "a parent's observations" in prose; that register is
  for evaluators, not for her.
- No meta-commentary about the copy itself: "here's the honest picture",
  "the part worth circling", "the real story is". Just say the thing.
- Reach for an image when it makes the idea land faster than the plain
  sentence would, and use the plain sentence when it does not. No quota.
  What is still banned is the STACK ("a starting line, not a verdict, watch
  the numbers move"), because three images in a row make her translate
  instead of read. One good one is worth having.
- Reassurance leads when something is actually wrong (a failure, a scary
  number, a thing she thinks she broke). Everywhere else, lead with the
  useful thing. Never wrap every fact in its own cushion: a cushion on a
  fact that did not need one reads as bad news withheld.
- Say the real thing, then be kind about it. Charm over cruelty, never
  sugarcoating over charm. When warmth and honesty pull apart, honesty
  wins and warmth carries it.
- Be funny when it is actually funny: dry, specific, earned by knowing the
  reader's real Tuesday. Never bits, never a quip bolted on at the end,
  never exclamation marks doing a good sentence's work. A forced joke is
  worse than no joke. Never at the parent's or a child's expense, and
  never when she is struggling.
- Plain words beat clever euphemisms. When a banned word forces a
  workaround, the replacement must still say something concrete ("growing
  right now" always arrives with the named next step).

## Hard laws (never bend, from AGENTS.md and copy-laws.ts)

- No em dash, ever. Comma, period, colon, or mid-dot.
- The name is always written "Homa", everywhere, including UI surfaces.
  Never type "HOMA". Where the brand appears as a mark, render the real
  `Logo` component (`apps/web/components/brand/Logo.tsx`), never a
  hand-typed imitation of it, and that includes a lowercase string put
  through an uppercase text transform. Founder correction 2026-07-28
  (`brand-casing-homa`), which retires the old D8 wording this line
  used to carry. Sentence case still governs the surrounding words.
- Never "behind" (in ANY sense), no deficit words, no diagnosis or testing
  vocabulary, no percentiles. Growth framing only.
- Never compare siblings. Never a verdict on a child.
- She decides, you suggest. That is respect, not timidity: recommend
  plainly ("I'd start with the counting mat"), never hedge into mush
  ("you might possibly want to consider maybe"), and never issue an order.
  Temporal never causal ("since June", never "because you did X").
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
| Dashboard cards | Mixed: sentences composed in components | `apps/web/components/dashboard/*.tsx` |
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
- The voice sections share the common laws in this rulebook but are not exact
  mirrors. A change to a shared law requires a deliberate pass across
  `instructions.md`, `report-writer.md`, and `curriculum-writer.md`; a
  surface-specific rule stays with its producer.
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
