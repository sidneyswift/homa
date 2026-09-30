import { isCurrentTurnBoundaryEvent, type HandleMessageStreamEvent, type SessionState } from "eve/client";

/** Reattach a quiet result stream, never resend the parent's request.
 * A local Live call on 2026-09-12 missed a result that was already durable,
 * leaving voice waiting for the entire five-minute bridge deadline. */
export async function readVoiceBridgeStream(input: {
  state: SessionState & { sessionId: string };
  signal: AbortSignal;
  open: (state: SessionState, signal: AbortSignal) => AsyncIterable<HandleMessageStreamEvent>;
  idleMs?: number;
}) {
  const events: HandleMessageStreamEvent[] = [];
  const state = { ...input.state };
  for (let attempt = 0; attempt < 24; attempt++) {
    input.signal.throwIfAborted();
    const idle = new AbortController();
    const signal = AbortSignal.any([input.signal, idle.signal]);
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => idle.abort(), input.idleMs ?? 15_000); };
    arm();
    try {
      for await (const event of input.open({ ...state }, signal)) {
        input.signal.throwIfAborted();
        events.push(event);
        state.streamIndex++;
        arm();
        if (isCurrentTurnBoundaryEvent(event)) {
          const completed = events.findLast(item => item.type === "message.completed" && item.data.finishReason !== "tool-calls");
          return {
            status: event.type === "session.failed" ? "failed" as const : event.type === "session.waiting" ? "waiting" as const : "completed" as const,
            message: completed?.type === "message.completed" ? completed.data.message ?? undefined : undefined,
            events,
            sessionId: state.sessionId,
            sessionState: state,
          };
        }
      }
      // EOF without a terminal event cannot establish completion. Avoid
      // spinning on an immediately closed stream or creating another task.
      if (!idle.signal.aborted) throw new Error("Voice result stream ended before a terminal result");
    } catch (error) {
      if (!idle.signal.aborted || input.signal.aborted) throw error;
    } finally {
      clearTimeout(timer!);
      idle.abort();
    }
  }
  throw new Error("Voice result stream did not reach a terminal result");
}
