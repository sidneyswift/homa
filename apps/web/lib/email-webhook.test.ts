import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  classifyResendWebhook,
  resendWebhookReceiptHttpStatus,
  verifySvixSignature,
} from "./email-webhook";

const KEY = Buffer.from("test-signing-key-32-bytes-long!!").toString("base64");
const SECRET = `whsec_${KEY}`;

function sign(id: string, timestamp: string, payload: string): string {
  const mac = createHmac("sha256", Buffer.from(KEY, "base64"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${mac}`;
}

test("accepts a correctly signed payload", () => {
  const now = 1_800_000_000;
  const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1" } });
  const headers = {
    id: "msg_1",
    timestamp: String(now),
    signature: sign("msg_1", String(now), payload),
  };
  assert.equal(verifySvixSignature(SECRET, headers, payload, now), true);
});

test("accepts when one of several signatures matches", () => {
  const now = 1_800_000_000;
  const payload = "{}";
  const good = sign("msg_2", String(now), payload);
  const headers = {
    id: "msg_2",
    timestamp: String(now),
    signature: `v1,${Buffer.from("wrong-signature-padding-x").toString("base64")} ${good}`,
  };
  assert.equal(verifySvixSignature(SECRET, headers, payload, now), true);
});

test("rejects a tampered payload", () => {
  const now = 1_800_000_000;
  const payload = "{}";
  const headers = {
    id: "msg_3",
    timestamp: String(now),
    signature: sign("msg_3", String(now), payload),
  };
  assert.equal(verifySvixSignature(SECRET, headers, '{"a":1}', now), false);
});

test("rejects a stale timestamp (replay)", () => {
  const now = 1_800_000_000;
  const stale = String(now - 6 * 60);
  const payload = "{}";
  const headers = { id: "msg_4", timestamp: stale, signature: sign("msg_4", stale, payload) };
  assert.equal(verifySvixSignature(SECRET, headers, payload, now), false);
});

test("rejects missing headers and an empty secret key", () => {
  const now = 1_800_000_000;
  assert.equal(
    verifySvixSignature(SECRET, { id: null, timestamp: String(now), signature: "v1,x" }, "{}", now),
    false,
  );
  const headers = { id: "msg_5", timestamp: String(now), signature: sign("msg_5", String(now), "{}") };
  assert.equal(verifySvixSignature("whsec_", headers, "{}", now), false);
});

test("classifies the event types the ledgers care about", () => {
  assert.deepEqual(classifyResendWebhook("email.delivered"), {
    ledgerStatus: "delivered",
    failsDelivery: false,
  });
  assert.deepEqual(classifyResendWebhook("email.bounced"), {
    ledgerStatus: "bounced",
    failsDelivery: true,
  });
  assert.deepEqual(classifyResendWebhook("email.complained"), {
    ledgerStatus: "complained",
    failsDelivery: false,
  });
  assert.deepEqual(classifyResendWebhook("email.opened"), {
    ledgerStatus: null,
    failsDelivery: false,
  });
});

test("returns a retryable status until a receipt matches durable provider state", () => {
  assert.equal(
    resendWebhookReceiptHttpStatus({
      matched: false,
      matchedEmailSends: 0,
      matchedDeliveries: 0,
      recomputedTaskRuns: 0,
    }),
    503,
  );
  assert.equal(
    resendWebhookReceiptHttpStatus({
      matched: true,
      matchedEmailSends: 0,
      matchedDeliveries: 1,
      recomputedTaskRuns: 1,
    }),
    200,
  );
});
