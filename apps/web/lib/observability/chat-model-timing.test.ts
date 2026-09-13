import assert from "node:assert/strict";
import { test } from "node:test";

import { streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { createChatModelTiming, previewModelTimingEnabled } from "./chat-model-timing";

function model() {
  return new MockLanguageModelV4({
    modelId: "openai/gpt-6-astra",
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          for (const chunk of [
            { type: "reasoning-start", id: "r" },
            { type: "reasoning-delta", id: "r", delta: "private-reasoning" },
            { type: "reasoning-end", id: "r" },
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "private-answer" },
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" },
              usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 2, text: 1, reasoning: 1 } } },
          ] as const) controller.enqueue(chunk);
          controller.close();
        },
      }),
    }),
  });
}

test("real SDK callbacks correlate concurrent calls without recording inputs or changing streams", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const integration = createChatModelTiming();
  const results = await Promise.all(["session-a", "session-b", undefined].map(async (sessionId) => {
    const result = streamText({ model: model(), prompt: "private-prompt", reasoning: "medium",
      headers: { authorization: "private-secret" },
      runtimeContext: sessionId ? { "eve.session.id": sessionId, "eve.turn.id": "turn_2",
        "eve.turn.sequence": "2", "eve.step.index": "0", secret: "private-context" } : {},
      telemetry: { includeRuntimeContext: { "eve.session.id": true, "eve.turn.id": true, "eve.turn.sequence": true, "eve.step.index": true }, integrations: integration, recordInputs: false, recordOutputs: false },
    });
    const chunks = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") chunks.push(chunk.type);
    }
    assert.deepEqual(chunks, ["reasoning-delta", "text-delta"]);
    return result.text;
  }));
  assert.deepEqual(results, ["private-answer", "private-answer", "private-answer"]);
  const rows = logs.filter(row => row[0] === "[chat-model]").map(row => JSON.parse(row[1] as string));
  assert.equal(rows.length, 4);
  for (const sessionId of ["session-a", "session-b"]) {
    const pair = rows.filter(row => row.sessionId === sessionId);
    assert.deepEqual(pair.map(row => row.stage), ["provider_call_started", "provider_call_completed"]);
    assert.equal(pair[0].callId, pair[1].callId);
    assert.equal(pair[0].turnId, "turn_2");
    assert.ok(pair[1].firstModelOutputMs >= 0);
    assert.ok(pair[1].responseTimeMs >= pair[1].firstModelOutputMs);
  }
  assert.notEqual(rows.find(row => row.sessionId === "session-a").callId,
    rows.find(row => row.sessionId === "session-b").callId);
  assert.doesNotMatch(JSON.stringify(logs), /private-|authorization|reasoning|answer|prompt|visible/i);
});

test("a failed logger cannot interrupt the actual model stream", async (t) => {
  t.mock.method(console, "info", () => { throw new Error("logging failed"); });
  const result = streamText({ model: model(), prompt: "private-prompt",
    runtimeContext: { "eve.session.id": "session", "eve.turn.id": "turn_0",
      "eve.turn.sequence": "0", "eve.step.index": "0" },
    telemetry: { includeRuntimeContext: { "eve.session.id": true, "eve.turn.id": true, "eve.turn.sequence": true, "eve.step.index": true }, integrations: createChatModelTiming(), recordInputs: false, recordOutputs: false },
  });
  assert.equal(await result.text, "private-answer");
});

test("timing registration requires the preview environment and explicit experiment flag", () => {
  const previousEnvironment = process.env.VERCEL_ENV;
  const previousFlag = process.env.HOMA_PREVIEW_MODEL_TIMING;
  try {
  for (const [environment, flag, expected] of [
    ["production", "1", false], ["preview", "0", false], ["preview", "1", true],
  ] as const) {
    process.env.VERCEL_ENV = environment;
    process.env.HOMA_PREVIEW_MODEL_TIMING = flag;
    assert.equal(previewModelTimingEnabled(), expected);
  }
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnvironment;
    if (previousFlag === undefined) delete process.env.HOMA_PREVIEW_MODEL_TIMING; else process.env.HOMA_PREVIEW_MODEL_TIMING = previousFlag;
  }
});
