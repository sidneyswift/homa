import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import {
  EVAL_BLOB_DIR_ENV_VAR,
  EVAL_BLOB_URL_ENV_VAR,
  isEvalIsolationActive,
} from "../eval-isolation";

/**
 * A local stand-in for the Vercel Blob store, active only inside isolated
 * eval runs (lib/eval-isolation.ts, 2026-07-25). Without it, scrubbing
 * BLOB_READ_WRITE_TOKEN made every materials eval park: the agent could
 * not store generated images or the finished PDF, so it honestly asked
 * the parent for input instead of finishing, and the succeeded gate
 * failed. This module gives the artifact store a throwaway directory
 * plus a loopback URL (scripts/eval-sandbox.mts serves the directory
 * over 127.0.0.1 so the PDF renderer can fetch embedded images), so the
 * whole materials pipeline runs at full fidelity and dies with the
 * sandbox.
 *
 * Both variables are honored only while eval isolation is active, so a
 * leaked variable cannot redirect a real runtime, and the tenancy law is
 * the same one isFamilyArtifactUrl enforces in production: a URL counts
 * as the family's own only under /families/<familyId>/.
 */

export interface EvalBlobStore {
  dir: string;
  baseUrl: string;
}

export function resolveEvalBlobStore(
  environment: Record<string, string | undefined>,
): EvalBlobStore | null {
  if (!isEvalIsolationActive(environment)) return null;
  const dir = environment[EVAL_BLOB_DIR_ENV_VAR];
  const baseUrl = environment[EVAL_BLOB_URL_ENV_VAR];
  if (!dir || !baseUrl) return null;
  return { dir, baseUrl: baseUrl.replace(/\/+$/, "") };
}

/**
 * The blob key becomes a real filesystem path here, and parts of the key
 * (the material slug) started life as model output, so the sandbox
 * enforces what the hosted store gets for free: a key can never escape
 * the store directory.
 */
function storePathFor(store: EvalBlobStore, key: string): string {
  const filePath = resolve(store.dir, key);
  if (filePath !== store.dir && !filePath.startsWith(store.dir + sep)) {
    throw new Error(`eval blob store: key escapes the store directory: ${key}`);
  }
  return filePath;
}

/** Mirrors put(..., { addRandomSuffix: true }): "a/b.pdf" -> "a/b-1a2b3c4d.pdf". */
function withRandomSuffix(key: string): string {
  const suffix = randomUUID().slice(0, 8);
  const dot = key.lastIndexOf(".");
  if (dot <= key.lastIndexOf("/")) return `${key}-${suffix}`;
  return `${key.slice(0, dot)}-${suffix}${key.slice(dot)}`;
}

export async function evalBlobPut(
  store: EvalBlobStore,
  key: string,
  body: Buffer,
): Promise<{ url: string }> {
  const suffixedKey = withRandomSuffix(key);
  const filePath = storePathFor(store, suffixedKey);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  return { url: `${store.baseUrl}/${suffixedKey}` };
}

/** Same tenancy shape as isFamilyArtifactUrl, against the sandbox origin. */
export function isEvalBlobFamilyUrl(
  store: EvalBlobStore,
  url: string,
  familyId: string,
): boolean {
  return url.startsWith(`${store.baseUrl}/families/${familyId}/`);
}

/** Local counterpart of deleteFamilyBlobs: returns how many files went. */
export async function evalBlobDeleteFamily(
  store: EvalBlobStore,
  familyId: string,
): Promise<number> {
  const familyDir = storePathFor(store, join("families", familyId));
  let count = 0;
  try {
    const entries = await readdir(familyDir, { recursive: true, withFileTypes: true });
    count = entries.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
  await rm(familyDir, { recursive: true, force: true });
  return count;
}
