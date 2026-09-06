import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as realtimeTools from "./realtime-tools";
import * as sourceTurn from "./source-turn";
import { WebVoiceSession } from "../../app/app/voice-session";

/** Execute the actual route handlers with their external boundaries replaced.
 * No Next server, provider, or production database is contacted. */
function fixture(options: { familyId?: string; userId?: string; authenticated?: boolean; persist?: "throw" | "null" } = {}) {
  const persisted: Record<string, unknown>[] = [];
  const dispatched: Record<string, unknown>[] = [];
  const load = (route: "tool" | "turn") => {
    const code = ts.transpileModule(readFileSync(new URL(`../../app/api/voice/realtime/${route}/route.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const dependencies: Record<string, unknown> = {
      "../../../../../lib/map/ratelimit": { rateLimited: () => false },
      "../../../../../lib/api-auth": {
        resolveApiFamily: async () => options.authenticated === false ? null : ({
          familyId: options.familyId ?? "family-a", userId: options.userId ?? "parent-a",
          supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "fixture-cookie-jwt" } } }) } },
        }),
      },
      "../../../../../lib/conversation-continuity/ledger": {
        persistCanonicalMessage: async (input: Record<string, unknown>) => {
          if (options.persist === "throw") throw new Error("fixture persistence failure");
          if (options.persist === "null") return null;
          persisted.push(JSON.parse(JSON.stringify(input)));
          return { id: "source-message-fixture" };
        },
      },
      "../../../../../lib/voice/homa-bridge": {
        askHomaFromVoice: async (input: Record<string, unknown>) => {
          dispatched.push(JSON.parse(JSON.stringify(input)));
          return { ok: true, spokenReply: "Fixture success.", effects: [], sessionState: { id: "fixture-session" } };
        },
        parseVoiceHomaSessionState: (input: unknown) => input,
      },
      "../../../../../lib/voice/active-object": { resolveActiveObject: async () => ({ ok: false }) },
      "../../../../../lib/voice/realtime-tools": realtimeTools,
      "../../../../../lib/voice/source-turn": sourceTurn,
    };
    const exports: { POST?: (request: Request) => Promise<Response> } = {};
    runInNewContext(code, {
      exports, Request, Response, URL, console: { error() {} },
      require: (name: string) => {
        if (!(name in dependencies)) throw new Error(`Uncontrolled route dependency: ${name}`);
        return dependencies[name];
      },
    });
    return exports.POST!;
  };
  const routes = { tool: load("tool"), turn: load("turn") };
  const request = (route: "tool" | "turn", body: unknown) => routes[route](new Request(`https://fixture.invalid/api/voice/realtime/${route}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  return { request, persisted, dispatched };
}

const toolBody = {
  name: "ask_homa", args: { request: "model paraphrase" }, sessionId: "voice-client",
  sourceSequence: 0, sourceText: "Read Avery's planner today.",
};

test("actual controller payload reaches cookie-authenticated route with exact source provenance", async () => {
  const f = fixture();
  const session = new WebVoiceSession("voice-client", {
    fetch: (async (url, init) => f.request(String(url).endsWith("/tool") ? "tool" : "turn", JSON.parse(String(init?.body)))) as typeof fetch,
    onTurn() {}, onError(message) { assert.fail(message); },
  });
  session.receive({ type: "audio-committed", itemId: "u1", raw: {} });
  session.receive({ type: "response-created", responseId: "r1", raw: {} });
  session.receive({ type: "function-call-arguments-done", responseId: "r1", itemId: "t1", callId: "c1", name: "ask_homa", arguments: JSON.stringify(toolBody.args), raw: {} });
  const result = session.runTool({ toolCallId: "c1", toolName: "ask_homa", args: toolBody.args });
  session.receive({ type: "input-transcription-completed", itemId: "u1", transcript: toolBody.sourceText, raw: {} });
  assert.equal((await result).ok, true);
  await session.finish();
  assert.equal(f.dispatched.length, 1);
  assert.equal(f.dispatched[0].message, toolBody.sourceText);
  assert.equal(f.dispatched[0].sourceMessageId, "source-message-fixture");
  assert.equal(f.dispatched[0].accessToken, "fixture-cookie-jwt");
  assert.equal(f.persisted.length, 2, "tool and transcript share the same canonical source key");
  assert.equal(f.persisted[0].sessionId, f.persisted[1].sessionId);
  assert.equal(f.persisted[0].turnId, f.persisted[1].turnId);
  assert.deepEqual(f.persisted[0].attributes, { familyId: "family-a", memberUserId: "parent-a" });
});

test("identical client session IDs cannot collide across families or adults", async () => {
  const identities = new Set();
  for (const options of [{ familyId: "a", userId: "one" }, { familyId: "a", userId: "two" }, { familyId: "b", userId: "one" }]) {
    const f = fixture(options);
    await f.request("tool", { ...toolBody, familyId: "attacker-choice" });
    await f.request("turn", { sessionId: "voice-client", sequence: 0, role: "user", content: toolBody.sourceText });
    assert.equal(f.persisted[0].sessionId, f.persisted[1].sessionId);
    identities.add(f.persisted[0].sessionId);
    assert.deepEqual(f.persisted[0].attributes, { familyId: options.familyId, memberUserId: options.userId });
  }
  assert.equal(identities.size, 3);
});

test("missing or malformed source identity never persists or dispatches", async () => {
  for (const body of [null, [], {}, { ...toolBody, sessionId: "" }, { ...toolBody, sessionId: " " },
    { ...toolBody, sessionId: "a".repeat(121) }, { ...toolBody, sourceSequence: -1 },
    { ...toolBody, sourceSequence: 0.5 }, { ...toolBody, sourceSequence: 2 ** 32 },
    { ...toolBody, sourceText: "a".repeat(8001) }, { ...toolBody, name: "arbitrary_tool" }]) {
    const f = fixture();
    assert.equal((await (await f.request("tool", body)).json()).ok, false);
    assert.equal(f.persisted.length, 0);
    assert.equal(f.dispatched.length, 0);
  }
});

test("no authentication and failed source persistence cannot reach Homa", async () => {
  for (const options of [{ authenticated: false }, { persist: "throw" as const }, { persist: "null" as const }]) {
    const f = fixture(options);
    const response = await f.request("tool", toolBody);
    assert.equal((await response.json()).ok, false);
    assert.equal(f.dispatched.length, 0);
  }
});

test("transcript endpoint validates identity and reports a missing persistence receipt", async () => {
  for (const body of [null, [], { sessionId: "voice-client", sequence: 1.2, role: "assistant", content: "Hello" },
    { sessionId: "a".repeat(121), sequence: 0, role: "user", content: "Hello" }]) {
    const f = fixture();
    assert.equal((await f.request("turn", body)).status, 400);
    assert.equal(f.persisted.length, 0);
  }
  const f = fixture({ persist: "null" });
  const response = await f.request("turn", { sessionId: "voice-client", sequence: 0, role: "user", content: "Hello" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, false);
});
