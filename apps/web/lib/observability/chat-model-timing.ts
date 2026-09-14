import { gateway, registerTelemetry, wrapLanguageModel, type LanguageModelMiddleware, type Telemetry } from "ai";

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
export function createChatModelTiming(): Telemetry & { middleware: LanguageModelMiddleware } {
  const calls = new Map<string, Attempt>();
  // The installed SDK passes this same prompt array to telemetry and doStream.
  // Weak keys correlate concurrent calls without retaining or logging content.
  const prompts = new WeakMap<object, { callId: string; attempt: Attempt }>();
  const write = (row: Record<string, string | number | undefined>) => {
    try { console.info("[chat-model]", JSON.stringify(row)); } catch { /* Observation cannot fail a turn. */ }
  };
  return {
    middleware: {
      specificationVersion: "v4",
      async wrapStream({ params, doStream }) {
        const match = prompts.get(params.prompt);
        if (!match) return doStream();
        const startedAtMs = Date.now();
        const started = performance.now();
        const record = (stage: string) => write({ stage, callId: match.callId,
          sessionId: match.attempt.sessionId, turnId: match.attempt.turnId,
          sequence: match.attempt.sequence, stepIndex: match.attempt.stepIndex,
          startedAtMs, observedAtMs: Date.now(), elapsedMs: performance.now() - started });
        record("model_stream_requested");
        const result = await doStream();
        // Stream creation is distinct from receiving any answer text.
        record("model_stream_opened");
        let firstText = false;
        let firstReasoning = false;
        return { ...result, stream: result.stream.pipeThrough(new TransformStream({
          transform(part, controller) {
            if (!firstText && part.type === "text-delta" && part.delta.trim().length > 0) {
              firstText = true;
              record("model_stream_first_text");
            }
            if (!firstReasoning && part.type === "reasoning-delta" && part.delta.trim().length > 0) {
              firstReasoning = true;
              record("model_stream_first_reasoning");
            }
            controller.enqueue(part);
          },
        })) };
      },
    },
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
      const attempt = { sessionId, turnId, sequence, stepIndex, observedAtMs: now };
      calls.set(event.callId, attempt);
      // AI 7.0.14 supplies this runtime field but omits it from the public type.
      // Fail open if a later SDK stops supplying it; never infer a different call.
      if ("promptMessages" in event && Array.isArray(event.promptMessages)) {
        prompts.set(event.promptMessages, { callId: event.callId, attempt });
      } else {
        write({ stage: "model_stream_correlation_unavailable", callId: event.callId,
          sessionId, turnId, sequence, stepIndex });
      }
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
  const timing = createChatModelTiming();
  registerTelemetry(timing);
  const provider = globalThis.AI_SDK_DEFAULT_PROVIDER ?? gateway;
  globalThis.AI_SDK_DEFAULT_PROVIDER = new Proxy(provider, {
    get(target, property) {
      if (property === "languageModel") return (id: string) => {
        const model = target.languageModel(id);
        return id === "openai/gpt-6-astra"
          ? wrapLanguageModel({ model, middleware: timing.middleware }) : model;
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
