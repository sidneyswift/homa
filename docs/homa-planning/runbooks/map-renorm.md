# Runbook: Homa-native norms (the re-norm loop)

Every map sitting stores anchored observations (`lead_answers` +
`lead_children.birth_month`). At cohort scale, that becomes the only
parent-observed homeschool norm base in existence: our moat. This runbook
turns that data into anchor corrections safely.

## The loop

1. Run `pnpm report:norms` (founder machine only; needs
   `SUPABASE_DB_PASSWORD` in `apps/web/.env.local`). Output is aggregate
   markdown: per item, answer shares by 6-month age bucket next to the
   item's published `typicalMonths` anchor.
2. Items where the observed 50%-easily age diverges from the anchor by
   more than 6 months get a FLAG. A flag is a question, not a verdict.
3. Before touching any anchor, check the gates below. If the gates pass
   and the evidence agrees, move the anchor in
   `packages/core/src/map/content.ts`, bump `MAP_BANK_VERSION`, run
   `pnpm check:map`, and log the decision in the build log with the
   sample sizes.

## Gates (all must pass before an anchor moves on our data)

- **Sample:** at least 100 real observations (easily / getting there /
  not yet) in the buckets around the anchor, not just 30 in one bucket.
- **Selection honesty:** our sample is homeschool families who chose
  Homa, not a national sample. Observed-late items may mean our anchor is
  early OR our cohort works on it later; check the published source
  before moving anything. Prefer widening the published-source range over
  contradicting it.
- **Item wording:** a divergence can mean the statement is being read
  differently than intended (the corpus's parent-observability law).
  Consider rewording before re-anchoring.
- **Direction of harm:** anchors err conservative (later) by design,
  matching the CDC 2022 75th-percentile philosophy. Moving an anchor
  EARLIER needs the strongest evidence, because early anchors create
  false "growing" states.

## Privacy posture (non-negotiable)

The report is aggregate-only: no names, emails, or ids ever appear in the
output; buckets under n=30 render as "low n". The script is read-only,
runs locally with the server-only credential, and is never deployed or
scheduled on infrastructure. Anything beyond aggregate counts is out of
scope for this loop and needs its own founder decision.

## Cadence

Quarterly, or whenever total stored answers double, whichever comes
first. Expect "insufficient data" verdicts for a long time at current
volume; the loop exists so the data compounds from day one.
