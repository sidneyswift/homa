import { fetch as expoFetch } from "expo/fetch";

/**
 * eve's client reads `response.body` as a ReadableStream (NDJSON turn
 * events). React Native's built-in fetch cannot stream response bodies;
 * expo/fetch (the WinterCG-compliant implementation, SDK 52+) can. We
 * install it as the global fetch once at startup so eve/react,
 * supabase-js, and @homa/core's emitEvent all share one spec-compliant
 * fetch. eve offers no per-client fetch injection, so global is the seam.
 */
export function installStreamingFetch(): void {
  globalThis.fetch = expoFetch as unknown as typeof globalThis.fetch;

  // eve's stream-disconnect detection does `instanceof DOMException`,
  // which throws if the global is missing entirely (Hermes has no DOM).
  if (typeof globalThis.DOMException === "undefined") {
    class DOMExceptionShim extends Error {
      constructor(message?: string, name = "Error") {
        super(message);
        this.name = name;
      }
    }
    (globalThis as Record<string, unknown>).DOMException = DOMExceptionShim;
  }
}
