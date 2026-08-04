import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const QUIET_PRIMITIVES = read("../design/quiet-primitives.css");
const TIER_OPTIONS = read("./tier-options.tsx");
const WALL_OFFER = read("./wall-offer.tsx");
const REPORT_LOCK_OFFER = read("./report-lock-offer.tsx");

test("the paywall projects its scrim and modal through Quiet roles", () => {
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall-surface\.wall-overlay[\s\S]*color-mix\(in srgb, var\(--homa-ink\) 42%/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__modal\.wall-card[\s\S]*box-shadow: 0 18px 42px color-mix\(in srgb, var\(--homa-ink\) 16%/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall-surface\.wall-overlay,[\s\S]*\.quiet-paywall__modal\.wall-card \{ transition: none/u);
});

test("billing period selection uses the midnight selected-state role", () => {
  assert.match(TIER_OPTIONS, /period === option[\s\S]*bg-\[var\(--homa-midnight-action\)\]/u);
  assert.doesNotMatch(TIER_OPTIONS, /period === option[\s\S]*bg-\[var\(--homa-brand-text\)\]/u);
});

test("paywall eyebrows use the approved interface type", () => {
  assert.doesNotMatch(WALL_OFFER, /font-mono/u);
  assert.doesNotMatch(REPORT_LOCK_OFFER, /font-mono/u);
  assert.match(WALL_OFFER, /font-sans text-xs font-semibold/u);
  assert.match(REPORT_LOCK_OFFER, /font-sans text-xs font-semibold/u);
});
