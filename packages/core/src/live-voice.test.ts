import assert from "node:assert/strict";
import test from "node:test";
import { LiveVoiceConversation, liveCommentary } from "./live-voice";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 15));
function fixture(options: { failedSave?: boolean; failedTool?: boolean; hold?: Promise<void> } = {}) {
  const calls: Record<string, unknown>[] = [];
  const saves: Record<string, unknown>[] = [];
  const sent: Record<string, unknown>[] = [];
  const captions = new Map<number, string>();
  const errors: string[] = [];
  const working: { active: boolean; sessionId: string; sourceSequence: number }[] = [];
  const effects: unknown[] = [];
  const conversation = new LiveVoiceConversation("voice-fixture", {
    transcriptDelayMs: 0, send: (event) => sent.push(event),
    onWorking: (active, context) => working.push({ active, ...context }),
    onEffects: (output) => { effects.push(output); },
    onError: (message) => errors.push(message), onCaption: (row) => captions.set(row.sequence, row.text),
    fetch: async (path, init) => {
      const body = JSON.parse(String(init?.body));
      if (path.endsWith("/turn")) { saves.push(body); return Response.json({ ok: !options.failedSave }); }
      calls.push(body);
      await options.hold;
      if (options.failedTool) throw new Error("ambiguous timeout");
      return Response.json({ output: { ok: true, spokenReply: "Saved once.", effects: [], sessionState: { id: "continued" } } });
    },
  });
  let event = 0;
  const fragment = (text: string, start: number, end: number, role = "input") => conversation.receive({ type: `session.${role}_transcript.delta`, event_id: `e${event++}`, delta: text, start_ms: start, end_ms: end });
  const delegate = (id: string, offset: number) => conversation.receive({ type: "session.delegation.created", delegation: { id, target: "client" }, offset_ms: offset });
  return { conversation, fragment, delegate, calls, saves, sent, captions, errors, working, effects };
}

test("captions preserve whitespace and overlap without starting work", async () => {
  const f = fixture();
  f.fragment("Make", 0, 10); f.fragment(" a maze", 10, 20);
  f.fragment("Sure", 5, 15, "output");
  assert.deepEqual([...f.captions.values()], ["Make a maze", "Sure"]);
  assert.equal(f.calls.length, 0);
  await f.conversation.finish();
  assert.deepEqual(f.saves.map((s) => s.content), ["Make a maze", "Sure"]);
});

test("late fragments are ordered by time; duplicate events are ignored", async () => {
  const f = fixture();
  f.fragment(" a maze", 10, 20); f.fragment("Make", 0, 10);
  const event = { type: "session.input_transcript.delta", event_id: "duplicate", delta: " please", start_ms: 20, end_ms: 30 };
  f.conversation.receive(event); f.conversation.receive(event);
  f.delegate("d1", 35); await tick();
  assert.equal(f.calls[0].sourceText, "Make a maze please");
  assert.equal(f.calls[0].sourceSequence, 0);
  assert.equal(f.calls[0].sessionId, "voice-fixture");
  await f.conversation.finish();
});

test("delegation uses its timestamp cutoff and cannot take a later correction", async () => {
  const f = fixture();
  f.fragment("Log reading.", 10, 20);
  f.delegate("d1", 30);
  f.fragment("Actually log art.", 40, 50);
  await tick();
  assert.equal(f.calls[0].sourceText, "Log reading.");
  f.delegate("d2", 60); await tick();
  assert.equal(f.calls[1].sourceText, "Actually log art.");
  assert.notEqual(f.calls[0].sourceSequence, f.calls[1].sourceSequence);
  assert.deepEqual(f.calls[1].homaSessionState, { id: "continued" });
  await f.conversation.finish();
});

test("duplicate delegations and ambiguous bridge failures never retry effects", async () => {
  const f = fixture({ failedTool: true });
  f.fragment("Save reading.", 0, 10);
  f.delegate("d1", 20); f.delegate("d1", 20);
  await tick();
  assert.equal(f.calls.length, 1);
  assert.match(String(f.sent[0]?.content), /could not confirm/);
  assert.equal(f.effects.length, 1);
  assert.deepEqual(f.working.map((event) => event.active), [true, false]);
  await f.conversation.finish();
});

test("missing transcript cannot dispatch guessed model arguments", async () => {
  const f = fixture();
  f.delegate("d1", 20); await tick();
  assert.equal(f.calls.length, 0);
  await f.conversation.finish();
});

