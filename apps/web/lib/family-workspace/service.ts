import { randomUUID } from "node:crypto";

import { assertFamilyArtifactAccess } from "../account-deletion-artifact-fence";
import { isEvalIsolationActive } from "../eval-isolation";
import { mapDb } from "../map/db";
import { checkpointWorkspaceFile, deleteWorkspaceCheckpoint, deleteWorkspaceCheckpoints, readWorkspaceCheckpoint } from "./checkpoint";
import { WORKSPACE_MAX_BYTES, workspaceHash, workspaceObjectPath, workspaceObjectDirectory, workspacePath, type WorkspaceFile, type WorkspaceNamespace } from "./contract";
import { mirrorWorkspaceBytes, withWorkspaceDrive } from "./provider";
import { getWorkspaceFile, listWorkspaceFiles, markWorkspaceFileDeleted, moveWorkspaceFile, saveWorkspaceFile } from "./store";

export type WorkspaceOperation =
  | { operation: "list" }
  | { operation: "read"; path: string }
  | { operation: "write"; path: string; content: string; expectedRevision: string | null; requestId: string }
  | { operation: "move"; path: string; destination: string; expectedRevision: string }
  | { operation: "remove"; path: string; expectedRevision: string };

const describe = (file: WorkspaceFile) => ({ path: file.path, revision: file.revision, byteSize: file.byte_size, updatedAt: file.updated_at });

export const workspaceDependencies = {
  authorize: assertFamilyArtifactAccess,
  list: listWorkspaceFiles, get: getWorkspaceFile, save: saveWorkspaceFile,
  move: moveWorkspaceFile, remove: markWorkspaceFileDeleted,
  mount: withWorkspaceDrive, mirror: mirrorWorkspaceBytes,
  checkpoint: checkpointWorkspaceFile, readCheckpoint: readWorkspaceCheckpoint, deleteCheckpoints: deleteWorkspaceCheckpoints,
  deleteCheckpoint: deleteWorkspaceCheckpoint,
};

/** Preview/eval processes cannot quietly allocate production resources with model OIDC. */
export async function familyWorkspaceNamespace(familyId: string): Promise<WorkspaceNamespace | null> {
  if (process.env.HOMA_FAMILY_DRIVES_ENABLED !== "true" || isEvalIsolationActive(process.env)
    || process.env.VERCEL_ENV !== "production") return null;
  // Pilot is deliberately restricted to disposable fixture families.
  const [family] = await mapDb()<Array<{ sandbox: boolean }>>`
    select sandbox from public.families where id = ${familyId} and status <> 'deleted'
  `;
  return family?.sandbox === true ? "production" : null;
}

