import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConversationFeedChanges, ConversationFeedMessage, ConversationFeedPage } from "../../lib/conversation-feed";
import { applyConversationFeedChanges, applyConversationFeedMaterials, ConversationFeedAccessChanged, ConversationFeedCursorExpired,
  createConversationFeedWindow, extendConversationFeedWindow, fetchConversationFeedChanges, fetchConversationFeedPage } from "./conversation-feed-client";

const account = "family:adult";
function message(n: number, content = `message ${n}`): ConversationFeedMessage {
  return { id: `id-${n.toString().padStart(6, "0")}`, content, sessionId: "session", turnId: "turn", role: "assistant", channel: "web",
    modality: "text", atMs: n, createdAt: `2026-09-12T12:00:00.${n.toString().padStart(6, "0")}Z`,
    historyCursor: `history-${n}`, recordingPosition: null, responseComplete: true, request: null, question: null };
}
function page(start = 50, count = 50, cursor = "changes-1"): ConversationFeedPage {
  return { account, conversationId: "conversation", accessEpoch: "epoch", mode: "snapshot",
    messages: Array.from({ length: count }, (_, i) => message(start + i)), materials: [], requests: [], requestsTruncated: false,
    changeCursor: cursor, nextCursor: start > 0 ? `history-${start}` : null, hasOlder: start > 0 };
}
function delta(changes: ConversationFeedChanges["changes"], nextChangeCursor = "changes-2"): ConversationFeedChanges {
  return { account, conversationId: "conversation", accessEpoch: "epoch", mode: "changes", changes,
    nextChangeCursor, hasMore: false, materials: [], materialSessions: [], requests: [], requestsTruncated: false };
}
const input = () => ({ account, accessToken: "exact-token", signal: new AbortController().signal });
const serve = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;

test("snapshot and changes use exact bearer, omit cookies, and scoped server cursors", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const send = (async (url, options) => { calls.push({ url: String(url), options: options! }); return Response.json(calls.length === 1 ? page() : delta([])); }) as typeof fetch;
  await fetchConversationFeedPage({ ...input(), before: "history-100", accessEpoch: "epoch", fetch: send });
  await fetchConversationFeedChanges({ ...input(), after: "changes-1", accessEpoch: "epoch", fetch: send });
  for (const call of calls) {
    assert.equal(call.options.credentials, "omit"); assert.equal(call.options.cache, "no-store");
    assert.equal(new Headers(call.options.headers).get("authorization"), "Bearer exact-token");
    assert.equal(new URL(call.url, "https://homa.test").searchParams.get("accessEpoch"), "epoch");
  }
  assert.match(calls[0]!.url, /before=history-100/); assert.match(calls[1]!.url, /after=changes-1/);
});

test("older history remains reachable after crossing the 500-message display window", () => {
  let window = createConversationFeedWindow(page(1000));
  for (let start = 950; start >= 0; start -= 50) {
    const previousChangeCursor = window.changeCursor;
    window = extendConversationFeedWindow(window, page(start, 50, `snapshot-at-${start}`));
    assert.equal(window.messages[0]!.historyCursor, `history-${start}`);
    assert.equal(window.hasOlder, start > 0);
    assert.equal(window.changeCursor, previousChangeCursor, "older snapshot must not skip unseen changes");
    assert.ok(window.messages.length <= 500);
  }
  assert.equal(window.messages.length, 500); assert.equal(window.hasNewer, true); assert.equal(window.followingNewest, false);
});

test("old reading stays anchored while new messages arrive, and in-window partials update", () => {
  let window = extendConversationFeedWindow(createConversationFeedWindow(page(50)), page(0));
  window = applyConversationFeedChanges(window, delta([{ kind: "upsert", message: message(100) },
    { kind: "upsert", message: message(25, "The complete response") }]));
  assert.equal(window.messages[0]!.id, message(0).id); assert.equal(window.messages.at(-1)!.id, message(99).id);
  assert.equal(window.messages.find(row => row.id === message(25).id)!.content, "The complete response");
  assert.equal(window.hasNewer, true); assert.equal(window.changeCursor, "changes-2");
  const newest = createConversationFeedWindow(page(51, 50, "changes-3"));
  assert.equal(newest.messages.at(-1)!.id, message(100).id); assert.equal(newest.hasNewer, false); assert.equal(newest.followingNewest, true);
});

test("deletions remove loaded old messages without refetching pages; identical text is not identity", () => {
  const window = createConversationFeedWindow(page(0));
  const next = applyConversationFeedChanges(window, delta([{ kind: "delete", messageId: message(20).id },
    { kind: "upsert", message: message(50, message(49).content) }]));
  assert.equal(next.messages.some(row => row.id === message(20).id), false);
  assert.equal(next.messages.filter(row => row.content === message(49).content).length, 2);
});

