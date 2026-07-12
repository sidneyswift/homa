import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  classifyMapAnswerResponse,
  classifyMapAnswerRequestStatus,
  createMapAnswerAttempt,
  MapAnswerAttemptKeyPolicy,
  mapAnswerAttemptRequestBody,
} from "./map-answer-attempt";

describe("onboarding answer attempts", () => {
  it("reuses one UUID across every retry of the same answer attempt", () => {
    let uuidCalls = 0;
    const attempt = createMapAnswerAttempt(
      {
        itemId: "math.counts-to-5",
        answer: "easily",
        source: "checklist",
      },
      () => {
        uuidCalls += 1;
        return "11111111-1111-4111-8111-111111111111";
      },
    );

    const firstBody = mapAnswerAttemptRequestBody(
      "22222222-2222-4222-8222-222222222222",
      attempt,
    );
    const retryBody = mapAnswerAttemptRequestBody(
      "22222222-2222-4222-8222-222222222222",
      attempt,
    );

    assert.equal(uuidCalls, 1);
    assert.deepEqual(retryBody, firstBody);
    assert.equal(
      retryBody.idempotencyKey,
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("reuses failures, replaces changed intents, and clears success", () => {
    const uuids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    const policy = new MapAnswerAttemptKeyPolicy(
      () => uuids.shift() ?? "unexpected",
    );
    const easily = {
      action: "save" as const,
      childId: "child-1",
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      source: "checklist" as const,
    };
    const changed = {
      ...easily,
      answer: "not_yet" as const,
    };
    const undo = {
      action: "delete" as const,
      childId: "child-1",
      itemId: "math.counts-to-5",
    };

    const first = policy.keyFor(easily);
    assert.equal(policy.keyFor(easily), first);
    const changedKey = policy.keyFor(changed);
    assert.notEqual(changedKey, first);
    policy.markSucceeded(changed);
    const repeatedAfterSuccess = policy.keyFor(changed);
    assert.notEqual(repeatedAfterSuccess, changedKey);

    const undoKey = policy.keyFor(undo);
    assert.notEqual(undoKey, repeatedAfterSuccess);
    assert.equal(policy.keyFor(undo), undoKey);
    policy.markSucceeded(undo);
    assert.notEqual(policy.keyFor(undo), undoKey);
  });

  it("wires save and undo policy into checklist and deep dive", async () => {
    for (const relativePath of [
      "./checklist-step.tsx",
      "./deep-dive-step.tsx",
    ]) {
      const source = await readFile(
        new URL(relativePath, import.meta.url),
        "utf8",
      );
      assert.match(source, /MapAnswerAttemptKeyPolicy/u);
      assert.ok((source.match(/\.keyFor\(/gu) ?? []).length >= 2);
      assert.ok(
        (source.match(/\.markSucceeded\(/gu) ?? []).length >= 2,
      );
      assert.match(source, /classifyMapAnswerResponse/u);
      assert.match(source, /\.markPermanentFailure\(/u);
      assert.match(source, /conflict_pending/u);
      assert.match(source, /idempotency_mismatch/u);
      assert.doesNotMatch(source, /crypto\.randomUUID/u);
    }
  });

  it("classifies retryable and permanent HTTP outcomes", () => {
    for (const status of [408, 429, 500, 503]) {
      assert.equal(
        classifyMapAnswerRequestStatus(status),
        "retryable",
      );
    }
    for (const status of [400, 401, 403, 404, 409, 422]) {
      assert.equal(
        classifyMapAnswerRequestStatus(status),
        "permanent",
      );
    }
    for (const status of [200, 204]) {
      assert.equal(
        classifyMapAnswerRequestStatus(status),
        "success",
      );
    }
    assert.equal(
      classifyMapAnswerResponse(409, "conflict-pending"),
      "conflict_pending",
    );
    assert.equal(
      classifyMapAnswerResponse(409, "idempotency-mismatch"),
      "idempotency_mismatch",
    );
    assert.equal(
      classifyMapAnswerResponse(409, "other"),
      "permanent",
    );
  });
});
