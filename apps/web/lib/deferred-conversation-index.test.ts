import assert from "node:assert/strict";
import { it } from "node:test";

import { persistConversationMessage } from "./conversation-log";
import {
  deferredConversationIndexEnabled,
  drainConversationIndexes,
} from "./deferred-conversation-index";

it("requires an explicit preview switch and stays off in production", () => {
  for (const VERCEL_ENV of [undefined, "development", "production"]) {
    assert.equal(deferredConversationIndexEnabled({ VERCEL_ENV, HOMA_PREVIEW_DEFER_USER_INDEX: "1" }), false);
  }
  assert.equal(deferredConversationIndexEnabled({ VERCEL_ENV: "preview" }), false);
  assert.equal(deferredConversationIndexEnabled({ VERCEL_ENV: "preview", HOMA_PREVIEW_DEFER_USER_INDEX: "1" }), true);
});

it("waits for canonical storage while making no embedding call on the experimental user path", async () => {
  const gate = Promise.withResolvers<void>();
  let resolved = false;
  let canonicalStarted = false;
  const operation = persistConversationMessage({
    attributes: { familyId: "family-a", episodeId: "episode-a" },
    sessionId: "session-a", channelKind: "web", sequence: 0,
    role: "user", content: "Please save my exact words.", turnId: "turn-a",
    deferUserEmbedding: true,
  }, {
    resolveInbound: async () => { throw new Error("episode already resolved"); },
    persistCanonical: async (input) => {
      canonicalStarted = true;
      await gate.promise;
      return { id: "message-a", episodeId: "episode-a", content: input.content, replyClaimed: false };
    },
    embed: async () => { throw new Error("must not embed before answer"); },
    saveEmbedding: async () => { throw new Error("must not update before answer"); },
  }).then(value => { resolved = true; return value; });
  await Promise.resolve();
  assert.equal(canonicalStarted, true);
  assert.equal(resolved, false);
  gate.resolve();
  assert.equal((await operation)?.content, "Please save my exact words.");
});

it("canonical failure still aborts the experimental user path", async () => {
  await assert.rejects(persistConversationMessage({
    attributes: { familyId: "family-a", episodeId: "episode-a" },
    sessionId: "session-a", channelKind: "web", sequence: 0,
    role: "user", content: "Save this.", turnId: "turn-a", deferUserEmbedding: true,
  }, {
    resolveInbound: async () => { throw new Error("unexpected resolution"); },
    persistCanonical: async () => { throw new Error("canonical unavailable"); },
    embed: async () => { throw new Error("unexpected embedding"); },
    saveEmbedding: async () => undefined,
  }), /canonical unavailable/);
});

it("retries missed indexing from saved rows and preserves family and exact-content guards", async () => {
  const remaining = new Map([["message-a", "Saved before interruption."], ["message-b", "Next user message."]]);
  const writes: unknown[] = [];
  let failFirst = true;
  const scope = { familyId: "family-a", sessionId: "session-a" };
  const dependencies = {
    pending: async (input: typeof scope) => {
      assert.deepEqual(input, scope);
      return [...remaining].map(([id, content]) => ({ id, content }));
    },
    embed: async (content: string, attribution?: { familyId: string | null; signal?: AbortSignal }) => {
      assert.equal(attribution?.familyId, scope.familyId);
      assert.ok(attribution?.signal instanceof AbortSignal);
      if (failFirst && content === remaining.get("message-a")) return null;
      return "vector";
    },
    save: async (input: { familyId: string; messageId: string; embedding: string; sourceContent: string; replaceExisting: boolean }) => {
      assert.equal(input.familyId, scope.familyId);
      assert.equal(input.sourceContent, remaining.get(input.messageId));
      assert.equal(input.replaceExisting, false);
      writes.push(input);
      remaining.delete(input.messageId);
    },
  };
  await drainConversationIndexes(scope, dependencies);
  assert.deepEqual([...remaining.keys()], ["message-a"]);
  failFirst = false;
  await drainConversationIndexes(scope, dependencies);
  assert.equal(remaining.size, 0);
  await drainConversationIndexes(scope, dependencies);
  assert.equal(writes.length, 2);
});
