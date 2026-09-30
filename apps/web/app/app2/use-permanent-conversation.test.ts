import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as outbox from "./conversation-outbox";
import type { usePermanentConversationDelivery } from "./use-permanent-conversation";

const adult = "00000000-0000-4000-8000-000000000001", family = "00000000-0000-4000-8000-000000000002";
const account = `${family}:${adult}`, epoch = "00000000-0000-4000-8000-000000000003";
const intentId = "00000000-0000-4000-8000-000000000004";
const requestId = "00000000-0000-4000-8000-000000000005", messageId = "00000000-0000-4000-8000-000000000006";
const attachmentId = "00000000-0000-4000-8000-000000000007";
const entry = (): outbox.PendingConversationIntent => ({ account, accessEpoch: epoch, intentId, text: "My exact words", submittedAt: 1 });
type Session = { user: { id: string }; access_token: string } | null;
function mount(initialEntries: outbox.PendingConversationIntent[] = []) {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = []; let index = 0, effects: (() => void)[] = [];
  let session: Session = { user: { id: adult }, access_token: "exact-token" };
  let auth: ((event: string, session: Session) => void) | undefined;
  let poll: (() => void) | undefined;
  const entries = [...initialEntries], accepted: outbox.PendingConversationIntent[] = [], prepared: outbox.PendingConversationIntent[] = [];
  const timeouts: AbortController[] = [];
  let cachedEpoch: string | null = null;
  let purgeCount = 0, bootstrapCount = 0;
  let getSession = async () => ({ data: { session }, error: null });
  let bootstrap = async () => ({ account, accessEpoch: epoch });
  let purge = async () => { entries.length = 0; };
  let acknowledge = async (value: outbox.PendingConversationIntent) => { const at = entries.findIndex(item => item.intentId === value.intentId); if (at >= 0) entries.splice(at, 1); };
  let accept = async (value: outbox.PendingConversationIntent): Promise<Awaited<ReturnType<outbox.ConversationOutboxTransport["accept"]>>> => ({ kind: "accepted", receipt: { intentId: value.intentId, requestId, messageId } });
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
  const exports = {} as { usePermanentConversationDelivery: typeof usePermanentConversationDelivery };
  const code = ts.transpileModule(readFileSync(new URL("./use-permanent-conversation.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, AbortController, queueMicrotask,
    AbortSignal: { any: AbortSignal.any.bind(AbortSignal), timeout() { const controller = new AbortController(); timeouts.push(controller); return controller.signal; } },
    window: { setInterval(callback: () => void) { poll = callback; return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} },
    require(name: string) {
      if (name === "react") return react;
      if (name === "./conversation-outbox") return outbox;
      if (name === "./conversation-file-staging") return { prepareStagedConversationIntent: async (value: outbox.PendingConversationIntent, token: string, signal: AbortSignal) => {
        assert.equal(token, "exact-token"); assert.equal(signal.aborted, false); prepared.push(value);
        const next = { ...value, attachmentIds: [attachmentId] };
        const at = entries.findIndex(item => item.intentId === value.intentId); if (at >= 0) entries[at] = next;
        return next;
      } };
      if (name === "./conversation-local-store") return {
        readConversationDeviceAccess: async () => cachedEpoch, writeConversationDeviceAccess: async (_account: string, value: string) => { cachedEpoch = value; },
        listConversationIntents: async () => [...entries], listFailedConversationIntents: async () => [],
        acknowledgeConversationIntent: (value: outbox.PendingConversationIntent) => acknowledge(value),
        clearConversationDeviceAccount: () => { purgeCount++; return purge(); },
        rejectConversationIntent: async () => {}, revokeConversationIntents: async () => { entries.length = 0; },
      };
      if (name === "./conversation-http-transport") return { createConversationHttpTransport: (input: { accessToken(): Promise<string | null> }) => ({
        session: async () => { const token = await input.accessToken(); if (!token) return null; bootstrapCount++; return { ...await bootstrap(), accessToken: token }; },
        accept: async (value: outbox.PendingConversationIntent) => { accepted.push(value); return accept(value); },
      }) };
      if (name.endsWith("supabase/client")) return { createSupabaseBrowserClient: () => ({ auth: {
        getSession: () => getSession(),
        onAuthStateChange(callback: typeof auth) { auth = callback; return { data: { subscription: { unsubscribe() { auth = undefined; } } } }; },
      } }) };
      throw new Error(name);
    },
  });
  const render = (owner: string | null = account, runEffects = true) => {
    index = 0; const value = exports.usePermanentConversationDelivery(owner, true);
    if (runEffects) { const pending = effects; effects = []; for (const effect of pending) effect(); }
    return value;
  };
  return { render, entries, accepted, prepared, setCachedEpoch(value: string | null) { cachedEpoch = value; }, poll: () => poll?.(),
    get purgeCount() { return purgeCount; }, get bootstrapCount() { return bootstrapCount; },
    setGetSession(next: typeof getSession) { getSession = next; }, setBootstrap(next: typeof bootstrap) { bootstrap = next; },
    setPurge(next: typeof purge) { purge = next; }, setAccept(next: typeof accept) { accept = next; },
    setAcknowledge(next: typeof acknowledge) { acknowledge = next; },
    expire() { timeouts.at(-1)!.abort(new Error("attempt timeout")); },
    changeAuth(event: string, next: Session) { session = next; auth?.(event, next); },
    unmount() { for (const slot of slots) slot.cleanup?.(); } };
}

test("accepted pending text bridges local acknowledgement until canonical feed catches up", async () => {
  const f = mount([entry()]); f.render(); await setImmediate();
  assert.equal(f.entries.length, 0); assert.equal(f.accepted.length, 1);
  assert.equal(f.render().pending[0]!.text, "My exact words"); assert.equal(f.render().revision, 1);
  f.render().confirmVisibleIntents([intentId], "wrong-epoch"); assert.equal(f.render().pending.length, 1);
  f.render().confirmVisibleIntents([intentId], epoch); assert.equal(f.render().pending.length, 0);
  f.unmount();
});

test("submitted staged files prepare with the exact bearer before acceptance", async () => {
  const f = mount([{ ...entry(), stagedAttachmentIds: [attachmentId] }]); f.render(); await setImmediate();
  assert.equal(f.prepared.length, 1); assert.deepEqual(f.accepted[0]!.attachmentIds, [attachmentId]);
  assert.equal(f.render().pending[0]!.attachmentIds![0], attachmentId);
  f.unmount();
});

test("missing session pauses without purging submitted words and recovers on token refresh", async () => {
  const f = mount([entry()]); f.changeAuth("INITIAL_SESSION", null); f.render(); await setImmediate();
  assert.equal(f.accepted.length, 0); assert.equal(f.purgeCount, 0); assert.equal(f.entries.length, 1);
  assert.equal(f.render().pending.length, 0, "cold private data waits for verified local identity"); assert.equal(f.render().signedOut, false);
  f.changeAuth("TOKEN_REFRESHED", { user: { id: adult }, access_token: "exact-token" }); await setImmediate();
  assert.equal(f.accepted.length, 1); assert.equal(f.render().accessEpoch, epoch);
  f.unmount();
});

test("signing back into the same account restarts delivery after explicit logout cleanup", async () => {
  const f = mount(); f.render(); await setImmediate();
  f.changeAuth("SIGNED_OUT", null); await setImmediate();
  assert.equal(f.render().signedOut, true); assert.equal(f.purgeCount, 1);
  f.changeAuth("SIGNED_IN", { user: { id: adult }, access_token: "exact-token" }); await setImmediate();
  assert.equal(f.render().signedOut, false); assert.equal(f.render().accessEpoch, epoch);
  f.entries.push(entry()); f.render().notifyQueued(); await setImmediate();
  assert.equal(f.accepted.length, 1);
  f.unmount();
});

test("hanging auth times out and a later attempt can deliver without refreshing the page", async () => {
  const f = mount([entry()]); f.setGetSession(() => new Promise(() => {})); f.render(); await setImmediate();
  f.expire(); await setImmediate(); assert.match(f.render().error!, /connection is unavailable/);
  assert.equal(f.entries.length, 1); assert.equal(f.purgeCount, 0);
  f.setGetSession(async () => ({ data: { session: { user: { id: adult }, access_token: "exact-token" } }, error: null }));
  f.poll(); await setImmediate(); assert.equal(f.accepted.length, 1);
  f.unmount();
});

test("hanging access bootstrap is bounded; its late result cannot publish an old epoch", async () => {
  const f = mount(); let finish!: (value: { account: string; accessEpoch: string }) => void;
  f.setBootstrap(() => new Promise(resolve => { finish = resolve; })); f.render(); await setImmediate();
  f.expire(); await setImmediate(); assert.match(f.render().error!, /connection is unavailable/);
  f.setBootstrap(async () => ({ account, accessEpoch: epoch })); f.poll(); await setImmediate();
  finish({ account, accessEpoch: "old-late-epoch" }); await setImmediate();
  assert.equal(f.render().accessEpoch, epoch);
  f.unmount();
});

test("account switch hides pending text before effects and ignores late old-account acceptance", async () => {
  const f = mount([entry()]); let finish!: (value: Awaited<ReturnType<outbox.ConversationOutboxTransport["accept"]>>) => void;
  f.setAccept(() => new Promise(resolve => { finish = resolve; })); f.render(); await setImmediate();
  assert.equal(f.render().pending.length, 1);
  assert.equal(f.render(`${family}:other`, false).pending.length, 0);
  f.render(`${family}:other`);
  finish({ kind: "accepted", receipt: { intentId, requestId, messageId } }); await setImmediate();
  assert.equal(f.render(`${family}:other`).pending.length, 0);
  assert.equal(f.render(`${family}:other`).revision, 0);
  f.unmount();
});

test("same-account login waits for old logout cleanup before enabling new drafts", async () => {
  const f = mount(); f.render(); await setImmediate();
  let finish!: () => void; f.setPurge(() => new Promise(resolve => { finish = resolve; }));
  f.changeAuth("SIGNED_OUT", null); await setImmediate();
  f.changeAuth("SIGNED_IN", { user: { id: adult }, access_token: "exact-token" }); await setImmediate();
  assert.equal(f.render().signedOut, true);
  finish(); await setImmediate(); assert.equal(f.render().signedOut, false);
  f.unmount();
});


test("a transient missing session keeps already visible submitted words without device purge", async () => {
  const f = mount([entry()]); f.setAccept(async () => ({ kind: "retry" })); f.render(); await setImmediate();
  assert.equal(f.render().pending.length, 1);
  f.changeAuth("TOKEN_REFRESHED", null); f.poll(); await setImmediate();
  assert.equal(f.render().pending.length, 1); assert.equal(f.entries.length, 1); assert.equal(f.purgeCount, 0);
  assert.equal(f.render().accessEpoch, epoch, "offline submission keeps its last verified epoch");
  f.unmount();
});

test("late old auth success cannot restart after explicit logout", async () => {
  const f = mount([entry()]); let finish!: (value: Awaited<ReturnType<Parameters<typeof f.setGetSession>[0]>>) => void;
  f.setGetSession(() => new Promise(resolve => { finish = resolve; })); f.render(); await setImmediate();
  f.changeAuth("SIGNED_OUT", null); await setImmediate();
  finish({ data: { session: { user: { id: adult }, access_token: "exact-token" } }, error: null }); await setImmediate();
  assert.equal(f.accepted.length, 0); assert.equal(f.render().pending.length, 0); assert.equal(f.render().signedOut, true);
  f.unmount();
});


test("offline reopen restores verified access for staging but cannot deliver before fresh server access", async () => {
  const f = mount([entry()]); f.setCachedEpoch(epoch);
  f.setBootstrap(async () => { throw new Error("offline"); });
  f.render(); await setImmediate();
  assert.equal(f.render().accessEpoch, epoch); assert.equal(f.render().pending.length, 1);
  assert.equal(f.accepted.length, 0); assert.equal(f.entries.length, 1);
  f.setBootstrap(async () => ({ account, accessEpoch: epoch })); f.poll(); await setImmediate();
  assert.equal(f.accepted.length, 1); f.unmount();
});
