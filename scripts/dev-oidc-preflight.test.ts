import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tokenExpiry, verdict } from "./dev-oidc-preflight.mjs";

const HOUR = 60 * 60 * 1000;
const SESSION = 3 * HOUR;
const NOW = 1_800_000_000_000;

function jwt(expSeconds: number): string {
  const head = Buffer.from('{"alg":"none"}').toString("base64url");
  const body = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `${head}.${body}.sig`;
}

describe("tokenExpiry", () => {
  it("reads exp out of the payload, in milliseconds", () => {
    assert.equal(tokenExpiry(jwt(1_700_000_000)), 1_700_000_000_000);
  });

  it("returns null for anything it cannot read", () => {
    // Unreadable is the script's problem, not the developer's, so this
    // has to be distinguishable from expired: one blocks a dev server
    // and the other must never do so.
    for (const bad of ["", "notajwt", "a.b", "a.!!!.c", jwt(NaN)]) {
      assert.equal(tokenExpiry(bad), null, bad);
    }
  });

  it("returns null when exp is missing", () => {
    const head = Buffer.from('{"alg":"none"}').toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
    assert.equal(tokenExpiry(`${head}.${body}.sig`), null);
  });
});

describe("verdict", () => {
  it("passes a token with a session left in it", () => {
    assert.equal(verdict(NOW + 11 * HOUR, NOW, SESSION), "ok");
  });

  it("blocks an expired token", () => {
    assert.equal(verdict(NOW - 1, NOW, SESSION), "expired");
  });

  it("blocks a token that expires exactly now", () => {
    assert.equal(verdict(NOW, NOW, SESSION), "expired");
  });

  it("warns about one that dies mid-session", () => {
    // The 2026-07-22 failure would have passed a check that only asked
    // about this instant: the token was alive at startup and dead an
    // hour into the walk.
    assert.equal(verdict(NOW + HOUR, NOW, SESSION), "expiring");
  });

  it("never blocks on a token it could not read", () => {
    assert.equal(verdict(null, NOW, SESSION), "unreadable");
  });
});
