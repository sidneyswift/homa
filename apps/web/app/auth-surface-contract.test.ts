import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const SIGN_IN = source("./signin/signin-form.tsx");
const FORGOT_PASSWORD = source("./forgot-password/forgot-password-form.tsx");
const RESET_PASSWORD = source("./reset-password/reset-password-form.tsx");
const RESET_CONFIRM = source("./reset-password/confirm/page.tsx");

test("account forms use the shared Quiet control and state atoms", () => {
  assert.match(SIGN_IN, /QuietAction/u);
  assert.match(SIGN_IN, /QuietField/u);
  assert.match(SIGN_IN, /QuietFeedback/u);
  assert.match(FORGOT_PASSWORD, /QuietAction/u);
  assert.match(FORGOT_PASSWORD, /QuietField/u);
  assert.match(FORGOT_PASSWORD, /QuietFeedback/u);
  assert.match(RESET_PASSWORD, /QuietAction/u);
  assert.match(RESET_PASSWORD, /QuietField/u);
  assert.match(RESET_PASSWORD, /QuietFeedback/u);
  assert.match(RESET_CONFIRM, /QuietAction/u);
  assert.match(RESET_CONFIRM, /QuietFeedback/u);
});

test("account controls do not carry route-local geometry", () => {
  for (const [name, text] of Object.entries({
    SIGN_IN,
    FORGOT_PASSWORD,
    RESET_PASSWORD,
    RESET_CONFIRM,
  })) {
    assert.doesNotMatch(text, /<button[\s>]/u, `${name} should render QuietAction`);
    assert.doesNotMatch(text, /rounded-\[var\(--homa-radius-(?:card|control)\)\]/u, `${name} should use primitive geometry`);
    assert.doesNotMatch(text, /focus:ring-\[var\(--homa-visual-coral\)\]/u, `${name} should use QuietField focus treatment`);
  }
});

test("password recovery keeps native form names and truthful states", () => {
  assert.match(SIGN_IN, /name="email"/u);
  assert.match(SIGN_IN, /name="password"/u);
  assert.match(FORGOT_PASSWORD, /name="email"/u);
  assert.match(RESET_PASSWORD, /name="password"/u);
  assert.match(RESET_PASSWORD, /name="confirmation"/u);
  assert.match(RESET_PASSWORD, /sessionState === "checking"/u);
  assert.match(RESET_PASSWORD, /sessionState === "missing"/u);
  assert.match(RESET_PASSWORD, /setUpdated\(true\)/u);
});
