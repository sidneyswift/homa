/**
 * Phase C dormant-window evidence snapshot
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md §6
 * Phase C, bullets 2-3: "a temporary server-side read counter show[s] zero
 * product reads after the cutover baseline" and "verify no new
 * family_skills rows appear").
 *
 * Captures, for public.skill_bank and public.family_skills: row count,
 * newest updated_at, and Postgres's own cumulative scan counters
 * (pg_stat_user_tables.seq_scan + idx_scan, the closest first-party proxy
 * for "how many times has anything queried this table"). Writes a
 * timestamped JSON snapshot to a local evidence directory, and when a
 * prior snapshot exists, diffs against it: unchanged row counts and
 * unchanged scan counters are the dormant-window evidence; any delta needs
 * an explanation before Phase C can close.
 *
 * This command never loads an environment file and never runs
 * automatically. Rerun it periodically across the 7-day window (docs
 * reference it from build-log.md); the diff against the very first
 * snapshot is the evidence, not any single run.
 *
 * Usage (run from the repo root):
 *   HOMA_SKILL_ARCHIVE_DATABASE_URL=postgres://... \
 *   pnpm --filter web exec tsx scripts/fleet-skills-dormant-snapshot.mts
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

import { SKILL_ARCHIVE_TABLES, type SkillArchiveTable } from "./skill-archive-format.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir = path.join(repoRoot, "supabase", ".temp", "fleet-skills-dormant-evidence");

interface TableSnapshot {
  rowCount: number;
  newestUpdatedAt: string | null;
  seqScan: number;
  idxScan: number;
}

interface Snapshot {
  capturedAtUtc: string;
  tables: Record<SkillArchiveTable, TableSnapshot>;
}

async function captureTable(sql: postgres.Sql, table: SkillArchiveTable): Promise<TableSnapshot> {
  const [rowCountRow] = await sql<{ count: string }[]>`
    select count(*)::text as count from public.${sql(table)}
  `;
  const [updatedAtRow] = await sql<{ newest: string | null }[]>`
    select max(updated_at)::text as newest from public.${sql(table)}
  `;
  const [statRow] = await sql<{ seq_scan: string; idx_scan: string }[]>`
    select coalesce(seq_scan, 0)::text as seq_scan, coalesce(idx_scan, 0)::text as idx_scan
    from pg_stat_user_tables
    where schemaname = 'public' and relname = ${table}
  `;
  return {
    rowCount: Number(rowCountRow?.count ?? "0"),
    newestUpdatedAt: updatedAtRow?.newest ?? null,
    seqScan: Number(statRow?.seq_scan ?? "0"),
    idxScan: Number(statRow?.idx_scan ?? "0"),
  };
}

function diffLine(table: SkillArchiveTable, previous: TableSnapshot, current: TableSnapshot): string[] {
  const lines: string[] = [];
  if (previous.rowCount !== current.rowCount) {
    lines.push(
      `${table}: row count changed ${previous.rowCount} -> ${current.rowCount} (a write happened; Phase C requires explaining this before closing)`,
    );
  }
  if (previous.newestUpdatedAt !== current.newestUpdatedAt) {
    lines.push(
      `${table}: newest updated_at changed ${previous.newestUpdatedAt ?? "null"} -> ${current.newestUpdatedAt ?? "null"}`,
    );
  }
  const previousScans = previous.seqScan + previous.idxScan;
  const currentScans = current.seqScan + current.idxScan;
  if (currentScans !== previousScans) {
    lines.push(
      `${table}: cumulative scan counter moved ${previousScans} -> ${currentScans} (${currentScans - previousScans} more scan(s) since the last snapshot; investigate before Phase C closes)`,
    );
  }
  return lines;
}

async function mostRecentSnapshot(): Promise<Snapshot | null> {
  let entries: string[];
  try {
    entries = await readdir(evidenceDir);
  } catch {
    return null;
  }
  const snapshotFiles = entries.filter((name) => name.endsWith(".json")).sort();
  const latest = snapshotFiles.at(-1);
  if (!latest) return null;
  const raw = await readFile(path.join(evidenceDir, latest), "utf8");
  return JSON.parse(raw) as Snapshot;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.HOMA_SKILL_ARCHIVE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "HOMA_SKILL_ARCHIVE_DATABASE_URL is required. This command does not load environment files.",
    );
  }

  await mkdir(evidenceDir, { recursive: true });
  const previous = await mostRecentSnapshot();

  const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 10, connect_timeout: 15 });
  try {
    const capturedAtUtc = new Date().toISOString();
    const tables: Partial<Record<SkillArchiveTable, TableSnapshot>> = {};
    for (const table of SKILL_ARCHIVE_TABLES) {
      tables[table] = await captureTable(sql, table);
    }
    const snapshot: Snapshot = {
      capturedAtUtc,
      tables: tables as Record<SkillArchiveTable, TableSnapshot>,
    };

    const fileName = `${capturedAtUtc.replaceAll(":", "-")}.json`;
    await writeFile(path.join(evidenceDir, fileName), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`Wrote ${fileName}`);
    console.log(JSON.stringify(snapshot, null, 2));

    if (!previous) {
      console.log("\nNo prior snapshot found; this is the Phase C baseline. Rerun this command later in the window to diff against it.");
      return;
    }

    const diffs: string[] = [];
    for (const table of SKILL_ARCHIVE_TABLES) {
      diffs.push(...diffLine(table, previous.tables[table], snapshot.tables[table]));
    }
    console.log(`\nDiff against ${previous.capturedAtUtc}:`);
    if (diffs.length === 0) {
      console.log("PASS  no row-count, updated_at, or scan-counter change since the prior snapshot.");
      return;
    }
    for (const line of diffs) console.log(`FAIL  ${line}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
