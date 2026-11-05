import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as client from "./conversation-feed-client";
import type { ConversationFeedChanges, ConversationFeedMaterials, ConversationFeedPage } from "../../lib/conversation-feed";
import type { useConversationFeed } from "./use-conversation-feed";

type Session = { user: { id: string }; access_token: string } | null;
function pageValue(account = "family:adult", id = "message"): ConversationFeedPage {
  return { account, conversationId: "conversation", accessEpoch: "epoch", mode: "snapshot", messages: [{ id, content: id,
    sessionId: "session", turnId: "turn", role: "assistant", channel: "web", modality: "text", atMs: 1,
    createdAt: "2026-09-12T12:00:00.000001Z", historyCursor: `history-${id}`, recordingPosition: null, responseComplete: true, request: null, question: null }],
  materials: [], requests: [], requestsTruncated: false, changeCursor: "changes-1", nextCursor: null, hasOlder: false };
}
function changesValue(account = "family:adult"): ConversationFeedChanges {
  return { account, conversationId: "conversation", accessEpoch: "epoch", mode: "changes", changes: [],
    nextChangeCursor: "changes-2", hasMore: false, materials: [], materialSessions: [], requests: [], requestsTruncated: false };
}
type Input = Parameters<typeof client.fetchConversationFeedPage>[0] & { after?: string; messageIds?: string[] };

function mount() {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = []; let index = 0;
  let effects: (() => void)[] = [];
  let session: Session = { user: { id: "adult" }, access_token: "token" };
  let auth: ((event: string, session: Session) => void) | undefined;
  let poll: (() => void) | undefined;
  const document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  let load: (input: Input) => Promise<ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials> = async input => input.after ? changesValue(input.account) : pageValue(input.account);
  const requests: Input[] = [];
  const react = {
    useState(initial: unknown) {
      const slot = slots[index++] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slot.value, (value: unknown) => { slot.value = typeof value === "function" ? value(slot.value) : value; }];
    },
    useRef(current: unknown) { return (slots[index++] ??= { value: { current } }).value; },
    useCallback(callback: unknown) { return callback; },
    useEffect(effect: () => (() => void) | undefined, deps: unknown[]) {
      const slot = slots[index++] ??= {};
      if (!slot.deps || deps.some((value, i) => value !== slot.deps![i])) {
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); }); slot.deps = deps;
      }
    },
  };
  const exports = {} as { useConversationFeed: typeof useConversationFeed };
  const code = ts.transpileModule(readFileSync(new URL("./use-conversation-feed.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, AbortController, AbortSignal, queueMicrotask, document,
    window: { setInterval(callback: () => void) { poll = callback; return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    require(name: string) {
      if (name === "react") return react;
      if (name === "./conversation-feed-client") {
        const fetchFeed = async (input: Input) => { requests.push(input); return load(input); };
        return { ...client, fetchConversationFeedPage: fetchFeed, fetchConversationFeedChanges: fetchFeed, fetchConversationFeedMaterials: fetchFeed };
      }
      if (name.endsWith("supabase/client")) return { createSupabaseBrowserClient: () => ({ auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange(callback: typeof auth) { auth = callback; return { data: { subscription: { unsubscribe() { auth = undefined; } } } }; },
      } }) };
      throw new Error(name);
    },
  });
  const render = (account: string | null = "family:adult", runEffects = true) => {
    index = 0; const value = exports.useConversationFeed(account, true);
    if (runEffects) { const pending = effects; effects = []; for (const effect of pending) effect(); }
    return value;
  };
  return { render, requests, document, poll: () => poll?.(), setLoad(next: typeof load) { load = next; },
    changeAuth(event: string, next: Session) { session = next; auth?.(event, next); },
    unmount() { for (const slot of slots) slot.cleanup?.(); } };
}

test("account prop switches hide previous adult's messages before effects run", async () => {
  const f = mount(); f.render(); await setImmediate();
  assert.equal(f.render().messages.length, 1);
  assert.equal(f.render("family:other", false).messages.length, 0);
  f.unmount();
});

test("logout clears mounted history immediately and late network results cannot restore it", async () => {
  const f = mount(); f.render(); await setImmediate();
  let finish!: (value: ConversationFeedChanges) => void;
  f.setLoad(() => new Promise(resolve => { finish = resolve; }));
  const refresh = f.render().refresh(); await setImmediate();
  f.changeAuth("SIGNED_OUT", null);
  assert.equal(f.render().messages.length, 0); assert.equal(f.render().accountActive, false);
  finish(changesValue()); await refresh;
  assert.equal(f.render().messages.length, 0);
  f.unmount();
});

test("same-account transient refresh failure preserves visible history", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.setLoad(async () => { throw new Error("offline"); });
  await f.render().refresh();
  assert.equal(f.render().messages.length, 1); assert.match(f.render().error!, /could not refresh/);
  f.unmount();
});

