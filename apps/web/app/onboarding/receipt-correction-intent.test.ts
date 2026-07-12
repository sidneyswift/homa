import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  classifyMapAnswerRequestStatus,
} from "./map-answer-attempt";
import {
  clearAcceptedReceiptChanges,
  snapshotReceiptChanges,
  type VersionedReceiptChange,
} from "./receipt-correction-intent";

describe("receipt correction intent", () => {
  it("clears only edits that still match the submitted version", () => {
    const submitted = {
      "math.counts-to-5": {
        answer: "not_yet",
        version: 1,
      },
      "math.counts-to-10": {
        answer: "easily",
        version: 2,
      },
    } satisfies Record<string, VersionedReceiptChange>;
    const current = {
      "math.counts-to-5": {
        answer: "getting_there",
        version: 3,
      },
      "math.counts-to-10": {
        answer: "easily",
        version: 2,
      },
    } satisfies Record<string, VersionedReceiptChange>;

    assert.deepEqual(
      clearAcceptedReceiptChanges(current, submitted),
      {
        "math.counts-to-5": {
          answer: "getting_there",
          version: 3,
        },
      },
    );
  });

  it("takes an immutable request snapshot", () => {
    const pending: Record<string, VersionedReceiptChange> = {
      "math.counts-to-5": {
        answer: "not_yet",
        version: 1,
      },
    };
    const snapshot = snapshotReceiptChanges(pending);
    pending["math.counts-to-5"] = {
      answer: "easily",
      version: 2,
    };

    assert.deepEqual(snapshot, {
      "math.counts-to-5": {
        answer: "not_yet",
        version: 1,
      },
    });
  });

  it("distinguishes retry from permanent conflict", () => {
    assert.equal(
      classifyMapAnswerRequestStatus(503),
      "retryable",
    );
    assert.equal(
      classifyMapAnswerRequestStatus(409),
      "permanent",
    );
  });

  it("wires immutable snapshots and permanent conflict handling", async () => {
    const source = await readFile(
      new URL("./r/[token]/receipts-list.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /snapshotReceiptChanges/u);
    assert.match(source, /clearAcceptedReceiptChanges/u);
    assert.match(source, /response\.status === 409/u);
    assert.match(source, /classifyMapAnswerRequestStatus/u);
    assert.ok(
      (source.match(/disabled=\{state === "busy"\}/gu) ?? [])
        .length >= 2,
    );
  });
});
