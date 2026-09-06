import assert from "node:assert/strict";
import { test } from "node:test";
import type { Experimental_RealtimeServerEvent as RealtimeEvent } from "ai";

import { WebVoiceSession } from "./voice-session";
import type { VoiceTranscriptLine } from "./voice-transcript";

type EventInput = RealtimeEvent extends infer T ? T extends { raw: unknown } ? Omit<T, "raw"> : never : never;
const event = (session: WebVoiceSession, input: EventInput) => session.receive({ ...input, raw: {} } as RealtimeEvent);
const commit = (s: WebVoiceSession, id: string) => event(s, { type: "audio-committed", itemId: id });
const transcript = (s: WebVoiceSession, id: string, text: string) => event(s, { type: "input-transcription-completed", itemId: id, transcript: text });
const response = (s: WebVoiceSession, id: string) => event(s, { type: "response-created", responseId: id });
const done = (s: WebVoiceSession, id: string) => event(s, { type: "response-done", responseId: id, status: "completed" });
const bind = (s: WebVoiceSession, responseId: string, callId: string) => event(s, {
  type: "function-call-arguments-done", responseId, itemId: `item-${callId}`, callId,
  name: "ask_homa", arguments: '{"request":"model paraphrase"}',
});
const call = (s: WebVoiceSession, id: string) => s.runTool({ toolCallId: id, toolName: "ask_homa", args: { request: "model paraphrase" } });
const reply = (sessionState?: unknown) => Response.json({
  ok: true, output: { ok: true, spokenReply: "Saved.", effects: [], sessionState },
});

function fixture(handler?: (url: string, body: Record<string, unknown>) => Promise<Response>) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const lines: VoiceTranscriptLine[] = [];
  const errors: string[] = [];
  const session = new WebVoiceSession("voice-test", {
    fetch: (async (url, init) => {
      const body = JSON.parse(String(init?.body));
      requests.push({ url: String(url), body });
      return handler ? handler(String(url), body)
        : String(url).endsWith("/turn") ? Response.json({ ok: true }) : reply();
    }) as typeof fetch,
    onTurn: (line) => lines.push(line), onError: (error) => errors.push(error),
    transcriptTimeoutMs: 15,
  });
  return { session, requests, lines, errors, tools: () => requests.filter((r) => r.url.endsWith("/tool")) };
}

test("late transcript keeps its audio sequence and precedes the assistant reply", async () => {
  const f = fixture();
  commit(f.session, "u1");
  response(f.session, "r1");
  event(f.session, { type: "audio-transcript-done", responseId: "r1", itemId: "a1", transcript: "I can help." });
  done(f.session, "r1");
  assert.equal(f.lines.length, 0);
  transcript(f.session, "u1", "Please record ten minutes of reading.");
  await f.session.finish();
  assert.deepEqual(f.lines.map((line) => [line.role, line.text]), [
    ["user", "Please record ten minutes of reading."], ["assistant", "I can help."],
  ]);
  assert.deepEqual(f.requests.map((r) => r.body.sequence), [0, 1]);
});

test("a tool waits for its own transcript, never the model paraphrase or a newer user turn", async () => {
  const f = fixture();
  commit(f.session, "u1"); response(f.session, "r1"); bind(f.session, "r1", "c1");
  const result = call(f.session, "c1");
  commit(f.session, "u2"); transcript(f.session, "u2", "Actually, tell me the time.");
  await Promise.resolve();
  assert.equal(f.tools().length, 0);
  transcript(f.session, "u1", "Record ten minutes of reading for Avery.");
  assert.equal((await result).ok, true);
  assert.equal(f.tools()[0].body.sourceText, "Record ten minutes of reading for Avery.");
  assert.equal(f.tools()[0].body.sourceSequence, 0);
  assert.equal(f.tools()[0].body.sessionId, "voice-test");
  await f.session.finish();
});

