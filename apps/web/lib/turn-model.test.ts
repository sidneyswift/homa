import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { zodSchema } from "ai";

import { FLEET_RESEARCH_MODEL, HOMA_MODEL, selectHomaTurnModel, type HomaTurnModel } from "../agent/model";
import selectTurnModelHook from "../agent/hooks/select-turn-model";
import { turnModelState } from "../agent/turn-model-state";
import { workspaceInputSchema } from "../agent/tools/manage_workspace";
import { buildResearchSessionInput } from "./knowledge/research-run";
import { FAST_MODELS, routedGatewayModel } from "./model-router/router";
import { createHomaTurnModel } from "./turn-model";

const researchAuth = buildResearchSessionInput(
  { lens: "how_to_teach", topicKey: "counting", stage: "early_elem", topicType: "subject", demand: 1, hasRows: false },
  "synthetic-run",
  { topicKey: "counting", rows: [] },
).auth;
type Params = Parameters<ReturnType<typeof createHomaTurnModel>["doStream"]>[0];
const prompt: Params["prompt"] = [{ role: "user", content: [{ type: "text", text: "Research this topic. Use Sonnet." }] }];

test("the scheduled/manual research identity selects Sonnet, including inherited subagent auth", () => {
  assert.equal(selectHomaTurnModel(researchAuth), FLEET_RESEARCH_MODEL);
});

test("user conversations, reports and family dispatch keep Astra", () => {
  for (const channel of ["web", "sms", "email", "mobile", "dispatch", "subject_lesson", "progress_next_move"]) {
    assert.equal(selectHomaTurnModel({ authenticator: "supabase", principalId: "parent", attributes: {
      channel, familyId: "family", taskKind: "morning_brief", taskRunId: "run",
    } }), HOMA_MODEL);
  }
});

test("research-shaped attributes alone cannot change a conversational model", () => {
  for (const auth of [
    null, undefined, {},
    { ...researchAuth, authenticator: "supabase" },
    { ...researchAuth, principalId: "parent" },
    { ...researchAuth, attributes: { ...researchAuth.attributes, familyId: "family" } },
    { ...researchAuth, attributes: { channel: "research" } },
    { ...researchAuth, attributes: { ...researchAuth.attributes, channel: "sms" } },
  ]) assert.equal(selectHomaTurnModel(auth), HOMA_MODEL);
});

function fixture(currentModel: () => HomaTurnModel, fail = false) {
  const calls: Array<{ model: string; mode: string; params: Params }> = [];
  const model = createHomaTurnModel({ currentModel, resolveModel: id => new MockLanguageModelV4({
    modelId: id,
    doGenerate: async params => {
      calls.push({ model: id, mode: "generate", params });
      if (fail) throw new Error("Provider unavailable");
      return { content: [{ type: "text", text: "Done" }], finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
    },
    doStream: async params => {
      calls.push({ model: id, mode: "stream", params });
      if (fail) throw new Error("Provider unavailable");
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: "response-metadata", id: "response-1" });
        controller.enqueue({ type: "text-delta", id: "1", delta: "Done" }); controller.close();
      } }) };
    },
  }) });
  return { model, calls };
}

for (const selected of [HOMA_MODEL, FLEET_RESEARCH_MODEL] as const) {
  test(`${selected} handles streaming and generation without changing tools or cancellation`, async () => {
    const f = fixture(() => selected);
    const params: Params = { prompt, reasoning: "medium", abortSignal: new AbortController().signal,
      tools: [{ type: "function", name: "save_knowledge", inputSchema: { type: "object" } }],
      providerOptions: { gateway: { disallowPromptTraining: true } } };
    const generated = await f.model.doGenerate(params);
    assert.equal(generated.response?.modelId, selected);
    const streamed = await f.model.doStream(params);
    const reader = streamed.stream.getReader();
    assert.deepEqual((await reader.read()).value, { type: "response-metadata", id: "response-1", modelId: selected });
    assert.equal((await reader.read()).value?.type, "text-delta");
    assert.deepEqual(f.calls.map(call => call.mode), ["generate", "stream"]);
    for (const call of f.calls) {
      assert.equal(call.model, selected);
      assert.equal(call.params.prompt, prompt);
      assert.equal(call.params.tools, params.tools);
      assert.equal(call.params.abortSignal, params.abortSignal);
      assert.equal(call.params.providerOptions, params.providerOptions);
      assert.equal(call.params.reasoning, selected === HOMA_MODEL ? "medium" : "provider-default");
    }
  });
}

