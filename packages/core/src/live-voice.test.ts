import assert from "node:assert/strict";
import test from "node:test";
import { LiveSessionDiagnostics, LiveVoiceConversation, liveCommentary } from "./live-voice";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 15));
function fixture(options: { failedSave?: boolean; failedTool?: boolean; needsReply?: boolean; hold?: Promise<void> } = {}) {
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
      return Response.json({ output: { ok: true, spokenReply: "Saved once.", effects: [], needsReply: options.needsReply, sessionState: { id: "continued" } } });
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
  assert.match(String(f.sent.find((event) => event.type === "session.commentary.append")?.content), /could not confirm/);
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
  const commentary = f.sent.filter((event) => event.type === "session.commentary.append");
  assert.equal(commentary.length, 1);
  assert.equal(commentary[0].delegation_id, "d1");
  assert.equal(commentary[0].content, "Saved once.");
  assert.deepEqual(f.working.map((event) => event.active), [true, false]);
  await f.conversation.finish();
});

test("assistant persistence waits for earlier unsealed user text", async () => {
  const f = fixture();
  f.fragment("Read", 0, 10); f.fragment("Okay", 5, 15, "output"); f.fragment(" today", 20, 30);
  await tick();
  assert.equal(f.saves.length, 0);
  f.delegate("d1", 40); await tick();
  assert.deepEqual(f.saves.map((s) => s.sequence), [0]);
  await f.conversation.finish();
  assert.deepEqual(f.saves.map((s) => s.sequence), [0, 1]);
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
  assert.equal(f.sent.at(-1)?.type, "session.commentary.append");
  assert.equal(f.sent.at(-1)?.delegation_id, null);
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
  assert.equal(f.sent.filter((event) => String(event.content).startsWith("Greet the parent")).length, 1);
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
  assert.equal(sent.find((event) => event.type === "session.commentary.append")?.content, "Use Open report in our chat.");
  await conversation.finish();
});

test("ordinary replies divide subsequent parent speech into stable bubbles", async () => {
  const f = fixture();
  f.fragment("Hello.", 100, 500);
  f.fragment("How are you?", 700, 1200, "output");
  f.fragment("Good thanks.", 1600, 2200);
  f.fragment("Glad to hear it.", 2500, 3100, "output");
  f.fragment("Could you make a maze?", 3500, 4400);
  assert.deepEqual([...f.captions.values()], ["Hello.", "How are you?", "Good thanks.", "Glad to hear it.", "Could you make a maze?"]);
  f.delegate("maze", 4500); await tick();
  assert.equal(f.calls[0].sourceText, "Could you make a maze?");
  assert.equal(f.calls[0].sourceSequence, 4);
  await f.conversation.finish();
  assert.deepEqual(f.saves.map(s => s.content), [...f.captions.values()]);
});

test("overlapping acknowledgments preserve the ongoing request and late fragments", async () => {
  const f = fixture();
  f.fragment("Make a", 100, 500);
  f.fragment("Mm-hmm", 300, 600, "output");
  f.fragment(" maze", 550, 900);
  f.fragment(" please", 900, 1200);
  f.fragment("Sure.", 1500, 1900, "output");
  f.fragment("For Avery.", 2200, 2800);
  f.fragment(" today.", 1200, 1400);
  assert.deepEqual([...f.captions.values()], ["Make a maze please today.", "Mm-hmm", "Sure.", "For Avery."]);
  assert.equal(f.calls.length, 0);
  await f.conversation.finish();
});

test("assistant acknowledgment does not consume a request before delegation", async () => {
  const f = fixture();
  f.fragment("Make a maze.", 100, 700);
  f.fragment("Sure, I'll do that.", 1000, 1500, "output");
  f.delegate("maze", 1600); await tick();
  assert.equal(f.calls[0].sourceText, "Make a maze.");
  f.delegate("duplicate-intent", 1700); await tick();
  assert.equal(f.calls.length, 1);
  await f.conversation.finish();
});

test("queued delegation captures source before later conversation begins", async () => {
  let release!: () => void;
  const f = fixture({ hold: new Promise<void>(resolve => { release = resolve; }) });
  f.fragment("Make a maze.", 100, 700); f.delegate("first", 800); await tick();
  f.fragment("Check my planner.", 1000, 1500); f.delegate("second", 1600); await tick();
  f.conversation.sendText("Create a checklist.");
  f.fragment("Sure, let me look.", 1800, 2300, "output");
  f.fragment("Thanks. How are you?", 2500, 3300);
  release(); await tick(); await tick();
  assert.deepEqual(f.calls.map(call => call.sourceText), ["Make a maze.", "Check my planner.", "Create a checklist."]);
  assert.deepEqual(f.calls[1].homaSessionState, { id: "continued" });
  await f.conversation.finish();
});

