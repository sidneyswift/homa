import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { ChildProgressView, ProgressNextMove } from "@homa/core";

import {
  createNativeProgressNextMoveDismissHandler,
  createNativeProgressNextMoveHandler,
  type NativeProgressNextMoveDependencies,
} from "../../../../web/lib/child-progress/native-next-move-handler";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_ID = "22222222-2222-4222-8222-222222222222";
const FINGERPRINT = "a".repeat(64);
const routeSource = readFileSync(
  new URL(
    "../../../../web/app/api/progress/[childId]/next-move/route.ts",
    import.meta.url,
  ),
  "utf8",
);

function view(overrides: Partial<ChildProgressView> = {}): ChildProgressView {
  return {
    childId: CHILD_ID,
    childName: "Maya",
    birthDate: "2020-01-02",
    timeZone: "America/New_York",
    projectedAt: "2026-08-02T16:00:00.000Z",
    scores: {
      subjects: [],
      strengthOrder: [],
      mappedCount: 0,
      totalSubjects: 0,
      observationCount: 0,
    },
    subjects: [],
    conflicts: [],
    ...overrides,
  };
}

function none(
  progressView = view(),
  overrides: Partial<Extract<ProgressNextMove, { kind: "none" }>> = {},
): Extract<ProgressNextMove, { kind: "none" }> {
  return {
    kind: "none",
    childId: progressView.childId,
    sourceRevision: "7",
    reason: "producer_stopped",
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<NativeProgressNextMoveDependencies> = {},
): NativeProgressNextMoveDependencies {
  const progressView = view();
  return {
    enabled: () => true,
    ipRateLimited: () => false,
    familyRateLimited: () => false,
    authenticate: async () => ({
      familyId: FAMILY_ID,
      aiProcessingConsented: true,
    }),
    prepare: async () => ({
      snapshot: {
        contextFingerprint: FINGERPRINT,
        sourceRevision: BigInt(7),
        view: progressView,
      },
      stored: { status: "none", nextMove: none(progressView) },
    }),
    dismiss: async () => true,
    logError: () => undefined,
    ...overrides,
  };
}

function context(childId = CHILD_ID) {
  return { params: Promise.resolve({ childId }) };
}

describe("native Progress next-move API", () => {
  it("uses the server-side per-adult AI consent resolver", () => {
    assert.match(routeSource, /requireFamilyWithAiConsentFromBearer/u);
    assert.match(routeSource, /aiProcessingConsented/u);
    assert.doesNotMatch(routeSource, /requireFamilyFromBearer\(request\)/u);
  });

  it("uses only the authenticated family and validated route child", async () => {
    let received: { familyId: string; childId: string } | null = null;
    const handler = createNativeProgressNextMoveHandler(
      dependencies({
        prepare: async (input) => {
          received = input;
          const progressView = view();
          return {
            snapshot: {
              contextFingerprint: FINGERPRINT,
              sourceRevision: BigInt(7),
              view: progressView,
            },
            stored: { status: "none", nextMove: none(progressView) },
          };
        },
      }),
    );

    const response = await handler(new Request("https://homa.test"), context());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(received, { familyId: FAMILY_ID, childId: CHILD_ID });
    const body = await response.json();
    assert.equal(body.status, "settled");
    assert.equal(body.contextFingerprint, FINGERPRINT);
  });

  it("returns pending without inventing a result", async () => {
    const progressView = view();
    const handler = createNativeProgressNextMoveHandler(
      dependencies({
        prepare: async () => ({
          snapshot: {
            contextFingerprint: FINGERPRINT,
            sourceRevision: BigInt(7),
            view: progressView,
          },
          stored: { status: "pending", nextMove: null },
        }),
      }),
    );

    const response = await handler(new Request("https://homa.test"), context());
    assert.deepEqual(await response.json(), {
      ok: true,
      status: "pending",
      contextFingerprint: FINGERPRINT,
      sourceRevision: "7",
      view: progressView,
    });
  });

  it("returns a result-free failed state and forwards explicit retry", async () => {
    const progressView = view();
    let retryFailed: boolean | undefined;
    const handler = createNativeProgressNextMoveHandler(
      dependencies({
        prepare: async (input) => {
          retryFailed = input.retryFailed;
          return {
            snapshot: {
              contextFingerprint: FINGERPRINT,
              sourceRevision: BigInt(7),
              view: progressView,
            },
            stored: { status: "failed", nextMove: null },
          };
        },
      }),
    );

    const response = await handler(
      new Request("https://homa.test?retry=1"),
      context(),
    );

    assert.equal(retryFailed, true);
    assert.deepEqual(await response.json(), {
      ok: true,
      status: "failed",
      contextFingerprint: FINGERPRINT,
      sourceRevision: "7",
      view: progressView,
      reason: "producer_unavailable",
    });
  });

  it("rejects invalid paths, missing auth, and rate-limited requests", async () => {
    const invalid = createNativeProgressNextMoveHandler(dependencies());
    assert.equal(
      (await invalid(new Request("https://homa.test"), context("not-a-uuid"))).status,
      400,
    );

    const noSession = createNativeProgressNextMoveHandler(
      dependencies({ authenticate: async () => null }),
    );
    assert.equal(
      (await noSession(new Request("https://homa.test"), context())).status,
      401,
    );

    const limited = createNativeProgressNextMoveHandler(
      dependencies({ ipRateLimited: () => true }),
    );
    assert.equal(
      (await limited(new Request("https://homa.test"), context())).status,
      429,
    );
  });

  it("starts no task before the signed-in adult has consented", async () => {
    let prepares = 0;
    const handler = createNativeProgressNextMoveHandler(
      dependencies({
        authenticate: async () => ({
          familyId: FAMILY_ID,
          aiProcessingConsented: false,
        }),
        prepare: async () => {
          prepares += 1;
          return null;
        },
      }),
    );

    const response = await handler(new Request("https://homa.test"), context());

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      ok: false,
      reason: "no-ai-consent",
    });
    assert.equal(prepares, 0);
  });

  it("fails closed on a wrong child or wrong source revision", async () => {
    const progressView = view();
    const wrongChild = createNativeProgressNextMoveHandler(
      dependencies({
        prepare: async () => ({
          snapshot: {
            contextFingerprint: FINGERPRINT,
            sourceRevision: BigInt(7),
            view: progressView,
          },
          stored: {
            status: "none",
            nextMove: none(progressView, {
              childId: "44444444-4444-4444-8444-444444444444",
            }),
          },
        }),
      }),
    );
    assert.equal(
      (await wrongChild(new Request("https://homa.test"), context())).status,
      502,
    );

    const wrongRevision = createNativeProgressNextMoveHandler(
      dependencies({
        prepare: async () => ({
          snapshot: {
            contextFingerprint: FINGERPRINT,
            sourceRevision: BigInt(7),
            view: progressView,
          },
          stored: {
            status: "none",
            nextMove: none(progressView, {
              sourceRevision: "6",
            }),
          },
        }),
      }),
    );
    const response = await wrongRevision(
      new Request("https://homa.test"),
      context(),
    );
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      reason: "invalid-result",
    });
  });
});

