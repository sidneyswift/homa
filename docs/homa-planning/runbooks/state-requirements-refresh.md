# Runbook: state requirements refresh

The `state_requirements` table (migration
`20260707032148_state_requirements.sql`) holds per-jurisdiction
homeschool compliance data for all 50 states + DC, seeded from
the repository's dated HomeschoolLeap API snapshot. The recorded CC BY-SA 4.0
license, attribution requirements, and current upstream availability require
fresh official verification before a new pull. M3-05 and AQ-10 use this data as
legal-reference input, so
refreshes are gated: nothing reaches the table without a human reading
the diff.

## The pipeline

1. `pnpm pull:state-requirements`: fetches the API and rewrites normalized,
   recursively key-sorted JSON in
   `data/state-requirements/` (51 per-state files + index + manifest).
   Before writing, the pull applies the source-backed exact-value corrections in
   `scripts/state-requirements-reviewed-corrections.mts`. A correction only
   recognizes its reviewed bad value and corrected value; a third value aborts
   for human review. A diff means the upstream payload or reviewed correction
   changed. Validation checks count, selected fields, and mechanically
   checkable citation label-to-URL section consistency, but does not prove the
   exact jurisdiction set, uniqueness, or every legal field. The pull does not
   delete stale files.
2. `git diff data/state-requirements`: THE review gate. Read every
   changed claim. Statute cites, deadlines, and threshold rules deserve a
   check against the linked statute (each state file carries
   `sources.statute_url` and `citation_urls`).
3. Run the `State requirements seed` workflow on `main`, entering the exact
   reviewed commit SHA. It calls
   `pnpm seed:state-requirements -- --confirm-prod` with the repository's
   production secrets and upserts snapshots through the direct pooler; the
   table has no Data API write policies. A local run of that command remains
   available when the same credentials are configured. The script performs 51
   sequential upserts without one wrapping transaction, then reads every
   payload back and compares it with the reviewed snapshots. A mid-run failure
   can leave a partial refresh, but cannot report success without full payload
   parity. Its changed/unchanged summary compares payload JSON only, while
   `updated_at` watches only payload and two booleans.
4. Commit the reviewed snapshot diff. Record a sanitized seed receipt with the
   target, snapshot pull time, row count, and outcome. Git history alone does
   not prove that the external table matches the commit.

## Cadence

- Quarterly at minimum, and always before building or demoing any
  compliance surface (hours targets, state pages, report generation).
- Also on trigger: legislation watchlist items from
  `docs/homa-benchmarks/16-state-assessment-requirements.md` (CT bills,
  WV wave, TN H.B. 1729, NE bill details) and any HomeschoolLeap
  re-verification sweep (their per-state `last_verified` dates move).
- Network-dependent by design, NOT in CI (same posture as
  `check:sources`). `pnpm check:isolation` exercises selected anonymous and
  authenticated isolation paths and mutates temporary Auth and family fixtures
  in the configured Supabase project. Confirm the target and credentials before
  running it; a pass is not full proof of every state-table operation.

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

- The current state card renders a source-page link and
  `source_last_verified` date. It does not yet render a dedicated statute link,
  HomeschoolLeap attribution, or the planned "being re-verified" state. Those
  remain M3-05 acceptance work and must not be described as shipped.
- HomeschoolLeap attribution remains a requirement wherever the data is
  displayed substantially, subject to fresh license verification.
- This is legal information, never legal advice; wording set by the
  M4-04 lawyer pass.
- Suggested cross-checks when reviewing diffs: JHU Homeschool Hub and the hand-researched
  assessment lane `docs/homa-benchmarks/16-state-assessment-requirements.md`.
  The repository does not contain evidence that every current snapshot received
  a completed JHU cross-check.
