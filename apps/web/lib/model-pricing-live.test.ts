import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mergeModelRates,
  ratesFromGatewayModels,
} from "./model-pricing-live";

test("gateway per-token strings become per-million rates, cache fields included", () => {
  const rates = ratesFromGatewayModels([
    {
      id: "anthropic/claude-sonnet-5",
      pricing: {
        input: "0.000002",
        output: "0.00001",
        cachedInputTokens: "0.0000002",
        cacheCreationInputTokens: "0.0000025",
      },
    },
    {
      id: "openai/text-embedding-3-small",
      pricing: { input: "0.00000002", output: "0" },
    },
  ]);
  assert.deepEqual(rates["anthropic/claude-sonnet-5"], [
    {
      inputUsdPerMTok: 2,
      outputUsdPerMTok: 10,
      cacheReadUsdPerMTok: 0.2,
      cacheWriteUsdPerMTok: 2.5,
    },
  ]);
  assert.deepEqual(rates["openai/text-embedding-3-small"], [
    { inputUsdPerMTok: 0.02, outputUsdPerMTok: 0 },
  ]);
});

test("catalog entries without usable pricing are skipped, not zeroed", () => {
  const rates = ratesFromGatewayModels([
    { id: "vendor/no-pricing" },
    { id: "vendor/null-pricing", pricing: null },
    { id: "vendor/garbled", pricing: { input: "not-a-number", output: "0.00001" } },
    { id: "vendor/negative", pricing: { input: "-1", output: "0.00001" } },
    { id: "vendor/good", pricing: { input: "0.000001", output: "0.000002" } },
  ]);
  assert.deepEqual(Object.keys(rates), ["vendor/good"]);
});

test("merge lets live prices win while pinned-only models keep their windows", () => {
  const pinned = {
    "anthropic/claude-sonnet-5": [
      { inputUsdPerMTok: 2, outputUsdPerMTok: 10, until: "2026-08-31" },
      { inputUsdPerMTok: 3, outputUsdPerMTok: 15, from: "2026-09-01" },
    ],
    "vendor/pinned-only": [{ inputUsdPerMTok: 1, outputUsdPerMTok: 1 }],
  };
  const live = {
    "anthropic/claude-sonnet-5": [{ inputUsdPerMTok: 2.5, outputUsdPerMTok: 12 }],
  };
  const merged = mergeModelRates(pinned, live);
  assert.deepEqual(merged["anthropic/claude-sonnet-5"], [
    { inputUsdPerMTok: 2.5, outputUsdPerMTok: 12 },
  ]);
  assert.deepEqual(merged["vendor/pinned-only"], pinned["vendor/pinned-only"]);
});
