import { createClient } from "@supabase/supabase-js";

import { mapDb } from "./map/db";

const STORAGE_DELETE_BATCH_SIZE = 1_000;

export interface AccountDeletionAvatarCleanerDependencies {
  listPaths: (userIds: readonly string[], limit: number) => Promise<string[]>;
  removePaths: (paths: readonly string[]) => Promise<void>;
}

export function createAccountDeletionAvatarCleaner(
  dependencies: AccountDeletionAvatarCleanerDependencies,
) {
  return async function cleanAccountDeletionAvatars(
    userIds: readonly string[],
  ): Promise<number> {
    const exactUserIds = [...new Set(userIds)];
    if (exactUserIds.length === 0) return 0;

    let deleted = 0;
    let previousBatch = "";
    for (;;) {
      const paths = await dependencies.listPaths(exactUserIds, STORAGE_DELETE_BATCH_SIZE);
      if (paths.length === 0) return deleted;
      if (paths.length > STORAGE_DELETE_BATCH_SIZE) {
        throw new Error("Supabase avatar cleanup returned an oversized batch.");
      }
      const batchSignature = paths.join("\n");
      if (batchSignature === previousBatch) {
        throw new Error("Supabase avatar cleanup made no progress.");
      }
      await dependencies.removePaths(paths);
      deleted += paths.length;
      previousBatch = batchSignature;
    }
  };
}

async function listAccountDeletionAvatarPaths(
  userIds: readonly string[],
  limit: number,
): Promise<string[]> {
  const sql = mapDb();
  const rows = await sql<Array<{ name: string }>>`
    select object.name
    from storage.objects object
    where object.bucket_id = 'avatars'
      and split_part(object.name, '/', 1) = any(${sql.array([...userIds])}::text[])
    order by object.name
    limit ${limit}
  `;
  return rows.map((row) => row.name);
}

async function removeAccountDeletionAvatarPaths(
  paths: readonly string[],
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase avatar cleanup is not configured.");
  }
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { error } = await supabase.storage.from("avatars").remove([...paths]);
  if (error) {
    throw new Error(`Supabase avatar cleanup failed: ${error.message}`);
  }
}

export const deleteAccountDeletionAvatars = createAccountDeletionAvatarCleaner({
  listPaths: listAccountDeletionAvatarPaths,
  removePaths: removeAccountDeletionAvatarPaths,
});
