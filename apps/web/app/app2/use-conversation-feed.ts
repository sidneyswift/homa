"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { applyConversationFeedChanges, applyConversationFeedMaterials, ConversationFeedAccessChanged, ConversationFeedCursorExpired,
  createConversationFeedWindow, extendConversationFeedWindow, fetchConversationFeedChanges, fetchConversationFeedMaterials, fetchConversationFeedPage,
  type ConversationFeedWindow } from "./conversation-feed-client";

type FeedState = { account: string | null; window: ConversationFeedWindow | null; loading: boolean;
  loadingOlder: boolean; error: string | null; accountActive: boolean };
type Action = "refresh" | "older" | "newest";
const empty: FeedState = { account: null, window: null, loading: false, loadingOlder: false, error: null, accountActive: false };

/** Exact bearer ownership, a bounded moving history window, and incremental
 * committed changes. Scroll position belongs to the parent, not the poller. */
export function useConversationFeed(account: string | null, enabled: boolean, revision = 0) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [state, setState] = useState<FeedState>(empty);
  const wake = useRef<(action: Action) => Promise<void>>(async () => {});
  const follow = useRef<(value: boolean) => void>(() => {});

  useEffect(() => {
    const lifetime = new AbortController();
    let request: AbortController | undefined;
    let running = false, active = enabled && Boolean(account);
    let current: ConversationFeedWindow | null = null;
    let queue: { action: Action; resolve: () => void }[] = [];
    if (!active || !account) return;
    const userId = account.split(":")[1];
    const live = () => active && !lifetime.signal.aborted;
    const clear = (message: string) => { current = null; setState({ ...empty, account, error: message }); };
    const publish = () => setState({ account, window: current, loading: false, loadingOlder: false, error: null, accountActive: true });
    const drainQueue = () => { for (const item of queue) item.resolve(); queue = []; };

    async function cycle(action: Action) {
      if (!live()) return;
      running = true;
      request = new AbortController();
      const requestAbort = request;
      const signal = AbortSignal.any([lifetime.signal, requestAbort.signal, AbortSignal.timeout(15_000)]);
      setState(previous => ({ ...previous, loading: current === null, loadingOlder: action === "older" }));
      try {
        const session = await Promise.race([supabase.auth.getSession(), new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("Conversation request cancelled")), { once: true });
        })]);
        if (!live() || signal.aborted) return;
        if (session.error) throw session.error;
        if (!session.data.session || session.data.session.user.id !== userId) {
          requestAbort.abort(); clear("Sign in to see this conversation."); return;
        }
        const input = { account: account!, accessToken: session.data.session.access_token, signal };
        try {
          if (!current || action === "newest") {
            const page = await fetchConversationFeedPage(input);
            if (!live() || signal.aborted) return;
            current = createConversationFeedWindow(page); publish();
          } else if (action === "older" && current.hasOlder) {
            const page = await fetchConversationFeedPage({ ...input, before: current.beforeCursor!, accessEpoch: current.accessEpoch });
            if (!live() || signal.aborted) return;
            current = extendConversationFeedWindow(current!, page); publish();
          } else if (action === "refresh") {
            // A bounded drain catches up after sleep without reloading history.
            // Each successful batch commits its cursor before requesting another.
            for (let batch = 0; batch < 4; batch++) {
              const page = await fetchConversationFeedChanges({ ...input, after: current!.changeCursor, accessEpoch: current!.accessEpoch });
              if (!live() || signal.aborted) return;
              current = applyConversationFeedChanges(current!, page); publish();
              if (!page.hasMore) break;
            }
            if (current!.pendingMaterialMessageIds.length) {
              const recovered = await fetchConversationFeedMaterials({ ...input, accessEpoch: current!.accessEpoch,
                messageIds: current!.pendingMaterialMessageIds.slice(0, 100) });
              if (!live() || signal.aborted) return;
              current = applyConversationFeedMaterials(current!, recovered); publish();
            }
          } else { publish(); }
        } catch (error) {
          if (!(error instanceof ConversationFeedCursorExpired)) throw error;
          if (!live() || signal.aborted) return;
          clear("Refreshing this conversation…");
          const page = await fetchConversationFeedPage(input);
          if (!live() || signal.aborted) return;
          current = createConversationFeedWindow(page); publish();
        }
      } catch (error) {
        if (!live() || requestAbort.signal.aborted) return;
        if (error instanceof ConversationFeedAccessChanged) clear("Sign in again to see this conversation.");
        else setState(previous => ({ ...previous, loading: false, loadingOlder: false,
          error: "The conversation could not refresh. It will try again when the connection returns." }));
      } finally {
        running = false;
        if (!live()) drainQueue();
        else {
          const next = queue.shift();
          if (next) void cycle(next.action).finally(next.resolve);
        }
      }
    }
    wake.current = action => {
      if (!live() || (document.visibilityState === "hidden" && action === "refresh")) return Promise.resolve();
      if (!running) return cycle(action);
      return new Promise<void>(resolve => {
        if (action === "newest") {
          // A deliberate jump wins over queued refreshes or old-page clicks.
          drainQueue(); queue.unshift({ action, resolve });
        } else queue.push({ action, resolve });
      });
    };
    follow.current = value => {
      if (!current || !live() || (value && current.hasNewer)) return;
      current = { ...current, followingNewest: value };
      setState(previous => ({ ...previous, window: current }));
    };
    // Polls coalesce while a request runs; user navigation remains awaitable.
    const onWake = () => { if (!running && document.visibilityState !== "hidden") void cycle("refresh"); };
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        active = false; request?.abort(); clear("Sign in to see this conversation."); drainQueue();
      } else if (session?.user.id === userId) { active = true; queueMicrotask(onWake); }
    });
    const interval = window.setInterval(onWake, 2_000);
    window.addEventListener("focus", onWake); window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    queueMicrotask(() => {
      if (!live()) return;
      setState({ ...empty, account, loading: current === null }); onWake();
    });
    return () => {
      active = false; lifetime.abort(); request?.abort(); wake.current = async () => {}; follow.current = () => {};
      drainQueue(); window.clearInterval(interval);
      window.removeEventListener("focus", onWake); window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake); auth.subscription.unsubscribe();
    };
  }, [account, enabled, supabase]);

  useEffect(() => { void wake.current("refresh"); }, [revision]);
  const loadOlder = useCallback(() => wake.current("older"), []);
  const refresh = useCallback(() => wake.current("refresh"), []);
  const jumpToNewest = useCallback(() => wake.current("newest"), []);
  const setFollowingNewest = useCallback((value: boolean) => follow.current(value), []);
  // Hide previous ownership synchronously, before effects run on account changes.
  const display = enabled && state.account === account ? state : empty;
  return { messages: display.window?.messages ?? [], loading: display.loading, loadingOlder: display.loadingOlder,
    materials: display.window?.materials ?? [], materialsUnavailable: display.window?.materialsUnavailable ?? false,
    materialsTruncated: display.window?.materialsTruncated ?? false, requestsTruncated: display.window?.requestsTruncated ?? false,
    requests: display.window?.requests ?? [], error: display.error, hasOlder: display.window?.hasOlder ?? false,
    loadOlder, refresh, jumpToNewest, setFollowingNewest, hasNewer: display.window?.hasNewer ?? false,
    followingNewest: display.window?.followingNewest ?? true,
    accountActive: display.accountActive, accessEpoch: display.window?.accessEpoch ?? null };
}
