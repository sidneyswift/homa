"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { prepareStagedConversationIntent } from "./conversation-file-staging";
import { createConversationHttpTransport } from "./conversation-http-transport";
import { acknowledgeConversationIntent, clearConversationDeviceAccount, listConversationIntents,
  readConversationDeviceAccess, writeConversationDeviceAccess, listFailedConversationIntents, rejectConversationIntent, revokeConversationIntents } from "./conversation-local-store";
import { deliverConversationOutbox, type ConversationAcceptanceReceipt, type PendingConversationIntent } from "./conversation-outbox";

const store = { list: listConversationIntents, acknowledge: acknowledgeConversationIntent,
  prepare: prepareStagedConversationIntent, reject: rejectConversationIntent, revoke: revokeConversationIntents };
const ATTEMPT_TIMEOUT_MS = 90_000;
const AUTH_TIMEOUT_MS = 15_000;

type DeliveryState = { account: string | null; accessEpoch: string | null; pending: PendingConversationIntent[];
  failed: PendingConversationIntent[]; error: string | null; signedOut: boolean; revision: number };
const empty: DeliveryState = { account: null, accessEpoch: null, pending: [], failed: [], error: null, signedOut: false, revision: 0 };

/** An abort deadline must settle even if auth, storage, or a mock transport
 * ignores its signal. A late committed write still belongs to its exact intent. */
async function withinAttempt<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason ?? new Error("Conversation attempt interrupted"));
      signal.addEventListener("abort", onAbort, { once: true });
    })]);
  } finally { if (onAbort) signal.removeEventListener("abort", onAbort); }
}

/** The browser owns pending delivery only. Accepted messages remain visible
 * until their canonical server rows appear, while execution survives the tab. */
