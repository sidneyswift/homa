import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { before, it } from "node:test";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as {
  build(options: unknown): Promise<{outputFiles: Array<{text: string}>}>;
};
const calls: Array<{name: string; input: Record<string, unknown>}> = [];
let canonical = true;
const fixture = {
  async persistCanonicalMessage(input: Record<string, unknown>) {calls.push({name: "persist", input}); return canonical ? {id: "canonical-message", episodeId: "owned-episode"} : null;},
  async recordReactiveDelivery(input: Record<string, unknown>) {calls.push({name: "delivery", input}); return {attempt: {id: "owned-delivery", familyId: "family", memberUserId: "adult"}, deliveryOutcome: "sent"};},
  async bindDeliveredProgressCheckIn(input: Record<string, unknown>) {calls.push({name: "bind", input}); return {status: "bound"};},
  async openReplyLoop(input: Record<string, unknown>) {calls.push({name: "generic-loop", input});},
};
let completed: (event: unknown, context: unknown) => Promise<void>;
before(async () => {
  const built = await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../../agent/hooks/continuity-web-delivery.ts", import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{name: "owned-delivery-effects", setup(build: {
      onResolve(options: {filter: RegExp}, callback: (args: {path: string}) => unknown): void;
      onLoad(options: {filter: RegExp; namespace: string}, callback: (args: {path: string}) => unknown): void;
    }) {
      build.onResolve({filter: /^(eve\/hooks)$|\/(delivery-binding\.server|delivery-ledger|ledger)$/}, args => ({path: args.path, namespace: "effects"}));
      build.onLoad({filter: /.*/, namespace: "effects"}, args => ({contents: args.path === "eve/hooks" ? "export const defineHook = value => value;" :
        "export const {persistCanonicalMessage, recordReactiveDelivery, bindDeliveredProgressCheckIn, openReplyLoop} = globalThis.__ownedScreenDelivery;", loader: "js"}));
    }}],
  });
  (globalThis as unknown as Record<string, unknown>).__ownedScreenDelivery = fixture;
  const imported = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  completed = imported.default.events["message.completed"];
  delete (globalThis as unknown as Record<string, unknown>).__ownedScreenDelivery;
});
const event = {data: {finishReason: "stop", message: "Maya claps along to a steady beat.", sequence: 8, turnId: "exact-turn"}};
const session = (attributes: Record<string, string>, parent: unknown = undefined) => ({session: {id: "exact-runtime", auth: {current: {attributes}}, parent}});

it("actual native text hook uses canonical owned message, recipient and exact runtime turn for binding", async () => {
  for (const channel of ["web", "mobile"]) {
    calls.length = 0; canonical = true;
    const attributes = {channel, familyId: "family", memberUserId: "adult"};
    await completed(event, session(attributes));
    assert.deepEqual(calls.map(row => row.name), ["persist", "delivery", "bind"]);
    assert.deepEqual(calls[0].input, {attributes, sessionId: "exact-runtime", channel: "web", sequence: 8,
      role: "assistant", content: event.data.message, turnId: "exact-turn", terminal: true});
    assert.equal(calls[1].input.familyId, "family");
    assert.equal(calls[1].input.memberUserId, "adult");
    assert.equal(calls[1].input.messageId, "canonical-message");
    assert.equal(calls[1].input.channel, "web");
    assert.deepEqual(calls[2].input, {attempt: {id: "owned-delivery", familyId: "family", memberUserId: "adult"},
      deliveryOutcome: "sent", runtimeSessionId: "exact-runtime", turnId: "exact-turn"});
  }
});

it("actual hook never binds a partial, empty, parented or unauthenticated message", async () => {
  const own = {channel: "mobile", familyId: "family", memberUserId: "adult"};
  for (const [incoming, context] of [
    [{data: {...event.data, finishReason: "length"}}, session(own)],
    [{data: {...event.data, message: " "}}, session(own)],
    [event, session({...own, familyId: ""})],
    [event, session({...own, memberUserId: ""})],
    [event, session({...own, channel: "voice"})],
    [event, session({...own, voiceBridge: "true"})],
    [event, session(own, {sessionId: "parent-session"})],
  ]) {
    calls.length = 0; canonical = true;
    await completed(incoming, context);
    assert.deepEqual(calls, []);
  }
  calls.length = 0; canonical = false;
  await completed(event, session(own));
  assert.deepEqual(calls.map(row => row.name), ["persist"]);
});
