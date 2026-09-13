import { registerTelemetry, type Telemetry } from "ai";

type Attempt = {
  sessionId: string;
  turnId: string;
  sequence: number;
  stepIndex: number;
  observedAtMs: number;
  startedAtMs?: number;
};

const MAX_CALLS = 128;
const RETENTION_MS = 10 * 60_000;

export function previewModelTimingEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" && process.env.HOMA_PREVIEW_MODEL_TIMING === "1";
}

/** No request bodies, response text, headers, auth or provider metadata enter logs. */
export function createChatModelTiming(): Telemetry {
  const calls = new Map<string, Attempt>();
  const write = (row: Record<string, string | number | undefined>) => {
    try { console.info("[chat-model]", JSON.stringify(row)); } catch { /* Observation cannot fail a turn. */ }
  };
  return {
    onStepStart(event) {
      const context = event.runtimeContext;
      const sessionId = context?.["eve.session.id"];
      const turnId = context?.["eve.turn.id"];
      const sequence = Number(context?.["eve.turn.sequence"]);
      const stepIndex = Number(context?.["eve.step.index"]);
      if (event.modelId !== "openai/gpt-6-astra" || typeof sessionId !== "string" ||
        typeof turnId !== "string" || !Number.isSafeInteger(sequence) || sequence < 0 ||
        !Number.isSafeInteger(stepIndex) || stepIndex < 0) return;
      const now = Date.now();
      for (const [key, value] of calls) {
        if (now - value.observedAtMs > RETENTION_MS) calls.delete(key);
      }
      // Aborted calls need not produce an end callback; keep the registry bounded.
      if (!calls.has(event.callId) && calls.size >= MAX_CALLS) calls.delete(calls.keys().next().value!);
      calls.set(event.callId, { sessionId, turnId, sequence, stepIndex, observedAtMs: now });
    },
    onLanguageModelCallStart(event) {
      const attempt = calls.get(event.callId);
      if (!attempt) return;
      attempt.startedAtMs = Date.now();
      write({ stage: "provider_call_started", callId: event.callId,
        sessionId: attempt.sessionId, turnId: attempt.turnId, sequence: attempt.sequence,
        stepIndex: attempt.stepIndex, startedAtMs: attempt.startedAtMs,
        toolCount: event.tools?.length ?? 0 });
    },
    onLanguageModelCallEnd(event) {
      const attempt = calls.get(event.callId);
      calls.delete(event.callId);
      if (attempt?.startedAtMs === undefined) return;
      write({ stage: "provider_call_completed", callId: event.callId,
        sessionId: attempt.sessionId, turnId: attempt.turnId, sequence: attempt.sequence,
        stepIndex: attempt.stepIndex, startedAtMs: attempt.startedAtMs,
        completedAtMs: Date.now(), responseTimeMs: event.performance.responseTimeMs,
        // The SDK includes reasoning and tool output here. This is not visible TTFT.
        firstModelOutputMs: event.performance.timeToFirstOutputMs });
    },
  };
}

let registered = false;
export function registerPreviewChatModelTiming(): void {
  if (!previewModelTimingEnabled() || registered) return;
  registered = true;
  registerTelemetry(createChatModelTiming());
}
