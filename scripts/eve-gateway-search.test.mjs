import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(path.join(root, "apps/web/package.json"));
const eveRoot = path.dirname(webRequire.resolve("eve/package.json"));
const { resolveWebSearchBackend, resolveWebSearchProviderTool } = await import(
  pathToFileURL(path.join(eveRoot, "dist/src/harness/provider-tools.js")).href
);

test("wrapped Gateway models retain the same web search as ordinary Gateway strings", async () => {
  const source = { sourceKind: "module", logicalPath: "agent.ts", sourceId: "agent.ts" };
  for (const model of ["openai/gpt-6-astra", "anthropic/claude-sonnet-5.5"]) {
    const ordinary = resolveWebSearchBackend({ id: model });
    const wrapped = resolveWebSearchBackend({ id: `gateway/${model}`, source });
    assert.equal(wrapped, ordinary);
    assert.equal(wrapped, "parallel");
    const search = await resolveWebSearchProviderTool(wrapped);
    assert.equal(search.type, "provider");
    assert.equal(search.id, "gateway.parallel_search");
    assert.ok(search.outputSchema);
  }
});

test("direct provider search and unknown-provider behavior stay unchanged", () => {
  const source = { sourceKind: "module", logicalPath: "agent.ts", sourceId: "agent.ts" };
  for (const [id, expected] of [
    ["openai.responses/gpt-6-astra", "openai"],
    ["anthropic.messages/claude-sonnet-5.5", "anthropic"],
    ["google.generative-ai/gemini", "google"],
    ["unknown/model", null],
  ]) assert.equal(resolveWebSearchBackend({ id, source }), expected);
});