test("latest following trims oldest rows with a cursor that can recover them", () => {
  let window = createConversationFeedWindow(page(450));
  for (let start = 400; start >= 0; start -= 50) window = extendConversationFeedWindow(window, page(start));
  window = { ...window, followingNewest: true };
  const next = applyConversationFeedChanges(window, delta([{ kind: "upsert", message: message(500) }]));
  assert.equal(next.messages.length, 500); assert.equal(next.beforeCursor, "history-1"); assert.equal(next.hasOlder, true);
  assert.equal(extendConversationFeedWindow(next, page(0, 1)).messages[0]!.id, message(0).id);
});

test("deleting every displayed row preserves the older keyset boundary", () => {
  const window = createConversationFeedWindow(page(50));
  const next = applyConversationFeedChanges(window, delta(window.messages.map(row => ({ kind: "delete", messageId: row.id }))));
  assert.equal(next.messages.length, 0); assert.equal(next.beforeCursor, "history-50"); assert.equal(next.hasOlder, true);
  assert.equal(extendConversationFeedWindow(next, page(0)).messages.length, 50);
});

test("material session invalidations remove deleted materials but transient errors preserve them", () => {
  const material = { id: "material", sessionId: "session" } as ConversationFeedPage["materials"][number];
  const window = { ...createConversationFeedWindow(page()), materials: [material] };
  const failed = applyConversationFeedChanges(window, { ...delta([]), materialSessions: ["session"], materialsUnavailable: true });
  assert.equal(failed.materials.length, 1); assert.equal(failed.materialsUnavailable, true);
  assert.equal(failed.changeCursor, "changes-2", "artifact failures cannot block later text");
  assert.equal(failed.pendingMaterialMessageIds.length, window.messages.length);
  const healthy = applyConversationFeedChanges(failed, { ...delta([]), materialSessions: ["session"] });
  assert.equal(healthy.materials.length, 0); assert.equal(healthy.materialsUnavailable, false);
});

test("account and epoch changes never merge private windows", async () => {
  const window = createConversationFeedWindow(page());
  assert.throws(() => applyConversationFeedChanges(window, { ...delta([]), account: "other" }), ConversationFeedAccessChanged);
  assert.throws(() => extendConversationFeedWindow(window, { ...page(), accessEpoch: "new-epoch" }), ConversationFeedCursorExpired);
  await assert.rejects(fetchConversationFeedPage({ ...input(), fetch: serve({ ...page(), account: "other" }) }), ConversationFeedAccessChanged);
  await assert.rejects(fetchConversationFeedChanges({ ...input(), after: "c", accessEpoch: "epoch", fetch: serve({ ...delta([]), accessEpoch: "new" }) }), ConversationFeedCursorExpired);
});

test("failed requests and malformed/nonadvancing cursors cannot advance committed state", async () => {
  await assert.rejects(fetchConversationFeedChanges({ ...input(), after: "changes-2", accessEpoch: "epoch", fetch: serve({ ...delta([]), hasMore: true }) }), /did not advance/);
  await assert.rejects(fetchConversationFeedPage({ ...input(), before: "history-50", accessEpoch: "epoch", fetch: serve(page()) }), /did not advance/);
  await assert.rejects(fetchConversationFeedPage({ ...input(), fetch: serve({ ...page(), messages: [{}] }) }), /Invalid/);
  for (const status of [401, 403]) await assert.rejects(fetchConversationFeedPage({ ...input(), fetch: serve({}, status) }), ConversationFeedAccessChanged);
  for (const status of [409, 410]) await assert.rejects(fetchConversationFeedPage({ ...input(), fetch: serve({}, status) }), ConversationFeedCursorExpired);
});

test("late aborted request cannot publish a snapshot", async () => {
  const controller = new AbortController(); controller.abort(new Error("left page"));
  await assert.rejects(fetchConversationFeedPage({ ...input(), signal: controller.signal, fetch: serve(page()) }), /left page/);
});


test("snapshot artifact failure retries exact owned message IDs independently of later text", () => {
  let window = createConversationFeedWindow({ ...page(), materialsUnavailable: true });
  assert.equal(window.pendingMaterialMessageIds.length, 50);
  window = applyConversationFeedChanges(window, delta([{ kind: "upsert", message: message(100) }], "changes-9"));
  assert.equal(window.messages.at(-1)!.id, message(100).id);
  assert.equal(window.changeCursor, "changes-9"); assert.equal(window.materialsUnavailable, true);
  const recovered = applyConversationFeedMaterials(window, { mode: "materials", account, conversationId: "conversation", accessEpoch: "epoch",
    materials: [], materialSessions: ["session"], requestedMessageIds: window.pendingMaterialMessageIds });
  assert.equal(recovered.materialsUnavailable, false); assert.equal(recovered.pendingMaterialMessageIds.length, 0);
  assert.equal(recovered.changeCursor, "changes-9");
});