test("silent tool-only responses settle without trapping subsequent turns", async () => {
  const f = fixture();
  commit(f.session, "u1"); transcript(f.session, "u1", "Read our records.");
  response(f.session, "tool-only"); done(f.session, "tool-only");
  response(f.session, "answer");
  event(f.session, { type: "text-delta", responseId: "answer", itemId: "a1", delta: "You recorded " });
  event(f.session, { type: "text-done", responseId: "answer", itemId: "a1", text: "You recorded ten minutes." });
  done(f.session, "answer");
  await f.session.finish();
  assert.equal(f.lines.length, 2);
  assert.deepEqual(f.requests.map((r) => r.body.sequence), [0, 2]);
});

test("duplicate events and tool callbacks do not duplicate effects or transcript writes", async () => {
  const f = fixture();
  commit(f.session, "u1"); commit(f.session, "u1");
  transcript(f.session, "u1", "Save reading."); transcript(f.session, "u1", "changed late text");
  response(f.session, "r1"); bind(f.session, "r1", "c1");
  const first = call(f.session, "c1");
  assert.equal(call(f.session, "c1"), first);
  await first;
  assert.equal(f.tools().length, 1);
  assert.equal(f.tools()[0].body.sourceText, "Save reading.");
  await f.session.finish(); await f.session.finish();
  assert.equal(f.requests.filter((r) => r.url.endsWith("/turn")).length, 1);
});

test("different provider calls for one utterance share one complete workflow receipt", async () => {
  const f = fixture();
  commit(f.session, "u1"); transcript(f.session, "u1", "Save ten minutes and make a reading page.");
  response(f.session, "r1"); bind(f.session, "r1", "c1"); bind(f.session, "r1", "c2");
  const first = call(f.session, "c1");
  assert.equal(call(f.session, "c2"), first);
  const receipt = await first;
  done(f.session, "r1");
  response(f.session, "r2"); bind(f.session, "r2", "c3");
  assert.equal(await call(f.session, "c3"), receipt);
  assert.equal(f.tools().length, 1);
  await f.session.finish();
});

test("serial bridge calls carry the preceding Homa session state", async () => {
  let release!: (value: Response) => void;
  const state = { id: "homa-session", token: "fixture-only" };
  let toolCount = 0;
  const f = fixture(async (url) => {
    if (url.endsWith("/turn")) return Response.json({ ok: true });
    toolCount += 1;
    return toolCount === 1 ? new Promise<Response>((resolve) => { release = resolve; }) : reply();
  });
  commit(f.session, "u1"); transcript(f.session, "u1", "What should we read?"); response(f.session, "r1"); bind(f.session, "r1", "c1");
  const first = call(f.session, "c1");
  commit(f.session, "u2"); transcript(f.session, "u2", "Yes, save that."); response(f.session, "r2"); bind(f.session, "r2", "c2");
  const second = call(f.session, "c2");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(toolCount, 1);
  release(reply(state));
  await Promise.all([first, second]);
  assert.equal(f.tools().length, 2);
  assert.deepEqual(f.tools()[1].body.homaSessionState, state);
  assert.equal(f.tools()[1].body.sourceText, "Yes, save that.");
  await f.session.finish();
});

test("missing, empty, or unbound source refuses without calling the bridge", async () => {
  const f = fixture();
  assert.equal((await call(f.session, "unbound")).ok, false);
  commit(f.session, "u1"); response(f.session, "r1"); bind(f.session, "r1", "c1");
  assert.equal((await call(f.session, "c1")).ok, false);
  transcript(f.session, "u1", " "); bind(f.session, "r1", "c2");
  assert.equal((await call(f.session, "c2")).ok, false);
  assert.equal(f.tools().length, 0);
  await f.session.finish();
});

test("End releases waiting calls without dispatch and reports an unfinished transcript", async () => {
  const f = fixture();
  commit(f.session, "u1"); response(f.session, "r1"); bind(f.session, "r1", "c1");
  const pending = call(f.session, "c1");
  await f.session.finish();
  transcript(f.session, "u1", "late after disconnect");
  assert.equal((await pending).ok, false);
  assert.equal(f.tools().length, 0);
  assert.equal(f.lines.length, 0);
  assert.match(f.errors[0], /not finished transcribing/);
});

