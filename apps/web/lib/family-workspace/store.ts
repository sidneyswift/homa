import { mapDb } from "../map/db";
import { WORKSPACE_MAX_FILES, type WorkspaceFile, type WorkspaceNamespace } from "./contract";

export async function listWorkspaceFiles(familyId: string, namespace: WorkspaceNamespace): Promise<WorkspaceFile[]> {
  return await mapDb()<WorkspaceFile[]>`
    select id, path, revision, sha256, byte_size, blob_url, updated_at::text, deleted_at::text
    from public.family_workspace_files where family_id = ${familyId} and namespace = ${namespace}
      and deleted_at is null order by path limit ${WORKSPACE_MAX_FILES}
  `;
}

export async function getWorkspaceFile(familyId: string, namespace: WorkspaceNamespace, path: string): Promise<WorkspaceFile | null> {
  const rows = await mapDb()<WorkspaceFile[]>`
    select id, path, revision, sha256, byte_size, blob_url, updated_at::text, deleted_at::text
    from public.family_workspace_files where family_id = ${familyId} and namespace = ${namespace} and path = ${path}
  `;
  return rows[0] ?? null;
}

export async function saveWorkspaceFile(familyId: string, namespace: WorkspaceNamespace,
  file: Pick<WorkspaceFile, "id" | "path" | "revision" | "sha256" | "byte_size" | "blob_url">,
  expectedRevision: string | null): Promise<boolean> {
  return await mapDb().begin(async (sql) => {
    // Serialize quota checks and inserts, including retries after a sandbox timeout.
    // The family row lock also orders writes against account deletion.
    const family = await sql`
      select id from public.families where id = ${familyId} and status <> 'deleted'
        and not exists (select 1 from public.account_deletion_artifact_tombstones where family_id = ${familyId})
      for update
    `;
    if (!family.length) return false;
    if (expectedRevision !== null) {
      const updated = await sql`
        update public.family_workspace_files set revision = ${file.revision}, sha256 = ${file.sha256},
          byte_size = ${file.byte_size}, blob_url = ${file.blob_url}, updated_at = now()
        where family_id = ${familyId} and namespace = ${namespace} and path = ${file.path}
          and revision = ${expectedRevision} and deleted_at is null returning id
      `;
      return updated.length === 1;
    }
    const rows = await sql`
      insert into public.family_workspace_files (id, family_id, namespace, path, revision, sha256, byte_size, blob_url)
      select ${file.id}, ${familyId}, ${namespace}, ${file.path}, ${file.revision}, ${file.sha256}, ${file.byte_size}, ${file.blob_url}
      where (select count(*) from public.family_workspace_files where family_id = ${familyId}
        and namespace = ${namespace} and deleted_at is null) < ${WORKSPACE_MAX_FILES}
      on conflict (family_id, namespace, path) do update
        set revision = excluded.revision, sha256 = excluded.sha256, byte_size = excluded.byte_size,
            blob_url = excluded.blob_url, updated_at = now(), deleted_at = null
        where family_workspace_files.deleted_at is not null
      returning id
    `;
    return rows.length === 1;
  });
}

export async function moveWorkspaceFile(familyId: string, namespace: WorkspaceNamespace,
  path: string, destination: string, revision: string): Promise<boolean> {
  const rows = await mapDb()`
    update public.family_workspace_files set path = ${destination}, updated_at = now()
    where family_id = ${familyId} and namespace = ${namespace} and path = ${path}
      and revision = ${revision} and deleted_at is null
      and not exists (select 1 from public.family_workspace_files where family_id = ${familyId}
        and namespace = ${namespace} and path = ${destination}) returning id
  `;
  return rows.length === 1;
}

export async function markWorkspaceFileDeleted(familyId: string, namespace: WorkspaceNamespace,
  path: string, revision: string): Promise<boolean> {
  const rows = await mapDb()`
    update public.family_workspace_files set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where family_id = ${familyId} and namespace = ${namespace} and path = ${path} and revision = ${revision} returning id
  `;
  return rows.length === 1;
}
