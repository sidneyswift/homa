import assert from "node:assert/strict";
import { test } from "node:test";

import {
  estimateUsageCostUsd,
  formatUsd,
  summarizeUsageCost,
} from "./model-pricing";

/** Dates pinning each Sonnet 5 price window (the change lands 2026-09-01). */
const INTRO = new Date("2026-07-13T12:00:00Z");
const STANDARD = new Date("2026-09-01T00:00:00Z");

function assertClose(actual: number | null, expected: number) {
  assert.notEqual(actual, null);
  assert.ok(
    Math.abs((actual as number) - expected) < 1e-9,
    `expected ${expected}, got ${actual}`,
  );
}

test("sonnet 5 chat call splits input into uncached, cache read, cache write", () => {
  // A real ledger row: input_tokens includes both cache columns, so the
  // freshly billed input here is 40865 - 39540 - 1323 = 2 tokens.
  const usd = estimateUsageCostUsd(
    "anthropic/claude-sonnet-5",
    { inputTokens: 40865, outputTokens: 1482, cacheReadTokens: 39540, cacheWriteTokens: 1323 },
    { at: INTRO },
  );
  assertClose(usd, (2 * 2 + 39540 * 0.2 + 1323 * 2.5 + 1482 * 10) / 1_000_000);
});

test("sonnet 5 reprices when the standard window starts", () => {
  const quantities = {
    inputTokens: 40865,
    outputTokens: 1482,
    cacheReadTokens: 39540,
    cacheWriteTokens: 1323,
  };
  const august = estimateUsageCostUsd(
    "anthropic/claude-sonnet-5",
    quantities,
    { at: new Date("2026-08-31T23:59:59Z") },
  );
  assertClose(august, (2 * 2 + 39540 * 0.2 + 1323 * 2.5 + 1482 * 10) / 1_000_000);
  const september = estimateUsageCostUsd("anthropic/claude-sonnet-5", quantities, { at: STANDARD });
  assertClose(september, (2 * 3 + 39540 * 0.3 + 1323 * 3.75 + 1482 * 15) / 1_000_000);
});

test("models without cache columns price all input at the input rate", () => {
  const usd = estimateUsageCostUsd(
    "openai/gpt-5.4-mini",
    { inputTokens: 1000, outputTokens: 100 },
    { at: INTRO },
  );
  assertClose(usd, (1000 * 0.75 + 100 * 4.5) / 1_000_000);
});

test("image calls price text input and image output at their own rates", () => {
  const usd = estimateUsageCostUsd(
    "openai/gpt-image-2",
    { inputTokens: 1883, outputTokens: 19598 },
    { at: INTRO },
  );
  assertClose(usd, (1883 * 5 + 19598 * 30) / 1_000_000);
});

test("embeddings bill input only", () => {
  const usd = estimateUsageCostUsd(
    "openai/text-embedding-3-small",
    { inputTokens: 27224, outputTokens: 0 },
    { at: INTRO },
  );
  assertClose(usd, (27224 * 0.02) / 1_000_000);
});

test("cache tokens larger than input clamp the uncached share at zero", () => {
  const usd = estimateUsageCostUsd(
    "anthropic/claude-sonnet-5",
    { inputTokens: 100, outputTokens: 0, cacheReadTokens: 150 },
    { at: INTRO },
  );
  assertClose(usd, (150 * 0.2) / 1_000_000);
});

test("an unknown model returns null, never zero", () => {
  assert.equal(
    estimateUsageCostUsd("openai/some-new-model", { inputTokens: 1000, outputTokens: 10 }, { at: INTRO }),
    null,
  );
});

test("a rates override (the live gateway book) beats the pinned table", () => {
  const rates = {
    "openai/some-new-model": [{ inputUsdPerMTok: 1, outputUsdPerMTok: 2 }],
  };
  const usd = estimateUsageCostUsd(
    "openai/some-new-model",
    { inputTokens: 1000, outputTokens: 500 },
    { at: INTRO, rates },
  );
  assertClose(usd, (1000 * 1 + 500 * 2) / 1_000_000);
});

test("summarize sums priced rows and names unpriced ones", () => {
  const summary = summarizeUsageCost(
    [
      { model: "openai/gpt-5.4-mini", inputTokens: 1000, outputTokens: 100 },
      { model: "openai/some-new-model", inputTokens: 5000, outputTokens: 500 },
      { model: "openai/some-new-model", inputTokens: 100, outputTokens: 1 },
    ],
    { at: INTRO },
  );
  assertClose(summary.estimatedUsd, (1000 * 0.75 + 100 * 4.5) / 1_000_000);
  assert.deepEqual(summary.unpricedModels, ["openai/some-new-model"]);
});

test("formatUsd covers the console's magnitudes", () => {
  assert.equal(formatUsd(0), "$0.00");
  assert.equal(formatUsd(0.0004), "<$0.001");
  assert.equal(formatUsd(0.031), "$0.031");
  assert.equal(formatUsd(0.42), "$0.42");
  assert.equal(formatUsd(12.3), "$12.30");
  assert.equal(formatUsd(1500), "$1,500");
});
