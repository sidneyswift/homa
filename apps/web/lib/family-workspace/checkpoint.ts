import { del, list, put } from "@vercel/blob";

import { familyBlobToken, signedFamilyBlobReadUrl } from "../family-blob";
import { isFamilyBlobUrl } from "../family-blob-url";
import { withFamilyArtifactWriteFence } from "../account-deletion-artifact-fence";
import { fetchBoundedAssetBytes } from "../library/family-asset-bytes";
import { WORKSPACE_MAX_BYTES, workspaceHash } from "./contract";

function token(): string {
  const value = familyBlobToken();
  if (!value) throw new Error("Private family workspace checkpoint storage is unavailable");
  return value;
}

export async function checkpointWorkspaceFile(familyId: string, fileId: string, revision: string, bytes: Buffer): Promise<string> {
  const result = await withFamilyArtifactWriteFence({ familyId, write: () => put(`families/${familyId}/workspace/${fileId}/${revision}.txt`, bytes, {
    token: token(), access: "private", addRandomSuffix: false, allowOverwrite: false,
    contentType: "text/plain; charset=utf-8",
  }), cleanup: (blob) => del(blob.url, { token: token() }) });
  return result.url;
}

export async function deleteWorkspaceCheckpoint(familyId: string, url: string): Promise<void> {
  if (!isFamilyBlobUrl(url, familyId, "workspace")) throw new Error("Checkpoint is outside this family");
  await del(url, { token: token() });
}

export async function readWorkspaceCheckpoint(familyId: string, url: string, hash: string, signal: AbortSignal): Promise<Buffer> {
  const signed = await signedFamilyBlobReadUrl(url, familyId, "workspace");
  const result = await fetchBoundedAssetBytes(signed, WORKSPACE_MAX_BYTES, signal);
  if (!result.ok || workspaceHash(result.bytes) !== hash) throw new Error("Workspace checkpoint could not be verified");
  return Buffer.from(result.bytes);
}

export async function deleteWorkspaceCheckpoints(familyId: string, fileId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const result = await list({ token: token(), prefix: `families/${familyId}/workspace/${fileId}/`, cursor });
    if (result.blobs.length) await del(result.blobs.map((entry) => entry.url), { token: token() });
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}