test("ending cancels queued delegations and suppresses late speech, not completed effects", async () => {
  let release!: () => void;
  const f = fixture({ hold: new Promise<void>((resolve) => { release = resolve; }) });
  f.fragment("Save reading.", 0, 10); f.delegate("d1", 20); await tick();
  f.fragment("Save art.", 30, 40); f.delegate("d2", 50);
  await f.conversation.finish();
  release(); await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.sent.length, 0);
  assert.equal(f.effects.length, 1);
  assert.deepEqual(f.working, [
    { active: true, sessionId: "voice-fixture", sourceSequence: 0 },
    { active: false, sessionId: "voice-fixture", sourceSequence: 0 },
  ]);
});

test("delayed completion reaches chat and voice once while the call stays open", async () => {
  let release!: () => void;
  const f = fixture({ hold: new Promise<void>((resolve) => { release = resolve; }) });
  f.fragment("Make a worksheet.", 0, 10); f.delegate("d1", 20); await tick();
  assert.deepEqual(f.working.map((event) => event.active), [true]);
  assert.equal(f.effects.length, 0);
  assert.equal(f.sent.length, 0);
  f.fragment("Thank you.", 30, 40);
  release(); await tick();
  assert.equal(f.effects.length, 1);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].delegation_id, "d1");
  assert.equal(f.sent[0].content, "Saved once.");
  assert.deepEqual(f.working.map((event) => event.active), [true, false]);
  await f.conversation.finish();
});

test("assistant persistence waits for earlier unsealed user text", async () => {
  const f = fixture();
  f.fragment("Read", 0, 10); f.fragment("Okay", 5, 15, "output"); f.fragment(" today", 20, 30);
  await tick();
  assert.equal(f.saves.length, 0);
  f.delegate("d1", 40); await tick();
  assert.deepEqual(f.saves.map((s) => s.sequence), [0, 1]);
  await f.conversation.finish();
});

test("failed transcript persistence is visible and retryable", async () => {
  const options = { failedSave: true };
  const f = fixture(options); f.fragment("Hello", 0, 10);
  assert.equal(await f.conversation.finish(), false);
  assert.ok(f.errors.length);
  options.failedSave = false;
  assert.equal(await f.conversation.retrySave(), true);
});

test("typed starters use the same authenticated bridge without Realtime commands", async () => {
  const f = fixture();
  assert.equal(f.conversation.sendText("Make a maze"), true); await tick();
  assert.equal(f.calls[0].sourceText, "Make a maze");
  assert.equal(f.sent[0].type, "session.commentary.append");
  assert.equal(f.sent[0].delegation_id, null);
  await f.conversation.finish();
  assert.equal(f.conversation.sendText("Save twice"), false);
});

test("commentary preserves Unicode within the Live append limit", () => {
  const text = "🦉 hello café ".repeat(200);
  const events = liveCommentary(text, "opaque-id");
  assert.equal(events.map((event) => event.content).join(""), text);
  assert.ok(events.every((event) => Buffer.byteLength(String(event.content)) <= 400));
  assert.ok(events.every((event) => event.delegation_id === "opaque-id"));
});

test("resume preserves backend context and does not greet or replay queued work", async () => {
  const f = fixture();
  f.conversation.receive({ type: "session.started", event_id: "start-1" });
  f.fragment("Look up my planner", 0, 10); f.delegate("d1", 20); await tick();
  await f.conversation.finish();
  f.conversation.resume();
  f.conversation.receive({ type: "session.started", event_id: "start-2" });
  f.fragment("What about tomorrow?", 0, 10); f.delegate("d2", 20); await tick();
  assert.deepEqual(f.calls[1].homaSessionState, { id: "continued" });
  assert.notEqual(f.calls[0].sourceSequence, f.calls[1].sourceSequence);
  assert.equal(f.sent.filter((event) => event.type === "session.instructions.append").length, 1);
  await f.conversation.finish();
});

test("surface-specific verified output is also the spoken reply", async () => {
  const sent: Record<string, unknown>[] = [];
  const conversation = new LiveVoiceConversation("voice-report", {
    send: (event) => sent.push(event), onCaption() {}, onError() {}, onWorking() {},
    onEffects: (output) => ({ ...output, spokenReply: "Use Open report in our chat." }),
    fetch: async (path) => Response.json(path.endsWith("/turn") ? { ok: true } : {
      output: { ok: true, spokenReply: "Your report is open.", effects: [] },
    }),
  });
  conversation.sendText("Open my report"); await tick();
  assert.equal(sent[0].content, "Use Open report in our chat.");
  await conversation.finish();
});
