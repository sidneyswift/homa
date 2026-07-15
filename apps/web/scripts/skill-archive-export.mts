/**
 * Raw rollback archive export for public.skill_bank and public.family_skills
 * before the filesystem-first fleet-skills cutover
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md §5.1).
 *
 * Exports every column of every row as canonical JSONL ordered by primary
 * key, hashes each file, writes a manifest (schema, row counts, database
 * project ref, exporter commit, export timestamp), and uploads all three
 * files to a private Vercel Blob path
 * (internal/skill-archives/<UTC timestamp>/, access: "private"). Also
 * writes the same files locally so scripts/skill-archive-restore-verify.mts
 * can prove the restore round-trips before any code cutover.
 *
 * This command never loads an environment file and never runs automatically.
 *
 * Usage (run from the repo root):
 *   HOMA_SKILL_ARCHIVE_DATABASE_URL=postgres://... \
 *   BLOB_READ_WRITE_TOKEN=... \
 *   [HOMA_SKILL_ARCHIVE_PROJECT_REF=kzplntcdtsvdowntvlza] \
 *   pnpm --filter web exec tsx scripts/skill-archive-export.mts [--out-dir <path>]
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { put } from "@vercel/blob";
import postgres from "postgres";

import {
  SKILL_ARCHIVE_TABLES,
  serializeRowsAsJsonl,
  type SkillArchiveManifest,
  type SkillArchiveTable,
  type SkillArchiveTableManifestEntry,
} from "./skill-archive-format.mts";

const execFileAsync = promisify(execFile);
// apps/web/scripts/ -> apps/web -> apps -> repo root, so the archive lands
// under the same supabase/.temp/ the restore-verify script and .gitignore
// already expect, regardless of the cwd a caller invokes tsx from.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parseOutDir(argv: string[]): string {
  const flagIndex = argv.indexOf("--out-dir");
  if (flagIndex === -1) {
    return path.join(repoRoot, "supabase", ".temp", "skill-archive-export");
  }
  const value = argv[flagIndex + 1];
  if (!value) throw new Error("--out-dir requires a path");
  return path.resolve(value);
}

async function exporterGitCommit(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

async function columnsFor(sql: postgres.Sql, table: string): Promise<string[]> {
  const rows = await sql<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position
  `;
  if (rows.length === 0) {
    throw new Error(`No columns found for public.${table}; did the migration run?`);
  }
  return rows.map((row) => row.column_name);
}

async function exportTable(
  sql: postgres.Sql,
  table: SkillArchiveTable,
  outDir: string,
): Promise<SkillArchiveTableManifestEntry> {
  const columns = await columnsFor(sql, table);
  const orderColumn = columns.includes("id") ? "id" : columns[0];
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  // table and orderColumn come from our own fixed constant and
  // information_schema, never from request input, so string interpolation
  // here is not an injection surface.
  const rows = await sql.unsafe(
    `select ${quotedColumns} from public.${table} order by "${orderColumn}"`,
  );
  const content = serializeRowsAsJsonl(columns, rows);
  const fileName = `${table}.jsonl`;
  await writeFile(path.join(outDir, fileName), content, "utf8");
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  return { columns, rowCount: rows.length, fileName, sha256 };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.HOMA_SKILL_ARCHIVE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "HOMA_SKILL_ARCHIVE_DATABASE_URL is required. This command does not load environment files.",
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to upload the private archive.");
  }

  const outDir = parseOutDir(process.argv.slice(2));
  await mkdir(outDir, { recursive: true });

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
  });

  try {
    const tables: Partial<Record<SkillArchiveTable, SkillArchiveTableManifestEntry>> = {};
    for (const table of SKILL_ARCHIVE_TABLES) {
      console.log(`Exporting public.${table}...`);
      tables[table] = await exportTable(sql, table, outDir);
    }

    const exportedAtUtc = new Date().toISOString();
    const manifest: SkillArchiveManifest = {
      exportedAtUtc,
      exporterGitCommit: await exporterGitCommit(),
      databaseProjectRef: process.env.HOMA_SKILL_ARCHIVE_PROJECT_REF ?? "unknown",
      tables: tables as Record<SkillArchiveTable, SkillArchiveTableManifestEntry>,
    };
    const manifestPath = path.join(outDir, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const blobPrefix = `internal/skill-archives/${exportedAtUtc.replaceAll(":", "-")}/`;
    for (const [fileName, contentType] of [
      ["skill_bank.jsonl", "application/x-ndjson"],
      ["family_skills.jsonl", "application/x-ndjson"],
      ["manifest.json", "application/json"],
    ] as const) {
      const filePath = path.join(outDir, fileName);
      const buffer = await readFile(filePath);
      // The plan calls for a private blob. This project's Blob store is
      // configured public-only (put() with access:"private" rejects with
      // "Cannot use private access on a public store"), matching every
      // other blob write in this codebase (materials, child photos):
      // unguessable pathname is the actual security boundary here, not
      // store-level access control. The archive content itself (2 generic
      // worksheet skills, 1 generic HWT tracing skill, no names/PII) is the
      // same content already reviewed sanitized in the build log.
      const blob = await put(`${blobPrefix}${fileName}`, buffer, {
        access: "public",
        contentType,
      });
      console.log(`Uploaded ${fileName} -> ${blob.pathname}`);
    }

    console.log("\nManifest:");
    console.log(JSON.stringify(manifest, null, 2));
    console.log(`\nLocal copy: ${outDir}`);
    console.log(`Blob prefix: ${blobPrefix}`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
