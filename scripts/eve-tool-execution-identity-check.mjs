import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, "apps/web/package.json"));
const eve = path.dirname(require.resolve("eve/package.json"));
const { wrapToolExecute } = await import(path.join(eve, "dist/src/harness/tools.js"));
const { createToolExecuteWithAuth } = await import(path.join(eve, "dist/src/execution/tool-auth.js"));
const { ContextContainer, contextStorage } = await import(path.join(eve, "dist/src/context/container.js"));
const { SessionKey } = await import(path.join(eve, "dist/src/context/keys.js"));
const context = new ContextContainer();
context.set(SessionKey, { sessionId: "actual-session", auth: {}, turn: { id: "actual-turn" } });
const seen = [];
const execute = wrapToolExecute({ name: "create_printable", execute: createToolExecuteWithAuth({ scope: "create_printable",
  execute(input, ctx) { seen.push({ input, identity: ctx.toolExecution, session: ctx.session.id }); return { ok: true }; } }) });
await contextStorage.run(context, async () => {
  await Promise.all([execute({ toolExecution: { callId: "forged" } }, { toolCallId: "actual-call-1" }),
    execute({}, { toolCallId: "actual-call-2" })]);
});
assert.deepEqual(seen.map(row => row.identity), [
  { name: "create_printable", callId: "actual-call-1" }, { name: "create_printable", callId: "actual-call-2" },
]);
assert(seen.every(row => row.session === "actual-session"));
console.log("PASS installed Eve preserves independent runtime-owned authored action identities");
