import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SUBPROCESSOR_NAMES } from "./privacy/subprocessors";

const privacySource = readFileSync(new URL("./privacy/page.tsx", import.meta.url), "utf8");
const termsSource = readFileSync(new URL("./terms/page.tsx", import.meta.url), "utf8");

test("the privacy policy renders the exact current subprocessor inventory", () => {
  assert.deepEqual(SUBPROCESSOR_NAMES, [
    "Supabase",
    "Vercel",
    "Resend",
    "Stripe",
    "Apple",
    "Telnyx",
    "Google",
    "Anthropic",
    "OpenAI",
    "Prodia",
    "Amazon Web Services",
    "Microsoft Azure",
    "Twelve Labs",
    "Firecrawl",
    "SerpAPI",
    "Parallel",
    "Handwrytten",
  ]);

  assert.doesNotMatch(privacySource, /complete list/i);
  assert.doesNotMatch(privacySource, /other model or media providers/i);
  assert.doesNotMatch(privacySource, /anonymous usage events/i);
  assert.match(privacySource, /provider depends on the feature/i);
  assert.match(privacySource, /paid APIs that do not train on prompts or responses by default/i);
  assert.doesNotMatch(privacySource, /active family records/i);
  assert.match(privacySource, /normal retention period/i);
});

test("the terms describe the live paid trial instead of the retired free-only offer", () => {
  assert.doesNotMatch(termsSource, /All of it is free today/i);
  assert.doesNotMatch(termsSource, /If paid plans arrive/i);
  assert.match(termsSource, /requires a payment method/i);
  assert.match(termsSource, /7 free days/i);
  assert.match(termsSource, /cancel before the trial\s+ends/i);
  assert.match(termsSource, /Stripe processes web purchases/i);
  assert.match(termsSource, /Apple processes App Store\s+purchases/i);
  assert.match(termsSource, /materials Homa makes are for your family/i);
  assert.doesNotMatch(termsSource, /active family records/i);
});

test("legal contact copy does not promise a human-only inbox", () => {
  assert.doesNotMatch(privacySource, /A person answers|not a bot/i);
  assert.doesNotMatch(termsSource, /A person answers|not a bot/i);
});
