import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { priceAgentJobsUsage, type AgentJobsUsageRow } from "./spend";
import type { ModelRates } from "../model-pricing";

// A tiny fixed price book so the assertions are exact and independent of the
// live feed: $1/MTok input, $2/MTok output, and a cache-read rate so the
// input-includes-cache math is exercised.
const RATES: ModelRates = {
  "anthropic/test-model": [
    { inputUsdPerMTok: 1, outputUsdPerMTok: 2, cacheReadUsdPerMTok: 0.1 },
  ],
  "openai/test-image": [{ inputUsdPerMTok: 5, outputUsdPerMTok: 30 }],
};

describe("priceAgentJobsUsage", () => {
  it("is empty for no rows", () => {
    const spend = priceAgentJobsUsage([], RATES);
    assert.equal(spend.cost.estimatedUsd, 0);
    assert.deepEqual(spend.cost.unpricedModels, []);
    assert.equal(spend.calls, 0);
    assert.equal(spend.tokens, 0);
    assert.equal(spend.models, 0);
  });

  it("sums calls and tokens and prices across models (chat + image)", () => {
    const rows: AgentJobsUsageRow[] = [
      // A build session's own turns: 1M input (of which 400k cache-read),
      // 200k output.
      {
        model: "anthropic/test-model",
        calls: 3,
        inputTokens: 1_000_000,
        outputTokens: 200_000,
        cacheReadTokens: 400_000,
        cacheWriteTokens: 0,
      },
      // The images that same stage caused, on a different model.
      {
        model: "openai/test-image",
        calls: 2,
        inputTokens: 100_000,
        outputTokens: 50_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ];
    const spend = priceAgentJobsUsage(rows, RATES);

    // input_tokens includes cache-read, so uncached input = 1M - 400k = 600k.
    // text: 600k*$1 + 400k*$0.1 + 200k*$2 = $0.6 + $0.04 + $0.4 = $1.04 (per MTok)
    // image: 100k*$5 + 50k*$30 = $0.5 + $1.5 = $2.00
    assert.equal(Number(spend.cost.estimatedUsd.toFixed(4)), 3.04);
    assert.deepEqual(spend.cost.unpricedModels, []);
    assert.equal(spend.calls, 5);
    assert.equal(spend.tokens, 1_000_000 + 200_000 + 100_000 + 50_000);
    assert.equal(spend.models, 2);
  });

  it("reports an unpriced model instead of counting it as free", () => {
    const rows: AgentJobsUsageRow[] = [
      {
        model: "anthropic/not-in-book",
        calls: 1,
        inputTokens: 10_000,
        outputTokens: 1_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ];
    const spend = priceAgentJobsUsage(rows, RATES);
    assert.equal(spend.cost.estimatedUsd, 0);
    assert.deepEqual(spend.cost.unpricedModels, ["anthropic/not-in-book"]);
    assert.equal(spend.calls, 1);
  });
});
