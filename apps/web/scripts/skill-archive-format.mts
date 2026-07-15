/**
 * Shared canonical serialization for the skill-table rollback archive
 * (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §5.1). Both the exporter (reads production) and the restore/verify script
 * (reads a disposable local cluster) must produce byte-identical JSONL for
 * the same rows, or a hash comparison between them is meaningless.
 */

export const SKILL_ARCHIVE_TABLES = ["skill_bank", "family_skills"] as const;
export type SkillArchiveTable = (typeof SKILL_ARCHIVE_TABLES)[number];

export interface SkillArchiveTableManifestEntry {
  columns: string[];
  rowCount: number;
  fileName: string;
  sha256: string;
}

export interface SkillArchiveManifest {
  exportedAtUtc: string;
  exporterGitCommit: string;
  databaseProjectRef: string;
  tables: Record<SkillArchiveTable, SkillArchiveTableManifestEntry>;
}

/** postgres.js returns Date objects for timestamptz and JS arrays for
 * text[]; canonicalize to plain JSON values so re-serializing restored rows
 * reproduces the exact export bytes. */
export function toCanonicalJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toCanonicalJsonValue(entry));
  return value;
}

/** One JSON object per line, keys in the given column order, rows in the
 * given order (callers sort by primary key). Trailing newline on a
 * non-empty file, empty string for zero rows. */
export function serializeRowsAsJsonl(
  columns: string[],
  rows: readonly Record<string, unknown>[],
): string {
  const lines = rows.map((row) => {
    const ordered: Record<string, unknown> = {};
    for (const column of columns) ordered[column] = toCanonicalJsonValue(row[column]);
    return JSON.stringify(ordered);
  });
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

export function parseJsonlRows(content: string): Record<string, unknown>[] {
  return content
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export function manifestFileName(): string {
  return "manifest.json";
}
