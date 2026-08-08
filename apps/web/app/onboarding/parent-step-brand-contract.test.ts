import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parentStep = readFileSync(new URL("./parent-step.tsx", import.meta.url), "utf8");
const reportPreview = readFileSync(new URL("./report-preview.tsx", import.meta.url), "utf8");
const quietAction = readFileSync(new URL("../../components/design/QuietAction.tsx", import.meta.url), "utf8");
const primitives = readFileSync(new URL("../../components/design/quiet-primitives.css", import.meta.url), "utf8");
const globals = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
const signupProvider = readFileSync(new URL("../../components/marketing/SignupPopupProvider.tsx", import.meta.url), "utf8");
const signupModal = readFileSync(new URL("../../components/marketing/SignupPopupModal.tsx", import.meta.url), "utf8");

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

test("the landing signup path explains the product and trial without legacy assessment framing", () => {
  assert.match(parentStep, /Start with what you already know about your child/u);
  assert.match(parentStep, /plain-language questions/u);
  assert.match(parentStep, /WALL_MECHANICS_LINE/u);
  assert.match(parentStep, /tierPriceAmount\("regular", "monthly"\)/u);
  assert.doesNotMatch(parentStep, /questionnaire|where your child shines|where they need a hand/iu);
});

test("the shared report preview cannot force the signup dialog wider than a phone", () => {
  assert.match(reportPreview, /min-w-0/u);
  assert.match(primitives, /\.quiet-report-preview__row-head\s*\{[^}]*flex-wrap: wrap;/u);
  assert.match(globals, /\.signup-popup-card\s*\{[^}]*min-width: 0;[^}]*overflow-x: hidden;/u);
  assert.match(globals, /\.signup-popup-card \.grid > \* \{ min-width: 0; \}/u);
});

test("the signup provider restores focus after the dialog leaves the document", () => {
  const capture = signupProvider.indexOf("returnFocusRef.current = event?.currentTarget");
  const open = signupProvider.indexOf("setOpen(true)");
  assert.ok(capture >= 0 && open > capture, "the opener must be captured before the dialog opens");
  assert.match(signupProvider, /setOpen\(false\);[\s\S]*window\.requestAnimationFrame/u);
  assert.match(signupProvider, /returnFocus\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(signupModal, /cardRef\.current\?\.focus\(\)/u);
  assert.doesNotMatch(signupModal, /previouslyFocused/u);
});

test("QuietAction exposes pressed state for accessible toggles", () => {
  assert.match(quietAction, /"aria-pressed"/u);
  assert.match(quietAction, /aria-pressed=\{ariaPressed\}/u);
});
