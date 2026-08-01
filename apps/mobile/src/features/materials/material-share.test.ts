import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  materialShareResultMessage,
  parsePreparedMaterialShareRequest,
} from "./material-share-contract";

const ID = "11111111-1111-4111-8111-111111111111";
const request = {
  materialId: ID,
  title: "Tuesday reading cards",
  authorizedPdfPath: `/api/materials/${ID}/pdf`,
  suggestedMessage: "I thought you'd want a copy of Tuesday reading cards.",
};

describe("native material share contract", () => {
  it("accepts only the matching authenticated material route", () => {
    assert.deepEqual(parsePreparedMaterialShareRequest(request), request);
    assert.equal(parsePreparedMaterialShareRequest({ ...request, authorizedPdfPath: "https://files.example/family.pdf" }), null);
    assert.equal(parsePreparedMaterialShareRequest({ ...request, materialId: "another-family" }), null);
  });

  it("calls OS completion a handoff, never delivery", () => {
    const message = materialShareResultMessage({ status: "handed-off" });
    assert.match(message, /Handed to your chosen app/u);
    assert.doesNotMatch(message, /delivered|sent successfully/u);
    assert.match(materialShareResultMessage({ status: "canceled" }), /Nothing was handed off/u);
  });

  it("gives a specific recovery for every bounded failure", () => {
    for (const reason of [
      "no-session",
      "app-backgrounded",
      "offline",
      "missing-material",
      "expired-material",
      "download-failed",
      "unsupported-destination",
      "share-failed",
    ] as const) {
      const message = materialShareResultMessage({ status: "failed", reason });
      assert.ok(message.length > 20, reason);
      assert.doesNotMatch(message, /delivered/u);
    }
  });
});
