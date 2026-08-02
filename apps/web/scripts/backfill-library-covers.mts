/**
 * backfill-library-covers: real book covers for /admin/library.
 *
 * The founder console's library shelf shows every ingested reference
 * and curriculum as a book. A record whose original bytes survive in
 * Blob deserves a real cover, meaning page 1 of the actual printable or
 * slide 1 of the actual presentation the co-founder dropped, not a
 * generated placeholder. This script walks inspo/ in Blob, renders the
 * first real page, and writes the result to inspo-covers/<id>.jpg.
 *
 * Why a script and not a route: the originals average 43MB and one is
 * 128MB, so rasterising on request would blow every deadline tier we
 * have. Covers are generated once, cached in Blob, and served straight
 * from their public URL. Records with no original never get one; the
 * shelf draws a designed cover from metadata instead.
 *
 * Idempotent and resumable. Re-running skips a cover only after its exact
 * source, JPEG bytes, and receipt read back successfully. Receiptless covers
 * remain explicitly legacy during a default run. Use --id to verify or
 * upgrade one intended record, or --force to upgrade every legacy cover.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... node --experimental-strip-types \
 *     scripts/backfill-library-covers.mts [--force] [--limit N] [--id <record-id>] \
 *     [--source-url <exact-live-blob-url>]
 *
 * Set LIBRARY_COVER_PDF_PASSWORD only for a password-protected original
 * and always pair it with --id.
 */

import { readFile } from "node:fs/promises";

import { get, list, put } from "@vercel/blob";

import {
  blobEtagsMatch,
  blobPathnamesMatch,
  blobReportedSizeMatches,
  inspectLibraryCoverJpeg,
  libraryCoverReceiptMatches,
  renderLibraryCover,
  retryLibraryCoverReadBack,
  selectLibraryCoverSource,
  shouldPreserveLegacyLibraryCover,
  type LibraryCoverBlob,
  type LibraryCoverReceipt,
} from "../lib/materials/library-cover-source.ts";
import {
  coverPathForRecord,
  recordIdFromBlobPath,
} from "../lib/materials/library-shelf.ts";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = readFlag("--limit");
const ONLY_ID = readFlag("--id");
const SOURCE_URL = readFlag("--source-url");
const PDF_PASSWORD = process.env.LIBRARY_COVER_PDF_PASSWORD;
const RECEIPT_PREFIX = "inspo-cover-receipts/";
const RECORD_ID_RE = /^(?:ref|cur)-\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : null;
  return value && !value.startsWith("--") ? value : null;
}

/** Blob's own listing is the authority on which originals exist; the
 * analysis JSONs record a blobUrl on only 3 of 195 documents. */
async function listAll(prefix: string) {
  const blobs: LibraryCoverBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    blobs.push(
      ...page.blobs.map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        etag: blob.etag,
      })),
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function receiptPathForRecord(recordId: string): string {
  return `${RECEIPT_PREFIX}${recordId}.json`;
}

async function readLiveBlob(blob: LibraryCoverBlob) {
  return retryLibraryCoverReadBack(async () => {
    const result = await get(blob.url, { access: "public", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`live Blob read-back failed for ${blob.pathname}`);
    }
    if (
      !blobPathnamesMatch(blob.pathname, result.blob.pathname) ||
      result.blob.url !== blob.url ||
      !blobReportedSizeMatches(blob.size, result.blob.size) ||
      !blobEtagsMatch(blob.etag, result.blob.etag)
    ) {
      throw new Error(`live Blob identity drifted for ${blob.pathname}`);
    }
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    if (bytes.length !== blob.size) {
      throw new Error(`live Blob size drifted for ${blob.pathname}`);
    }
    return { bytes, contentType: result.blob.contentType };
  });
}

