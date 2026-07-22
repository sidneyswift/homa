import { loadEnvFile } from "node:process";

import { MEMORY_CONFLICT_MAX_DISTANCE } from "../lib/agent-memory";
import { mapDb } from "../lib/map/db";

/**
 * Audits the contradiction guardrail (findConflictingMemories) against
 * real stored memories.
 *
 * The guardrail's job is to notice when a newly saved fact restates or
 * supersedes one already held, so the agent can retire the old one in the
 * same turn. It decides that with ONE scalar: cosine distance under
 * MEMORY_CONFLICT_MAX_DISTANCE, calibrated on a single observed pair.
 *
 * This measures whether that threshold can see the redundancy we KNOW
 * exists: compaction on 2026-07-21 merged specific rows because they said
 * the same thing, which makes those rows a labelled positive set. If their
 * pairwise distance sits above the threshold, the guardrail never had a
 * chance to fire and its silence was never evidence of a clean store.
 *
 *   pnpm --filter web exec tsx scripts/memory-conflict-audit.mts
 *
 * Read only. Never writes.
 */

try {
  loadEnvFile(".env.local");
} catch {
  // CI or preconfigured shells provide the env directly.
}

interface Row {
  id: string;
  family: string;
  child: string | null;
  kind: string;
  content: string;
  superseded_at: string | null;
  embedding: string | null;
}

function parseVector(literal: string): number[] | null {
  const inner = literal.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!inner) return null;
  const values = inner.split(",").map(Number);
  return values.some((v) => !Number.isFinite(v)) ? null : values;
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 1 : 1 - dot / denom;
}

const sql = mapDb();

const rows = await sql<Row[]>`
  select m.id, f.name as family, c.name as child, m.kind, m.content,
         m.superseded_at::text as superseded_at, m.embedding::text as embedding
  from public.family_memories m
  join public.families f on f.id = m.family_id
  left join public.children c on c.id = m.child_id
  where m.kind in ('fact','what_works') and f.name = 'The Gomes family'
  order by m.created_at
`;

const withVec = rows.filter((r) => r.embedding);
console.log(
  `${rows.length} Gomes rows, ${withVec.length} with embeddings ` +
    `(${rows.length - withVec.length} without, invisible to the guardrail entirely)`,
);
console.log(`Threshold: distance < ${MEMORY_CONFLICT_MAX_DISTANCE} flags a conflict.\n`);

// The rows compaction retired today: our labelled "these said the same
// thing" set. Everything superseded on 2026-07-21 was merged or unpacked.
const retired = withVec.filter((r) => r.superseded_at !== null);
const live = withVec.filter((r) => r.superseded_at === null);

console.log(`${"=".repeat(70)}`);
console.log(`LABELLED POSITIVES: pairs among the ${retired.length} rows compaction retired`);
console.log(`${"=".repeat(70)}`);

let flagged = 0;
let missed = 0;
const distances: number[] = [];

for (let i = 0; i < retired.length; i += 1) {
  for (let j = i + 1; j < retired.length; j += 1) {
    const a = retired[i];
    const b = retired[j];
    // Same scope rule the guardrail itself applies.
    const sameScope = a.child === b.child || a.child === null || b.child === null;
    if (!sameScope || a.kind !== b.kind) continue;
    const va = parseVector(a.embedding!);
    const vb = parseVector(b.embedding!);
    if (!va || !vb || va.length !== vb.length) continue;

    const d = cosineDistance(va, vb);
    distances.push(d);
    const hit = d < MEMORY_CONFLICT_MAX_DISTANCE;
    if (hit) flagged += 1;
    else missed += 1;
    console.log(
      `${hit ? "FLAGGED " : "MISSED  "} d=${d.toFixed(3)}  [${a.child ?? "family"}]`,
    );
    console.log(`    A: ${a.content.slice(0, 78)}`);
    console.log(`    B: ${b.content.slice(0, 78)}`);
  }
}

console.log(`\n  ${flagged} flagged, ${missed} missed`);
if (distances.length > 0) {
  const sorted = [...distances].sort((x, y) => x - y);
  console.log(
    `  distance range ${sorted[0].toFixed(3)} to ${sorted[sorted.length - 1].toFixed(3)}, ` +
      `median ${sorted[Math.floor(sorted.length / 2)].toFixed(3)}`,
  );
}

console.log(`\n${"=".repeat(70)}`);
console.log(`FALSE POSITIVE CHECK: pairs among the ${live.length} rows still live`);
console.log(`(these were reviewed and left alone, so a flag here is noise)`);
console.log(`${"=".repeat(70)}`);

let noise = 0;
for (let i = 0; i < live.length; i += 1) {
  for (let j = i + 1; j < live.length; j += 1) {
    const a = live[i];
    const b = live[j];
    const sameScope = a.child === b.child || a.child === null || b.child === null;
    if (!sameScope || a.kind !== b.kind) continue;
    const va = parseVector(a.embedding!);
    const vb = parseVector(b.embedding!);
    if (!va || !vb || va.length !== vb.length) continue;
    const d = cosineDistance(va, vb);
    if (d < MEMORY_CONFLICT_MAX_DISTANCE) {
      noise += 1;
      console.log(`FLAGGED d=${d.toFixed(3)}  [${a.child ?? "family"}]`);
      console.log(`    A: ${a.content.slice(0, 78)}`);
      console.log(`    B: ${b.content.slice(0, 78)}`);
    }
  }
}
console.log(`\n  ${noise} live pairs would be flagged as conflicts today.`);

await sql.end();