test("old transcript delivery after delegation cannot become new permission", async () => {
  const f = fixture();
  f.fragment("Log reading.", 100, 700); f.delegate("first", 800); await tick();
  f.fragment(" please", 700, 750); f.delegate("second", 900); await tick();
  assert.equal(f.calls.length, 1);
  f.fragment("Log art.", 1000, 1500); f.delegate("third", 1600); await tick();
  assert.equal(f.calls[1].sourceText, "Log art.");
  await f.conversation.finish();
});

test("late assistant delivery separates parent utterances already on screen", async () => {
  const f = fixture();
  f.fragment("Hello.", 100, 500);
  f.fragment("I'm well.", 2000, 2500);
  f.fragment("How are you?", 800, 1500, "output");
  assert.deepEqual([...f.captions.values()], ["Hello.", "How are you?", "I'm well."]);
  f.fragment(" Thanks.", 2500, 2900);
  assert.equal(f.captions.get(2), "I'm well. Thanks.");
  await f.conversation.finish();
});

test("a brief reply between words does not split the parent's sentence", async () => {
  const f = fixture();
  f.fragment("How are", 100, 500);
  f.fragment("I'm good!", 550, 800, "output");
  f.fragment(" you?", 900, 1200);
  assert.deepEqual([...f.captions.values()], ["How are you?", "I'm good!"]);
  await f.conversation.finish();
});

test("late brief acknowledgment cannot divide a continuing request", async () => {
  const f = fixture();
  f.fragment("Make a", 100, 500); f.fragment(" maze.", 900, 1200);
  f.fragment("Okay", 550, 800, "output");
  f.delegate("maze", 1300); await tick();
  assert.equal(f.calls[0].sourceText, "Make a maze.");
  await f.conversation.finish();
});


test("backend waiting state requests a new delegation without running work itself", async () => {
  const f = fixture({ needsReply: true });
  f.fragment("Make a plan.", 100, 500); f.delegate("first", 600); await tick();
  assert.equal(f.sent[0].type, "session.instructions.append");
  assert.equal(f.sent[0].delegation_id, "first");
  assert.match(String(f.sent[0].content), /NEW client delegation/);
  assert.equal(f.sent[1].type, "session.commentary.append");
  f.fragment("An activity schedule.", 1000, 1800); await tick();
  assert.equal(f.calls.length, 1);
  f.delegate("answer", 1900); await tick();
  assert.equal(f.calls[1].sourceText, "An activity schedule.");
  await f.conversation.finish();
});


test("Live append receipts match both command ID and event type without claiming playback", () => {
  const d = new LiveSessionDiagnostics();
  d.sent({ type: "session.commentary.append", event_id: "result" });
  d.receive({ type: "session.thinking.appended", client_event_id: "result" });
  assert.equal(d.snapshot().unconfirmed, 1);
  d.receive({ type: "session.commentary.appended", client_event_id: "other" });
  assert.equal(d.snapshot().unconfirmed, 1);
  d.receive({ type: "session.commentary.appended", client_event_id: "result" });
  d.receive({ type: "session.commentary.appended", client_event_id: "result" });
  assert.equal(d.snapshot().acknowledged, 1);
  assert.equal(d.snapshot().unconfirmed, 0);
  assert.equal(d.snapshot().finalized, false);
});

test("Live errors reject only their command; null codes and missing IDs remain nonterminal", async () => {
  const d = new LiveSessionDiagnostics();
  d.sent({ type: "session.instructions.append", event_id: "a" });
  d.sent({ type: "session.commentary.append", event_id: "b" });
  d.receive({ type: "error", error: { code: null, client_event_id: "a" } });
  d.receive({ type: "error", error: { code: null } });
  assert.equal(d.snapshot().rejected, 1);
  assert.equal(d.snapshot().unconfirmed, 1);
  assert.equal(d.snapshot().finalized, false);
  const f = fixture();
  f.conversation.receive({ type: "error", error: { code: null } });
  f.fragment("Make a maze", 1, 10); f.delegate("after-error", 11); await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.errors.length, 1);
  assert.doesNotMatch(f.errors[0], /restart/i);
  await f.conversation.finish();
});

test("duration snapshots are never summed and transport loss does not imply final usage", () => {
  const d = new LiveSessionDiagnostics();
  for (const seconds of [12, 15, 15, 10, -1, NaN]) d.receive({ type: "session.usage.updated", usage: { seconds } });
  assert.equal(d.snapshot().seconds, 15);
  assert.equal(d.snapshot().finalized, false);
  d.receive({ type: "session.closed", reason: "connection_lost", usage: { seconds: 17 } });
  d.receive({ type: "session.closed", reason: "close_requested", usage: { seconds: 99 } });
  assert.equal(d.snapshot().seconds, 17);
  assert.equal(d.snapshot().reason, "connection_lost");
  assert.equal(d.snapshot().finalized, true);
});
