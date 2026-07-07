# LLM report depth: options, rulings, and the chosen shape

Date: 2026-07-06 (night session)
Status: RULED. All blocking questions answered by the founder in chat the same
evening. This doc records the problem, the verified mechanism, the options as
they stood, the Q&A with rulings inline, and the shape that won. The
ready-to-hand build prompt lives at
`2026-07-06-llm-report-narrative-implementation-prompt.md`.

## 1. Problem statement

The founder, looking at a real report on 2026-07-06:

> "The results of the cards seem redundant because of the way we are
> generating them. I believe we could provide more value if an LLM generated
> a deeper report, and certain elements of each card."

What they saw: six subjects scored "On track" in a row, and every card opened
with the identical sentence "Right where most kids their age are." The
evidence clause varies; the voice does not. It reads like a form letter.

## 2. Verified mechanism (spot-checked in code)

- `packages/core/src/map/sentences.ts` `domainLine()` has exactly one opener
  per position. Six on-track subjects means six identical openers. "Growing"
  rotates three openers by domain-id hash; exposure subjects have fixed
  lines. The redundancy is structural, not a bug.
- Everything the report knows already exists as structured data per subject:
  position, monthsAhead, strongestObservedStatement, frontierStatement, every
  answer with its typicalMonths and sources, child age, interests, help-with
  tags, whatsWorking notes, and score history across rescores
  (`lead_reports.scores` + `history`, capped at 12 snapshots). The raw
  material is far richer than the one sentence rendered from it.
- Prose is derived at render time and stored nowhere. There is no per-report
  narrative storage today.
- The report renders the instant scoring finishes (D5=A); the email is
  fire-and-forget after scoring.
- The sample report at `/onboarding/sample` renders from a committed fixture
  with zero model calls, and skeptics inspect it before giving an email.
