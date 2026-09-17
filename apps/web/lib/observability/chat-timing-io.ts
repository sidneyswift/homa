import { context, trace, SpanStatusCode } from "@opentelemetry/api";

import { timeServer } from "./chat-timing-server";

/** Preserve lazy Postgres queries: timing starts when the query is awaited, never at construction. */
export function timedSql<T extends (...args: never[]) => unknown>(sql: T): T {
  const queries = new WeakMap<object, object>();
  function wrapQuery(value: unknown): unknown {
    if (!value || typeof value !== "object" || !("then" in value) || typeof value.then !== "function") return value;
    const previous = queries.get(value); if (previous) return previous;
    let observed: Promise<unknown> | undefined;
    const result = new Proxy(value, {
      get(target, key) {
        if (key === "then") return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
          observed ??= timeServer("homa.database.query", () => target as PromiseLike<unknown>);
          return observed.then(resolve, reject);
        };
        const member = Reflect.get(target, key, target);
        return typeof member === "function" ? (...args: unknown[]) => wrapQuery(Reflect.apply(member, target, args)) : member;
      },
    });
    queries.set(value, result); return result;
  }
  return new Proxy(sql, {
    apply(target, thisArg, args) { return wrapQuery(Reflect.apply(target, thisArg, args)); },
    get(target, key) {
      const member = Reflect.get(target, key, target);
      if (typeof member === "function" && (key === "begin" || key === "savepoint")) return (...args: unknown[]) => timeServer("homa.database.transaction", () => Reflect.apply(member, target, args.map(arg => typeof arg === "function" ? (tx: T) => arg(timedSql(tx)) : arg)));
      return typeof member === "function" ? (...args: unknown[]) => wrapQuery(Reflect.apply(member, target, args)) : member;
    },
  });
}
let fetchRegistered = false;
/** One observer per process; no extra request, body read, retries, or buffering. */
export function registerTimingFetch(): void {
  if (fetchRegistered) return;
  fetchRegistered = true;
  const original = globalThis.fetch;
  globalThis.fetch = async function(input, init) {
    if (!trace.getSpan(context.active())) return original(input, init);
    const tracer = trace.getTracer("homa-chat-timing");
    const span = tracer.startSpan("homa.http.outbound");
    try {
      const response = await original(input, init);
      span.addEvent("headers.received");
      span.setAttribute("http.status_code", response.status);
      if (!response.body) { span.end(); return response; }
      let first = true;
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (chunk.done) { span.end(); controller.close(); return; }
            if (first) { first = false; span.addEvent("body.first_byte"); }
            controller.enqueue(chunk.value);
          } catch (error) { span.setStatus({code: SpanStatusCode.ERROR}); span.end(); controller.error(error); }
        },
        async cancel(reason) { span.addEvent("body.cancelled"); span.end(); await reader.cancel(reason); },
      }, { highWaterMark: 0 });
      const wrapped = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      // Preserve standard fetch metadata used by SDKs, while keeping body streaming.
      for (const key of ["url", "redirected", "type"] as const) Object.defineProperty(wrapped, key, { value: response[key] });
      return wrapped;
    } catch (error) { span.setStatus({code: SpanStatusCode.ERROR}); span.end(); throw error; }
  };
}