export function usePermanentConversationDelivery(account: string | null, enabled: boolean) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [state, setState] = useState<DeliveryState>(empty);
  const wake = useRef<() => void>(() => {});
  const confirm = useRef<(intentIds: string[], epoch: string | null) => void>(() => {});

  useEffect(() => {
    if (!enabled || !account) return;
    const lifetime = new AbortController();
    let attempt: AbortController | undefined;
    let running = false, repeat = false, authenticated = true;
    let generation = 0;
    let purge: Promise<void> = Promise.resolve();
    let queued: PendingConversationIntent[] = [];
    let failed: PendingConversationIntent[] = [];
    let epoch: string | null = null;
    let visibleIntentIds = new Set<string>();
    const accepted = new Map<string, { entry: PendingConversationIntent; receipt: ConversationAcceptanceReceipt }>();
    const userId = account.split(":")[1];
    const active = () => authenticated && !lifetime.signal.aborted;
    const displayPending = () => [...new Map([
      ...queued.map(entry => [entry.intentId, entry] as const),
      ...[...accepted.values()].map(({ entry }) => [entry.intentId, entry] as const),
    ]).values()].sort((a, b) => a.submittedAt - b.submittedAt);
    const publish = (error: string | null = null) => setState(previous => ({ ...previous,
      account, accessEpoch: epoch, pending: displayPending(), failed, error, signedOut: false }));

    async function cycle() {
      if (!active()) return;
      if (running) { repeat = true; return; }
      running = true;
      attempt = new AbortController();
      const cycleGeneration = generation, controller = attempt;
      const signal = AbortSignal.any([lifetime.signal, controller.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]);
      const valid = () => active() && generation === cycleGeneration && !signal.aborted;
      const wait = <T,>(work: Promise<T>) => withinAttempt(work, signal);
      const waitAuth = <T,>(work: Promise<T>) => withinAttempt(work, AbortSignal.any([signal, AbortSignal.timeout(AUTH_TIMEOUT_MS)]));
      const readToken = async () => {
        const session = await waitAuth(supabase.auth.getSession());
        if (!valid()) return null;
        if (session.error) throw session.error;
        // Missing auth during refresh is not an explicit logout and must never
        // erase device drafts or submitted words.
        if (!session.data.session) return null;
        if (session.data.session.user.id !== userId) {
          authenticated = false; accepted.clear(); queued = []; epoch = null; visibleIntentIds.clear();
          setState(previous => ({ ...previous, account, accessEpoch: null, pending: [], failed: [], signedOut: true, error: "Sign in to continue." }));
          return null;
        }
        return session.data.session.access_token;
      };
      const base = createConversationHttpTransport({ signal, accessToken: readToken });
      const transport = { session: () => waitAuth(base.session()), accept: async (...args: Parameters<typeof base.accept>) => {
        const result = await wait(base.accept(...args));
        if (valid() && result.kind === "accepted") {
          const entry = args[0];
          if (!visibleIntentIds.has(entry.intentId)) accepted.set(entry.intentId, { entry, receipt: result.receipt });
          publish();
          // Wake the feed as soon as the server receipt arrives, even if local
          // acknowledgement is slow or fails and must retry the same intent.
          setState(previous => ({ ...previous, revision: previous.revision + 1 }));
        }
        return result;
      } };
      try {
        // Explicit logout cleanup must finish before this login can enqueue
        // fresh work; an earlier cleanup cannot erase the new login's draft.
        purge = purge.catch(() => clearConversationDeviceAccount(account!));
        await wait(purge);
        const authenticatedToken = await readToken();
        if (!valid()) return;
        if (!authenticatedToken) {
          setState(previous => ({ ...previous, error: "Sign in again to continue this conversation." }));
          return;
        }
        if (!epoch) epoch = await wait(readConversationDeviceAccess(account!));
        queued = await wait(store.list(account!));
        failed = await wait(listFailedConversationIntents(account!));
        if (!valid()) return;
        publish();
        const session = await transport.session();
        if (!valid()) return;
        if (!session) {
          setState(previous => ({ ...previous, error: "Sign in again to continue this conversation." }));
          return;
        }
        if (session.account !== account) {
          authenticated = false; generation++; controller.abort(); epoch = null; queued = []; accepted.clear(); visibleIntentIds.clear();
          setState(previous => ({ ...previous, account, accessEpoch: null, pending: [], failed: [], signedOut: true, error: "Sign in to continue." }));
          return;
        }
        if (epoch !== session.accessEpoch) visibleIntentIds.clear();
        for (const [id, value] of accepted) if (value.entry.accessEpoch !== session.accessEpoch) accepted.delete(id);
        queued = queued.filter(entry => entry.accessEpoch === session.accessEpoch);
        epoch = session.accessEpoch;
        await wait(writeConversationDeviceAccess(account!, epoch));
        if (!valid()) return;
        publish();
        const result = await wait(deliverConversationOutbox({ account: account!,
          currentAccount: () => valid() ? account : null, store, transport, signal }));
        if (!valid()) return;
        queued = await wait(store.list(account!));
        const rejected = await wait(listFailedConversationIntents(account!));
        if (!valid()) return;
        failed = rejected;
        publish(rejected.length ? "A message could not be sent. Your words are still on this device." :
          result.kind === "paused" && result.reason !== "aborted" ? "Your message will send when the connection returns." : null);
      } catch {
        if (active() && generation === cycleGeneration && !controller.signal.aborted) {
          setState(previous => ({ ...previous, error: "The connection is unavailable. Submitted messages will send automatically when it returns." }));
        }
      } finally {
        running = false;
        if (repeat && active()) { repeat = false; queueMicrotask(() => { void cycle(); }); }
      }
    }
    wake.current = () => { void cycle(); };
    confirm.current = (intentIds, feedEpoch) => {
      if (!active() || !feedEpoch || feedEpoch !== epoch) return;
      visibleIntentIds = new Set(intentIds);
      let changed = false;
      for (const id of intentIds) if (accepted.get(id)?.entry.accessEpoch === feedEpoch) {
        accepted.delete(id); changed = true;
      }
      if (changed) setState(previous => ({ ...previous, pending: displayPending() }));
    };
    const onWake = () => { void cycle(); };
    window.addEventListener("online", onWake); window.addEventListener("focus", onWake);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("homa-conversation-delivery") : null;
    if (channel) channel.onmessage = onWake;
    const interval = window.setInterval(onWake, 5_000);
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        authenticated = false; generation++; attempt?.abort(); epoch = null; queued = []; accepted.clear(); visibleIntentIds.clear();
        setState(previous => ({ ...previous, account, accessEpoch: null, pending: [], failed: [], signedOut: true, error: "Sign in to continue." }));
        purge = purge.catch(() => {}).then(() => clearConversationDeviceAccount(account!));
        // Observe failure now; the next authenticated cycle retries no delivery
        // until it can establish that the old account cleanup finished.
        void purge.catch(() => {});
      } else if (session?.user.id === userId) {
        authenticated = true;
        // Supabase auth callbacks cannot synchronously call auth again.
        queueMicrotask(onWake);
      }
    });
    queueMicrotask(() => {
      if (!active()) return;
      setState(previous => ({ ...empty, account, revision: previous.revision })); void cycle();
    });
    return () => {
      authenticated = false; generation++; lifetime.abort(); attempt?.abort(); wake.current = () => {}; confirm.current = () => {};
      window.clearInterval(interval); window.removeEventListener("online", onWake); window.removeEventListener("focus", onWake);
      channel?.close(); auth.subscription.unsubscribe();
    };
  }, [account, enabled, supabase]);

  const notifyQueued = useCallback(() => {
    wake.current();
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("homa-conversation-delivery"); channel.postMessage("queued"); channel.close();
    }
  }, []);
  const confirmVisibleIntents = useCallback((intentIds: string[], accessEpoch: string | null) => confirm.current(intentIds, accessEpoch), []);
  const display = enabled && state.account === account ? state : empty;
  return { accessEpoch: display.accessEpoch, pending: display.pending, failed: display.failed, error: display.error,
    revision: display.revision, notifyQueued, signedOut: display.signedOut, confirmVisibleIntents };
}
