import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { list } from "@vercel/blob";

import {
  buildShelf,
  countShelf,
  parseLibraryRecord,
  recordIdFromBlobPath,
  type BlobOriginal,
  type LibraryBook,
  type LibraryKind,
  type ShelfCounts,
} from "../materials/library-shelf";

/**
 * The library shelf's disk and Blob layer (/admin/library, founder ask
 * 2026-07-31). Mirrors readCosmoFunnel's posture exactly: the analysis
 * JSONs at the repo root ARE the product state, read fresh per request
 * and traced into the deployed function by next.config.ts. What is new
 * here is the Blob half, because the corpus's original bytes and its
 * cover thumbnails live there and the JSONs do not reliably point at
 * them (3 of 195 record a blobUrl).
 *
 * Blob listing is the authority on what we actually hold. It is wrapped
 * in React's per-request cache so the shelf page and a detail page in
 * the same render do not pay for it twice, but never cached across
 * requests: a founder who has just drained the backlog should see the
 * result on reload, not in five minutes.
 */

export interface LibraryView {
  books: LibraryBook[];
  counts: ShelfCounts;
  /** Null when Blob is unreachable or unconfigured, so the page can say
   * "originals unknown" instead of quietly showing every book as
   * missing its file. */
  blobReachable: boolean;
}

/** cwd is apps/web in the Next runtime and the repo root under scripts;
 * .cosmo sits at the repo root, so accept both. Same rule as
 * cosmo-data.ts, which this surface sits beside. */
function cosmoDir(): string {
  const fromRepoRoot = path.join(process.cwd(), ".cosmo");
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return path.join(process.cwd(), "..", "..", ".cosmo");
}

async function readJsonDocs(dir: string, prefix: string): Promise<unknown[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const docs: unknown[] = [];
  for (const name of names.sort()) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    try {
      docs.push(JSON.parse(await readFile(path.join(dir, name), "utf8")));
    } catch {
      // A malformed analysis file is Cosmo's bug, not a page outage.
    }
  }
  return docs;
}

async function listAllBlobs(prefix: string) {
  const blobs: { pathname: string; url: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    blobs.push(
      ...page.blobs.map((b) => ({ pathname: b.pathname, url: b.url, size: b.size })),
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

/** Originals and covers in one pass, tolerant of an unreachable store. */
const readBlobLayer = cache(
  async (): Promise<{
    originals: BlobOriginal[];
    covers: Map<string, string>;
    reachable: boolean;
  } > => {
    try {
      const [originalBlobs, coverBlobs] = await Promise.all([
        listAllBlobs("inspo/"),
        listAllBlobs("inspo-covers/"),
      ]);
      const originals: BlobOriginal[] = [];
      for (const blob of originalBlobs) {
        const recordId = recordIdFromBlobPath(blob.pathname);
        if (!recordId) continue;
        originals.push({
          recordId,
          url: blob.url,
          name: blob.pathname.split("/").slice(2).join("/"),
          size: blob.size,
        });
      }
      const covers = new Map<string, string>();
      for (const blob of coverBlobs) {
        const id = blob.pathname.replace(/^inspo-covers\//, "").replace(/\.jpg$/, "");
        if (id) covers.set(id, blob.url);
      }
      return { originals, covers, reachable: true };
    } catch (error) {
      // The page degrades to analysis-only rather than crashing, but the
      // reason must reach the logs: a silently empty Blob layer makes
      // every book look like its file is missing, which is a far more
      // alarming and completely wrong story.
      console.error("[library] Blob listing failed:", (error as Error).message);
      return { originals: [], covers: new Map(), reachable: false };
    }
  },
);

const readRecords = cache(async () => {
  const root = cosmoDir();
  if (!existsSync(root)) return [];
  const [refs, curs] = await Promise.all([
    readJsonDocs(path.join(root, "references"), "ref-"),
    readJsonDocs(path.join(root, "curriculums"), "cur-"),
  ]);
  const parse = (docs: unknown[], kind: LibraryKind) =>
    docs.map((doc) => parseLibraryRecord(doc, kind));
  return [...parse(refs, "reference"), ...parse(curs, "curriculum")];
});

export async function readLibrary(): Promise<LibraryView> {
  const [records, blob] = await Promise.all([readRecords(), readBlobLayer()]);
  const books = buildShelf(records, blob.originals, blob.covers);
  return { books, counts: countShelf(books), blobReachable: blob.reachable };
}

export async function readLibraryBook(id: string): Promise<LibraryBook | null> {
  const { books } = await readLibrary();
  return books.find((book) => book.id === id) ?? null;
}