test("hidden pages do not poll; visible polling refreshes again", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.document.visibilityState = "hidden"; const count = f.requests.length;
  f.poll(); await setImmediate(); assert.equal(f.requests.length, count);
  f.document.visibilityState = "visible"; f.poll(); await setImmediate(); assert.equal(f.requests.length, count + 1);
  f.unmount();
});

test("a different authenticated user never requests the old account's feed", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.changeAuth("SIGNED_IN", { user: { id: "other" }, access_token: "other-token" });
  const count = f.requests.length; await f.render().refresh();
  assert.equal(f.requests.length, count); assert.equal(f.render().messages.length, 0);
  f.unmount();
});

test("polling requests only changes after the committed cursor, never the older window", async () => {
  const f = mount();
  f.setLoad(async input => input.after ? { ...changesValue(), nextChangeCursor: "changes-3" }
    : { ...pageValue(), hasOlder: true, nextCursor: "history-first" });
  f.render(); await setImmediate();
  await f.render().loadOlder();
  assert.equal(f.requests.at(-1)!.before, "history-first");
  await f.render().refresh();
  assert.equal(f.requests.at(-1)!.after, "changes-1");
  assert.equal(f.requests.at(-1)!.before, undefined);
  await f.render().refresh();
  assert.equal(f.requests.at(-1)!.after, "changes-3");
  assert.equal(f.requests.filter(request => !request.after).length, 2);
  f.unmount();
});

test("successful delta batches remain committed when the next batch fails", async () => {
  const f = mount(); f.render(); await setImmediate();
  let count = 0;
  f.setLoad(async () => {
    if (++count === 1) return { ...changesValue(), nextChangeCursor: "changes-10", hasMore: true,
      changes: [{ kind: "upsert", message: { ...pageValue().messages[0]!, content: "Committed partial" } }] };
    throw new Error("network interrupted");
  });
  await f.render().refresh();
  assert.equal(f.render().messages[0]!.content, "Committed partial");
  assert.match(f.render().error!, /could not refresh/);
  f.setLoad(async () => changesValue()); await f.render().refresh();
  assert.equal(f.requests.at(-1)!.after, "changes-10");
  f.unmount();
});

test("explicit newest jump waits for in-flight updates, then replaces the older window", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.render().setFollowingNewest(false);
  let finish!: (value: ConversationFeedChanges) => void;
  f.setLoad(input => input.after ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(pageValue("family:adult", "latest")));
  const refresh = f.render().refresh(); await setImmediate();
  const jump = f.render().jumpToNewest();
  assert.equal(f.render().followingNewest, false);
  finish(changesValue()); await refresh; await jump;
  assert.equal(f.render().messages[0]!.id, "latest"); assert.equal(f.render().followingNewest, true);
  assert.equal(f.requests.at(-1)!.after, undefined); assert.equal(f.requests.at(-1)!.before, undefined);
  f.unmount();
});

test("expired access epoch clears and bootstraps a fresh latest snapshot", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.setLoad(async input => {
    if (input.after) throw new client.ConversationFeedCursorExpired("epoch replaced");
    return { ...pageValue("family:adult", "new epoch message"), accessEpoch: "epoch-2" };
  });
  await f.render().refresh();
  assert.equal(f.render().accessEpoch, "epoch-2"); assert.equal(f.render().messages[0]!.id, "new epoch message");
  f.unmount();
});


test("artifact retry is independent of the text cursor and requests only retained message IDs", async () => {
  const f = mount();
  f.setLoad(async input => {
    if (input.messageIds) return { mode: "materials", account: "family:adult", conversationId: "conversation", accessEpoch: "epoch",
      requestedMessageIds: input.messageIds, materialSessions: ["session"], materials: [] };
    if (input.after) return { ...changesValue(), nextChangeCursor: "changes-9" };
    return { ...pageValue(), materialsUnavailable: true };
  });
  f.render(); await setImmediate();
  assert.equal(f.render().materialsUnavailable, true);
  await f.render().refresh();
  assert.deepEqual(f.requests.at(-1)!.messageIds, ["message"]);
  assert.equal(f.render().materialsUnavailable, false);
  await f.render().refresh();
  assert.equal(f.requests.at(-1)!.after, "changes-9");
  assert.equal(f.requests.filter(request => request.messageIds).length, 1);
  f.unmount();
});
