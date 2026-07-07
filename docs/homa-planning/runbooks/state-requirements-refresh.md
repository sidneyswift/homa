# Runbook: state requirements refresh

The `state_requirements` table (migration #21) holds per-jurisdiction
homeschool compliance data for all 50 states + DC, seeded from
HomeschoolLeap's free public API (CC BY-SA 4.0, attribution required).
Families will make legal filings against this data (M3-05, AQ-10), so
refreshes are gated: nothing reaches the table without a human reading
the diff.

## The pipeline

1. `pnpm pull:state-requirements`: fetches the API and rewrites
   `data/state-requirements/` (51 per-state files + index + manifest).
   Deterministic JSON (sorted keys), so a diff means upstream content
   actually changed. Fails without writing if the payload count or shape
   is off.
2. `git diff data/state-requirements`: THE review gate. Read every
   changed claim. Statute cites, deadlines, and threshold rules deserve a
   check against the linked statute (each state file carries
   `sources.statute_url` and `citation_urls`).
3. `pnpm seed:state-requirements`: upserts snapshots into the table
   (direct pooler connection, `SUPABASE_DB_PASSWORD`; the table has no
   Data API write policies). Reports inserted/changed/unchanged and fails
   unless the table ends at exactly 51 rows. `updated_at` moves only on
   real content change; `pulled_at` records the snapshot time.
4. Commit the snapshot diff and the seed in the same change, so the repo
   history always matches what the table served.

## Cadence

- Quarterly at minimum, and always before building or demoing any
  compliance surface (hours targets, state pages, report generation).
- Also on trigger: legislation watchlist items from
  `docs/homa-benchmarks/16-state-assessment-requirements.md` (CT bills,
  WV wave, TN H.B. 1729, NE bill details) and any HomeschoolLeap
  re-verification sweep (their per-state `last_verified` dates move).
- Network-dependent by design, NOT in CI (same posture as
  `check:sources`). `pnpm check:isolation` covers the table's read/write
  posture in CI.

## When a rule changed for a state with active families

Per journey J-H (wrong-legal-claim recovery), a changed rule is not just
a data update:

1. Identify which families live under the changed rule (family profile
   state, and later route/pathway).
2. If any product surface showed the OLD rule (report, hours target,
   chat answer), send a proactive correction with the new rule + statute
   link before they discover it themselves.
3. A wrong claim that came from OUR seed (not an upstream change) is a
   P0: fix the row, then do blast-radius on every family shown it.

## Trust rules that ride along

- Every compliance surface renders the statute link + the state's
  `source_last_verified` date (F4-S2). If a row looks stale or upstream
  flags it unverified, the surface says "being re-verified", never a
  silent stale claim.
- HomeschoolLeap attribution (CC BY-SA 4.0) must appear wherever the
  data is displayed substantially: "Data by HomeschoolLeap
  (homeschoolleap.com)".
- This is legal information, never legal advice; wording set by the
  M4-04 lawyer pass.
- Cross-checks when reviewing diffs: JHU Homeschool Hub (secondary
  verification per 07-deep-research-notes §3) and the hand-researched
  assessment lane `docs/homa-benchmarks/16-state-assessment-requirements.md`.
