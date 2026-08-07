import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const storePath = new URL("./store.ts", import.meta.url);
const dispatchInputPath = new URL("./dispatch-input.ts", import.meta.url);
const channelPath = new URL(
  "../../agent/channels/dispatch.ts",
  import.meta.url,
);

test("scheduled and Run-now loaders carry source-offer transport provenance", async () => {
  const source = await readFile(storePath, "utf8");
  const claimStart = source.indexOf("export async function claimDueFamilyTasks");
  const manualStart = source.indexOf("export async function loadFamilyTaskForRun");
  const claim = source.slice(claimStart, manualStart);
  const manual = source.slice(manualStart, source.indexOf("export async function hasRunningTaskRun"));

  assert.ok(claimStart >= 0);
  assert.ok(manualStart > claimStart);
  assert.match(claim, /s\.source_offer_delivery_id/u);
  assert.match(claim, /sourceOfferDeliveryId: row\.source_offer_delivery_id/u);
  assert.match(manual, /s\.source_offer_delivery_id/u);
  assert.match(manual, /sourceOfferDeliveryId: row\.source_offer_delivery_id/u);
});

test("recurrence provenance stays in target state and never becomes tool authority", async () => {
  const dispatchInput = await readFile(dispatchInputPath, "utf8");
  const channel = await readFile(channelPath, "utf8");
  const targetStart = dispatchInput.indexOf("export function buildDispatchTarget");
  const authStart = dispatchInput.indexOf("export function buildDispatchAuth");
  const target = dispatchInput.slice(targetStart, authStart);
  const auth = dispatchInput.slice(authStart);

  assert.match(target, /sourceOfferDeliveryId: task\.sourceOfferDeliveryId/u);
  assert.doesNotMatch(auth, /acceptedOfferDeliveryId/u);
  assert.match(channel, /sourceOfferDeliveryId: target\.sourceOfferDeliveryId/u);
  assert.match(
    channel,
    /acceptedOfferDeliveryIdFromAttributes\([\s\S]*\) \?\? sourceOfferDeliveryId/u,
  );
});
