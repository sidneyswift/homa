import { createHash } from "node:crypto";
import { gateway } from "@ai-sdk/gateway";
import { get, list, put } from "@vercel/blob";
import { wrapLanguageModel } from "ai";

import { HOMA_MODEL } from "../agent/model";
import { benchEnabled, type BenchDependencies } from "./runtime-bench";

const base = gateway(HOMA_MODEL);
type Options = Parameters<typeof base.doStream>[0];
const run = "6a59d4a9dd4dd65b3af481f749fcebf3";
const child = "c603e48e-9c9f-469b-b41b-3fd74bfd66a0";
export const MATCHED_USER = "b4c62122-61c0-460a-8059-e0e6caf49955";
export const MATCHED_FAMILY = "6c7af6b8-bea2-430b-a759-6a1a03ea1c2a";
const prefix = `runtime-matched/${run}/`;
function token() {
  const value = process.env.HOMA_FAMILY_READ_WRITE_TOKEN || process.env.HOMA_LESSON_READ_WRITE_TOKEN;
  if (!value) throw new Error("Private experiment storage is unavailable");
  return value;
}
export function matchedEnabled() {
  return benchEnabled(process.env) && process.env.HOMA_RUNTIME_BENCH_USER_ID === MATCHED_USER;
}
export function serializableOptions(params: Options): Options {
  // Authentication and cancellation are transport state, never stored or replayed.
  const { abortSignal: _abort, headers: _headers, ...options } = params;
  void _abort; void _headers;
  return JSON.parse(JSON.stringify(options)) as Options;
}
export function requestHash(options: Options) {
  return createHash("sha256").update(JSON.stringify(options)).digest("hex");
}
function lastUserText(options: Options) {
  const message = options.prompt.findLast((item) => item.role === "user");
  return message?.content.filter((item) => item.type === "text").map((item) => item.text).join("\n") ?? "";
}
interface Capture {
  options: Options; hash: string; prompt: string; modelStartedAt: number;
  firstTextAt: number | null; finishedAt: number; firstRequest: boolean;
  usage: unknown; familyId: string; toolCalls: string[];
}

/** Captures only this preview's exact synthetic family, after streaming completes. */
export const matchedModel = wrapLanguageModel({
  model: base,
  middleware: {
    specificationVersion: "v4",
    async wrapStream({ doStream, params }) {
      if (!matchedEnabled()) return doStream();
      const options = serializableOptions(params);
      if (!JSON.stringify(options.prompt).includes(child)) return doStream();
      const modelStartedAt = Date.now();
      let firstTextAt: number | null = null;
      let usage: unknown = null;
      const toolCalls: string[] = [];
      const result = await doStream();
      return { ...result, stream: result.stream.pipeThrough(new TransformStream({
        transform(event, controller) {
          if (event.type === "text-delta" && event.delta.trim() && firstTextAt === null) firstTextAt = Date.now();
          if (event.type === "finish") usage = event.usage;
          if (event.type === "tool-call") toolCalls.push(event.toolName);
          controller.enqueue(event);
        },
        async flush() {
          const hash = requestHash(options);
          const captured: Capture = { options, hash, prompt: lastUserText(options), modelStartedAt, firstTextAt, finishedAt: Date.now(), firstRequest: options.prompt.at(-1)?.role === "user", usage, familyId: MATCHED_FAMILY, toolCalls };
          await put(`${prefix}${modelStartedAt}-${hash}.json`, JSON.stringify(captured), { access: "private", token: token(), addRandomSuffix: false, contentType: "application/json" });
        },
      })) };
    },
  },
});

export async function runMatched(prompt: string, deps: BenchDependencies) {
  if (!matchedEnabled()) throw new Error("Matched experiment is unavailable");
  // Preserve a real authenticated family read in the replay preparation path.
  const profile = await deps.lookup();
  if (!JSON.stringify(profile).includes(child)) throw new Error("Fixture identity mismatch");
  const objects = await list({ prefix, token: token(), limit: 30 });
  if (objects.hasMore) throw new Error("Capture bound exceeded");
  const candidates: Capture[] = [];
  for (const object of [...objects.blobs].sort((a, b) => b.pathname.localeCompare(a.pathname))) {
    const response = await get(object.url, { access: "private", token: token(), useCache: false });
    if (!response || response.statusCode !== 200) throw new Error("Capture unavailable");
    const capture = await new Response(response.stream).json() as Capture;
    if (capture.prompt === prompt && capture.firstRequest) { candidates.push(capture); break; }
  }
  const capture = candidates[0];
  if (!capture || capture.familyId !== MATCHED_FAMILY || requestHash(capture.options) !== capture.hash) throw new Error("No matching verified full request");
  deps.trace({ type: "matched.capture", hash: capture.hash, originalModelStartedAt: capture.modelStartedAt, originalFirstTextAt: capture.firstTextAt, originalUsage: capture.usage, originalToolCalls: capture.toolCalls, tools: capture.options.tools?.length, promptBytes: JSON.stringify(capture.options.prompt).length });
  const start = Date.now();
  const result = await base.doStream({ ...capture.options, abortSignal: deps.signal });
  const reader = result.stream.getReader();
  let answer = "";
  let stopped = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "text-delta") { answer += value.delta; deps.text(answer); }
      if (value.type === "finish") {
        deps.trace({ type: "matched.finish", durationMs: Date.now() - start, usage: value.usage, finishReason: value.finishReason });
        stopped = value.finishReason.unified === "stop";
      }
      if (value.type === "tool-call") throw new Error(`Replay requires real tool execution: ${value.toolName}`);
      if (value.type === "error") throw new Error("Matched model request failed");
    }
  } finally { await reader.cancel(); }
  if (!stopped || !answer.trim()) throw new Error("Matched replay did not complete an answer");
}
