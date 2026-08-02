import { safeLibraryPathName } from "./family-assets";

export const LIBRARY_MULTIPART_CHUNK_BYTES = 8 * 1024 * 1024;

export const FAMILY_ASSET_UPLOAD_STATUSES = [
  "pending",
  "uploading",
  "completing",
  "ready",
  "needs_attention",
  "failed",
  "abandoned",
] as const;

export type FamilyAssetUploadStatus =
  (typeof FAMILY_ASSET_UPLOAD_STATUSES)[number];

export interface FamilyAssetUploadPart {
  etag: string;
  partNumber: number;
  byteSize: number;
  sha256: string;
}

export interface FamilyAssetUploadView {
  id: string;
  originalName: string;
  pathname: string;
  mediaType: string;
  byteSize: number;
  lastModified: number;
  fingerprintSha256: string;
  blobUploadId: string | null;
  blobKey: string | null;
  completedParts: FamilyAssetUploadPart[];
  status: FamilyAssetUploadStatus;
  statusNote: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export function familyAssetUploadPath(
  familyId: string,
  clientRequestId: string,
  originalName: string,
): string {
  return `families/${familyId}/library/${clientRequestId}/${safeLibraryPathName(originalName)}`;
}

export function familyAssetUploadPartCount(byteSize: number): number {
  return Math.ceil(byteSize / LIBRARY_MULTIPART_CHUNK_BYTES);
}

export function familyAssetUploadPartByteSize(
  byteSize: number,
  partNumber: number,
): number | null {
  const partCount = familyAssetUploadPartCount(byteSize);
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > partCount) {
    return null;
  }
  const start = (partNumber - 1) * LIBRARY_MULTIPART_CHUNK_BYTES;
  return Math.min(LIBRARY_MULTIPART_CHUNK_BYTES, byteSize - start);
}

export function familyAssetUploadProgress(
  byteSize: number,
  parts: readonly FamilyAssetUploadPart[],
): number {
  if (byteSize < 1) return 0;
  const uniqueParts = new Map<number, number>();
  for (const part of parts) {
    const expected = familyAssetUploadPartByteSize(byteSize, part.partNumber);
    if (expected === part.byteSize) uniqueParts.set(part.partNumber, part.byteSize);
  }
  const uploadedBytes = [...uniqueParts.values()].reduce(
    (total, partBytes) => total + partBytes,
    0,
  );
  return Math.min(100, Math.floor((uploadedBytes / byteSize) * 100));
}

export function mergeFamilyAssetUploadParts(
  ...groups: readonly (readonly FamilyAssetUploadPart[])[]
): FamilyAssetUploadPart[] {
  const parts = new Map<number, FamilyAssetUploadPart>();
  for (const group of groups) {
    for (const part of group) parts.set(part.partNumber, part);
  }
  return [...parts.values()].sort(
    (first, second) => first.partNumber - second.partNumber,
  );
}

/**
 * A lightweight identity check for resuming a browser upload. It hashes the
 * file metadata plus either the whole small file or samples from both ends of
 * a large file. Final Blob metadata verification remains the security wall.
 */
export async function familyAssetUploadFingerprint(file: File): Promise<string> {
  const sampleBytes = 64 * 1024;
  const sample =
    file.size <= sampleBytes * 2
      ? file
      : new Blob([
          file.slice(0, sampleBytes),
          file.slice(file.size - sampleBytes, file.size),
        ]);
  const metadata = new TextEncoder().encode(
    JSON.stringify([file.name, file.size, file.lastModified]),
  );
  const sampleBuffer = new Uint8Array(await sample.arrayBuffer());
  const fingerprintInput = new Uint8Array(metadata.byteLength + sampleBuffer.byteLength);
  fingerprintInput.set(metadata, 0);
  fingerprintInput.set(sampleBuffer, metadata.byteLength);
  return sha256Hex(fingerprintInput);
}

async function sha256Hex(value: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function familyAssetUploadPartSha256(part: Blob): Promise<string> {
  return sha256Hex(await part.arrayBuffer());
}

export function isFamilyAssetUploadFingerprint(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}
