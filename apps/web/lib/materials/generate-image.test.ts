import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GatewayInternalServerError,
  GatewayInvalidRequestError,
  GatewayRateLimitError,
} from "@ai-sdk/gateway";
import { APICallError } from "ai";

import {
  classifyImageFailure,
  imageFailureNote,
  type ImageFailureKind,
} from "./generate-image";

/**
 * Fixtures are built from the real error classes the gateway throws, not
 * hand-written lookalikes, so a provider upgrade that changes the shape
 * breaks these tests instead of silently un-fixing the 2026-07-29
 * "that is not pokemon" bug.
 */

/** What the gateway actually throws when gpt-image-2 refuses a prompt. */
function moderationRefusal(): unknown {
  const upstream = new APICallError({
    // The gateway image model passes the parsed body through as the
    // message (errorToMessage: data => data), so this is genuinely not a
    // readable sentence in production.
    message: "[object Object]",
    url: "https://ai-gateway.vercel.sh/v1/ai/image-model",
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        message:
          "Your request was rejected as a result of our safety system.",
        type: "invalid_request_error",
        code: "moderation_blocked",
        param: null,
      },
    }),
    data: { error: { code: "moderation_blocked" } },
  });
  // The gateway re-types by error.type and drops error.code, so the
  // outer error deliberately says nothing about moderation here: the
  // marker survives only on the cause. That is the case that regressed.
  return new GatewayInvalidRequestError({
    message: "Gateway request failed",
    statusCode: 400,
    cause: upstream,
  });
}

test("a moderation refusal buried on the cause chain reads as a policy block", () => {
  assert.equal(classifyImageFailure(moderationRefusal()), "policy");
});

test("a likeness refusal phrased only in prose still reads as policy", () => {
  const error = new GatewayInvalidRequestError({
    message:
      "This request was blocked because it may depict a trademarked character.",
    statusCode: 400,
  });
  assert.equal(classifyImageFailure(error), "policy");
});

test("a non-policy 400 is rejected, not transient: an identical retry fails identically", () => {
  const error = new GatewayInvalidRequestError({
    message: "Reference image exceeds the maximum supported dimensions.",
    statusCode: 400,
  });
  assert.equal(classifyImageFailure(error), "rejected");
});

test("rate limits and provider outages stay transient", () => {
  assert.equal(classifyImageFailure(new GatewayRateLimitError({})), "transient");
  assert.equal(
    classifyImageFailure(new GatewayInternalServerError({})),
    "transient",
  );
});

test("a proxy outage whose HTML body carries a copyright footer stays transient", () => {
  // The false positive that would matter most: telling a parent her
  // character is blocked when the provider was merely down.
  const outage = new GatewayInternalServerError({
    message: "Bad gateway",
    statusCode: 502,
    cause: new APICallError({
      message: "Bad gateway",
      url: "https://ai-gateway.vercel.sh/v1/ai/image-model",
      requestBodyValues: {},
      statusCode: 502,
      responseBody:
        "<html><body><h1>502</h1><footer>Copyright 2026</footer></body></html>",
    }),
  });
  assert.equal(classifyImageFailure(outage), "transient");
});

test("an unrecognizable failure stays transient, so a network blip never reads as a refusal", () => {
  assert.equal(classifyImageFailure(new Error("fetch failed")), "transient");
  assert.equal(classifyImageFailure(undefined), "transient");
  assert.equal(classifyImageFailure("something broke"), "transient");
});

test("a self-referencing cause chain terminates instead of hanging", () => {
  const looping = new Error("outer") as Error & { cause?: unknown };
  looping.cause = looping;
  assert.equal(classifyImageFailure(looping), "transient");
});

test("the policy note keeps a real route open instead of declaring defeat", () => {
  const note = imageFailureNote("policy");
  // Founder correction 2026-07-29: refusal is per-franchise, and a
  // reference image genuinely changes the outcome, so the note must not
  // teach Homa that the character is simply unavailable.
  assert.match(note, /per-franchise/u);
  assert.match(note, /reference image/u);
  assert.doesNotMatch(note, /never the real one|will keep failing/u);
});

test("the policy note still forbids the quiet-lookalike path and names the parent", () => {
  const note = imageFailureNote("policy");
  assert.match(note, /tell the parent plainly/u);
  assert.match(note, /off-brand lookalike/u);
  assert.match(note, /theme-object|close-but-not-canon/u);
  // The original bug was the generic advice. Still banned on a policy block.
  assert.doesNotMatch(note, /Try a reworded prompt/u);
});

test("every kind gets its own note, so the classification changes what Homa reads", () => {
  const kinds: ImageFailureKind[] = ["policy", "rejected", "transient"];
  const notes = kinds.map(imageFailureNote);
  assert.equal(new Set(notes).size, kinds.length);
  for (const note of notes) assert.ok(note.length > 0);
});

test("no em dash in any parent-bound note (house law)", () => {
  for (const kind of ["policy", "rejected", "transient"] as const) {
    assert.doesNotMatch(imageFailureNote(kind), /—/u);
  }
});
