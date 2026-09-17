import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { NodeTracerProvider, type ReadableSpan, type SpanProcessor, type Span } from "@opentelemetry/sdk-trace-node";

import { flushTimingRecords, CHAT_TIMING_HEADER, timingId, timingIdentity, timingRecord, type TimingIdentity } from "./chat-timing";

const hrMs = (time: readonly [number, number]) => time[0] * 1000 + time[1] / 1e6;
const safeKeys = new Set(["eve.session.id", "eve.turn.id", "eve.turn.sequence", "eve.step.index", "homa.send.id", "ai.model.id", "ai.usage.inputTokens", "ai.usage.outputTokens", "ai.response.msToFirstChunk", "http.status_code", "gen_ai.request.model", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens", "gen_ai.tool.name", "gen_ai.operation.name", "ai.toolCall.name"]);
/** An allowlist, not a sanitizer: raw SDK attributes and exception messages never leave the process. */
export function spanRecord(span: ReadableSpan) {
  const attributes: Record<string, string | number | boolean> = {};
  for (const [sourceKey, value] of Object.entries(span.attributes)) {
    const key = sourceKey.startsWith("ai.settings.context.") ? sourceKey.slice("ai.settings.context.".length) : sourceKey;
    if (safeKeys.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) attributes[key] = value;
  }
  const operation = attributes["gen_ai.operation.name"];
  const operationName = typeof operation === "string" && ["chat", "agent_step", "invoke_agent", "execute_tool", "embeddings"].includes(operation) ? `gen_ai.${operation}` : "platform.operation";
  return {
    kind: "span", name: /^(?:homa|ai|gen_ai)\.[a-zA-Z0-9_.-]+$/.test(span.name) ? span.name : operationName, traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId, parentSpanId: span.parentSpanContext?.spanId,
    startedAtMs: hrMs(span.startTime), durationMs: hrMs(span.duration),
    outcome: span.status.code === SpanStatusCode.ERROR ? "error" : "ok",
    attributes,
    events: span.events.filter(e => ["ai.stream.firstChunk", "ai.stream.finish", "headers.received", "body.first_byte", "body.cancelled", "model.headers_received", "model.first_answer_text", "model.first_reasoning", "model.cancelled"].includes(e.name))
      .map(e => ({ name: e.name, atMs: hrMs(e.time) })),
  };
}
let registered = false;
export function registerChatTiming(): void {
  if (registered) return;
  registered = true;
  const processor: SpanProcessor = {
    onStart(span: Span) {
      // Start receipts survive an interrupted call, unlike end-only spans.
      timingRecord({ kind: "span.start", name: /^(?:homa|ai|gen_ai)\.[a-zA-Z0-9_.-]+$/.test(span.name) ? span.name : "platform.operation", atMs: Date.now(), traceId: span.spanContext().traceId, spanId: span.spanContext().spanId });
    },
    onEnd(span) { try { timingRecord(spanRecord(span)); } catch { /* Best effort. */ } },
    async forceFlush() {}, async shutdown() {},
  };
  new NodeTracerProvider({ spanProcessors: [processor] }).register();
  timingRecord({ kind: "clock", domain: "server", atMs: Date.now(), monotonicMs: performance.now() });
}
export async function timeServer<T>(name: string, operation: () => PromiseLike<T> | T, identity: TimingIdentity = {}): Promise<T> {
  return trace.getTracer("homa-chat-timing").startActiveSpan(name, async span => {
    const ids = timingIdentity(identity);
    for (const [key, value] of Object.entries(ids)) span.setAttribute(key === "sendId" ? "homa.send.id" : key === "sessionId" ? "eve.session.id" : key === "turnId" ? "eve.turn.id" : "eve.step.index", value);
    try { return await operation(); }
    catch (error) { span.setStatus({ code: SpanStatusCode.ERROR }); throw error; }
    finally { span.end(); }
  });
}
export async function timeRequest(request: Request, name: string, operation: () => Promise<Response>): Promise<Response> {
  registerChatTiming();
  const receivedAtMs = Date.now();
  const sendId = timingId(request.headers.get(CHAT_TIMING_HEADER));
  try { return await timeServer(name, async () => {
    const result = await operation();
    trace.getSpan(context.active())?.setAttribute("http.status_code", result.status);
    const headers = new Headers(result.headers);
    headers.set("x-homa-timing-received", String(receivedAtMs));
    headers.set("x-homa-timing-headers", String(Date.now()));
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }, { sendId }); } finally { flushTimingRecords(); }
}
