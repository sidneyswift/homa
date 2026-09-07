import assert from "node:assert/strict";
import { test } from "node:test";

import { loadJournalConversationContext, verifiedJournalPredecessor, type JournalContextRequest } from "./journal-context";

const request: JournalContextRequest = {
  familyId: "00000000-0000-4000-8000-000000000001",
  memberUserId: "00000000-0000-4000-8000-000000000002",
  runtimeSessionId: "context-test-session",
  inboundMessageId: "00000000-0000-4000-8000-000000000003",
  message: "She can do all of that.",
  channel: "web",
};
const row = {
  id: "00000000-0000-4000-8000-000000000004", role: "assistant", visibility: "family",
  member_user_id: request.memberUserId, channel: "web", content: "Can Maya cut a straight line?",
  created_at: "2026-09-05T12:00:00.000Z", delivered_to_actor: false,
};

test("accepts only the immediate visible assistant with complete actor and channel binding", () => {
  assert.deepEqual(verifiedJournalPredecessor([row], request), {messageId: row.id, text: row.content, createdAt: row.created_at});
  for (const patch of [
    {role: "user"}, {visibility: "internal"}, {member_user_id: null},
    {member_user_id: "00000000-0000-4000-8000-000000000005"}, {channel: "sms"},
    {id: "invented"}, {content: "  "}, {created_at: "invalid"},
  ]) assert.equal(verifiedJournalPredecessor([{...row, ...patch}, {...row, created_at: "2026-09-04T12:00:00.000Z"}], request), null);
  assert.equal(verifiedJournalPredecessor([], request), null);
});

test("ties and overlong context refuse rather than silently choosing or truncating meaning", () => {
  assert.equal(verifiedJournalPredecessor([row, {...row, id: request.inboundMessageId}], request), null);
  assert.equal(verifiedJournalPredecessor([row, row, row], request), null);
  assert.ok(verifiedJournalPredecessor([{...row, content: "🙂".repeat(2_000)}], request));
  assert.equal(verifiedJournalPredecessor([{...row, content: "🙂".repeat(2_001)}], request), null);
});

test("SMS and email context require actual sent delivery to the current actor", () => {
  for (const channel of ["sms", "email"] as const) {
    assert.equal(verifiedJournalPredecessor([{...row, channel}], {...request, channel}), null);
    assert.ok(verifiedJournalPredecessor([{...row, channel, delivered_to_actor: true}], {...request, channel}));
  }
});

test("invalid identity never reaches the database", async () => {
  let calls = 0;
  const database = (async () => { calls += 1; return [row]; }) as unknown as NonNullable<Parameters<typeof loadJournalConversationContext>[1]>;
  for (const patch of [
    {familyId: "invalid"}, {memberUserId: null}, {inboundMessageId: "invalid"},
    {runtimeSessionId: ""}, {runtimeSessionId: "x".repeat(201)}, {message: ""},
    {message: "🙂".repeat(8_001)},
  ]) assert.equal(await loadJournalConversationContext({...request, ...patch}, database), null);
  assert.equal(calls, 0);
});

test("one parameterized current-message-bound read; optional lookup failure returns no context", async () => {
  const captured: {text: string; values: unknown[]}[] = [];
  const database = (async (chunks: TemplateStringsArray, ...values: unknown[]) => {
    captured.push({text: chunks.join("?"), values});
    return [row];
  }) as unknown as NonNullable<Parameters<typeof loadJournalConversationContext>[1]>;
  assert.equal((await loadJournalConversationContext(request, database))?.messageId, row.id);
  assert.equal(captured.length, 1);
  assert.ok(captured[0].values.includes(request.message));
  assert.ok(captured[0].values.includes(request.inboundMessageId));
  assert.ok(captured[0].values.includes(request.memberUserId));
  assert.ok(captured[0].values.includes(request.familyId));
  assert.ok(captured[0].values.includes(request.runtimeSessionId));
  assert.ok(!captured[0].text.includes(request.message));
  const unavailable = (async () => { throw new Error("unavailable"); }) as unknown as typeof database;
  assert.equal(await loadJournalConversationContext(request, unavailable), null);
});

test("a stalled optional context read is cancelled and becomes no context", async () => {
  let cancelled = false;
  const pending = Object.assign(new Promise<never>(() => {}), {cancel() { cancelled = true; }});
  const database = (() => pending) as unknown as NonNullable<Parameters<typeof loadJournalConversationContext>[1]>;
  assert.equal(await loadJournalConversationContext(request, database), null);
  assert.equal(cancelled, true);
});
