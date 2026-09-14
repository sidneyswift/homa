import assert from "node:assert/strict";
import { test } from "node:test";
import { gateway } from "@ai-sdk/gateway";
import { requestHash, serializableOptions } from "./runtime-matched";

test("capture keeps full model input while removing transport credentials", () => {
  const options: Parameters<ReturnType<typeof gateway>["doStream"]>[0] = {
    prompt: [{ role: "system", content: "Full instructions" }, { role: "user", content: [{ type: "text", text: "Question" }] }],
    tools: [{ type: "function", name: "lookup", description: "Real schema", inputSchema: { type: "object", properties: {} } }],
    providerOptions: { openai: { reasoningEffort: "medium" } },
    headers: { Authorization: "test-secret" }, abortSignal: new AbortController().signal,
  };
  const capture = serializableOptions(options);
  assert.deepEqual(capture.prompt, options.prompt);
  assert.deepEqual(capture.tools, options.tools);
  assert.deepEqual(capture.providerOptions, options.providerOptions);
  assert.equal(capture.headers, undefined);
  assert.equal(capture.abortSignal, undefined);
  assert.equal(requestHash(capture), requestHash(JSON.parse(JSON.stringify(capture))));
  assert.notEqual(requestHash(capture), requestHash({ ...capture, tools: [] }));
});