export async function operateFamilyWorkspace(familyId: string, namespace: WorkspaceNamespace,
  input: WorkspaceOperation, dependencies = workspaceDependencies) {
  await dependencies.authorize(familyId);
  if (input.operation === "list") return { ok: true, files: (await dependencies.list(familyId, namespace)).map(describe) };
  const path = workspacePath(input.path);
  if (input.operation === "move") workspacePath(input.destination);
  const bytes = input.operation === "write" ? Buffer.from(input.content, "utf8") : null;
  if (bytes && (bytes.length === 0 || bytes.length > WORKSPACE_MAX_BYTES)) throw new Error("Workspace text must be 1 to 65536 bytes");
  const signal = AbortSignal.timeout(55_000);
  return await dependencies.mount(familyId, namespace, signal, async (sandbox) => {
    // Re-check after acquiring the provider writer, including queued network time.
    await dependencies.authorize(familyId);
    signal.throwIfAborted();
    const file = await dependencies.get(familyId, namespace, path);
    if (input.operation === "read") {
      if (!file || file.deleted_at) return { ok: false, reason: "not-found" };
      let content = await sandbox.readFileToBuffer({ path: workspaceObjectPath(file.sha256, file.id) }, { signal });
      const cacheHit = content !== null && workspaceHash(content) === file.sha256;
      if (!cacheHit) {
        content = await dependencies.readCheckpoint(familyId, file.blob_url, file.sha256, signal);
        await dependencies.mirror(sandbox, content, file.sha256, file.id, signal);
      }
      await dependencies.authorize(familyId);
      return { ok: true, file: describe(file), content: content!.toString("utf8"), cacheHit };
    }
    if (input.operation === "write") {
      const hash = workspaceHash(bytes!);
      if (file && !file.deleted_at && file.revision === input.requestId) {
        if (file.sha256 !== hash) return { ok: false, reason: "request-conflict" };
        await dependencies.mirror(sandbox, bytes!, hash, file.id, signal);
        await dependencies.authorize(familyId);
        return { ok: true, file: describe(file), replay: true };
      }
      if ((file && !file.deleted_at ? file.revision : null) !== input.expectedRevision) return { ok: false, reason: "revision-conflict" };
      if (file?.deleted_at) {
        // Finish any interrupted removal before reusing this logical name.
        await dependencies.deleteCheckpoints(familyId, file.id);
        await sandbox.fs.rm(workspaceObjectDirectory(file.id), { recursive: true, force: true, signal });
      }
      const id = file?.id ?? randomUUID();
      // Independent immutable checkpoint, then compare-and-set the metadata.
      const url = await dependencies.checkpoint(familyId, id, randomUUID(), bytes!);
      let saved = false;
      try {
        await dependencies.authorize(familyId);
        signal.throwIfAborted();
        saved = await dependencies.save(familyId, namespace, { id, path, revision: input.requestId,
          sha256: hash, byte_size: bytes!.length, blob_url: url }, input.expectedRevision);
      } catch (error) {
        // An ambiguous DB response may have committed. Preserve the checkpoint
        // unless a scoped read proves it is not the current file.
        const current = await dependencies.get(familyId, namespace, path);
        if (current?.blob_url !== url) await dependencies.deleteCheckpoint(familyId, url);
        throw error;
      }
      if (!saved) {
        await dependencies.deleteCheckpoint(familyId, url);
        return { ok: false, reason: "revision-conflict-or-quota" };
      }
      await dependencies.mirror(sandbox, bytes!, hash, id, signal);
      if (file && !file.deleted_at) {
        await dependencies.deleteCheckpoint(familyId, file.blob_url);
        if (file.sha256 !== hash) await sandbox.fs.rm(workspaceObjectPath(file.sha256, file.id), { force: true, signal });
      }
      await dependencies.authorize(familyId);
      return { ok: true, path, revision: input.requestId, byteSize: bytes!.length };
    }
    if (input.operation === "move") {
      if (!file) {
        const destination = await dependencies.get(familyId, namespace, input.destination);
        return destination?.revision === input.expectedRevision && !destination.deleted_at
          ? { ok: true, file: describe(destination), replay: true } : { ok: false, reason: "not-found" };
      }
      if (file.deleted_at || file.revision !== input.expectedRevision) return { ok: false, reason: "revision-conflict" };
      if (input.destination === path) return { ok: true, file: describe(file) };
      const moved = await dependencies.move(familyId, namespace, path, input.destination, input.expectedRevision);
      await dependencies.authorize(familyId);
      return moved ? { ok: true, path: input.destination, revision: input.expectedRevision } : { ok: false, reason: "destination-exists-or-conflict" };
    }
    if (!file || file.revision !== input.expectedRevision) return { ok: false, reason: "not-found-or-conflict" };
    if (!(await dependencies.remove(familyId, namespace, path, input.expectedRevision))) return { ok: false, reason: "revision-conflict" };
    await dependencies.deleteCheckpoints(familyId, file.id);
    await sandbox.fs.rm(workspaceObjectDirectory(file.id), { recursive: true, force: true, signal });
    return { ok: true, removed: path };
  });
}
