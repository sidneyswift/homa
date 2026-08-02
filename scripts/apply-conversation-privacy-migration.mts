/**
 * Applies only the gh#606 conversation-privacy migration.
 *
 * Production execution is deliberately limited to this repository's GitHub
 * Actions runner with an explicit opt-in. The eval sandbox may run it to
 * prove the migration is transactional and idempotent.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION = "20260802033000_conversation_privacy_per_adult.sql";
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isSandbox = Boolean(process.env.HOMA_EVAL_DATABASE_URL);
const isAuthorizedProductionRun =
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.GITHUB_REPOSITORY === "sidneyswift/homa" &&
  process.env.HOMA_APPLY_CONVERSATION_PRIVACY_MIGRATION === "1";

if (!isSandbox && !isAuthorizedProductionRun) {
  throw new Error(
    "Conversation privacy migration refused: use the eval sandbox or the explicit sidneyswift/homa GitHub Actions gate.",
  );
}

const source = await readFile(
  path.join(repoRoot, "supabase", "migrations", MIGRATION),
  "utf8",
);
const { mapDb } = await import("../apps/web/lib/map/db");
const sql = mapDb();

try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe(source);
  });

  const verification = await sql<
    {
      call_owner_column: boolean;
      message_policy: boolean;
      call_policy: boolean;
      scoped_semantic_function: boolean;
    }[]
  >`
    select
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'call_transcripts'
          and column_name = 'member_user_id'
      ) as call_owner_column,
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'conversation_messages'
          and policyname = 'adults read their own conversation messages'
      ) as message_policy,
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'call_transcripts'
          and policyname = 'adults read their own call transcripts'
      ) as call_policy,
      exists (
        select 1
        from pg_proc procedure
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.proname = 'recall_semantic'
          and pg_get_function_arguments(procedure.oid)
            = 'query_embedding text, match_limit integer DEFAULT 6, scopes text[] DEFAULT NULL::text[]'
      ) as scoped_semantic_function
  `;
  const result = verification[0];
  assert.ok(result?.call_owner_column);
  assert.ok(result?.message_policy);
  assert.ok(result?.call_policy);
  assert.ok(result?.scoped_semantic_function);
  console.log(JSON.stringify({ migration: MIGRATION, applied: true, ...result }));
} finally {
  await sql.end();
}
