import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Library shelf smoke check: runs the /admin/library data layer against
 * the real .cosmo corpus and the real Blob store, printing counts only.
 * The founder gate 404s locally, so this is how the shelf's data half
 * gets verified without a signed-in session.
 *
 * Usage: pnpm library:smoke
 */

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(webRoot, ".env.local"));
} catch {
  // Fine when the vars already arrive via the environment.
}

const { readLibrary } = await import("../lib/admin/library-data.ts");
const { SHELF_STATUS_LABEL, SHELF_STATUS_ORDER } = await import(
  "../lib/materials/library-shelf.ts"
);

const view = await readLibrary();
console.log("blob reachable:", view.blobReachable);
console.log(
  `books ${view.counts.total} | needs work ${view.counts.needsWork} | real covers ${view.counts.withCover}`,
);
for (const status of SHELF_STATUS_ORDER) {
  console.log(`  ${SHELF_STATUS_LABEL[status].padEnd(16)} ${view.counts.byStatus[status]}`);
}
console.log(`originals held: ${(view.counts.originalBytes / 1e9).toFixed(2)} GB`);

const missingTitle = view.books.filter((b) => !b.title.trim()).length;
const missingDate = view.books.filter((b) => !b.droppedAt).length;
console.log(`books with no title: ${missingTitle} | with no date: ${missingDate}`);

const retainedWithoutCover = view.books
  .filter((book) => book.originalUrl && !book.coverUrl)
  .map((book) => book.id)
  .sort();
console.log(
  `retained originals with no cover: ${retainedWithoutCover.length}`,
);
for (const id of retainedWithoutCover) console.log(`  ${id}`);
