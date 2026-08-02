import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizePasswordRecoveryEmail,
  parsePasswordRecoveryConfirmation,
  passwordRecoveryRedirectUrl,
  validatePasswordReset,
} from "./password-recovery";

test("normalizes valid recovery email addresses", () => {
  assert.equal(
    normalizePasswordRecoveryEmail("  Parent@Example.COM  "),
    "parent@example.com",
  );
  assert.equal(normalizePasswordRecoveryEmail("not-an-email"), null);
});

test("builds one web recovery destination for local and production origins", () => {
  assert.equal(
    passwordRecoveryRedirectUrl("https://thankshoma.com/some/path"),
    "https://thankshoma.com/reset-password/confirm",
  );
  assert.equal(
    passwordRecoveryRedirectUrl("http://localhost:3000"),
    "http://localhost:3000/reset-password/confirm",
  );
  assert.equal(passwordRecoveryRedirectUrl("javascript:alert(1)"), null);
});

test("accepts only nonempty Supabase recovery token hashes", () => {
  assert.deepEqual(
    parsePasswordRecoveryConfirmation(" token-value ", "recovery"),
    { tokenHash: "token-value" },
  );
  assert.equal(parsePasswordRecoveryConfirmation("", "recovery"), null);
  assert.equal(parsePasswordRecoveryConfirmation("token-value", "signup"), null);
});

test("applies the existing Homa password length contract before matching", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_MAX_LENGTH, 200);
  assert.equal(validatePasswordReset("short", "short"), "too-short");
  assert.equal(
    validatePasswordReset("a".repeat(PASSWORD_MAX_LENGTH + 1), "different"),
    "too-long",
  );
  assert.equal(validatePasswordReset("long-enough", "different"), "mismatch");
  assert.equal(validatePasswordReset("long-enough", "long-enough"), null);
});
