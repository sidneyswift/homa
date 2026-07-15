import { loadEnvFile } from "node:process";

import { Handwrytten } from "handwrytten";

import {
  sendHandwryttenCard,
  getHandwryttenOrderStatus,
} from "../lib/cards/handwrytten";
import { THANK_YOU_CARD_WISHES, thankYouCardMessage } from "../lib/cards/message";

/**
 * Handwrytten smoke check for the thank-you card pipeline
 * (plans/2026-07-11-thank-you-cards.md). Two modes, both safe:
 *
 *   pnpm --filter web exec tsx scripts/handwrytten-smoke.mts
 *     Verifies the API key, prints the account, thank-you card
 *     candidates, and handwriting fonts, so ids can be chosen.
 *
 *   pnpm --filter web exec tsx scripts/handwrytten-smoke.mts --send \
 *     --first Sidney --last Swift --street "..." --city "..." --state DC --zip "..."
 *     Places ONE order through the exact production code path
 *     (lib/cards/handwrytten.ts + the real message template) with test
 *     mode FORCED on: the order validates end to end but never prints,
 *     mails, or bills. This script cannot place a real order.
 *
 * Env: HANDWRYTTEN_API_KEY (+ HANDWRYTTEN_CARD_ID / HANDWRYTTEN_FONT
 * for --send), read from apps/web/.env.local.
 */

try {
  loadEnvFile(".env.local");
} catch {
  // CI or preconfigured shells provide the env directly.
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const apiKey = process.env.HANDWRYTTEN_API_KEY;
if (!apiKey) {
  console.error("HANDWRYTTEN_API_KEY is not set (.env.local)");
  process.exit(2);
}

const client = new Handwrytten({ apiKey });

async function listMode(): Promise<void> {
  const user = await client.auth.getUser();
  console.log(`account ok: ${user.firstName ?? ""} ${user.lastName ?? ""} <${user.email ?? "?"}>`);
  console.log(`credits: ${user.credits ?? 0}`);

  const cards = await client.cards.list();
  console.log(`\ncards: ${cards.length} total; thank-you candidates:`);
  const candidates = cards.filter((card) =>
    `${card.title} ${card.category ?? ""}`.toLowerCase().includes("thank"),
  );
  for (const card of candidates.slice(0, 30)) {
    console.log(`  [${card.id}] ${card.title} (${card.category ?? "uncategorized"}) ${card.imageUrl ?? ""}`);
  }
  if (candidates.length === 0) {
    for (const card of cards.slice(0, 20)) {
      console.log(`  [${card.id}] ${card.title} (${card.category ?? "uncategorized"})`);
    }
  }

  const fonts = await client.fonts.list();
  console.log(`\nhandwriting fonts: ${fonts.length}`);
  for (const font of fonts) {
    console.log(`  [${font.id}] ${font.label} ${font.previewUrl ?? ""}`);
  }
}

async function sendMode(): Promise<void> {
  // Test mode is forced, never optional: this script exists to validate
  // the pipeline, and only the production cron may spend money.
  process.env.HANDWRYTTEN_TEST_MODE = "true";
  const firstName = argValue("--first") ?? "Test";
  const request = {
    firstName,
    lastName: argValue("--last") ?? "",
    street1: argValue("--street") ?? "",
    city: argValue("--city") ?? "",
    state: argValue("--state") ?? "",
    zip: argValue("--zip") ?? "",
    message: thankYouCardMessage(firstName),
    wishes: THANK_YOU_CARD_WISHES,
  };
  if (!request.street1 || !request.city || !request.state || !request.zip) {
    console.error("--send needs --street, --city, --state, --zip (and ideally --first/--last)");
    process.exit(2);
  }
  console.log("placing TEST-MODE order (validates, never prints or bills)...");
  try {
    const { orderId } = await sendHandwryttenCard(request);
    console.log(`order accepted, vendor order id: ${orderId ?? "(none returned)"}`);
    if (orderId) {
      const status = await getHandwryttenOrderStatus(orderId);
      console.log(`vendor status: ${status ?? "(unavailable)"}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("test mode")) {
      console.error(
        "The vendor rejected the per-order test flag: the ACCOUNT is in live " +
          "mode. Flip test mode on app.handwrytten.com (Integrations page), " +
          "rerun this, then flip the account back to live.",
      );
      process.exit(1);
    }
    throw error;
  }
}

/**
 * One-time account setup probe: saves a sender (return) address through
 * the API and prints its id. Set HANDWRYTTEN_RETURN_ADDRESS_ID in .env.local
 * to the printed id so cards use "Homa" as the sender instead of the
 * account owner's personal info.
 *
 *   pnpm --filter web exec tsx scripts/handwrytten-smoke.mts --setup-sender
 *   pnpm --filter web exec tsx scripts/handwrytten-smoke.mts --setup-sender --first Homa --last "" --street "" --city "" --state "" --zip ""
 *   pnpm --filter web exec tsx scripts/handwrytten-smoke.mts --list-senders
 */
async function setupSenderMode(): Promise<void> {
  const senderId = await client.addressBook.addSender({
    firstName: argValue("--first") ?? "Homa",
    lastName: argValue("--last") ?? "",
    street1: argValue("--street") ?? "",
    city: argValue("--city") ?? "",
    state: argValue("--state") ?? "",
    zip: argValue("--zip") ?? "",
  });
  console.log(`sender saved, id: ${JSON.stringify(senderId)}`);
  console.log(`\nSet this in .env.local (and Vercel env vars):`);
  console.log(`  HANDWRYTTEN_RETURN_ADDRESS_ID=${JSON.stringify(senderId)}`);
  console.log(`\nAll saved senders:`);
  const senders = await client.addressBook.listSenders();
  for (const sender of senders) {
    console.log(`  [${sender.id}] ${sender.firstName ?? ""} ${sender.lastName ?? ""}, ${sender.street1 ?? ""}`);
  }
}

async function listSendersMode(): Promise<void> {
  const senders = await client.addressBook.listSenders();
  console.log(`Saved senders (${senders.length}):`);
  for (const sender of senders) {
    console.log(`  [${sender.id}] ${sender.firstName ?? ""} ${sender.lastName ?? ""}, ${sender.street1 ?? ""}`);
  }
}

if (process.argv.includes("--setup-sender")) {
  await setupSenderMode();
} else if (process.argv.includes("--list-senders")) {
  await listSendersMode();
} else if (process.argv.includes("--send")) {
  await sendMode();
} else {
  await listMode();
}
