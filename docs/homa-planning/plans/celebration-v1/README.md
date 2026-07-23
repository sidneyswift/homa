# Celebration system, v1 build plans

The celebration system spec
([`../2026-07-22-celebration-system.md`](../2026-07-22-celebration-system.md),
merged PR #116) defines a twelve-rung ladder from the in-turn "that's a first"
moment up to the printable year and the state portfolio packet. Its one law:
**a celebration is a receipt, never a verdict.**

This folder holds the adversarially-verified build plans for the v1 tranches.
Each was produced by a design pass, then three skeptics (correctness, harm,
law), then a revise pass that folded surviving objections back in. The file
specs already reflect those objections; the objection list at the bottom of
each doc is the audit trail, not a to-do list.

## Status (2026-07-22)

| Tranche | Plan | Built? |
|---|---|---|
| Keep their voice (D1) | (folded into the ruling) | ✅ **shipped**, PR #122, live in prod |
| Kid standing chip removed (D7) | (de-risk) | ✅ shipped, PR #118 |
| Abilities map card | (earlier) | ✅ shipped, PR #115 |
| **1. Receipt spine** | [`1-receipt-spine.md`](1-receipt-spine.md) | ☐ not started |
| **2. Guards and truth** | [`2-guards-and-truth.md`](2-guards-and-truth.md) | ☐ not started |
| **3. Friday letter** | [`3-friday-letter.md`](3-friday-letter.md) | ☐ not started |

Rungs still spec-only, no build plan yet: R5 free credit, R7 your own words
answered, R8 then-and-now, R9 dinner question, R10 ninety days, R11 area
certificate, R12 portfolio packet.

All seven founder decisions (D1-D7) are now ruled (spec section 7). The two
that touch these three tranches are settled: the Friday letter goes to the
reporting adult by default with per-child opt-in for a second adult (D5), and
its named-worry rail runs at a monthly minimum (D6). D2 (certificate wording)
and D3 (Homa may proactively remind about portfolio deadlines in states that
require one) govern the certificate and portfolio rungs, which have no build
plan yet. Note D3 created a narrow second proactive channel: see the spec's R6
reconciliation note before assuming "the Friday letter is the only proactive
beat" is still literally true.

## Build order, and why

Build in the numbered order. It is a dependency order, not a priority order.

1. **Receipt spine first.** The page of firsts and the provenance viewer are
   pure read-time projections over evidence rows that already exist: no
   migration, no new capture, nothing to reconcile. It is also the surface the
   Friday letter reads from, so building it first means the letter has real
   receipts to point at rather than a stub. Smallest and safest of the three.

2. **Guards and truth second.** Coverage-is-not-ability, the correction and
   regression paths, the "is he behind his sister?" move, and the measurement
   instrument. This is the safety layer every proactive surface leans on, so it
   lands before the letter that would expose the gaps.

3. **Friday letter last.** The large ticket and the only proactive beat. It
   reads the receipt spine and relies on the guards, so it goes last. It is the
   one tranche that ships a migration (`celebration_letters`), so mind the
   prod-schema-and-code-together law: additive, may lead the deploy.

## How to read a plan doc

Each doc has: a summary (what folded in and why), a section per file with the
exact signatures / logic / copy strings, a test section with one line per case,
edge cases, risks (including objections the author deliberately rejected, with
reasons), a list of verified facts, and the folded-objection audit trail.

**Every `file:line` citation was written by an agent reading the repo on
2026-07-22.** Treat them as strong leads, not gospel. Re-verify each before you
touch it; the codebase moves, and three of these plans overlap files (all three
touch `packages/core/src/events.ts`; guards and the letter both touch the
narrative gate).

## The binding laws these plans were written under

- **Models judge, code verifies.** A model may decide what a sentence means; code
  verifies existence, tenancy, provenance (a quote is verbatim in its source),
  age-plausibility, and caps. The one narrow exception is a deterministic
  security floor (roster-name and banned-word suppression), which is exact
  string checking over a known catalog, not interpretation.
- **A celebration is a receipt, never a verdict.** Every parent-facing sentence
  names something that already happened and traces in one tap to the parent's
  own words with a date.
- No denominators, no percentages, no totals, no streaks, no inactivity nudges,
  no child-facing view, never the word "behind", never a sibling comparison,
  **no em dash anywhere**.
- `familyId` never comes from the model or client; every model-supplied id is
  re-scoped inside the authenticated family.
- Prod schema and code ship together; additive migrations may lead, breaking
  ones may not.
