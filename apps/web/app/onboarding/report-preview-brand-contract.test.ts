import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync(new URL("./report-preview.tsx", import.meta.url), "utf8");
const primitives = readFileSync(new URL("../../components/design/quiet-primitives.css", import.meta.url), "utf8");

test("onboarding report preview uses the Quiet report adapter", () => {
  assert.match(preview, /QuietFrame/u);
  assert.match(preview, /quiet-report-preview__header/u);
  assert.match(preview, /quiet-report-preview__row/u);
  assert.match(preview, /quiet-report-preview-link/u);
  assert.match(preview, /From you/u);
  assert.match(preview, /See the full sample report/u);
  assert.doesNotMatch(preview, /\bObserved\b|12 more areas inside/u);
  assert.doesNotMatch(preview, /after lunch|story words/u);
  assert.doesNotMatch(preview, /A note from Homa|quiet-report-preview__note/u);
  assert.doesNotMatch(preview, /Doodle|rotate-\[/u);
  assert.doesNotMatch(preview, /font-mono/u);
  assert.doesNotMatch(preview, /rounded-\[var\(--homa-radius-(?:card|control)\)\]/u);
  assert.doesNotMatch(preview, /rounded-pill/u);
});

test("report preview adapter owns the quiet type and motion contract", () => {
  assert.match(primitives, /\.quiet-report-preview__eyebrow,[\s\S]*font-family: var\(--font-sans\)/u);
  assert.match(primitives, /\.quiet-report-preview__title[\s\S]*var\(--font-display\)/u);
  assert.match(primitives, /\.quiet-report-preview__evidence,[\s\S]*font: 400 0\.75rem\/1\.35 var\(--font-sans\)/u);
  assert.doesNotMatch(preview, /Ahead|On track|\+\d+ mo|national benchmarks|right on rhythm/u);
  assert.match(primitives, /\.quiet-report-preview:hover,[\s\S]*transform: none;/u);
});
