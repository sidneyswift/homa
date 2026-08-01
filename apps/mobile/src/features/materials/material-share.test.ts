import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  materialShareResultMessage,
  parsePreparedMaterialShareRequest,
  runMaterialShareWithRuntime,
  type MaterialShareRuntime,
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
    assert.match(message, /PDF is in your chosen app/u);
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

  function runtime(overrides: Partial<MaterialShareRuntime> = {}): MaterialShareRuntime {
    return {
      accessToken: async () => "session-token",
      appState: () => "active",
      networkState: async () => ({ isConnected: true, isInternetReachable: true }),
      download: async () => ({ uri: "file:///tmp/material.pdf" }),
      share: async () => ({ dismissed: false }),
      ...overrides,
    };
  }

  it("stops before download without a session", async () => {
    let downloaded = false;
    const result = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
      accessToken: async () => null,
      download: async () => {
        downloaded = true;
        return { uri: "file:///tmp/material.pdf" };
      },
    }));
    assert.deepEqual({ status: result.status, reason: result.status === "failed" ? result.reason : null }, {
      status: "failed",
      reason: "no-session",
    });
    assert.equal(downloaded, false);
  });

  it("stops before download while the app is backgrounded", async () => {
    let downloaded = false;
    const result = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
      appState: () => "background",
      download: async () => {
        downloaded = true;
        return { uri: "file:///tmp/material.pdf" };
      },
    }));
    assert.equal(result.status, "failed");
    if (result.status !== "failed") throw new Error("expected failure");
    assert.equal(result.reason, "app-backgrounded");
    assert.equal(downloaded, false);
  });

  it("stops before download while offline", async () => {
    let downloaded = false;
    const result = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
      networkState: async () => ({ isConnected: true, isInternetReachable: false }),
      download: async () => {
        downloaded = true;
        return { uri: "file:///tmp/material.pdf" };
      },
    }));
    assert.equal(result.status, "failed");
    if (result.status !== "failed") throw new Error("expected failure");
    assert.equal(result.reason, "offline");
    assert.equal(downloaded, false);
  });

  it("classifies authenticated download failures", async () => {
    for (const [message, reason] of [
      ["request failed with 401", "no-session"],
      ["request failed with 403", "no-session"],
      ["request failed with 404", "missing-material"],
      ["request failed with 410", "expired-material"],
      ["socket closed", "download-failed"],
    ] as const) {
      const result = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
        download: async () => { throw new Error(message); },
      }));
      assert.equal(result.status, "failed", message);
      if (result.status !== "failed") throw new Error("expected failure");
      assert.equal(result.reason, reason, message);
    }
  });

  it("maps OS dismissal separately from a completed handoff", async () => {
    const canceled = await runMaterialShareWithRuntime(request, " edited note ", runtime({
      share: async (input) => {
        assert.equal(input.message, "edited note");
        return { dismissed: true };
      },
    }));
    assert.equal(canceled.status, "canceled");

    const handedOff = await runMaterialShareWithRuntime(request, "edited note", runtime());
    assert.equal(handedOff.status, "handed-off");
    assert.doesNotMatch(handedOff.message, /sent|delivered/iu);
  });

  it("maps native share throws to bounded destination or generic failures", async () => {
    const unsupported = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
      share: async () => { throw new Error("No activity available"); },
    }));
    assert.equal(unsupported.status, "failed");
    if (unsupported.status !== "failed") throw new Error("expected failure");
    assert.equal(unsupported.reason, "unsupported-destination");

    const failed = await runMaterialShareWithRuntime(request, request.suggestedMessage, runtime({
      share: async () => { throw new Error("native bridge failed"); },
    }));
    assert.equal(failed.status, "failed");
    if (failed.status !== "failed") throw new Error("expected failure");
    assert.equal(failed.reason, "share-failed");
  });
});
