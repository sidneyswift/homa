# Handoff: build the celebration system v1

Paste the block below to a fresh agent in a new git worktree off `main`. It is
self-contained and assumes no prior context. It scopes the first unit of work to
tranche 1 (the receipt spine), then a review stop.

The plan docs it refers to live beside this file:
[`README.md`](README.md), [`1-receipt-spine.md`](1-receipt-spine.md),
[`2-guards-and-truth.md`](2-guards-and-truth.md),
[`3-friday-letter.md`](3-friday-letter.md), and the spec at
[`../2026-07-22-celebration-system.md`](../2026-07-22-celebration-system.md).

---

You are picking up the Homa "celebration system" build. Work in a fresh git
worktree off `main`.

## What this is

Homa is a multi-tenant AI homeschool assistant (pnpm + Turborepo monorepo,
Next.js, Supabase Postgres, Vercel). The celebration system is how Homa hands a
parent evidence of their child's growth: a page of firsts, a Friday letter, and
truth-guards around all of it. The spec is merged and the build plans are
written and adversarially verified. Your job is to implement them, in order,
each as its own PR.

## Read these first, in order

1. `AGENTS.md` (repo root) , the project laws. Pay special attention to the
   "Models judge, code verifies" section and the tenant-isolation law.
2. `docs/homa-planning/plans/2026-07-22-celebration-system.md` , the spec (a
   proposal; the one law is "a celebration is a receipt, never a verdict").
3. `docs/homa-planning/plans/celebration-v1/README.md` , the build order and
   status table.
4. `docs/homa-planning/plans/celebration-v1/1-receipt-spine.md` , your FIRST
   deliverable, in full.

## Build order (dependency order, not priority)

1. **Receipt spine** (`1-receipt-spine.md`) , the page of firsts + provenance
   viewer. Pure read-time projection, no migration. Everything else reads from
   it, so it goes first. START HERE.
2. **Guards and truth** (`2-guards-and-truth.md`) , coverage-is-not-ability,
   corrections/regressions, the "is he behind his sister?" chat move,
   measurement. The safety layer.
3. **Friday letter** (`3-friday-letter.md`) , the only proactive celebration
   beat, the large ticket. Ships a migration (`celebration_letters`). Its
   named-worry rail is now ruled (D6, spec section 7): build it with a monthly
   minimum cadence (one true sentence about the mother's named worry subject at
   least every fourth weekly letter, including the honest slow answer when
   nothing moved). Recipient default is also ruled (D5): the letter goes to the
   adult who has been reporting evidence for that child, with per-child opt-in
   for a second adult.

Ship tranche 1 as its own PR and stop for review before starting tranche 2.
Do not batch them.

## How to use a plan doc

Each doc has: a summary, a section per file with exact signatures/logic/copy
strings, a test section (one line per case), edge cases, risks (including
objections the author rejected, with reasons), verified facts, and the folded-
objection audit trail. Build the files as specified and write every listed test.

CRITICAL: every `file:line` citation was written by an agent reading the repo on
2026-07-22. Treat them as strong leads, NOT gospel. Re-verify each with your own
Read/Grep before you touch it. The codebase moves. The three plans overlap
files (all touch `packages/core/src/events.ts`; guards and the letter both touch
`packages/core/src/map/narrative-gate.ts`).

## Non-negotiable laws (from AGENTS.md)

- **Models judge, code verifies.** A model may decide what a sentence MEANS;
  deterministic code verifies existence, tenancy, provenance (a quote is
  verbatim in its source), age-plausibility, and caps. Never regex/keyword-match
  to decide meaning. The one narrow exception is a deterministic security floor
  (roster-name + banned-word suppression) , exact string checks over a known
  catalog, failure mode is suppression not misattribution.
- **A celebration is a receipt, never a verdict.** Every parent-facing sentence
  names something that already happened and traces in one tap to the parent's
  own words with a date.
- No denominators, no percentages, no totals, no streaks, no inactivity nudges,
  no child-facing view, never the word "behind", never a sibling comparison.
- **No em dash, ever, anywhere** (code, copy, docs, commits). Use a comma,
  period, colon, or mid-dot.
- `familyId` NEVER comes from the model or client. Every model-supplied id is
  re-scoped inside the authenticated family.
- Prod schema and code ship together. Additive migrations may lead the deploy;
  breaking ones may not. The Friday letter's migration is additive.
- Imports at top of file, no inline imports. Sentence case in copy.

## Setup and verification

Install in a fresh worktree (Homebrew pnpm 9 silently drops the eve patch, so
use corepack):

    corepack pnpm install

Before opening a PR, all of these must be green (run the ones your tranche
touches, plus these always):

    pnpm typecheck
    pnpm lint
    pnpm check:isolation        # required before any schema/query change
    pnpm check:progress-ui
    pnpm check:child-progress
    pnpm check:events           # if you touched packages/core/src/events.ts
    pnpm child-progress:e2e     # disposable local Postgres; required if you
                                # changed a query or a table the harness builds

The child-progress E2E harness (`scripts/child-progress-postgres-test.mts`)
hand-writes only the tables it needs. If your code reads a new table, ADD it to
the harness rather than letting the code tolerate its absence: swallowing
"relation does not exist" hides real schema drift.

New tests must be wired into the relevant `pnpm check:*` script in `package.json`
so CI runs them, not just left as loose files.

## Verifying UI changes

For any observable UI (the firsts page, the abilities card changes), render it
and look at it before shipping , do not trust that it compiles. This worktree
has no `.env.local`; copy one from the main worktree
(`apps/web/.env.local`, it is gitignored) so the dev server's Supabase
middleware does not 500 every request. Note that `_`-prefixed app-router folders
are private and never route; use a plain folder name for any throwaway preview
page and delete it before committing.

## PR discipline

- Branch off `main`; never push to `main` directly. One PR per tranche.
- Confirm CI is actually green (`gh pr view <n> --json statusCheckRollup`) before
  saying it passes. A green local build is not a green deploy.
- End commit messages with:
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- End PR bodies with the Claude Code generation line.
- All seven founder decisions (D1-D7) are now ruled; see spec section 7. If a
  plan still conflicts with what you find in the code, or with a ruling, STOP
  and surface it rather than inventing policy. Founder rulings outrank plan docs.

Start by reading the four docs above, then re-verify the receipt-spine plan's
citations against the current code, then build it.
