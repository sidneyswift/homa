import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const QUIET_PRIMITIVES = read("../design/quiet-primitives.css");
const TIER_OPTIONS = read("./tier-options.tsx");
const WALL_OFFER = read("./wall-offer.tsx");
const REPORT_LOCK_OFFER = read("./report-lock-offer.tsx");
const WALL_MODAL = read("./wall-modal.tsx");
const TRIAL_GATE = read("./trial-gate.tsx");

test("the paywall projects its scrim and modal through Quiet roles", () => {
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall-surface\.wall-overlay[\s\S]*color-mix\(in srgb, var\(--homa-ink\) 42%/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__modal\.wall-card[\s\S]*box-shadow: 0 18px 42px color-mix\(in srgb, var\(--homa-ink\) 16%/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall-surface\.wall-overlay,[\s\S]*\.quiet-paywall__modal\.wall-card \{ transition: none/u);
});

test("billing period selection uses the midnight selected-state role", () => {
  assert.match(TIER_OPTIONS, /quiet-paywall__period-option--selected/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__period-option--selected[\s\S]*background: var\(--homa-midnight-action\)/u);
  assert.doesNotMatch(TIER_OPTIONS, /homa-brand-text.*selected/u);
});

test("paywall eyebrows use the approved interface type", () => {
  assert.doesNotMatch(WALL_OFFER, /font-mono/u);
  assert.doesNotMatch(REPORT_LOCK_OFFER, /font-mono/u);
  assert.match(WALL_OFFER, /quiet-paywall__eyebrow/u);
  assert.match(REPORT_LOCK_OFFER, /quiet-paywall__eyebrow/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__eyebrow,[\s\S]*font: 700 0\.6875rem\/1\.3 var\(--font-sans\)/u);
});

test("paywall components keep presentation inside Quiet semantic roles", () => {
  const stripComments = (source: string) => source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const activeSources = [WALL_MODAL, WALL_OFFER, REPORT_LOCK_OFFER, TIER_OPTIONS, TRIAL_GATE].map(stripComments);
  for (const source of activeSources) {
    assert.doesNotMatch(source, /font-mono|font-serif|font-hand|bg-card|border-border|text-(body|strong|muted|subtle|brand)/u);
  }
  assert.match(WALL_MODAL, /quiet-paywall__dismiss/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__dismiss:focus-visible[\s\S]*outline: 3px/u);
  assert.match(QUIET_PRIMITIVES, /\.quiet-paywall__modal\.wall-card[\s\S]*max-height: calc\(100dvh - 48px\)/u);
});
