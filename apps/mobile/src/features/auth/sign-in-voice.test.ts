import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { signInFailureMessage } from "./sign-in-voice";
import type { SignInFlowResult } from "./sign-in-result";

/**
 * Guards the one rule that decides whether Homa speaks over a provider.
 *
 * The scar: with no Apple Account on the device, Apple shows its own
 * dialog naming the cause and offering Settings. Apple then throws
 * ERR_REQUEST_UNKNOWN rather than a cancel, which the screen read as a
 * generic failure and answered with "you can try again when you're
 * ready". That advice can never succeed, and it replaced Apple's correct
 * explanation with a wrong one. Founder ruling 2026-08-18: stay quiet
 * when the provider already spoke.
 */

test("stays quiet when the parent backed out", () => {
  assert.equal(signInFailureMessage({ status: "dismissed" }), null);
});

test("stays quiet when the provider already explained itself", () => {
  const declined: SignInFlowResult = {
    status: "provider-declined",
    reason: "RequestUnknownException: the authorization attempt failed",
  };
  assert.equal(signInFailureMessage(declined), null);
});

test("speaks when our own exchange broke after the provider said yes", () => {
  const message = signInFailureMessage({
    status: "failed",
    reason: "Unsupported provider: provider is not enabled",
  });
  assert.ok(message, "a parent who did everything right needs an answer");
});

test("the spoken line reassures before it informs and blames nobody", () => {
  const message =
    signInFailureMessage({ status: "failed", reason: "any" }) ?? "";
  assert.match(message, /Nothing to fix on your end/u);
  assert.doesNotMatch(message, /failed|error|invalid|wrong/iu);
});

test("no em dash anywhere in the parent-facing copy", () => {
  const message =
    signInFailureMessage({ status: "failed", reason: "any" }) ?? "";
  assert.doesNotMatch(message, /—/u);
});

test("the sign-in screen renders the shared mapping, not its own copy", () => {
  // Keeps the guarded rule from being bypassed by a second literal on the
  // screen, which is how the original generic line survived unreviewed.
  const screen = readFileSync(
    new URL("../../app/(auth)/signin.tsx", import.meta.url),
    "utf8",
  );
  assert.match(screen, /signInFailureMessage/u);
  // The retired generic OAuth line specifically. The email and password
  // path keeps its own "try again when you're ready", which is correct
  // advice for a mistyped password and is not what this guards.
  assert.doesNotMatch(screen, /That didn't go through/u);
});
