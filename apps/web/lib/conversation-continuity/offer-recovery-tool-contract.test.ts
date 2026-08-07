import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const printablePath = new URL(
  "../../agent/tools/create_printable.ts",
  import.meta.url,
);
const telnyxPath = new URL(
  "../../agent/channels/telnyx.ts",
  import.meta.url,
);
const emailPath = new URL(
  "../../agent/channels/email.ts",
  import.meta.url,
);

test("accepted printable sources prove the authenticated adult before SMS progress or writes", async () => {
  const source = await readFile(printablePath, "utf8");
  const executeStart = source.indexOf("async execute(input, ctx)");
  const sourceRead = source.indexOf(
    "acceptedOfferDeliveryIdFromAttributes(attributes)",
    executeStart,
  );
  const recipientProof = source.indexOf(
    "await validateAcceptedOfferFulfillmentRecipient",
    sourceRead,
  );
  const smsProgress = source.indexOf("await sendSmsProgressTextOnce", sourceRead);
  const upload = source.indexOf("await uploadMaterialArtifacts", sourceRead);
  const insert = source.indexOf("await insertMaterialRowPinned", sourceRead);

  assert.ok(executeStart >= 0);
  assert.ok(sourceRead > executeStart);
  assert.ok(recipientProof > sourceRead);
  assert.ok(smsProgress > recipientProof);
  assert.ok(upload > recipientProof);
  assert.ok(insert > upload);
  assert.match(
    source.slice(sourceRead, smsProgress),
    /recipientMemberUserId !== expectedRecipientMemberUserId/u,
  );
});

test("review-null recovery reserves fulfillment and the final insert rechecks source ownership", async () => {
  const source = await readFile(printablePath, "utf8");
  const reviewGate = source.indexOf("if (review !== null && !review.pass)");
  const reservation = source.indexOf(
    "await reserveAcceptedOfferFulfillment",
    reviewGate,
  );
  const insert = source.indexOf("await insertMaterialRowPinned", reservation);

  assert.ok(reviewGate >= 0);
  assert.ok(reservation > reviewGate);
  assert.ok(insert > reservation);
  assert.match(
    source.slice(insert, insert + 1_500),
    /sourceAuthorizationDeliveryId: sourceOfferDeliveryId/u,
  );
  assert.match(
    source.slice(insert, insert + 1_500),
    /sourceOfferRecipientMemberUserId/u,
  );
});

test("caller-mode web fulfillment keeps server proof and stamps reserved provenance", async () => {
  const source = await readFile(printablePath, "utf8");
  const sourceRead = source.indexOf(
    "acceptedOfferDeliveryIdFromAttributes(attributes)",
    source.indexOf("async execute(input, ctx)"),
  );
  const callerInsert = source.indexOf('.from("materials")', sourceRead);

  assert.ok(sourceRead >= 0);
  assert.ok(callerInsert > sourceRead);
  assert.doesNotMatch(
    source.slice(sourceRead, callerInsert),
    /access\.mode !== "pinned"/u,
  );
  assert.match(
    source.slice(callerInsert, callerInsert + 1_500),
    /source_offer_delivery_id: reservedSourceDeliveryId/u,
  );
});

test("accepted printable SMS media rechecks the exact destination before both provider calls", async () => {
  const source = await readFile(printablePath, "utf8");
  const deliveryBlock = source.indexOf(
    'if (channel === "sms" && reviewPassed && attributes?.phoneNumber)',
  );
  const firstAuthorization = source.indexOf(
    "await acceptedOfferSmsDestinationIsCurrent()",
    deliveryBlock,
  );
  const firstSend = source.indexOf("await sendHomaSms", firstAuthorization);
  const secondAuthorization = source.indexOf(
    "await acceptedOfferSmsDestinationIsCurrent()",
    firstSend,
  );
  const secondSend = source.indexOf("await sendHomaSms", secondAuthorization);

  assert.ok(deliveryBlock >= 0);
  assert.ok(firstAuthorization > deliveryBlock);
  assert.ok(firstSend > firstAuthorization);
  assert.ok(secondAuthorization > firstSend);
  assert.ok(secondSend > secondAuthorization);
});

test("accepted SMS terminal replies recheck the exact destination at the provider boundary", async () => {
  const source = await readFile(telnyxPath, "utf8");
  const attemptGate = source.indexOf("if (!attempt.shouldSend)");
  const authorization = source.indexOf(
    "await acceptedOfferDestinationStillCurrent",
    attemptGate,
  );
  const providerCall = source.indexOf(
    "await channel.thread.post(messageText)",
    authorization,
  );

  assert.ok(attemptGate >= 0);
  assert.ok(authorization > attemptGate);
  assert.ok(providerCall > authorization);
  assert.match(
    source.slice(attemptGate, authorization),
    /acceptedOfferDeliveryIdFromAttributes\(attributes\)/u,
  );
});

test("accepted email terminal replies recheck the exact destination inside every provider attempt", async () => {
  const source = await readFile(emailPath, "utf8");
  const sendCallback = source.indexOf("sendEmail: async (attempt)");
  const authorization = source.indexOf(
    "await acceptedOfferDestinationStillCurrent",
    sendCallback,
  );
  const providerCall = source.indexOf(
    "await submitAgentComposedEmail",
    authorization,
  );

  assert.ok(sendCallback >= 0);
  assert.ok(authorization > sendCallback);
  assert.ok(providerCall > authorization);
  assert.match(
    source.slice(authorization, providerCall),
    /return \{ status: "rejected" \}/u,
  );
});
