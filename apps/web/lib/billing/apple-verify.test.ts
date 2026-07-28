import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Status } from "@apple/app-store-server-library";

import {
  appleStatusToSharedVocabulary,
  verifyAppleNotification,
  verifyAppleTransaction,
} from "./apple-verify";

/**
 * No real Apple-signed sample is available without a sandbox purchase
 * (needs an App Store Connect product, a founder-only step, #310), so
 * the positive verification path is not covered here. What IS covered,
 * and matters: the verifier actually performs cryptographic checks
 * rather than silently accepting anything (a verifier that no-ops on
 * bad input is worse than no verifier, since it would look tested and
 * grant entitlement to garbage), the root certificate loads without
 * throwing, and the status vocabulary mapping (a pure function) is
 * exhaustively covered.
 */

describe("verifyAppleTransaction", () => {
  it("loads the bundled root certificate regardless of the caller's cwd (caught once: process.cwd()-relative resolution passed this exact test for the wrong reason, ENOENT, when run from the repo root)", async () => {
    const originalCwd = process.cwd();
    process.chdir("/");
    try {
      await assert.rejects(
        () => verifyAppleTransaction("not-a-real-jws"),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.ok(
            !/ENOENT|no such file/i.test(message),
            `expected a verification failure, got a file-loading error: ${message}`,
          );
          return true;
        },
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rejects a garbage string, never treating it as valid", async () => {
    await assert.rejects(() => verifyAppleTransaction("not-a-real-jws"));
  });

  it("rejects a structurally JWT-shaped but unsigned token", async () => {
    const fakeHeader = Buffer.from(JSON.stringify({ alg: "ES256", x5c: [] })).toString(
      "base64url",
    );
    const fakePayload = Buffer.from(JSON.stringify({ transactionId: "1" })).toString(
      "base64url",
    );
    await assert.rejects(() =>
      verifyAppleTransaction(`${fakeHeader}.${fakePayload}.fakesignature`),
    );
  });
});

describe("verifyAppleNotification", () => {
  it("rejects a garbage payload", async () => {
    await assert.rejects(() => verifyAppleNotification("not-a-real-jws"));
  });
});

describe("appleStatusToSharedVocabulary", () => {
  it("maps active states to active", () => {
    for (const status of [Status.ACTIVE, Status.BILLING_RETRY, Status.BILLING_GRACE_PERIOD]) {
      assert.equal(appleStatusToSharedVocabulary(status), "active");
    }
  });

  it("maps expired and revoked to the shared canceled vocabulary", () => {
    assert.equal(appleStatusToSharedVocabulary(Status.EXPIRED), "canceled");
    assert.equal(appleStatusToSharedVocabulary(Status.REVOKED), "canceled");
  });
});
