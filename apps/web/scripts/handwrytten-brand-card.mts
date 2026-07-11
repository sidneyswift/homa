import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadEnvFile } from "node:process";

import { put } from "@vercel/blob";
import { Handwrytten } from "handwrytten";

/**
 * Create (or refresh) the Homa-branded Handwrytten stationery
 * (plans/2026-07-11-thank-you-cards.md, branding pass). Takes rendered
 * print-resolution panels, hosts them on the public homa-artifacts Blob
 * store, registers them as Handwrytten cover images, runs the vendor's
 * quality check, and assembles the custom card. Prints the new card id;
 * point HANDWRYTTEN_CARD_ID at it to ship the design.
 *
 *   pnpm --filter web exec tsx scripts/handwrytten-brand-card.mts \
 *     --front /path/front.png --back /path/back.png \
 *     [--name "Homa thank you (brand v1)"] [--dimension 3]
 *
 * Dimension 3 = "A2 Folded Landscape" (5.5x8.5 open); panels render at
 * 1650x1275 (5.5x4.25in at 300dpi). Env: HANDWRYTTEN_API_KEY,
 * BLOB_READ_WRITE_TOKEN (both in .env.local).
 */

try {
  loadEnvFile(".env.local");
} catch {
  // Preconfigured shells provide the env directly.
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const frontPath = argValue("--front");
const backPath = argValue("--back");
if (!frontPath || !backPath) {
  console.error("need --front and --back paths to print-resolution PNGs");
  process.exit(2);
}
const apiKey = process.env.HANDWRYTTEN_API_KEY;
if (!apiKey || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("HANDWRYTTEN_API_KEY and BLOB_READ_WRITE_TOKEN must be set (.env.local)");
  process.exit(2);
}

const client = new Handwrytten({ apiKey });

async function hostOnBlob(path: string): Promise<string> {
  const blob = await put(`cards/${basename(path)}`, readFileSync(path), {
    access: "public",
    addRandomSuffix: true,
  });
  console.log(`hosted ${basename(path)}: ${blob.url}`);
  return blob.url;
}

async function registerCover(url: string, label: string): Promise<number> {
  const image = await client.customCards.uploadImage({ url, imageType: "cover" });
  const check = await client.customCards.checkImage(image.id);
  console.log(`${label} cover image id ${image.id}, quality check: ${JSON.stringify(check)}`);
  return image.id;
}

const frontUrl = await hostOnBlob(frontPath);
const backUrl = await hostOnBlob(backPath);
const coverId = await registerCover(frontUrl, "front");
const backCoverId = await registerCover(backUrl, "back");

const card = await client.customCards.create({
  name: argValue("--name") ?? "Homa thank you (brand v1)",
  dimensionId: argValue("--dimension") ?? "3",
  coverId,
  // The API requires naming what the back side IS ("cover" or "logo"),
  // not just which image it uses.
  backType: "cover",
  backCoverId,
});
console.log(`custom card created, card id: ${card.cardId}`);
console.log(JSON.stringify(card.raw));

// Custom cards live under customCards, not the public catalog.
const detail = await client.customCards.get(card.cardId);
console.log(`detail: ${JSON.stringify(detail.raw)}`);
