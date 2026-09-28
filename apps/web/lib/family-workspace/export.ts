import { assertFamilyArtifactAccess } from "../account-deletion-artifact-fence";
import { mapDb } from "../map/db";
import { readWorkspaceCheckpoint } from "./checkpoint";

/** Export real bytes, not private URLs that stop working outside Homa. */
export async function exportFamilyWorkspace(familyId: string) {
  await assertFamilyArtifactAccess(familyId);
  const sql = mapDb();
  const [schema] = await sql`select to_regclass('public.family_workspace_files') is not null as ready`;
  if (!schema?.ready) return [];
  const files = await sql<Array<{ path: string; namespace: string; revision: string; sha256: string; blob_url: string }>>`
    select path, namespace, revision, sha256, blob_url from public.family_workspace_files
    where family_id = ${familyId} and deleted_at is null order by namespace, path
  `;
  const signal = AbortSignal.timeout(30_000);
  const result: Array<{ path: string; namespace: string; revision: string; content: string }> = [];
  // Bound network fanout. Each file is hash-verified and capped at 64 KiB.
  for (let offset = 0; offset < files.length; offset += 5) {
    result.push(...await Promise.all(files.slice(offset, offset + 5).map(async (file) => ({
      path: file.path, namespace: file.namespace, revision: file.revision,
      content: (await readWorkspaceCheckpoint(familyId, file.blob_url, file.sha256, signal)).toString("utf8"),
    }))));
  }
  await assertFamilyArtifactAccess(familyId);
  return result;
}
