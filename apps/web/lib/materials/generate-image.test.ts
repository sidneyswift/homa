import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  GatewayInternalServerError,
  GatewayInvalidRequestError,
  GatewayRateLimitError,
} from "@ai-sdk/gateway";
import { APICallError } from "ai";

import {
  classifyImageFailure,
  familyReferenceSpace,
  generateStudioImage,
  imageFailureNote,
  imageFallbackModelId,
  shouldTryPolicyFallback,
  type ImageFailureKind,
} from "./generate-image";

test("the image tool does not impose a daily family cap", async () => {
  const source = await readFile(
    new URL("../../agent/tools/generate_image.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /MAX_IMAGES_PER_FAMILY_PER_DAY/u);
  assert.doesNotMatch(source, /imagesGeneratedToday/u);
  assert.doesNotMatch(source, /image budget for today is used up/u);
  assert.match(source, /emitMapEvent\("materials\.image_generated"/u);
});

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

/**
 * The policy fallback (founder ruling 2026-07-29, gh#449): a refused
 * character gets one retry on a vendor whose policy permits it.
 */

test("only a policy refusal earns the fallback retry", () => {
  const base = { fallbackModel: "prodia/flux-fast-schnell", budgetLeftMs: 120_000 };
  assert.equal(shouldTryPolicyFallback({ ...base, failure: "policy" }), true);
  // A transient failure should retry the SAME model, and a rejected
  // request is broken as written on any vendor. Neither is a policy case,
  // so neither should burn a second vendor's money.
  assert.equal(shouldTryPolicyFallback({ ...base, failure: "transient" }), false);
  assert.equal(shouldTryPolicyFallback({ ...base, failure: "rejected" }), false);
});

test("no configured fallback means the refusal simply stands", () => {
  assert.equal(
    shouldTryPolicyFallback({
      failure: "policy",
      fallbackModel: null,
      budgetLeftMs: 120_000,
    }),
    false,
  );
});

test("a fallback is not started when it cannot plausibly finish", () => {
  const base = { failure: "policy" as const, fallbackModel: "prodia/flux-fast-schnell" };
  assert.equal(shouldTryPolicyFallback({ ...base, budgetLeftMs: 19_999 }), false);
  assert.equal(shouldTryPolicyFallback({ ...base, budgetLeftMs: 20_000 }), true);
  // A blown budget must never produce a negative-timeout attempt.
  assert.equal(shouldTryPolicyFallback({ ...base, budgetLeftMs: -5_000 }), false);
});

test("the fallback model is opt-in, trimmed, and never the primary", () => {
  const saved = {
    primary: process.env.HOMA_IMAGE_MODEL,
    fallback: process.env.HOMA_IMAGE_FALLBACK_MODEL,
  };
  try {
    delete process.env.HOMA_IMAGE_FALLBACK_MODEL;
    assert.equal(imageFallbackModelId(), null, "unset means the feature is off");

    process.env.HOMA_IMAGE_FALLBACK_MODEL = "   ";
    assert.equal(imageFallbackModelId(), null, "whitespace is not a model");

    process.env.HOMA_IMAGE_FALLBACK_MODEL = "prodia/flux-fast-schnell";
    assert.equal(imageFallbackModelId(), "prodia/flux-fast-schnell");

    // Retrying the model that just refused would spend money to be
    // refused again, so a matching value reads as off.
    process.env.HOMA_IMAGE_MODEL = "prodia/flux-fast-schnell";
    assert.equal(imageFallbackModelId(), null);
  } finally {
    if (saved.primary === undefined) delete process.env.HOMA_IMAGE_MODEL;
    else process.env.HOMA_IMAGE_MODEL = saved.primary;
    if (saved.fallback === undefined) delete process.env.HOMA_IMAGE_FALLBACK_MODEL;
    else process.env.HOMA_IMAGE_FALLBACK_MODEL = saved.fallback;
  }
});

const FAMILY_ID = "304f0003-0000-4000-8000-000000000001";
const OTHER_FAMILY_ID = "304f0003-0000-4000-8000-000000000002";
// The shapes from Carolyng's refused calls (2026-10-16): a signed chat
// photo link from find_attachments, and Homa's own public material page.
const SIGNED_CHAT_PHOTO = `https://op7kkdcjyqedlv5l.private.blob.vercel-storage.com/families/${FAMILY_ID}/chat/IMG_8056-2tAj.jpg?cache=0&vercel-blob-delegation=abc.def&vercel-blob-signature=xyz`;
const MATERIAL_PAGE = `https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/families/${FAMILY_ID}/materials/libro-1-amalia-y-la-lata-restored-gGh3.jpg`;

test("a photo the parent sent is her own reference, not an outside URL", () => {
  assert.equal(familyReferenceSpace(MATERIAL_PAGE, FAMILY_ID), "artifact");
  assert.equal(familyReferenceSpace(SIGNED_CHAT_PHOTO, FAMILY_ID), "chat");
  assert.equal(
    familyReferenceSpace(
      `https://op7kkdcjyqedlv5l.private.blob.vercel-storage.com/families/${FAMILY_ID}/library/papi.png`,
      FAMILY_ID,
    ),
    "library",
  );
});

test("another family's photo, a working file, and an outside host stay refused", () => {
  assert.equal(familyReferenceSpace(SIGNED_CHAT_PHOTO, OTHER_FAMILY_ID), null);
  assert.equal(
    familyReferenceSpace(
      `https://op7kkdcjyqedlv5l.private.blob.vercel-storage.com/families/${FAMILY_ID}/workspace/notes.png`,
      FAMILY_ID,
    ),
    null,
  );
  assert.equal(
    familyReferenceSpace(`https://example.com/families/${FAMILY_ID}/chat/a.jpg`, FAMILY_ID),
    null,
  );
});

test("a parent photo reaches the read step instead of the outside-URL refusal", async () => {
  const saved = {
    family: process.env.HOMA_FAMILY_READ_WRITE_TOKEN,
    lesson: process.env.HOMA_LESSON_READ_WRITE_TOKEN,
  };
  // With no store token the private read cannot be signed, so the call
  // stops at the load step without any network or model call. The point
  // is which note comes back: before the fix it was the refusal.
  delete process.env.HOMA_FAMILY_READ_WRITE_TOKEN;
  delete process.env.HOMA_LESSON_READ_WRITE_TOKEN;
  try {
    const result = await generateStudioImage({
      familyId: FAMILY_ID,
      channel: "web",
      prompt: "Papi walking up the hill",
      referenceImageUrls: [SIGNED_CHAT_PHOTO],
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.note, /could not be loaded/u);

    const outside = await generateStudioImage({
      familyId: OTHER_FAMILY_ID,
      channel: "web",
      prompt: "Papi walking up the hill",
      referenceImageUrls: [SIGNED_CHAT_PHOTO],
    });
    assert.match(outside.ok ? "" : outside.note, /must be this family's own/u);
  } finally {
    if (saved.family !== undefined) process.env.HOMA_FAMILY_READ_WRITE_TOKEN = saved.family;
    if (saved.lesson !== undefined) process.env.HOMA_LESSON_READ_WRITE_TOKEN = saved.lesson;
  }
});

test("no em dash in any parent-bound note (house law)", () => {
  for (const kind of ["policy", "rejected", "transient"] as const) {
    assert.doesNotMatch(imageFailureNote(kind), /—/u);
  }
});
