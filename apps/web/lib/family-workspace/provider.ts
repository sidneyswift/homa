import { randomUUID } from "node:crypto";
import { APIError, Drive, Sandbox } from "@vercel/sandbox";

import { assertFamilyArtifactAccess } from "../account-deletion-artifact-fence";
import { isEvalIsolationActive } from "../eval-isolation";

import { workspaceDriveName, workspaceHash, workspaceObjectPath, workspaceObjectDirectory, type WorkspaceNamespace } from "./contract";

export class WorkspaceBusyError extends Error {
  constructor() { super("The family workspace is busy. No file was changed. Try again shortly."); }
}

/** The single writer mount is the cross-process lock. No lease can outlive it. */
export async function withWorkspaceDrive<T>(familyId: string, namespace: WorkspaceNamespace,
  signal: AbortSignal, work: (sandbox: Sandbox) => Promise<T>): Promise<T> {
  if (isEvalIsolationActive(process.env) || process.env.VERCEL_ENV !== "production") {
    throw new Error("Live family Drives are disabled in this environment");
  }
  await assertFamilyArtifactAccess(familyId);
  const driveName = workspaceDriveName(familyId, namespace);
  const drive = await Drive.getOrCreate({ name: driveName, region: "iad1", maxSize: 1024 ** 3, signal });
  const name = `${driveName.slice(0, 48)}-${randomUUID().slice(0, 8)}`;
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.create({ name, region: "iad1", persistent: false, timeout: 75_000,
      resources: { vcpus: 1 }, networkPolicy: "deny-all", mounts: { "/family-workspace": drive }, signal });
  } catch (error) {
    if (error instanceof APIError && error.json?.error?.code === "drive_attached") throw new WorkspaceBusyError();
    throw error;
  }
  try {
    return await work(sandbox);
  } finally {
    // Observed gh#1199: snapshots can lag acknowledged writes until writer stop.
    // Use an independent cleanup deadline even when the operation was aborted.
    await sandbox.stop({ signal: AbortSignal.timeout(15_000) });
    await sandbox.delete({ signal: AbortSignal.timeout(15_000) });
    // A late allocation/write must not outlive account deletion. Drive bytes
    // are recoverable checkpoints, so an unavailable authorization check fails closed.
    try {
      await assertFamilyArtifactAccess(familyId);
    } catch (error) {
      await drive.delete({ signal: AbortSignal.timeout(15_000) });
      throw error;
    }
  }
}

export async function mirrorWorkspaceBytes(sandbox: Sandbox, bytes: Buffer, hash: string, fileId: string, signal: AbortSignal): Promise<void> {
  const path = workspaceObjectPath(hash, fileId);
  await sandbox.fs.mkdir(workspaceObjectDirectory(fileId), { recursive: true, signal });
  await sandbox.writeFiles([{ path, content: bytes }], { signal });
  const readback = await sandbox.readFileToBuffer({ path }, { signal });
  if (!readback || workspaceHash(readback) !== hash) throw new Error("Workspace byte verification failed");
}

/** Called by deletion even when the rollout flag is off. Never creates a Drive. */
export async function deleteFamilyWorkspaceDrives(familyId: string): Promise<number> {
  // Eval model OIDC can administer Sandbox too. Never use it for cleanup.
  if (isEvalIsolationActive(process.env) || process.env.VERCEL_ENV !== "production") return 0;
  let deleted = 0;
  for (const namespace of ["production", "preview", "development"] as const) {
    const name = workspaceDriveName(familyId, namespace);
    const result = await Drive.list({ namePrefix: name, sortBy: "name", signal: AbortSignal.timeout(20_000) });
    for (const drive of result.drives) {
      if (drive.name !== name) continue;
      if (drive.currentSandboxName) {
        const writer = await Sandbox.get({ name: drive.currentSandboxName, signal: AbortSignal.timeout(20_000) });
        await writer.stop({ signal: AbortSignal.timeout(20_000) });
        await writer.delete({ signal: AbortSignal.timeout(20_000) });
      }
      await drive.delete({ signal: AbortSignal.timeout(20_000) });
      deleted++;
    }
    const after = await Drive.list({ namePrefix: name, sortBy: "name", signal: AbortSignal.timeout(20_000) });
    if (after.drives.some((drive) => drive.name === name)) throw new Error("Workspace deletion is not confirmed");
  }
  return deleted;
}