test("HTTP200 not-saved is retried with the same key, retained, and recoverable", async () => {
  let canSave = false;
  const f = fixture(async () => Response.json({ ok: canSave }));
  commit(f.session, "u1"); transcript(f.session, "u1", "Our reading today.");
  assert.equal(await f.session.finish(), false);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.requests[0].body, f.requests[1].body);
  assert.match(f.errors[0], /has not saved/);
  canSave = true;
  assert.equal(await f.session.retrySave(), true);
  assert.equal(f.lines.length, 1);
  assert.deepEqual(f.requests[2].body, f.requests[0].body);
});

test("assistant saves wait for user persistence and stay queued when it fails", async () => {
  let release!: (value: Response) => void;
  let firstAttempt = true;
  let canSave = false;
  const f = fixture(async (_url, body) => {
    if (body.role === "user" && firstAttempt) {
      firstAttempt = false;
      return new Promise((resolve) => { release = resolve; });
    }
    return Response.json({ ok: canSave });
  });
  commit(f.session, "u1"); transcript(f.session, "u1", "Read our records.");
  response(f.session, "r1");
  event(f.session, { type: "text-done", responseId: "r1", itemId: "a1", text: "Here is your reading." });
  done(f.session, "r1");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.requests.length, 1);
  release(Response.json({ ok: false }));
  assert.equal(await f.session.finish(), false);
  assert.ok(f.requests.every((r) => r.body.role === "user"));
  canSave = true;
  assert.equal(await f.session.retrySave(), true);
  assert.deepEqual(f.requests.slice(-2).map((r) => r.body.role), ["user", "assistant"]);
});

test("explicit transcription failure settles the missing turn without giving it tool authority", async () => {
  const f = fixture();
  commit(f.session, "u1"); response(f.session, "r1"); bind(f.session, "r1", "c1");
  const pending = call(f.session, "c1");
  f.session.receive({
    type: "custom", rawType: "conversation.item.input_audio_transcription.failed", raw: { item_id: "u1" },
  });
  done(f.session, "r1");
  commit(f.session, "u2"); transcript(f.session, "u2", "Here is the second request.");
  assert.equal((await pending).ok, false);
  assert.equal(f.lines[0].text, "Here is the second request.");
  assert.equal(f.tools().length, 0);
  assert.match(f.errors[0], /could not transcribe/);
  await f.session.finish();
});

test("a lost bridge receipt is not retried or described as Nothing changed", async () => {
  const f = fixture(async (url) => {
    if (url.endsWith("/turn")) return Response.json({ ok: true });
    throw new Error("connection lost after dispatch");
  });
  commit(f.session, "u1"); transcript(f.session, "u1", "Save reading."); response(f.session, "r1"); bind(f.session, "r1", "c1");
  const output = await call(f.session, "c1");
  assert.equal(output.ok, false);
  assert.match(output.spokenReply, /check your records/);
  await call(f.session, "c1");
  assert.equal(f.tools().length, 1);
  await f.session.finish();
});

test("auth and malformed receipts fail honestly; a server refusal keeps its exact reply", async () => {
  for (const receipt of [Response.json({ ok: false }, { status: 401 }), Response.json({ ok: true, output: {} })]) {
    const f = fixture(async (url) => url.endsWith("/turn") ? Response.json({ ok: true }) : receipt);
    commit(f.session, "u1"); transcript(f.session, "u1", "Read my records."); response(f.session, "r1"); bind(f.session, "r1", "c1");
    assert.equal((await call(f.session, "c1")).ok, false);
    await f.session.finish();
  }
  const f = fixture(async (url) => url.endsWith("/turn") ? Response.json({ ok: true }) : Response.json({
    ok: false, output: { ok: false, spokenReply: "That child is not in this family.", effects: [] },
  }));
  commit(f.session, "u1"); transcript(f.session, "u1", "Save reading."); response(f.session, "r1"); bind(f.session, "r1", "c1");
  assert.equal((await call(f.session, "c1")).spokenReply, "That child is not in this family.");
  await f.session.finish();
});
