import type { HandleMessageStreamEvent } from "eve/client";

import { applyConversationSourceBatch, leaseConversationSources, releaseConversationSource } from "../lib/conversation-source";

export interface ConversationSourceCycleDependencies {
  enabled(): boolean;
  lease: typeof leaseConversationSources;
  apply: typeof applyConversationSourceBatch;
  release: typeof releaseConversationSource;
  passMs: number;
  cleanupMs: number;
  batchSize?: number;
}
const defaults: ConversationSourceCycleDependencies = {
  enabled: () => process.env.HOMA_CONVERSATION_RECORDING === "1" && process.env.HOMA_CONVERSATION_REQUESTS === "1",
  lease: leaseConversationSources, apply: applyConversationSourceBatch, release: releaseConversationSource,
  passMs: 20_000, cleanupMs: 1_000, batchSize: 64,
};

class SourceDeadline extends Error {}

/** Racing only stops this caller waiting. In particular it never cancels a
 * database transaction or establishes whether that transaction committed. */
async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SourceDeadline("Source pass deadline reached")), Math.max(0, milliseconds));
    })]);
  } finally { clearTimeout(timer); }
}

/** Each pass is bounded. A lost process leaves a lease and committed bookmark;
 * the next pass resumes the durable Eve stream without regenerating content. */
export async function runConversationSourceCycle(
  open: (sessionId: string, startIndex: number) => Promise<ReadableStream<HandleMessageStreamEvent>>,
  dependencies: ConversationSourceCycleDependencies = defaults,
) {
  const result = { sources: 0, events: 0, retrying: 0 };
  if (!dependencies.enabled()) return result;
  if (!(dependencies.passMs > 0 && dependencies.passMs <= 20_000 && dependencies.cleanupMs > 0 && dependencies.cleanupMs <= 1_000)) {
    throw new Error("Invalid source cycle deadlines");
  }
  const batchSize = dependencies.batchSize ?? 64;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64) throw new Error("Invalid source batch size");
  const release = (source: Awaited<ReturnType<typeof leaseConversationSources>>[number]) =>
    bounded(Promise.resolve().then(() => dependencies.release(source)), dependencies.cleanupMs);
  let acquiring = true;
  const acquisition = Promise.resolve().then(() => dependencies.lease(4)).then(sources => {
    // A database lease can arrive after the acquisition deadline. It must not
    // start consuming a stream after this pass has already returned.
    if (!acquiring) {
      for (const source of sources) void release(source).catch(() => {});
    }
    return sources;
  });
  let sources: Awaited<typeof acquisition>;
  try { sources = await bounded(acquisition, dependencies.passMs); }
  catch { acquiring = false; result.retrying++; return result; }
  acquiring = false;
  await Promise.all(sources.map(async source => {
    let reader: ReadableStreamDefaultReader<HandleMessageStreamEvent> | undefined;
    let accepting = true, writePending = false, retrying = false;
    const deadline = Date.now() + dependencies.passMs;
    const remaining = () => deadline - Date.now();
    try {
      const opening = Promise.resolve().then(() => open(source.sessionId, source.nextIndex)).then(stream => {
        if (!accepting) {
          // No reader is acquired and no late event can reach persistence.
          void bounded(Promise.resolve().then(() => stream.cancel()), dependencies.cleanupMs).catch(() => {});
        }
        return stream;
      });
      const stream = await bounded(opening, remaining());
      reader = stream.getReader();
      let cursor = source.nextIndex;
      let pendingRead: Promise<ReadableStreamReadResult<HandleMessageStreamEvent>> | null = null;
      let ended = false;
      for (;;) {
        if (remaining() <= 0) throw new SourceDeadline("Source pass deadline reached");
        const batch: HandleMessageStreamEvent[] = [];
        const flushAt = Date.now() + 10;
        while (batch.length < batchSize) {
          pendingRead ??= reader.read();
          let entry: ReadableStreamReadResult<HandleMessageStreamEvent>;
          try { entry = await bounded(pendingRead, batch.length ? Math.min(remaining(), flushAt - Date.now()) : remaining()); }
          catch (error) {
            // Keep the in-flight read for the next batch. The timer does not
            // cancel it or discard an event that arrives during the write.
            if (error instanceof SourceDeadline && batch.length && remaining() > 0) break;
            throw error;
          }
          pendingRead = null;
          if (entry.done) { ended = true; break; }
          batch.push(entry.value);
          if (entry.value.type === "session.completed" || entry.value.type === "session.failed" || Date.now() >= flushAt) break;
        }
        if (!batch.length && ended) break;
        if (remaining() <= 0) throw new SourceDeadline("Source pass deadline reached");
        // The database owns both content and cursor in one transaction. If its
        // reply is late, leave the lease alone and let recovery read that cursor.
        writePending = true;
        const writing = Promise.resolve().then(() => dependencies.apply(source, cursor, batch));
        const saved = await bounded(writing, remaining());
        writePending = false;
        cursor = saved.nextIndex;
        result.events += batch.length;
        if (saved.complete || ended) break;
      }
      result.sources++;
    } catch { retrying = true; }
    finally {
      accepting = false;
      const cleanup = async () => {
        if (!reader) return;
        try { await bounded(Promise.resolve().then(() => reader!.cancel()), dependencies.cleanupMs); }
        finally { reader.releaseLock(); }
      };
      // Cancellation and lease release are independent. A stuck transport may
      // not prevent a safe release, and a pending write may not lose its fence.
      const outcomes = await Promise.allSettled([cleanup(), ...(!writePending ? [release(source)] : [])]);
      if (outcomes.some(outcome => outcome.status === "rejected")) retrying = true;
      if (retrying) result.retrying++;
    }
  }));
  return result;
}

/** Cover the interval between minute sweeps while a source is producing text.
 * Each pass retains its own lease/write fence; an idle pass ends the window.
 * Three passes take about a minute for live streams (at most 126 seconds when
 * all lease acquisitions and cleanup also reach their existing bounds). */
export async function runConversationSourceWindow(
  open: Parameters<typeof runConversationSourceCycle>[0],
  cycle: typeof runConversationSourceCycle = runConversationSourceCycle,
) {
  const total = { sources: 0, events: 0, retrying: 0 };
  for (let pass = 0; pass < 3; pass++) {
    const result = await cycle(open);
    total.sources += result.sources; total.events += result.events; total.retrying += result.retrying;
    if (result.sources === 0 && result.events === 0 && result.retrying === 0) break;
  }
  return total;
}
