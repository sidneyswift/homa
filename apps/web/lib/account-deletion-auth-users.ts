import { createClient } from "@supabase/supabase-js";

import { mapDb } from "./map/db";

export interface AccountDeletionAuthUserCleanerDependencies {
  listExistingUserIds(userIds: readonly string[]): Promise<string[]>;
  deleteUser(userId: string): Promise<void>;
}

export function accountDeletionSupabaseCleanupConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      && process.env.SUPABASE_SECRET_KEY?.trim(),
  );
}

/**
 * Deletes only identities that still exist. The exact preflight makes retries
 * idempotent after a partial provider success without interpreting provider
 * error prose such as "user not found".
 */
export function createAccountDeletionAuthUserCleaner(
  dependencies: AccountDeletionAuthUserCleanerDependencies,
) {
  return async function cleanAccountDeletionAuthUsers(
    userIds: readonly string[],
  ): Promise<number> {
    const exactUserIds = [...new Set(userIds)];
    if (exactUserIds.length === 0) return 0;

    const existingUserIds = await dependencies.listExistingUserIds(exactUserIds);
    const allowedIds = new Set(exactUserIds);
    if (existingUserIds.some((userId) => !allowedIds.has(userId))) {
      throw new Error("Supabase Auth cleanup returned an unexpected identity.");
    }
    for (const userId of existingUserIds) {
      await dependencies.deleteUser(userId);
    }
    return existingUserIds.length;
  };
}

async function listExistingAccountDeletionAuthUserIds(
  userIds: readonly string[],
): Promise<string[]> {
  const sql = mapDb();
  const rows = await sql<Array<{ id: string; deletable: boolean }>>`
    select auth_user.id,
           not exists (
             select 1
             from public.family_members membership
             where membership.user_id = auth_user.id
           ) as deletable
    from auth.users auth_user
    where auth_user.id = any(${sql.array([...userIds])}::uuid[])
    order by auth_user.id
  `;
  if (rows.some((row) => !row.deletable)) {
    throw new Error("Supabase Auth cleanup identity has a current family membership.");
  }
  return rows.map((row) => row.id);
}

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

async function deleteAccountDeletionAuthUser(userId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Auth cleanup is not configured.");
  }
  supabaseAdmin ??= createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
  if (error) {
    throw new Error("Supabase Auth identity cleanup failed.", { cause: error });
  }
}

export const deleteAccountDeletionAuthUsers =
  createAccountDeletionAuthUserCleaner({
    listExistingUserIds: listExistingAccountDeletionAuthUserIds,
    deleteUser: deleteAccountDeletionAuthUser,
  });
