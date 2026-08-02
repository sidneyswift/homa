/**
 * Promote eligible legacy chat attachments into Family Library.
 *
 * The default is a content-free dry run. A write requires --write, and a
 * hosted Supabase write also requires --confirm-prod through the shared guard.
 * Existing source_attachment_id rows, including soft-deleted rows, are never
 * selected. That makes reruns resumable without resurrecting a parent's delete.
 *
 * Usage:
 *   pnpm backfill:family-library-chat
 *   pnpm backfill:family-library-chat -- --limit 10
 *   pnpm backfill:family-library-chat -- --write --confirm-prod
 */

import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isFamilyChatAttachmentUrl } from "../lib/attachments/markers";
import { promoteFamilyAttachment } from "../lib/library/family-asset-promotion";
import { mapDb } from "../lib/map/db";
import { assertConfirmedProdWrite } from "../../../scripts/prod-write-guard.mts";

export interface FamilyLibraryBackfillArgs {
  write: boolean;
  confirmProd: boolean;
  limit: number | null;
  attachmentId: string | null;
  help: boolean;
}

export interface FamilyLibraryBackfillCandidate {
  id: string;
  familyId: string;
  memberUserId: string | null;
  url: string;
}

interface FamilyLibraryBackfillRow {
  id: string;
  family_id: string;
  member_user_id: string | null;
  url: string;
}

interface FamilyLibraryBackfillPlan {
  selected: FamilyLibraryBackfillCandidate[];
  eligibleCount: number;
  invalidSourceCount: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function valueAfter(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseFamilyLibraryBackfillArgs(
  argv: string[],
): FamilyLibraryBackfillArgs {
  let write = false;
  let confirmProd = false;
  let limit: number | null = null;
  let attachmentId: string | null = null;
  let help = false;
  let explicitDryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      if (explicitDryRun) {
        throw new Error("Choose either --dry-run or --write, not both.");
      }
      write = true;
    } else if (arg === "--confirm-prod") {
      confirmProd = true;
    } else if (arg === "--dry-run") {
      if (write) throw new Error("Choose either --dry-run or --write, not both.");
      explicitDryRun = true;
    } else if (arg === "--limit") {
      const raw = valueAfter(argv, index, arg);
      const parsed = Number(raw);
      if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error("--limit must be a positive integer.");
      }
      limit = parsed;
      index += 1;
    } else if (arg === "--attachment-id") {
      const raw = valueAfter(argv, index, arg);
      if (!UUID.test(raw)) throw new Error("--attachment-id must be a UUID.");
      attachmentId = raw.toLowerCase();
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { write, confirmProd, limit, attachmentId, help };
}

export function planFamilyLibraryBackfill(
  candidates: FamilyLibraryBackfillCandidate[],
  args: Pick<FamilyLibraryBackfillArgs, "attachmentId" | "limit">,
): FamilyLibraryBackfillPlan {
  const requested = args.attachmentId
    ? candidates.filter((candidate) => candidate.id === args.attachmentId)
    : candidates;
  const eligible = requested.filter((candidate) =>
    isFamilyChatAttachmentUrl(candidate.url, candidate.familyId),
  );
  return {
    selected: args.limit === null ? eligible : eligible.slice(0, args.limit),
    eligibleCount: eligible.length,
    invalidSourceCount: requested.length - eligible.length,
  };
}

function printUsage(): void {
  console.log(
    [
      "Usage: pnpm backfill:family-library-chat -- [options]",
      "",
      "Options:",
      "  --dry-run                 Show content-free counts, the default",
      "  --write                   Promote selected attachments",
      "  --confirm-prod            Confirm a hosted Supabase write",
      "  --limit N                 Process at most N eligible attachments",
      "  --attachment-id UUID      Process one exact attachment",
    ].join("\n"),
  );
}

async function loadCandidates(
  attachmentId: string | null,
): Promise<FamilyLibraryBackfillCandidate[]> {
  const sql = mapDb();
  const rows = attachmentId
    ? await sql<FamilyLibraryBackfillRow[]>`
        select attachment.id, attachment.family_id,
               attachment.member_user_id, attachment.url
        from public.chat_attachments attachment
        where attachment.id = ${attachmentId}
          and not exists (
            select 1
            from public.family_assets asset
            where asset.family_id = attachment.family_id
              and asset.source_attachment_id = attachment.id
          )
        order by attachment.created_at, attachment.id
      `
    : await sql<FamilyLibraryBackfillRow[]>`
        select attachment.id, attachment.family_id,
               attachment.member_user_id, attachment.url
        from public.chat_attachments attachment
        where not exists (
          select 1
          from public.family_assets asset
          where asset.family_id = attachment.family_id
            and asset.source_attachment_id = attachment.id
        )
        order by attachment.created_at, attachment.id
      `;
  return rows.map((row) => ({
    id: row.id,
    familyId: row.family_id,
    memberUserId: row.member_user_id,
    url: row.url,
  }));
}

async function main(): Promise<void> {
  const args = parseFamilyLibraryBackfillArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  try {
    loadEnvFile(path.join(webRoot, ".env.local"));
  } catch {
    // Fine when credentials already arrive through the environment.
  }

  if (args.write) {
    assertConfirmedProdWrite({
      scriptName: "backfill-family-library-chat-attachments",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      argv: args.confirmProd ? ["--confirm-prod"] : [],
    });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required for --write.");
    }
  }

  const sql = mapDb();
  try {
    const candidates = await loadCandidates(args.attachmentId);
    const plan = planFamilyLibraryBackfill(candidates, args);
    console.log(`mode: ${args.write ? "write" : "dry-run"}`);
    console.log(`unpromoted attachments: ${candidates.length}`);
    console.log(`eligible family Blob sources: ${plan.eligibleCount}`);
    console.log(`invalid or foreign Blob sources: ${plan.invalidSourceCount}`);
    console.log(`selected by filters: ${plan.selected.length}`);

    if (!args.write) {
      console.log("no writes performed");
      return;
    }

    let created = 0;
    let alreadyActive = 0;
    const failures = new Map<string, number>();
    for (const candidate of plan.selected) {
      const result = await promoteFamilyAttachment({
        familyId: candidate.familyId,
        attachmentId: candidate.id,
        uploadedByUserId: candidate.memberUserId,
      });
      if (result.ok) {
        if (result.created) created += 1;
        else alreadyActive += 1;
      } else {
        failures.set(result.reason, (failures.get(result.reason) ?? 0) + 1);
      }
    }

    console.log(`created Library originals: ${created}`);
    console.log(`already active during run: ${alreadyActive}`);
    console.log(`failed: ${[...failures.values()].reduce((sum, count) => sum + count, 0)}`);
    for (const [reason, count] of [...failures.entries()].sort()) {
      console.log(`  ${reason}: ${count}`);
    }
    if (failures.size > 0) process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Family Library backfill failed.",
    );
    process.exitCode = 1;
  });
}
