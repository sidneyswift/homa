import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requestConflictResolution } from "./resolve-conflict-request";

const INPUT = {
  conflictId: "11111111-1111-4111-8111-111111111111",
  answer: "easily" as const,
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
};

describe("requestConflictResolution", () => {
  it("posts the resolution and settles on 200", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const outcome = await requestConflictResolution(INPUT, {
      async fetchJson(url, init) {
        calls.push({ url, init });
        return { status: 200 };
      },
    });

    assert.equal(outcome, "settled");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/progress/conflict");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), INPUT);
  });

  it("treats a closed or missing conflict as already settled", async () => {
    for (const status of [404, 409]) {
      const outcome = await requestConflictResolution(INPUT, {
        fetchJson: async () => ({ status }),
      });
      assert.equal(outcome, "already_settled");
    }
  });

  it("reports failure on server errors and network throws", async () => {
    assert.equal(
      await requestConflictResolution(INPUT, {
        fetchJson: async () => ({ status: 502 }),
      }),
      "failed",
    );
    assert.equal(
      await requestConflictResolution(INPUT, {
        fetchJson: async () => {
          throw new Error("offline");
        },
      }),
      "failed",
    );
  });
});
