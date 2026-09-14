import assert from "node:assert/strict";
import { test } from "node:test";

import { streamText, wrapLanguageModel } from "ai";
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
    const result = streamText({ model: wrapLanguageModel({ model: model(), middleware: integration.middleware }), prompt: "private-prompt", reasoning: "medium",
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
  assert.equal(rows.length, 12);
  for (const sessionId of ["session-a", "session-b"]) {
    const pair = rows.filter(row => row.sessionId === sessionId);
    assert.deepEqual(pair.map(row => row.stage), ["provider_call_started", "model_stream_requested",
      "model_stream_opened", "model_stream_first_reasoning", "model_stream_first_text", "provider_call_completed"]);
    assert.equal(pair[0].callId, pair[1].callId);
    assert.equal(pair[0].turnId, "turn_2");
    assert.ok(pair[5].firstModelOutputMs >= 0);
    assert.ok(pair[5].responseTimeMs >= pair[5].firstModelOutputMs);
    assert.ok(pair[4].elapsedMs >= pair[3].elapsedMs);
  }
  assert.notEqual(rows.find(row => row.sessionId === "session-a").callId,
    rows.find(row => row.sessionId === "session-b").callId);
  assert.doesNotMatch(JSON.stringify(logs), /private-|authorization|answer|prompt|visible/i);
});

test("a failed logger cannot interrupt the actual model stream", async (t) => {
  t.mock.method(console, "info", () => { throw new Error("logging failed"); });
  const timing = createChatModelTiming();
  const result = streamText({ model: wrapLanguageModel({ model: model(), middleware: timing.middleware }), prompt: "private-prompt",
    runtimeContext: { "eve.session.id": "session", "eve.turn.id": "turn_0",
      "eve.turn.sequence": "0", "eve.step.index": "0" },
    telemetry: { includeRuntimeContext: { "eve.session.id": true, "eve.turn.id": true, "eve.turn.sequence": true, "eve.step.index": true }, integrations: timing, recordInputs: false, recordOutputs: false },
  });
  assert.equal(await result.text, "private-answer");
});

test("hidden reasoning and blank text cannot satisfy the first answer marker", { timeout: 5000 }, async (t) => {
  const reasoningObserved = Promise.withResolvers<void>();
  const blankObserved = Promise.withResolvers<void>();
  const releaseAnswer = Promise.withResolvers<void>();
  t.after(() => releaseAnswer.resolve());
  const stages: string[] = [];
  t.mock.method(console, "info", (label: string, json: string) => {
    if (label !== "[chat-model]") return;
    const { stage } = JSON.parse(json);
    stages.push(stage);
    if (stage === "model_stream_first_reasoning") reasoningObserved.resolve();
  });
  const timing = createChatModelTiming();
  const delayed = wrapLanguageModel({ model: model(), middleware: {
    specificationVersion: "v4",
    async wrapStream({ doStream }) {
      const result = await doStream();
      return { ...result, stream: result.stream.pipeThrough(new TransformStream({
        async transform(part, controller) {
          controller.enqueue(part);
          if (part.type === "text-start") {
            controller.enqueue({ type: "text-delta", id: part.id, delta: "" });
            controller.enqueue({ type: "text-delta", id: part.id, delta: "\n " });
            await releaseAnswer.promise;
          }
        },
      })) };
    },
  } });
  const result = streamText({
    model: wrapLanguageModel({ model: delayed, middleware: timing.middleware }),
    prompt: "private-prompt",
    onChunk({ chunk }) {
      if (chunk.type === "text-delta" && chunk.text.trim().length === 0) blankObserved.resolve();
    },
    runtimeContext: { "eve.session.id": "session", "eve.turn.id": "turn_0",
      "eve.turn.sequence": "0", "eve.step.index": "0" },
    telemetry: { includeRuntimeContext: { "eve.session.id": true, "eve.turn.id": true,
      "eve.turn.sequence": true, "eve.step.index": true },
      integrations: timing, recordInputs: false, recordOutputs: false },
  });
  const answer = result.text;
  await reasoningObserved.promise;
  await blankObserved.promise;
  assert.ok(!stages.includes("model_stream_first_text"));
  releaseAnswer.resolve();
  assert.equal(await answer, "\n private-answer");
  assert.equal(stages.filter(stage => stage === "model_stream_first_text").length, 1);
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
