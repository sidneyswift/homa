import assert from "node:assert/strict";
import { test } from "node:test";

import { emailHash } from "./hash";
import { mintUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

const SECRET = "test-unsubscribe-secret";

test("a minted token verifies back to the address hash", () => {
  const token = mintUnsubscribeToken("Parent@Example.com", SECRET);
  assert.ok(token);
  assert.equal(verifyUnsubscribeToken(token as string, SECRET), emailHash("parent@example.com"));
});

test("the token carries no raw address, only the hash", () => {
  const token = mintUnsubscribeToken("parent@example.com", SECRET) as string;
  assert.ok(!token.toLowerCase().includes("parent@example.com"));
  assert.ok(token.startsWith(emailHash("parent@example.com")));
});

test("a tampered signature is rejected", () => {
  const token = mintUnsubscribeToken("parent@example.com", SECRET) as string;
  const [hash] = token.split(".");
  assert.equal(verifyUnsubscribeToken(`${hash}.forged-signature`, SECRET), null);
});

test("a token signed with a different secret is rejected", () => {
  const token = mintUnsubscribeToken("parent@example.com", SECRET) as string;
  assert.equal(verifyUnsubscribeToken(token, "other-secret"), null);
});

test("malformed tokens are rejected, never thrown", () => {
  assert.equal(verifyUnsubscribeToken("", SECRET), null);
  assert.equal(verifyUnsubscribeToken("no-dot", SECRET), null);
  assert.equal(verifyUnsubscribeToken("not-a-hash.sig", SECRET), null);
});

test("no secret means no token and no verification", () => {
  assert.equal(mintUnsubscribeToken("parent@example.com", ""), null);
  assert.equal(verifyUnsubscribeToken("anything.here", ""), null);
});
