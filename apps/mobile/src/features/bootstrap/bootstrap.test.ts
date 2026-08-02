import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOBILE_BOOTSTRAP_STAGES } from "@homa/core";

import {
  BootstrapFailure,
  classifyBootstrapFailure,
  runBootstrapStep,
} from "./bootstrap";

describe("native bootstrap runner", () => {
  it("returns a successful value", async () => {
    assert.deepEqual(await runBootstrapStep("family", async () => 42), {
      ok: true,
      value: 42,
    });
  });

  it("bounds every bootstrap stage when its promise never settles", async () => {
    for (const stage of MOBILE_BOOTSTRAP_STAGES) {
      const result = await runBootstrapStep(
        stage,
        () => new Promise<never>(() => {}),
        { timeoutMs: 5 },
      );
      assert.deepEqual(result, { ok: false, reason: "timeout" });
    }
  });

  it("classifies an offline device before a generic transport error", () => {
    assert.equal(
      classifyBootstrapFailure(new TypeError("fetch failed"), {
        isConnected: false,
        isInternetReachable: false,
      }),
      "offline",
    );
  });

  it("recognizes an expired auth session from structured error fields", () => {
    assert.equal(
      classifyBootstrapFailure({
        name: "AuthApiError",
        code: "refresh_token_not_found",
        status: 400,
      }),
      "expired_session",
    );
  });

  it("uses the bounded network check to classify an offline rejection", async () => {
    const result = await runBootstrapStep(
      "billing",
      async () => {
        throw new TypeError("fetch failed");
      },
      {
        getNetworkState: async () => ({
          isConnected: false,
          isInternetReachable: false,
        }),
      },
    );
    assert.deepEqual(result, { ok: false, reason: "offline" });
  });

  it("separates server errors from unknown failures", () => {
    assert.equal(classifyBootstrapFailure({ status: 503 }), "server_error");
    assert.equal(classifyBootstrapFailure(new Error("local failure")), "unknown");
  });

  it("keeps an explicit failure reason authoritative", () => {
    assert.equal(
      classifyBootstrapFailure(new BootstrapFailure("billing", "expired_session")),
      "expired_session",
    );
  });
});