async function coverIsCurrent(
  recordId: string,
  source: LibraryCoverBlob,
  cover: LibraryCoverBlob | undefined,
  receiptBlob: LibraryCoverBlob | undefined,
): Promise<boolean> {
  if (!cover || !receiptBlob || !source.etag || !cover.etag) return false;
  try {
    const receiptBytes = (await readLiveBlob(receiptBlob)).bytes;
    const receipt = JSON.parse(receiptBytes.toString("utf8"));
    if (!libraryCoverReceiptMatches(receipt, recordId, source, cover)) {
      return false;
    }
    const liveCover = await readLiveBlob(cover);
    if (liveCover.contentType !== "image/jpeg") return false;
    const evidence = await inspectLibraryCoverJpeg(liveCover.bytes);
    return (
      evidence.size === receipt.cover.size &&
      evidence.sha256 === receipt.cover.sha256
    );
  } catch {
    return false;
  }
}

async function persistCoverReceipt(receipt: LibraryCoverReceipt): Promise<void> {
  const rendered = `${JSON.stringify(receipt, null, 2)}\n`;
  const saved = await put(receiptPathForRecord(receipt.recordId), rendered, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  const receiptBlob: LibraryCoverBlob = {
    pathname: saved.pathname,
    url: saved.url,
    size: Buffer.byteLength(rendered),
    etag: saved.etag,
  };
  const readBack = await readLiveBlob(receiptBlob);
  if (readBack.contentType !== "application/json" || readBack.bytes.toString("utf8") !== rendered) {
    throw new Error(`cover receipt failed read-back for ${receipt.recordId}`);
  }
}

async function claimedSourceUrls(recordId: string): Promise<Set<string>> {
  const folder = recordId.startsWith("cur-") ? "curriculums" : "references";
  const url = new URL(`../../../.cosmo/${folder}/${recordId}.json`, import.meta.url);
  try {
    const record = JSON.parse(await readFile(url, "utf8"));
    return new Set(
      (record.sourceFiles ?? [])
        .map((source: { blobUrl?: unknown }) => source.blobUrl)
        .filter((value: unknown): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

async function main() {
  if (args.includes("--id") && !ONLY_ID) {
    console.error("--id requires an exact record id");
    process.exit(1);
  }
  if (ONLY_ID && !RECORD_ID_RE.test(ONLY_ID)) {
    console.error("--id must be a canonical ref-YYYY-MM-DD-slug or cur-YYYY-MM-DD-slug");
    process.exit(1);
  }
  if (args.includes("--limit") && !LIMIT) {
    console.error("--limit requires a positive integer");
    process.exit(1);
  }
  if (LIMIT && (!Number.isInteger(Number(LIMIT)) || Number(LIMIT) <= 0)) {
    console.error("--limit requires a positive integer");
    process.exit(1);
  }
  if (args.includes("--source-url") && !SOURCE_URL) {
    console.error("--source-url requires an exact live Blob URL");
    process.exit(1);
  }
  if (SOURCE_URL && !ONLY_ID) {
    console.error("--source-url requires --id so the source cannot cross record boundaries");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required. Inside apps/web: vercel env pull .env.blob && source .env.blob");
    process.exit(1);
  }
  if (PDF_PASSWORD && !ONLY_ID) {
    console.error(
      "LIBRARY_COVER_PDF_PASSWORD requires --id so it cannot be applied to unrelated records",
    );
    process.exit(1);
  }

  const [originals, existingCovers, existingReceipts] = await Promise.all([
    listAll("inspo/"),
    listAll("inspo-covers/"),
    listAll(RECEIPT_PREFIX),
  ]);
  const coverByRecord = new Map(
    existingCovers.map((blob) => [
      blob.pathname.replace(/^inspo-covers\//, "").replace(/\.jpg$/, ""),
      blob,
    ]),
  );
  const receiptByRecord = new Map(
    existingReceipts.map((blob) => [
      blob.pathname.replace(/^inspo-cover-receipts\//, "").replace(/\.json$/, ""),
      blob,
    ]),
  );

  const recordIds = new Set<string>();
  for (const blob of originals) {
    const recordId = recordIdFromBlobPath(blob.pathname);
    if (recordId) recordIds.add(recordId);
  }

  let explicitSource: LibraryCoverBlob | null = null;
  if (SOURCE_URL && ONLY_ID) {
    try {
      explicitSource = selectLibraryCoverSource(
        originals,
        ONLY_ID,
        SOURCE_URL,
        await claimedSourceUrls(ONLY_ID),
      );
    } catch (error) {
      console.error(`--source-url rejected: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  const targets = ONLY_ID ? [ONLY_ID] : [...recordIds].sort();

  console.log(
    `originals: ${originals.length} across ${recordIds.size} records | covers present: ${coverByRecord.size} | candidates: ${targets.length}`,
  );

  let made = 0;
  let skipped = 0;
  let legacy = 0;
  let failed = 0;
  let attempted = 0;

  for (const recordId of targets) {
    try {
      const blob =
        explicitSource && recordId === ONLY_ID
          ? explicitSource
          : selectLibraryCoverSource(originals, recordId);
      const existingCover = coverByRecord.get(recordId);
      const existingReceipt = receiptByRecord.get(recordId);
      if (!FORCE && await coverIsCurrent(
        recordId,
        blob,
        existingCover,
        existingReceipt,
      )) {
        skipped += 1;
        console.log(`  keep  ${recordId} (source and JPEG receipt verified)`);
        continue;
      }
      // Covers created before receipt version 1 remain usable legacy assets,
      // but their source and bytes are unproved. Preserve the old default,
      // which did not rewrite existing covers. An exact --id run upgrades one
      // intended record, while --force is the explicit whole-library upgrade.
      if (shouldPreserveLegacyLibraryCover({
        force: FORCE,
        exactRecord: Boolean(ONLY_ID),
        cover: existingCover,
        receipt: existingReceipt,
      })) {
        legacy += 1;
        console.log(
          `  legacy ${recordId} (unverified; use --id ${recordId} to upgrade)`,
        );
        continue;
      }
      if (LIMIT && attempted >= Number(LIMIT)) break;
      attempted += 1;
      const name = blob.pathname.split("/").slice(2).join("/");
      const mb = (blob.size / 1e6).toFixed(0);

      const sourceReadBack = await readLiveBlob(blob);
      const rendered = await renderLibraryCover(name, sourceReadBack.bytes, {
        pdfPassword: PDF_PASSWORD ?? undefined,
      });
      const coverEvidence = await inspectLibraryCoverJpeg(rendered.jpeg);

      const savedCover = await put(coverPathForRecord(recordId), rendered.jpeg, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      const coverBlob: LibraryCoverBlob = {
        pathname: savedCover.pathname,
        url: savedCover.url,
        size: coverEvidence.size,
        etag: savedCover.etag,
      };
      const coverReadBack = await readLiveBlob(coverBlob);
      if (coverReadBack.contentType !== "image/jpeg") {
        throw new Error(`cover MIME read-back failed for ${recordId}`);
      }
      const liveEvidence = await inspectLibraryCoverJpeg(coverReadBack.bytes);
      if (
        liveEvidence.size !== coverEvidence.size ||
        liveEvidence.sha256 !== coverEvidence.sha256
      ) {
        throw new Error(`cover byte read-back failed for ${recordId}`);
      }
      if (!blob.etag || !coverBlob.etag) {
        throw new Error(`Blob listing omitted an ETag for ${recordId}`);
      }
      await persistCoverReceipt({
        version: 1,
        recordId,
        source: {
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
          etag: blob.etag,
        },
        cover: {
          pathname: coverBlob.pathname,
          url: coverBlob.url,
          size: coverBlob.size,
          etag: coverBlob.etag,
          sha256: liveEvidence.sha256,
        },
        renderedFrom: rendered.renderedFrom,
      });
      made += 1;
      console.log(
        `  cover ${recordId} (${mb}MB source, page 1 from ${rendered.renderedFrom})`,
      );
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${recordId}: ${(error as Error).message}`);
    }
  }

  console.log(
    `\ndone. generated ${made}, verified ${skipped}, ` +
    `legacy ${legacy}, failed ${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

await main();
