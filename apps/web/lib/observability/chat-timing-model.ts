import { trace, SpanStatusCode } from "@opentelemetry/api";
import { gateway } from "@ai-sdk/gateway";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";

import { timingRecord } from "./chat-timing";

/** Observe provider text separately from reasoning, setup chunks, and tool calls. */
export const chatTimingMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  async wrapStream({ doStream }) {
    const span = trace.getTracer("homa-chat-timing").startSpan("homa.model.provider_stream");
    const started = performance.now();
    const mark = (name: string) => {
      span.addEvent(name);
      timingRecord({ kind: "model.mark", name, atMs: Date.now(), elapsedMs: performance.now() - started, traceId: span.spanContext().traceId, spanId: span.spanContext().spanId });
    };
    let firstText = false;
    let firstReasoning = false;
    try {
      const result = await doStream();
      mark("model.headers_received");
      const reader = result.stream.getReader();
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) { span.end(); controller.close(); return; }
            const value = chunk.value;
            if (value.type === "text-delta" && value.delta.trim() && !firstText) {
              firstText = true; mark("model.first_answer_text");
            }
            if (value.type === "reasoning-delta" && value.delta.trim() && !firstReasoning) {
              firstReasoning = true; mark("model.first_reasoning");
            }
            if (value.type === "error") span.setStatus({ code: SpanStatusCode.ERROR });
            controller.enqueue(value);
          } catch(error) { span.setStatus({ code: SpanStatusCode.ERROR }); span.end(); controller.error(error); }
        },
        async cancel(reason) { mark("model.cancelled"); span.end(); await reader.cancel(reason); },
      }, { highWaterMark: 0 });
      return { ...result, stream };
    } catch(error) { span.setStatus({ code: SpanStatusCode.ERROR }); span.end(); throw error; }
  },
};
export function timedGatewayModel(id: string) {
  return wrapLanguageModel({ model: gateway(id), middleware: chatTimingMiddleware });
}
