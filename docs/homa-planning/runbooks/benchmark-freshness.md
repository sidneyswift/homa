# Runbook: benchmark source freshness

The bank's credibility rests on live, current sources. This runbook keeps
them that way.

## Cadence

- Run `pnpm check:sources` at least quarterly, and always before porting
  new anchors from `docs/homa-benchmarks/` into the bank.
- The script is network-dependent by design and is NOT in CI. A dead link
  or a manifest mismatch exits 1; staleness and watchlist items are
  warnings.

## What the script checks

1. Every `MAP_SOURCES` key in `packages/core/src/map/content.ts` has a
   verified date in `scripts/benchmarks-freshness.mts`, and vice versa. A
   new source cannot ship without a verification entry.
2. Every source URL still resolves (HEAD with GET fallback, browser UA).
3. Verified dates older than 180 days warn. The watchlist prints known
   in-flight revisions (CSTA 2026, NCAS review, CEE 3rd edition, the CCSS
   site move).

## When a source moved or revised

1. Re-read the live document. If only the URL changed, update the URL in
   `MAP_SOURCES` and the verified date in the script.
2. If the CONTENT changed (a standards revision), check every bank item
   citing that source key, and every item whose `standards` codes belong
   to that body (`grep '"CSTA ' packages/core/src/map/content.ts` style
   searches make this mechanical).
3. Anchors or statements that need to move get a `MAP_BANK_VERSION` bump,
   `pnpm check:map` green, and a build-log entry. Reports store the
   version that scored them, so history never silently rewrites.
4. Refresh the matching lane in `docs/homa-benchmarks/` (or add a dated
   addendum lane like `15-refresh-sweep-2026-07.md`) so the corpus and the
   bank stay in step.

## Verified-date discipline

Update a date in the script ONLY after actually re-reading the source.
The date is a claim ("a human or agent re-verified this then"), not a
timestamp of the last time the linter ran.
