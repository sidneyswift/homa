import type { SupabaseClient } from "@supabase/supabase-js";

import { createCallerDbClient } from "./agent-db";
import type { MemoryRow } from "./agent-memory";
import type { ChildRow, FamilyContextRows, FamilyRow, MemberRow } from "./family-context";
import { markChatPreparation, type ChatPreparationTrace } from "./observability/chat-preparation";

// #1181: healthy caller reads took hundreds of milliseconds; gateway failures
// consumed almost nine seconds and discarded the turn's entire family context.
const ATTEMPT_MS = 1_250;
const TOTAL_MS = 2_500;
const MAX_ATTEMPTS = 2;
const UNAVAILABLE = "family context load failed under caller token";

type ContextTrace = Pick<ChatPreparationTrace, "sessionId" | "turnId">;
interface ReadResult<T> {
  data: T | null;
  error: unknown;
  status: number;
}

function transientReadFailure(result: ReadResult<unknown>): boolean {
  // SQL and PostgREST query errors are not a reason to repeat the same query.
  const code = result.error && typeof result.error === "object" && "code" in result.error
    ? result.error.code
    : undefined;
  if (typeof code === "string" && code.length > 0) return false;
  return [0, 502, 503, 504, 520].includes(result.status);
}

/** Stop awaiting even if a faulty fetch implementation ignores cancellation. */
function abortableRead<T>(
  read: (signal: AbortSignal) => PromiseLike<ReadResult<T>>,
  signal: AbortSignal,
): Promise<ReadResult<T>> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error(UNAVAILABLE));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new Error(UNAVAILABLE);
      return read(signal);
    }).then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      () => {
        signal.removeEventListener("abort", onAbort);
        reject(new Error(UNAVAILABLE));
      },
    );
  });
}

/** Production entry point: identity and JWT come only from server auth. */
export async function loadCallerFamilyContext(
  attributes: unknown,
  trace?: ContextTrace,
): Promise<FamilyContextRows> {
  return loadCallerFamilyContextRows(createCallerDbClient(attributes), { trace });
}

/** The injected budget and signal support controlled-fetch tests, not config. */
export async function loadCallerFamilyContextRows(
  { db, familyId }: { db: SupabaseClient; familyId: string },
  options: {
    trace?: ContextTrace;
    signal?: AbortSignal;
    attemptMs?: number;
    totalMs?: number;
  } = {},
): Promise<FamilyContextRows> {
  const attemptMs = options.attemptMs ?? ATTEMPT_MS;
  const totalMs = options.totalMs ?? TOTAL_MS;
  const deadline = performance.now() + totalMs;
  const batch = new AbortController();
  const cancel = () => batch.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const deadlineTimer = setTimeout(cancel, totalMs);
  let recovered = false;

  async function read<T>(query: (signal: AbortSignal) => PromiseLike<ReadResult<T>>): Promise<T | null> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const remainingMs = deadline - performance.now();
      if (batch.signal.aborted || remainingMs <= 0) throw new Error(UNAVAILABLE);
      const controller = new AbortController();
      const abortAttempt = () => controller.abort();
      batch.signal.addEventListener("abort", abortAttempt, { once: true });
      // When the batch has less time left, only its timer may cancel. A second
      // fractional timer can fire early and mistakenly start a last retry.
      const timer = attemptMs < remainingMs ? setTimeout(abortAttempt, attemptMs) : undefined;
      if (attempt > 0) recovered = true;
      let retryable = false;
      try {
        const result = await abortableRead(query, controller.signal);
        if (batch.signal.aborted || performance.now() >= deadline) throw new Error(UNAVAILABLE);
        if (!result.error) return result.data;
        retryable = transientReadFailure(result);
      } catch {
        // Only our own attempt timeout can retry a thrown failure. A caller or
        // batch cancellation always stops, and SDK transport errors are values.
        retryable = controller.signal.aborted && !batch.signal.aborted;
      } finally {
        clearTimeout(timer);
        batch.signal.removeEventListener("abort", abortAttempt);
      }
      if (!retryable) throw new Error(UNAVAILABLE);
    }
    throw new Error(UNAVAILABLE);
  }

  try {
    const [family, children, memories, members] = await Promise.all([
      read<FamilyRow>((signal) => db
        .from("families")
        .select("name, us_state, parent_display_name, time_zone")
        .eq("id", familyId)
        .retry(false)
        .abortSignal(signal)
        .maybeSingle()),
      read<ChildRow[]>((signal) => db
        .from("children")
        .select("id, name, birth_month, profile, avatar_url")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true })
        .retry(false)
        .abortSignal(signal)),
      read<MemoryRow[]>((signal) => db
        .from("family_memories")
        .select("id, child_id, kind, content, source, created_at")
        .eq("family_id", familyId)
        .is("superseded_at", null)
        .in("kind", ["fact", "what_works"])
        .order("created_at", { ascending: true })
        .limit(200)
        .retry(false)
        .abortSignal(signal)),
      read<MemberRow[]>((signal) => db
        .from("family_members")
        .select("display_name")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true })
        .retry(false)
        .abortSignal(signal)),
    ]);
    if (batch.signal.aborted || performance.now() >= deadline) throw new Error(UNAVAILABLE);
    if (recovered) {
      markChatPreparation("family_context_recovered", options.trace?.sessionId, {
        turnId: options.trace?.turnId,
      });
    }
    return { family, children: children ?? [], memories: memories ?? [], members: members ?? [] };
  } finally {
    clearTimeout(deadlineTimer);
    options.signal?.removeEventListener("abort", cancel);
    // A permanent error in one read cancels every other in-flight attempt.
    batch.abort();
  }
}
