# Runbook: Homa-native norms (the re-norm loop)

Map sittings store anchored observations in `child_answers` joined to
`children.birth_month`, whose legacy column name now holds a full birth date.
This runbook describes how Homa may use its own parent-observed cohort as one
input to anchor review. It does not establish a national norm or a unique moat.

## The loop

1. Run `pnpm report:norms` (founder machine only; needs
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_DB_PASSWORD` in
   `apps/web/.env.local`). Output is aggregate
   markdown: per item, answer shares by 6-month age bucket next to the
   item's published `typicalMonths` anchor.
   The current query does not distinguish production families from test or
   incomplete cohorts. It calculates calendar year/month differences and
   ignores the birthday day, so observations near a month boundary are
   approximate. Suspend anchor changes from this report until cohort eligibility
   and day-precise age math are implemented.
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

The report is aggregate-only and contains no names, emails, family IDs, or child
IDs. It does print bank item IDs, exact overall child and answer totals, and the
exact count inside each `low n` cell. Treat the output as founder-private and do
not store or share it as a privacy-safe aggregate. The script is read-only, runs
locally with the server-only credential, and is not deployed or scheduled.

## Cadence

Quarterly, or after an explicitly recorded answer-count checkpoint doubles.
The repository does not persist a last-run count, so the doubling trigger is
not otherwise computable. Expect "insufficient data" verdicts for a long time.
