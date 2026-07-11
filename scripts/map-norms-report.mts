/**
 * Homa-native norms report (founder ops, read-only).
 *
 * Aggregates map answers by bank item and child age band to show how OUR
 * families actually answer at each age, next to the item's published
 * typicalMonths anchor. This is the seed of the re-norm loop: at cohort
 * scale, observed attainment curves become evidence for moving anchors
 * (procedure: docs/homa-planning/runbooks/map-renorm.md).
 *
 * Privacy and tenancy posture:
 *   - Aggregate counts only. No names, emails, or ids in the output.
 *   - Read-only queries; runs locally with the server-only DB password
 *     (same credential path as apps/web/lib/map/db.ts), never deployed.
 *   - Buckets under MIN_BUCKET_N render as "low n" instead of percentages,
 *     so no small-cell inference is possible.
 *
 * Usage: pnpm report:norms   (tsx scripts/map-norms-report.mts)
 * Env: apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD).
 * Output: markdown on stdout; redirect to a file if you want to keep it.
 */

import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { MAP_BANK_VERSION, MAP_SUBJECTS } from "../packages/core/src/index";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when the vars arrive via the environment.
}

/** Buckets smaller than this are reported as "low n", never as percentages. */
const MIN_BUCKET_N = 30;
/** Age bucket width in months (6 = half-year bands, matching the scorer's grain). */
const BUCKET_MONTHS = 6;
/** Flag items whose observed picture diverges from the anchor by more than this. */
const DIVERGENCE_MONTHS = 6;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!supabaseUrl || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DB_PASSWORD (apps/web/.env.local)");
  process.exit(2);
}
const ref = new URL(supabaseUrl).hostname.split(".")[0];

const sql = postgres({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  username: `postgres.${ref}`,
  password,
  ssl: "require",
  prepare: false,
  max: 1,
  idle_timeout: 10,
  connect_timeout: 15,
});

interface BucketRow {
  question_id: string;
  age_bucket: number;
  answer: string;
  n: number;
}

/**
 * Age at answer time in whole months, bucketed. birth_month is stored as a
 * date with day 01 (no birth day is ever collected), matching the app's
 * ageInMonths convention.
 */
const rows = await sql<BucketRow[]>`
  select
    a.question_id,
    (floor((
      (extract(year from a.answered_at) - extract(year from c.birth_month)) * 12
      + (extract(month from a.answered_at) - extract(month from c.birth_month))
    ) / ${BUCKET_MONTHS}) * ${BUCKET_MONTHS})::int as age_bucket,
    a.answer,
    count(*)::int as n
  from public.child_answers a
  join public.lead_children c on c.id = a.child_id
  where a.answer in ('easily', 'getting_there', 'not_yet')
  group by 1, 2, 3
  order by 1, 2
`;

const totals = await sql<{ children: number; answers: number }[]>`
  select
    (select count(distinct child_id) from public.child_answers)::int as children,
    (select count(*) from public.child_answers)::int as answers
`;

await sql.end();

// question_id -> age_bucket -> counts
const byItem = new Map<string, Map<number, { easily: number; getting: number; notYet: number }>>();
for (const row of rows) {
  const buckets = byItem.get(row.question_id) ?? new Map();
  const bucket = buckets.get(row.age_bucket) ?? { easily: 0, getting: 0, notYet: 0 };
  if (row.answer === "easily") bucket.easily += row.n;
  else if (row.answer === "getting_there") bucket.getting += row.n;
  else bucket.notYet += row.n;
  buckets.set(row.age_bucket, bucket);
  byItem.set(row.question_id, buckets);
}

/** First bucket (ascending) where at least half of n answered "easily". */
function observedAttainmentBucket(
  buckets: Map<number, { easily: number; getting: number; notYet: number }>,
): { bucket: number; n: number } | null {
  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  for (const [bucket, counts] of sorted) {
    const n = counts.easily + counts.getting + counts.notYet;
    if (n < MIN_BUCKET_N) continue;
    if (counts.easily / n >= 0.5) return { bucket, n };
  }
  return null;
}

console.log("# Map norms report (aggregate, founder ops)\n");
console.log(`Generated ${new Date().toISOString().slice(0, 10)} against bank ${MAP_BANK_VERSION}.`);
console.log(
  `${totals[0].answers} stored answers across ${totals[0].children} children. ` +
    `Buckets under n=${MIN_BUCKET_N} are shown as "low n" and never interpreted.\n`,
);
console.log(
  "Reading rule: observed-50% is the first age bucket where at least half of real answers were " +
    '"easily". It only means something at scale; see the re-norm runbook before touching any anchor.\n',
);

let flagged = 0;
for (const domain of MAP_SUBJECTS) {
  console.log(`## ${domain.displayName}\n`);
  console.log("| Item | Anchor (mo) | Observed answers by age bucket | Observed 50% easily |");
  console.log("| --- | --- | --- | --- |");
  for (const item of domain.items) {
    const buckets = byItem.get(item.id);
    if (!buckets || buckets.size === 0) {
      console.log(`| ${item.id} | ${item.typicalMonths} | no data yet | no data yet |`);
      continue;
    }
    const cells = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, counts]) => {
        const n = counts.easily + counts.getting + counts.notYet;
        if (n < MIN_BUCKET_N) return `${bucket}mo: low n (${n})`;
        const pct = Math.round((counts.easily / n) * 100);
        return `${bucket}mo: ${pct}% easily (n=${n})`;
      })
      .join("; ");
    const attained = observedAttainmentBucket(buckets);
    let verdict = "insufficient data";
    if (attained) {
      const delta = attained.bucket - item.typicalMonths;
      verdict = `${attained.bucket}mo (anchor ${delta >= 0 ? "+" : ""}${delta})`;
      if (Math.abs(delta) > DIVERGENCE_MONTHS) {
        verdict += " FLAG";
        flagged += 1;
      }
    }
    console.log(`| ${item.id} | ${item.typicalMonths} | ${cells} | ${verdict} |`);
  }
  console.log("");
}

console.log(
  flagged > 0
    ? `${flagged} item(s) flagged with observed-vs-anchor divergence beyond ${DIVERGENCE_MONTHS} months. Follow the runbook before changing anything.`
    : "No item meets the divergence flag threshold at current sample sizes.",
);
