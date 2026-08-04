import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parentStep = readFileSync(new URL("./parent-step.tsx", import.meta.url), "utf8");
const quietAction = readFileSync(new URL("../../components/design/QuietAction.tsx", import.meta.url), "utf8");

test("onboarding account doors use Quiet Authority atoms", () => {
  assert.match(parentStep, /QuietAction/u);
  assert.match(parentStep, /QuietField/u);
  assert.match(parentStep, /QuietFeedback/u);
  assert.doesNotMatch(parentStep, /<button[\s>]/u);
  assert.doesNotMatch(parentStep, /rounded-\[var\(--homa-radius-control\)\]/u);
  assert.doesNotMatch(parentStep, /hover:border-\[var\(--homa-visual-coral\)\]/u);
});

test("onboarding preserves account and offline recovery contracts", () => {
  assert.match(parentStep, /\/api\/map\/claim/u);
  assert.match(parentStep, /submitWaitlist/u);
  assert.match(parentStep, /parent-email/u);
  assert.match(parentStep, /parent-password/u);
  assert.match(parentStep, /already has a Homa account/u);
  assert.doesNotMatch(parentStep, /setGoogleError\(oauthError\.message\)/u);
});

test("QuietAction exposes pressed state for accessible toggles", () => {
  assert.match(quietAction, /"aria-pressed"/u);
  assert.match(quietAction, /aria-pressed=\{ariaPressed\}/u);
});
