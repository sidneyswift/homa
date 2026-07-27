import { loadEnvFile } from "node:process";

import {
  compactFamilyMemories,
  compactionThresholdChars,
  type CompactionOutcome,
} from "../lib/learning/compact-memories";
import { mapDb } from "../lib/map/db";

/**
 * Runs the real compaction pass (lib/learning/compact-memories.ts) against
 * real families, dry by default. This is the gate before
 * HOMA_MEMORY_COMPACTION_ENABLED goes on anywhere: the deterministic half
 * is unit tested, but whether the model proposes GOOD merges and splits is
 * only answerable by looking at what it proposes for a real store.
 *
 *   pnpm --filter web exec tsx scripts/memory-compaction.mts
 *   pnpm --filter web exec tsx scripts/memory-compaction.mts --family "The Gomes family"
 *   pnpm --filter web exec tsx scripts/memory-compaction.mts --family "..." --apply
 *
 * Without --apply nothing is written: the pass runs, the model is called
 * (which does cost tokens), and the proposal is printed for a human. With
 * --apply the writes land through the same guarded path production uses,
 * superseding rather than deleting, so a bad call stays recoverable.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD, VERCEL_OIDC_TOKEN
 * (the AI Gateway credential; refresh with `vercel env pull` when it
 * expires, they are short lived), read from apps/web/.env.local.
 */

try {
  loadEnvFile(".env.local");
} catch {
  // CI or preconfigured shells provide the env directly.
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const apply = process.argv.includes("--apply");
const familyName = argValue("--family");

function report(outcome: CompactionOutcome, label: string): void {
  const delta = outcome.charsAfter - outcome.charsBefore;
  const sign = delta > 0 ? "+" : "";
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${label}`);
  console.log(
    `  ${outcome.charsBefore} chars -> ${outcome.charsAfter} (${sign}${delta}), ` +
      `${outcome.proposed} proposed, ${outcome.applied.length} merges, ` +
      `${outcome.unpacked.length} splits, ${outcome.rejected.length} rejected`,
  );
  console.log(`  model ${outcome.model}, ${outcome.durationMs}ms`);

  if (outcome.applied.length > 0) {
    console.log(`\n  MERGES`);
    for (const entry of outcome.applied) {
      console.log(`    (${entry.replaced} rows -> 1, ${entry.content.length} chars)`);
      console.log(`      ${entry.content}`);
    }
  }
  if (outcome.unpacked.length > 0) {
    console.log(`\n  SPLITS`);
    for (const entry of outcome.unpacked) {
      console.log(`    FROM (${entry.from.length}): ${entry.from}`);
      for (const part of entry.into) {
        console.log(`      INTO (${part.length}): ${part}`);
      }
    }
  }
  if (outcome.rejected.length > 0) {
    console.log(`\n  REJECTED`);
    for (const entry of outcome.rejected) {
      console.log(`    [${entry.reason}] ${entry.detail}`);
    }
  }
  if (outcome.applied.length === 0 && outcome.unpacked.length === 0) {
    console.log(`\n  Nothing to change. That is a valid answer.`);
  }
}

const sql = mapDb();

let targets: { id: string; name: string; chars: number }[];
if (familyName) {
  targets = await sql<{ id: string; name: string; chars: number }[]>`
    select f.id, f.name,
           coalesce(sum(char_length(m.content)) filter (
             where m.superseded_at is null and m.kind in ('fact','what_works')), 0)::int as chars
    from public.families f
    left join public.family_memories m on m.family_id = f.id
    where f.name = ${familyName}
    group by f.id, f.name
  `;
  if (targets.length === 0) {
    console.error(`No family named "${familyName}".`);
    process.exit(2);
  }
} else {
  const threshold = compactionThresholdChars();
  targets = await sql<{ id: string; name: string; chars: number }[]>`
    select f.id, f.name, sum(char_length(m.content))::int as chars
    from public.family_memories m
    join public.families f on f.id = m.family_id
    where m.kind in ('fact','what_works') and m.superseded_at is null
    group by f.id, f.name
    having sum(char_length(m.content)) >= ${threshold}
    order by sum(char_length(m.content)) desc
  `;
  console.log(`Threshold ${threshold} chars; ${targets.length} families over it.`);
}

console.log(apply ? "MODE: APPLY (writes will land)" : "MODE: DRY RUN (nothing written)");

for (const target of targets) {
  const outcome = await compactFamilyMemories(target.id, { dryRun: !apply });
  report(outcome, `${target.name} (${target.chars} chars active)`);
}

await sql.end();
console.log(`\nDone.`);
