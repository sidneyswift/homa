import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAccountDeletionAvatarCleaner } from "./account-deletion-avatars";

test("deletes every exact avatar path in bounded Storage API batches", async () => {
  const remaining = Array.from(
    { length: 1_005 },
    (_, index) => `11111111-1111-4111-8111-111111111111/avatar-${index}.jpg`,
  );
  const removedBatches: string[][] = [];
  const cleaner = createAccountDeletionAvatarCleaner({
    listPaths: async (_userIds, limit) => remaining.slice(0, limit),
    removePaths: async (paths) => {
      removedBatches.push([...paths]);
      remaining.splice(0, paths.length);
    },
  });

  const deleted = await cleaner(["11111111-1111-4111-8111-111111111111"]);

  assert.equal(deleted, 1_005);
  assert.deepEqual(removedBatches.map((batch) => batch.length), [1_000, 5]);
  assert.equal(remaining.length, 0);
});

test("does not initialize Storage cleanup when no avatar paths exist", async () => {
  let removes = 0;
  const cleaner = createAccountDeletionAvatarCleaner({
    listPaths: async () => [],
    removePaths: async () => {
      removes += 1;
    },
  });

  assert.equal(await cleaner(["22222222-2222-4222-8222-222222222222"]), 0);
  assert.equal(removes, 0);
});

test("the migration retains avatar cleanup identity and fences stale JWT writes", async () => {
  const source = await readFile(
    new URL("../../../supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /add column storage_user_ids uuid\[\]/u);
  assert.match(source, /final_cleanup_after[\s\S]*interval '6 hours 30 minutes'/u);
  assert.match(source, /account_deletion_artifact_tombstones/u);
  assert.match(source, /artifact_quiet_since timestamptz/u);
  assert.match(source, /create or replace function public\.current_auth_user_exists\(\)/u);
  assert.match(source, /from auth\.users/u);
  assert.match(source, /public\.account_deletion_jobs/u);
  assert.match(source, /revoke all on function public\.delete_own_account\(\)/u);
  assert.equal((source.match(/public\.current_auth_user_exists\(\)/gu) ?? []).length >= 4, true);
});
