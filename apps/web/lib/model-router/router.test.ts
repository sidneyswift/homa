import assert from "node:assert/strict";
import test from "node:test";
import { HOMA_MODEL } from "../../agent/model";
import { chooseRoute, FAST_MODELS, routedGatewayModel, routingInput, type Route } from "./router";

type Model = ReturnType<typeof routedGatewayModel>;
type Params = Parameters<Model["doStream"]>[0];
const prompt: Params["prompt"] = [{ role: "user", content: [{ type: "text", text: "What is a number bond?" }] }];
function fixture(candidate: string | undefined, classifyModel = FAST_MODELS.luna as string) {
  const calls: { model: string; params: Params }[] = [];
  const routes: Route[] = [];
  let classifications = 0;
  const model = routedGatewayModel({ candidate: () => candidate,
    onRoute: route => routes.push(route),
    classify: async () => { classifications++; return { model: classifyModel, reason: "test", routerMs: 2 }; },
    resolveModel: id => ({ specificationVersion: "v4", provider: "test", modelId: id, supportedUrls: {},
      doGenerate: async () => { throw new Error("not used"); },
      doStream: async params => { calls.push({ model: id, params }); return { stream: new ReadableStream({ start(c) { c.enqueue({ type: "text-delta", id: "1", delta: "hello" }); c.close(); } }) }; },
    }),
  });
  return { model, calls, routes, count: () => classifications };
}
test("disabled router makes no classification and preserves Astra medium", async () => {
  const f = fixture(undefined); await f.model.doStream({ prompt, reasoning: "medium" });
  assert.equal(f.count(), 0); assert.equal(f.calls[0].model, HOMA_MODEL); assert.equal(f.calls[0].params.reasoning, "medium");
});
test("selected model receives unchanged prompt and tools and streams its answer", async () => {
  const f = fixture(FAST_MODELS.luna); const params: Params = { prompt, tools: [{ type: "function", name: "example", inputSchema: { type: "object" } }] };
  const result = await f.model.doStream(params); assert.equal(f.count(), 1); assert.equal(f.calls[0].model, FAST_MODELS.luna);
  assert.equal(f.calls[0].params.prompt, prompt); assert.equal(f.calls[0].params.tools, params.tools); assert.equal(f.calls[0].params.reasoning, "low");
  assert.equal((await result.stream.getReader().read()).value?.type, "text-delta");
});
test("tool continuation bypasses classifier and returns to Astra", async () => {
  const f = fixture(FAST_MODELS.luna);
  await f.model.doStream({ prompt: [...prompt, { role: "assistant", content: [{ type: "text", text: "Working" }] }] });
  assert.equal(f.count(), 0); assert.equal(f.calls[0].model, HOMA_MODEL);
});
test("attachments and oversized history cannot silently become simple requests", () => {
  assert.equal(routingInput([{ role: "user", content: [{ type: "file", mediaType: "image/png", data: { type: "url", url: new URL("https://example.com/a.png") } }] }]), null);
  assert.equal(routingInput([{ role: "user", content: [{ type: "text", text: "a".repeat(12001) }] }]), null);
});
test("conversation is passed as data with prior context, without system instructions", () => {
  const input = routingInput([{ role: "system", content: "secret system" }, { role: "assistant", content: [{ type: "text", text: "Should I make a worksheet?" }] }, ...prompt]);
  assert.ok(input?.includes("worksheet")); assert.ok(!input?.includes("secret system"));
});
test("uncertain route preserves medium", async () => {
  const f = fixture(FAST_MODELS.luna, HOMA_MODEL); await f.model.doStream({ prompt });
  assert.equal(f.calls[0].params.reasoning, "medium");
});
test("cancellation prevents dispatching an answer model", async () => {
  const f = fixture(undefined); const c = new AbortController(); c.abort();
  await assert.rejects(async () => await f.model.doStream({ prompt, abortSignal: c.signal })); assert.equal(f.calls.length, 0);
});

test("router errors fall back to Astra without retry", async () => {
  let calls = 0;
  const r = await chooseRoute("hello", FAST_MODELS.luna, undefined, 100, async () => { calls++; throw new Error("provider failed"); });
  assert.equal(calls, 1); assert.equal(r.model, HOMA_MODEL); assert.equal(r.reason, "router_error");
});
test("router deadline bounds even a provider that ignores cancellation", async () => {
  const r = await chooseRoute("hello", FAST_MODELS.luna, undefined, 5, () => new Promise(() => {}));
  assert.equal(r.model, HOMA_MODEL); assert.equal(r.reason, "router_timeout");
});
test("invalid model cannot enter the candidate roster", async () => {
  await assert.rejects(chooseRoute("hello", "unapproved/model"), /Unapproved/);
});
test("both Jev judgments must clear the fast-route threshold", async () => {
  for (const [complexity, safeSimple] of [[0.89, 1], [1, 0.89], [undefined, 1]] as const) {
    const r = await chooseRoute("hello", FAST_MODELS.luna, undefined, 100, async () => ({
      answers: { complexity: { type: "choice", choice: "simple", probabilities: complexity === undefined ? undefined : { simple: complexity } }, safeSimple: { type: "boolean", probability: safeSimple } }, usage: {},
    }) as never);
    assert.equal(r.model, HOMA_MODEL);
  }
});
test("high-confidence simple classification selects the approved fast model", async () => {
  const r = await chooseRoute("hello", FAST_MODELS.luna, undefined, 100, async () => ({
    answers: { complexity: { type: "choice", choice: "simple", probabilities: { simple: 0.99 } }, safeSimple: { type: "boolean", probability: 0.99 } }, usage: { inputTokens: 550, outputTokens: 59 },
  }) as never);
  assert.equal(r.model, FAST_MODELS.luna); assert.equal(r.inputTokens, 550);
});
