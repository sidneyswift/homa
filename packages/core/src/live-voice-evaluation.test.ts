import assert from "node:assert/strict";
import test from "node:test";
import { LiveVoiceConversation } from "./live-voice";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 20));
function harness() {
  const requests: Record<string, unknown>[] = [];
  const spoken: Record<string, unknown>[] = [];
  const effects: unknown[] = [];
  const releases: (() => void)[] = [];
  const conversation = new LiveVoiceConversation("evaluation", {
    transcriptDelayMs: 0, send: (event) => spoken.push(event),
    onCaption() {}, onError() {}, onWorking() {}, onEffects: (result) => { effects.push(result); },
    fetch: async (path, init) => {
      if (path.endsWith("/turn")) return Response.json({ ok: true });
      requests.push(JSON.parse(String(init?.body)));
      await new Promise<void>((resolve) => releases.push(resolve));
      return Response.json({ output: { ok: true, spokenReply: "The original worksheet is ready.", effects: [], sessionState: { streamIndex: requests.length } } });
    },
  });
  let id = 0;
  const fragment = (role: "input" | "output", text: string, start: number, end: number) => conversation.receive({
    type: `session.${role}_transcript.delta`, delta: text, start_ms: start, end_ms: end, event_id: `e${id++}`,
  });
  const delegate = (offset: number) => conversation.receive({ type: "session.delegation.created", offset_ms: offset, delegation: { id: `d${id++}`, target: "client" } });
  return { conversation, fragment, delegate, requests, spoken, releases, effects };
}

test("request details survive multiple exchanges before the first delegation", async () => {
  const f = harness();
  f.fragment("input", "Make a tracing worksheet.", 0, 800);
  f.fragment("output", "Who is it for?", 1000, 1800);
  f.fragment("input", "For Avery.", 2500, 3000);
  f.fragment("output", "Which letter?", 3300, 3900);
  f.fragment("input", "Lowercase s, please.", 4500, 5200);
  f.delegate(5500); await tick();
  assert.equal(f.requests[0].sourceText, "Lowercase s, please.");
  assert.deepEqual(f.requests[0].sourceContext, [
    { role: "user", sequence: 0, text: "Make a tracing worksheet." },
    { role: "assistant", sequence: 1, text: "Who is it for?" },
    { role: "user", sequence: 2, text: "For Avery." },
    { role: "assistant", sequence: 3, text: "Which letter?" },
  ]);
  f.releases.shift()!(); await tick(); await f.conversation.finish();
});

test("a queued correction prevents an obsolete result from being announced as the final answer", async () => {
  const f = harness();
  f.fragment("input", "Make uppercase S.", 0, 800); f.delegate(900); await tick();
  f.fragment("input", "Actually, lowercase s.", 1200, 2000); f.delegate(2100); await tick();
  f.releases.shift()!(); await tick();
  assert.equal(f.effects.length, 1, "completed effects remain visible and truthful");
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].sourceText, "Actually, lowercase s.");
  assert.ok(f.spoken.some((event) => event.type === "session.thinking.append" && String(event.content).includes("newer request")));
  assert.equal(f.spoken.filter((event) => event.type === "session.commentary.append").length, 0);
  f.releases.shift()!(); await tick();
  assert.equal(f.spoken.filter((event) => event.type === "session.commentary.append").length, 1);
  assert.ok(f.spoken.some((event) => event.type === "session.instructions.append" && String(event.content).includes("no longer current")));
  await f.conversation.finish();
});

test("a new audio connection does not export the previous call's caption context", async () => {
  const f = harness();
  f.fragment("input", "Old call detail.", 0, 800); await f.conversation.finish();
  f.conversation.resume();
  f.fragment("input", "Make a new worksheet.", 0, 800); f.delegate(900); await tick();
  assert.deepEqual(f.requests[0].sourceContext, []);
  f.releases.shift()!(); await tick(); await f.conversation.finish();
});

test("speech during work prompts intent-aware delegation, never dispatches by caption alone", async () => {
  const f = harness();
  f.fragment("input", "Make uppercase S.", 0, 800); f.delegate(900); await tick();
  f.fragment("input", "Actually, lowercase s.", 1200, 2000); await tick();
  assert.equal(f.requests.length, 1);
  assert.ok(f.spoken.some((event) => event.type === "session.instructions.append" && String(event.content).includes("Merely acknowledging")));
  f.delegate(2100); await tick(); f.releases.shift()!(); await tick(); f.releases.shift()!(); await tick();
  await f.conversation.finish();
});
