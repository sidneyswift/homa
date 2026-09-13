import type { EveAgentStore, EveAgentStoreCallbacks } from "eve/client";

/**
 * Keeps subscribers attached when recovery supplies a replacement Eve store.
 * The caller owns the authenticated session/cursor and any replayed events.
 * Unlike reset(), replace() preserves the replacement's recovered session.
 */
export function createRecoverableEveAgentStore<TData>(initial: EveAgentStore<TData>) {
  let current = initial;
  let callbacks: EveAgentStoreCallbacks<TData> = {};
  let activeSend: AbortController | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  let unsubscribe = current.subscribe(notify);

  return {
    get snapshot() {
      return current.snapshot;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setCallbacks(next: EveAgentStoreCallbacks<TData>) {
      callbacks = next;
      current.setCallbacks(next);
    },
    async send(input: Parameters<EveAgentStore<TData>["send"]>[0]) {
      if (activeSend) throw new Error("A chat turn is already being sent.");
      const controller = new AbortController();
      activeSend = controller;
      try {
        await current.send({
          ...input,
          signal: input.signal
            ? AbortSignal.any([input.signal, controller.signal])
            : controller.signal,
        });
      } finally {
        if (activeSend === controller) activeSend = undefined;
      }
    },
    /** Detach this browser's request; do not cancel the durable server turn. */
    stop() {
      activeSend?.abort();
    },
    replace(replacement: EveAgentStore<TData>) {
      if (replacement === current) return;
      // Retired connections must not persist stale snapshots or flush the queue
      // when their aborted send eventually invokes onFinish.
      current.setCallbacks({});
      unsubscribe();
      activeSend?.abort();
      activeSend = undefined;
      current.reset();
      current = replacement;
      current.setCallbacks(callbacks);
      unsubscribe = current.subscribe(notify);
      notify();
    },
    reset() {
      activeSend?.abort();
      activeSend = undefined;
      current.reset();
    },
  };
}
