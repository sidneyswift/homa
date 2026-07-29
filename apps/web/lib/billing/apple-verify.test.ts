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
 * grant entitlement to garbage), the embedded root certificate decodes
 * to something the verifier can construct from, and the status
 * vocabulary mapping (a pure function) is exhaustively covered.
 *
 * The root cert used to be a sibling file, resolved at runtime. Caught
 * twice before landing as the base64 constant apple-verify.ts embeds
 * now: a process.cwd()-relative path threw ENOENT depending on the
 * caller's working directory, and the fix for that broke Next.js's
 * Turbopack production build outright ("Module not found: Can't
 * resolve '.'", since Turbopack statically analyzes
 * `new URL(_, import.meta.url)` as an asset reference). Both failure
 * modes are now structurally impossible: there is no file read, so the
 * only way this rejects is a real cryptographic failure, exactly what
 * the assertion below checks for.
 */

describe("verifyAppleTransaction", () => {
  it("rejects a garbage string for a real verification reason, not a construction error", async () => {
    await assert.rejects(
      () => verifyAppleTransaction("not-a-real-jws"),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.ok(
          !/ENOENT|no such file|base64|cannot resolve/i.test(message),
          `expected a verification failure, got a construction/loading error: ${message}`,
        );
        return true;
      },
    );
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
