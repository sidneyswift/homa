import { createHash } from "node:crypto";

import { signedFamilyBlobReadUrl } from "../family-blob";
import { isFamilyBlobUrl } from "../family-blob-url";
import { familyAssetReadableByteLimit } from "./family-asset-read-contract";

export type FamilyAssetBytes =
  | { ok: true; bytes: Uint8Array; sha256: string }
  | { ok: false; reason: "too_large" | "transient" | "corrupt" };

/** The injectable fetch is for deterministic tests. Production URLs are scoped
 * before signing, and response headers never substitute for counted bytes. */
export async function fetchBoundedAssetBytes(
  url: string,
  maxBytes: number,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<FamilyAssetBytes> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    signal.throwIfAborted();
    const response = await fetcher(url, { signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return { ok: false, reason: "transient" };
    }
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body.cancel();
      return { ok: false, reason: "too_large" };
    }
    reader = response.body.getReader();
    const abort = () => { void reader?.cancel().catch(() => {}); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      const chunks: Uint8Array[] = [];
      const hash = createHash("sha256");
      let total = 0;
      while (true) {
        signal.throwIfAborted();
        const next = await reader.read();
        signal.throwIfAborted();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, reason: "too_large" };
        }
        hash.update(next.value);
        chunks.push(next.value);
      }
      if (total === 0) return { ok: false, reason: "corrupt" };
      return { ok: true, bytes: Buffer.concat(chunks, total), sha256: hash.digest("hex") };
    } finally {
      signal.removeEventListener("abort", abort);
    }
  } catch {
    return { ok: false, reason: "transient" };
  } finally {
    reader?.releaseLock();
  }
}

export async function fetchFamilyAssetBytes(
  asset: { url: string; familyId: string; mediaType: string },
  signal: AbortSignal,
): Promise<FamilyAssetBytes> {
  if (!isFamilyBlobUrl(asset.url, asset.familyId, "library")) return { ok: false, reason: "corrupt" };
  try {
    signal.throwIfAborted();
    const url = await signedFamilyBlobReadUrl(asset.url, asset.familyId, "library");
    return await fetchBoundedAssetBytes(url, familyAssetReadableByteLimit(asset.mediaType),
      AbortSignal.any([signal, AbortSignal.timeout(25_000)]));
  } catch {
    return { ok: false, reason: "transient" };
  }
}