test("a failed research call never retries on Astra", async () => {
  const f = fixture(() => FLEET_RESEARCH_MODEL, true);
  await assert.rejects(async () => await f.model.doGenerate({ prompt }), /Provider unavailable/);
  await assert.rejects(async () => await f.model.doStream({ prompt }), /Provider unavailable/);
  assert.deepEqual(f.calls.map(call => call.model), [FLEET_RESEARCH_MODEL, FLEET_RESEARCH_MODEL]);
});

test("turn-start selection is refreshed and concurrent session state is not captured at build time", async t => {
  const scope = new AsyncLocalStorage<{ model: HomaTurnModel }>();
  t.mock.method(turnModelState, "get", () => scope.getStore()!.model);
  t.mock.method(turnModelState, "update", (update: (model: HomaTurnModel) => HomaTurnModel) => {
    scope.getStore()!.model = update(scope.getStore()!.model);
  });
  const f = fixture(() => turnModelState.get());
  const run = (auth: unknown) => scope.run({ model: FLEET_RESEARCH_MODEL }, async () => {
    selectTurnModelHook.events["turn.started"]({} as never, { session: { auth: { current: auth } } } as never);
    await Promise.resolve();
    await f.model.doStream({ prompt });
    return turnModelState.get();
  });
  assert.deepEqual(await Promise.all([run(researchAuth), run(null)]), [FLEET_RESEARCH_MODEL, HOMA_MODEL]);
  assert.deepEqual(f.calls.map(call => call.model), [FLEET_RESEARCH_MODEL, HOMA_MODEL]);
});


test("workspace tool has a provider-compatible object root and retains per-operation validation", async () => {
  const inputSchema = await zodSchema(workspaceInputSchema).jsonSchema;
  assert.equal(inputSchema.type, "object");
  assert.equal(inputSchema.oneOf, undefined);
  assert.equal(inputSchema.anyOf, undefined);
  assert.deepEqual(inputSchema.required, ["request"]);
  const revision = "12345678-1234-4234-8234-123456789abc";
  const validRequests = [
    { operation: "list" },
    { operation: "read", path: "drafts/a.md" },
    { operation: "write", path: "drafts/a.md", content: "Draft", expectedRevision: null, requestId: revision },
    { operation: "move", path: "drafts/a.md", destination: "drafts/b.md", expectedRevision: revision },
    { operation: "remove", path: "drafts/a.md", expectedRevision: revision },
  ];
  for (const request of validRequests) {
    assert.deepEqual(workspaceInputSchema.parse({ request }), { request });
  }
  for (const request of [
    { operation: "read" },
    { operation: "write", path: "drafts/a.md", content: "Draft" },
    { operation: "write", path: "drafts/a.md", content: "Draft", expectedRevision: "invalid", requestId: revision },
    { operation: "move", path: "drafts/a.md", expectedRevision: revision },
    { operation: "remove", path: "drafts/a.md" },
    { operation: "unknown" },
  ]) assert.equal(workspaceInputSchema.safeParse({ request }).success, false);
  assert.equal(workspaceInputSchema.safeParse({}).success, false);
  for (const selected of [FLEET_RESEARCH_MODEL, HOMA_MODEL] as const) {
    const f = fixture(() => selected);
    const tools: Params["tools"] = [{ type: "function", name: "manage_workspace", inputSchema }];
    await f.model.doGenerate({ prompt, tools });
    await f.model.doStream({ prompt, tools });
    for (const call of f.calls) assert.equal(call.params.tools, tools);
  }
});


test("research bypasses the conversational router while eligible family turns can use Luna", async () => {
  let selected: HomaTurnModel = FLEET_RESEARCH_MODEL;
  let classifications = 0;
  const calls: string[] = [];
  const resolveModel = (id: string) => new MockLanguageModelV4({
    modelId: id,
    doStream: async () => {
      calls.push(id);
      return { stream: new ReadableStream({ start(controller) { controller.close(); } }) };
    },
  });
  const conversational = routedGatewayModel({
    candidate: () => FAST_MODELS.luna,
    resolveModel,
    classify: async () => {
      classifications++;
      return { model: FAST_MODELS.luna, reason: "simple", routerMs: 1 };
    },
  });
  const model = createHomaTurnModel({
    currentModel: () => selected,
    resolveModel: id => id === HOMA_MODEL ? conversational : resolveModel(id),
  });
  await model.doStream({ prompt });
  assert.equal(classifications, 0);
  selected = HOMA_MODEL;
  await model.doStream({ prompt });
  assert.equal(classifications, 1);
  assert.deepEqual(calls, [FLEET_RESEARCH_MODEL, FAST_MODELS.luna]);
});