- Two shipped pages carry the old posture in public copy:
  `apps/web/app/privacy/page.tsx` ("No AI provider receives your
  questionnaire answers... If that ever changes, this page changes first")
  and `apps/web/app/onboarding/method/page.tsx` ("No AI reads or scores your
  answers... the same answers always produce the same report").
- The signed-in product already sends family data (names, ages, interests,
  memories) through the gateway-routed model in chat; the "no AI" claim was
  specific to the lead-magnet questionnaire answers.

## 3. What this re-opened

Founder decision D8 in `docs/homa-planning/lead-magnet/index.html` chose
curated sentence banks: zero model calls, one human pass reviews every
sentence, and the marketing line "no AI provider ever sees the answers" for
the AI-wary channel. The founder's ask re-opened D8 and its three
commitments: the privacy line, the pre-review posture, and the
same-answers-same-report determinism contract.

## 4. Founder Q&A, rulings inline (2026-07-06 evening session)

1. **D8 re-decision.** Asked whether "zero model calls" stands. Ruling,
   verbatim: "fuck privacy. customers care about results." D8 is OVERTURNED
   for report prose. Mechanical consequence accepted: the privacy page and
   the method page change in the same PR that ships generation (the privacy
   page itself promises it "changes first"). The FAQ line "your child never
   talks to an AI" stays true and stays.
2. **Which elements does the model write.** Recommendation was per-card
   sentences plus a new whole-picture synthesis. Ruling went further: "LLM
   should write all of it. but we should create metadata so some answers or
   numbers or w/e can be deterministic or at least tracked in the database
   over time... lean into intelligence, while capturing data correctly,
   writing scripts where deterministic answers matter and building homa into
   an 'agent' for the user that is personal to them." Interpreted and
   confirmed as the facts/voice split: code computes every number, the
   database tracks every fact and every generated narrative over time, the
   model writes every word a parent reads. One writer, one voice.
3. **Latency.** First ruling: B, hold the report behind an honest "Homa is
   writing Maya's report" moment, capped ~20s. Amended minutes later: "dont
   cap the report time. let the agent do its thing. I would rather the
   report and the deep dives and the 4 week ciricculums be FUCKING
   INCREADIBLE, then have it take less than 20 seconds." Final: the writing
   moment is uncapped; quality is the constraint. Templates render only on
   hard failure, never on slowness. The report email sends when generation
   completes, so the emailed link always opens a finished report.
4. **Email depth.** Today's report email is two sentences and a button;
   there is no depth for intelligence to add yet. v1 keeps it as the short
   pointer to the living report. Revisit when the email has something to
   carry. (Accepted in the reasoning pass, not contested.)
5. **Cost.** Full-depth generation is roughly $0.03 to $0.05 per report on
   claude-sonnet-5 intro pricing ($2/M in, $10/M out through 2026-08-31,
   then $3/$15; new tokenizer runs ~30% heavier). A 200-report conference
   day is about $10. Ruled a non-constraint by inspection.
6. **Runtime gate.** The build-time copy checks in `scripts/map-check.mts`
   become a runtime validator over generated text: banned words (behind,
   delay, disorder, diagnosis language, screening, assessment, percentile),
   em dashes, negative numbers, sibling comparisons, length caps, plus the
   new grounding check: any number or age claim not present in the facts
   payload rejects the piece. A rejected piece falls back to its template
   line; a failed call falls back whole.
7. **Grounding contract.** Interpretation is allowed and is the point
   ("rhyming and letter names are the same pre-reading story"). Numbers are
   not: the model never computes or invents a number, age, position, or
   benchmark; it writes around facts handed to it. "Scripts where
   deterministic answers matter" = scorer, ages, badges, chart, movement
   math, citations stay code forever.
8. **Regeneration.** Default accepted without veto: regenerate the narrative
   on every rescore (deep dives included), so prose never sits stale next to
   moved numbers. Prior narratives snapshot into history alongside prior
   scores.
9. **Provider and model.** Default accepted without veto: the same
   gateway-routed `anthropic/claude-sonnet-5` the chat agent uses, sharing
   the same voice rules source, so the report and the daily Homa sound like
   one person. Model id lives in one shared constant; swapping later is one
   line.
10. **Sample report and red-team fixture.** Default accepted without veto:
    generate the sample's narrative once with the real pipeline, hand
    review, commit as fixture. The struggling-kid (hardest honest case)
    generation is produced by the same script and read aloud before any
    prompt version ships. `/onboarding/sample` never makes a live call.
11. **Conference timing (July 13).** Asked; the founder answered the cap
    question instead, and the energy of the answer ("let the agent do its
    thing") sets the default: build now behind a server flag, flip it on
    the moment the founder read-aloud passes, whether that lands before or
    after July 13. The flag makes this reversible mid-conference. Logged as
    a standing default, vetoable in one line.

## 5. The options as they stood, and what won

| Option | Per-report cost | Latency | Kill criterion | Verdict |
|---|---|---|---|---|
| A. Richer templates, no LLM | $0 | instant | still a form letter, ceiling too low | dead (ruling 1) |
| B. LLM re-voices each card | ~$0.02 | ~8 to 15s | two-voice seams with template note/synthesis | subsumed |
| C. Templates keep cards, LLM writes one synthesis | ~$0.01 | ~4 to 8s | leaves the redundant openers in place, the original complaint | subsumed |
| D. Progressive depth (instant paint, async swap-in) | ~$0.03 | 0s first paint | words shifting under the reader reads as glitchy; first impression stays redundant | dead (ruling 3) |
| E. Depth lives in the product only | $0 free tier | n/a | withholds the wow from the lead magnet, the surface being fixed | dead (rulings 1+2) |
| **F. Full narrative layer (chosen)** | **~$0.03 to $0.05** | **uncapped writing beat** | see kill criteria below | **RULED IN** |

F, the chosen shape: code computes facts, the model writes all parent-facing
prose (top note, 16 card lines, new whole-picture synthesis, drawer
explainers, four-week plan prose) in the Homa voice, generation is stored
and versioned on the report row, a runtime gate validates every piece,
templates are the permanent fallback skeleton, the sample is a hand-reviewed
committed fixture, and the whole layer sits behind a server flag.

## 6. Kill criteria for the chosen shape

- The struggling-kid read-aloud makes the founder wince and prompt iteration
  cannot fix it: flag stays off, lead magnet ships templates, depth retreats
  to the signed-in product (old option E) while the prompt matures.
- Generation p95 grows past ~90s on real reports: revisit scope per call
  (split drawers/plans to lazy generation on first open) before revisiting
  the no-cap ruling.
- Gate rejection rate above ~10% of pieces in production: the prompt is not
  ready; flag off, fix, re-run the fixtures.
- Cost only kills at absurdity (>$0.25/report), which current scope cannot
  reach.

## 7. Unknowns resolved and remaining

Resolved this session: D8 posture, scope of generation, latency posture,
failure posture, storage-and-versioning requirement, regeneration policy,
model/provider, sample handling, gate ownership.

Remaining, owned by the build (none need a founder):
- Writing-beat UX during an uncapped wait (honest status lines; polling vs
  held request; the implementation prompt specifies polling + background
  generation so a closed tab never loses the report).
- Exact schema shape (columns on `lead_reports` vs sibling table; prompt
  recommends columns plus history entries, decided in migration review).
- Prompt engineering to the Homa voice bar, iterated against the two
  committed fixtures.
- Method-page and privacy-page wording (drafted in the implementation
  prompt, founder reads in PR).