describe("native Progress next-move dismissal", () => {
  it("dismisses only the authenticated child and exact fingerprint", async () => {
    let received: {
      familyId: string;
      childId: string;
      contextFingerprint: string;
    } | null = null;
    const handler = createNativeProgressNextMoveDismissHandler(
      dependencies({
        dismiss: async (input) => {
          received = input;
          return true;
        },
      }),
    );
    const response = await handler(
      new Request("https://homa.test", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contextFingerprint: FINGERPRINT }),
      }),
      context(),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(received, {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      contextFingerprint: FINGERPRINT,
    });
  });

  it("rejects malformed and stale fingerprints", async () => {
    const malformed = createNativeProgressNextMoveDismissHandler(dependencies());
    const malformedResponse = await malformed(
      new Request("https://homa.test", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contextFingerprint: "short" }),
      }),
      context(),
    );
    assert.equal(malformedResponse.status, 400);

    const stale = createNativeProgressNextMoveDismissHandler(
      dependencies({ dismiss: async () => false }),
    );
    const staleResponse = await stale(
      new Request("https://homa.test", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contextFingerprint: FINGERPRINT }),
      }),
      context(),
    );
    assert.equal(staleResponse.status, 409);
    assert.deepEqual(await staleResponse.json(), {
      ok: false,
      reason: "stale-result",
    });
  });
});
