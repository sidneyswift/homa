import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const eventSource = readFileSync(
  new URL("./bootstrap-events.ts", import.meta.url),
  "utf8",
);
const routeSource = readFileSync(
  new URL(
    "../../../../web/app/api/mobile/bootstrap-event/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const rootSource = readFileSync(
  new URL("../../app/_layout.tsx", import.meta.url),
  "utf8",
);
const sessionSource = readFileSync(
  new URL("../auth/session-provider.tsx", import.meta.url),
  "utf8",
);
const familyHookSource = readFileSync(
  new URL("../family/use-family-data.ts", import.meta.url),
  "utf8",
);
const familyGateSource = readFileSync(
  new URL("../../components/family-readiness-gate.tsx", import.meta.url),
  "utf8",
);
const consentSource = readFileSync(
  new URL("../../components/ai-consent-gate.tsx", import.meta.url),
  "utf8",
);
const billingSource = readFileSync(
  new URL("../../lib/billing.ts", import.meta.url),
  "utf8",
);
const billingHookSource = readFileSync(
  new URL("../billing/use-billing-gate.ts", import.meta.url),
  "utf8",
);
const billingGateSource = readFileSync(
  new URL("../../components/billing-gate.tsx", import.meta.url),
  "utf8",
);

describe("native bootstrap telemetry wiring", () => {
  it("sends only the closed bootstrap payload without family or auth data", () => {
    assert.match(eventSource, /kind,\s+stage,/u);
    assert.doesNotMatch(eventSource, /familyId|accessToken|Authorization/u);
  });

  it("rate limits and validates the public beacon before server emission", () => {
    assert.match(routeSource, /rateLimited\(`mobile-bootstrap:/u);
    assert.match(routeSource, /mobileBootstrapEventSchema\.safeParse\(raw\)/u);
    assert.match(routeSource, /emitMapEvent\("mobile\.bootstrap_attempted"/u);
    assert.match(routeSource, /emitMapEvent\("mobile\.bootstrap_failed"/u);
    assert.match(routeSource, /emitMapEvent\("mobile\.bootstrap_recovered"/u);
  });

  it("bounds fonts and session before releasing the root splash", () => {
    assert.match(rootSource, /BOOTSTRAP_TIMEOUT_MS/u);
    assert.match(rootSource, /fonts\.error/u);
    assert.match(rootSource, /Use standard text/u);
    assert.match(sessionSource, /runMobileBootstrapStep\("session"/u);
    assert.match(sessionSource, /continueSignedOut/u);
  });

  it("stops family-less accounts before billing with explicit recovery", () => {
    assert.match(familyHookSource, /runMobileBootstrapStep\("family"/u);
    assert.match(familyGateSource, /Finish setup/u);
    assert.match(familyGateSource, /Check again/u);
    assert.match(familyGateSource, /Use a different account/u);
  });

  it("fails consent closed and preserves affirmative durable consent", () => {
    assert.match(consentSource, /runMobileBootstrapStep\("consent"/u);
    assert.match(consentSource, /status === "failed"/u);
    assert.match(consentSource, /recordAiProcessingConsent/u);
    assert.doesNotMatch(consentSource, /continueWithoutConsent|bypassConsent/u);
  });

  it("keeps failed billing checks distinct from paywall entitlement", () => {
    assert.match(billingSource, /runMobileBootstrapStep\("billing"/u);
    assert.match(billingHookSource, /setGate\(null\)/u);
    assert.match(billingHookSource, /setFailureReason\(result\.reason\)/u);
    assert.match(billingGateSource, /if \(gate === null\)/u);
    assert.match(billingGateSource, /<GateCheckFailed/u);
  });

  it("emits failure and recovery counters for all five stages", () => {
    assert.match(rootSource, /"attempted", "fonts"/u);
    assert.match(sessionSource, /"attempted", "session"/u);
    assert.match(familyGateSource, /"attempted", "family"/u);
    assert.match(consentSource, /"attempted", "consent"/u);
    assert.match(billingHookSource, /"attempted", "billing"/u);
    assert.match(rootSource, /"failed", "fonts"/u);
    assert.match(sessionSource, /"failed", "session"/u);
    assert.match(familyGateSource, /"failed", "family"/u);
    assert.match(consentSource, /"failed", "consent"/u);
    assert.match(billingHookSource, /"failed", "billing"/u);
    assert.match(rootSource, /"recovered", "fonts"/u);
    assert.match(sessionSource, /"recovered", "session"/u);
    assert.match(familyGateSource, /"recovered", "family"/u);
    assert.match(consentSource, /"recovered", "consent"/u);
    assert.match(billingHookSource, /"recovered", "billing"/u);
  });
});
