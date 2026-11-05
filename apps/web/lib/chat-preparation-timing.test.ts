import assert from "node:assert/strict";
import { test } from "node:test";

import timingHook from "../agent/hooks/preparation-timing";
import { persistConversationMessage, type PersistConversationMessageDependencies } from "./conversation-log";
import { embedText } from "./learning/embeddings";
import { markChatPreparation, measureChatPreparation } from "./observability/chat-preparation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const userMessage = {
  attributes: { familyId: "private-family", episodeId: "private-episode", token: "private-token" },
  sessionId: "session-timing",
  channelKind: "web",
  sequence: 2,
  role: "user" as const,
  content: "private parent message",
  turnId: "turn-timing",
};

const persisted = { id: "private-message-id", episodeId: "private-episode", replyClaimed: false, content: userMessage.content };

test("timing whitelists correlation fields and keeps absolute start time without serializing payloads", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const metadata = {
    turnId: "turn-timing", role: "user" as const, sequence: 2, stepIndex: 0,
    familyId: "private-family", token: "private-token", content: "private-text",
    get auth() { throw new Error("must not read auth"); },
  };
  const before = Date.now();
  const result = { content: "private-result" };
  assert.equal(await measureChatPreparation("canonical_persistence", async () => result, "session-timing", metadata), result);
  const record = JSON.parse(logs[0][1] as string);
  assert.ok(record.startedAtMs >= before && record.startedAtMs <= Date.now());
  assert.ok(record.durationMs >= 0);
  assert.deepEqual(Object.keys(record).sort(), [
    "durationMs", "outcome", "role", "sequence", "sessionId", "stage", "startedAtMs", "stepIndex", "turnId",
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /private-|auth|token|content/);
  t.mock.method(console, "info", () => { throw new Error("logger failed"); });
  markChatPreparation("agent_step_started", "session-timing", metadata);
  const failure = new Error("original failure");
  await assert.rejects(measureChatPreparation("canonical_persistence", async () => { throw failure; }), (error) => error === failure);
});

test("user timing saves canonical text before indexing and awaits the vector update", { timeout: 5000 }, async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const embedding = deferred<string>();
  const canonical = deferred<typeof persisted>();
  const vector = deferred<void>();
  const enteredEmbedding = deferred<void>();
  const enteredCanonical = deferred<void>();
  const enteredVector = deferred<void>();
  const calls: string[] = [];
  let finished = false;
  const dependencies: PersistConversationMessageDependencies = {
    resolveInbound: async () => { throw new Error("existing episode must be reused"); },
    embed: async (_text, attribution) => {
      calls.push("embedding");
      assert.deepEqual(attribution.preparationTrace, {
        sessionId: userMessage.sessionId, turnId: userMessage.turnId, role: "user", sequence: 2,
      });
      enteredEmbedding.resolve();
      return embedding.promise;
    },
    persistCanonical: async () => {
      calls.push("canonical");
      enteredCanonical.resolve();
      return canonical.promise;
    },
    saveEmbedding: async (id, value, content, replaceExisting) => {
      calls.push("vector");
      assert.deepEqual([id, value, content, replaceExisting], [persisted.id, "private-vector", userMessage.content, false]);
      enteredVector.resolve();
      await vector.promise;
    },
  };
  const result = persistConversationMessage(userMessage, dependencies).then((value) => { finished = true; return value; });
  await enteredCanonical.promise;
  assert.deepEqual(calls, ["canonical"]);
  assert.equal(finished, false);
  canonical.resolve(persisted);
  await enteredEmbedding.promise;
  assert.deepEqual(calls, ["canonical", "embedding"]);
  assert.equal(finished, false);
  embedding.resolve("private-vector");
  await enteredVector.promise;
  assert.equal(finished, false);
  vector.resolve();
  assert.equal(await result, persisted);
  assert.deepEqual(calls, ["canonical", "embedding", "vector"]);
  assert.deepEqual(logs.map((row) => JSON.parse(row[1] as string).stage), [
    "canonical_persistence", "embedding_total", "embedding_update", "user_persistence",
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /private-/);
});

test("canonical failure aborts before indexing or vector updates", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const failure = new Error("private canonical failure");
  await assert.rejects(persistConversationMessage(userMessage, {
    resolveInbound: async () => { throw new Error("unexpected continuity read"); },
    embed: async () => { assert.fail("indexing must not run before the canonical write"); },
    persistCanonical: async () => { throw failure; },
    saveEmbedding: async () => { assert.fail("vector write must not run"); },
  }), (error) => error === failure);
  const records = logs.map((row) => JSON.parse(row[1] as string));
  assert.deepEqual(records.map((row) => [row.stage, row.outcome]), [
    ["canonical_persistence", "error"], ["user_persistence", "error"],
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /private-/);
});

test("embedding timing preserves provider settings and awaits its usage write", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const usage = deferred<void>();
  const enteredUsage = deferred<void>();
  let finished = false;
  const result = embedText("private input", {
    familyId: "private-family",
    preparationTrace: { sessionId: "session-timing", turnId: "turn-timing", role: "user" },
  }, {
    embed: async (options) => {
      assert.equal(options.value, "private input");
      assert.equal(options.maxRetries, 1);
      assert.equal(options.abortSignal, undefined);
      return { value: options.value, embedding: Array.from({ length: 1536 }, () => 0), usage: { tokens: 2 }, warnings: [] };
    },
    recordModelUsage: async (row) => {
      assert.equal(row.familyId, "private-family");
      enteredUsage.resolve();
      await usage.promise;
    },
  }).then((value) => { finished = true; return value; });
  await enteredUsage.promise;
  assert.equal(finished, false);
  usage.resolve();
  assert.equal((await result)?.split(",").length, 1536);
  assert.deepEqual(logs.map((row) => JSON.parse(row[1] as string).stage), ["embedding_provider", "embedding_usage"]);
  assert.doesNotMatch(JSON.stringify(logs), /private-|0,0,0/);
});

test("ordinary stream hooks mark the step and each text block's first nonempty append without content", (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const context = { session: { id: "session-timing" } } as Parameters<typeof timingHook.events["step.started"]>[1];
  const step = { turnId: "turn-timing", sequence: 2, stepIndex: 0 };
  timingHook.events["step.started"]({ type: "step.started", data: step }, context);
  for (const [messageDelta, messageSoFar] of [
    ["", ""], ["private first", "private first"], [" second", "private first second"],
  ]) {
    timingHook.events["message.appended"]({ type: "message.appended", data: { ...step, messageDelta, messageSoFar } }, context);
  }
  assert.deepEqual(logs.map((row) => JSON.parse(row[1] as string).stage), ["agent_step_started", "first_message_appended"]);
  assert.doesNotMatch(JSON.stringify(logs), /private|messageDelta|messageSoFar/);
});

test("embedding provider failure still returns the FTS fallback and records no usage", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "error", () => {});
  assert.equal(await embedText("private input", {
    familyId: "private-family",
    preparationTrace: { sessionId: "session-timing", turnId: "turn-timing", role: "user" },
  }, {
    embed: async () => { throw new Error("private provider error"); },
    recordModelUsage: async () => { assert.fail("failed embedding has no usage write"); },
  }), null);
  assert.deepEqual(logs.map((row) => {
    const record = JSON.parse(row[1] as string);
    return [record.stage, record.outcome];
  }), [["embedding_provider", "error"]]);
  assert.doesNotMatch(JSON.stringify(logs), /private/);
});
