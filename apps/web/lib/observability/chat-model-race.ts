import { randomUUID } from "node:crypto";

import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";

import { HOMA_MODEL } from "../../agent/model";

type StreamInput = Parameters<NonNullable<LanguageModelMiddleware["wrapStream"]>>[0];
type StreamResult = Awaited<ReturnType<StreamInput["model"]["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

interface Attempt {
  index: number;
  controller: AbortController;
  prefix: StreamPart[];
  prefixChars: number;
  result?: StreamResult;
  reader?: ReadableStreamDefaultReader<StreamPart>;
  error?: unknown;
  settled: boolean;
  finished: boolean;
}

/** These bounds end speculation; they never discard a long reasoning response. */
const MAX_PREFIX_PARTS = 4096;
const MAX_PREFIX_CHARS = 1_000_000;

export function previewModelRaceEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" && process.env.HOMA_PREVIEW_MODEL_RACE === "1";
}

const REGISTRATION = Symbol.for("homa.previewChatModelRace");

/** Keep Eve's string model identity, routing, attribution, and caching intact. */
export function registerPreviewChatModelRace(): void {
  if (!previewModelRaceEnabled()) return;
  const provider = globalThis.AI_SDK_DEFAULT_PROVIDER ?? gateway;
  if (Reflect.get(provider, REGISTRATION)) return;
  globalThis.AI_SDK_DEFAULT_PROVIDER = new Proxy(provider, {
    get(target, property) {
      if (property === REGISTRATION) return true;
      if (property === "languageModel") return (id: string) => {
        const model = target.languageModel(id);
        return id === HOMA_MODEL
          ? wrapLanguageModel({ model, middleware: createChatModelRace(true) })
          : model;
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Race inference below tool execution. Never run two Eve turns or mix their protocols. */
export function createChatModelRace(requireMainAgentTitle = false): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    async wrapStream({ model, params, doStream }) {
      // Eve attributes its main agent as "web". Standalone extraction/report
      // calls sharing Astra do not have this header and stay single requests.
      if (requireMainAgentTitle && (!previewModelRaceEnabled() || params.headers?.["x-title"] !== "web")) {
        return doStream();
      }
      // A provider tool can act remotely before a stream wins. Raw chunks can
      // also carry unbounded opaque values that cannot be safely prefix-buffered.
      if (params.tools?.some(tool => tool.type === "provider") || params.includeRawChunks) {
        return doStream();
      }
      params.abortSignal?.throwIfAborted();
      const raceId = randomUUID();
      const startedAtMs = Date.now();
      const started = performance.now();
      const attempts: Attempt[] = [0, 1].map(index => ({ index, controller: new AbortController(),
        prefix: [], prefixChars: 0, settled: false, finished: false }));
      const selection = Promise.withResolvers<Attempt>();
      let winner: Attempt | undefined;
      let selectionEnded = false;

      function record(stage: string, fields: Record<string, string | number>) {
        try {
          console.info("[chat-model-race]", JSON.stringify({ stage, raceId, startedAtMs,
            elapsedMs: Math.round(performance.now() - started), ...fields }));
        } catch {
          // Diagnostic failure cannot interrupt the selected model stream.
        }
      }
      function finish(attempt: Attempt, outcome: "completed" | "failed" | "cancelled") {
        if (attempt.finished) return;
        attempt.finished = true;
        record("attempt_finished", { index: attempt.index, outcome });
      }
      function cancel(attempt: Attempt) {
        if (!attempt.controller.signal.aborted) {
          record("cancel_requested", { index: attempt.index });
          attempt.controller.abort(new Error("Preview inference no longer needed"));
        }
        // Cancellation is requested immediately, but a slow cancellation must
        // not hold up the winning text. The losing pump always handles settlement.
        releaseReader(attempt);
      }
      function releaseReader(attempt: Attempt) {
        const reader = attempt.reader;
        if (reader) void reader.cancel().catch(() => {}).finally(() => {
          try { reader.releaseLock(); } catch { /* An in-flight read still owns the lock. */ }
        });
      }
      function choose(attempt: Attempt, reason: "answer" | "tool" | "prefix_bound" | "terminal") {
        if (selectionEnded) return false;
        selectionEnded = true;
        winner = attempt;
        record("winner_selected", { index: attempt.index, reason });
        for (const other of attempts) if (other !== attempt) cancel(other);
        selection.resolve(attempt);
        return true;
      }
      function abort() {
        for (const attempt of attempts) cancel(attempt);
        if (!selectionEnded) {
          selectionEnded = true;
          selection.reject(params.abortSignal?.reason ?? new Error("Preview inference cancelled"));
        }
      }
      params.abortSignal?.addEventListener("abort", abort, { once: true });
      if (params.abortSignal?.aborted) abort();

      async function open(attempt: Attempt) {
        try {
          const signal = params.abortSignal
            ? AbortSignal.any([params.abortSignal, attempt.controller.signal])
            : attempt.controller.signal;
          signal.throwIfAborted();
          record("attempt_started", { index: attempt.index });
          attempt.result = await model.doStream({ ...params, abortSignal: signal });
          if (signal.aborted) {
            await attempt.result.stream.cancel().catch(() => {});
            finish(attempt, "cancelled");
            return;
          }
          attempt.reader = attempt.result.stream.getReader();
          while (true) {
            const part = await attempt.reader.read();
            if (signal.aborted) { finish(attempt, "cancelled"); return; }
            if (part.done) { finish(attempt, "completed"); return; }
            attempt.prefix.push(part.value);
            if (part.value.type === "error") { finish(attempt, "failed"); return; }
            if (part.value.type === "text-delta" && part.value.delta.trim().length) {
              if (choose(attempt, "answer")) return;
            } else if (part.value.type === "tool-call" || part.value.type === "tool-approval-request") {
              if (choose(attempt, "tool")) return;
            } else if (part.value.type === "file") {
              if (choose(attempt, "answer")) return;
            }
            if ("delta" in part.value) attempt.prefixChars += part.value.delta.length;
            if (attempt.prefix.length >= MAX_PREFIX_PARTS || attempt.prefixChars >= MAX_PREFIX_CHARS) {
              if (choose(attempt, "prefix_bound")) return;
            }
          }
        } catch (error) {
          attempt.error = error;
          // Preserve an already-open stream's error in its stream, so the SDK
          // does not turn it into a retryable pre-stream connection failure.
          if (attempt.result) attempt.prefix.push({ type: "error", error });
          finish(attempt, attempt.controller.signal.aborted ? "cancelled" : "failed");
        } finally {
          attempt.settled = true;
          if (!selectionEnded && attempts.every(candidate => candidate.settled)) {
            // Empty/error streams still reach the SDK unchanged if neither
            // copy supplies content. An open failure retains its original error.
            const terminal = attempts.find(candidate => candidate.result);
            if (terminal) choose(terminal, "terminal");
            else {
              selectionEnded = true;
              selection.reject(attempts[0].error ?? new Error("Both preview inferences failed"));
            }
          }
          if (winner !== attempt || attempt.finished) releaseReader(attempt);
        }
      }
      for (const attempt of attempts) void open(attempt);

      let selected: Attempt;
      try { selected = await selection.promise; }
      catch (error) {
        params.abortSignal?.removeEventListener("abort", abort);
        throw error;
      }
      const result = selected.result!;
      let prefixIndex = 0;
      const cleanup = () => params.abortSignal?.removeEventListener("abort", abort);
      return {
        ...result,
        stream: new ReadableStream<StreamPart>({
          async pull(controller) {
            try {
              params.abortSignal?.throwIfAborted();
              if (prefixIndex < selected.prefix.length) {
                controller.enqueue(selected.prefix[prefixIndex++]);
                return;
              }
              if (selected.finished) { cleanup(); controller.close(); return; }
              const next = await selected.reader!.read();
              if (next.done) {
                finish(selected, "completed");
                selected.reader!.releaseLock();
                cleanup();
                controller.close();
              } else {
                if (next.value.type === "error") {
                  finish(selected, "failed");
                  cancel(selected);
                }
                controller.enqueue(next.value);
              }
            } catch (error) {
              finish(selected, selected.controller.signal.aborted ? "cancelled" : "failed");
              cancel(selected);
              cleanup();
              controller.error(error);
            }
          },
          async cancel() {
            for (const attempt of attempts) cancel(attempt);
            finish(selected, "cancelled");
            cleanup();
          },
        }),
      };
    },
  };
}
