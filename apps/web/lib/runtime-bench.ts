import { isStepCount, streamText, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL, HOMA_REASONING } from "../agent/model";
import { VOICE_PERSONA_MARKDOWN } from "./voice/persona.generated";

export const BENCH_INSTRUCTIONS = `${VOICE_PERSONA_MARKDOWN}\n\nThis preview supports introductions, explanations, and family profile lookups only. Use get_family_profile when asked what is saved about this family. It reads the authenticated family's current records. Do not claim to create materials or take other actions. Answer the question directly, without a separate acknowledgement. Keep these small answers to three sentences.`;

export type BenchArm = "direct" | "agents";
export const BENCH_DEADLINE = Date.parse("2026-09-15T04:00:00Z");
export function benchEnabled(environment: Record<string, string | undefined>, now = Date.now()) {
  return environment.VERCEL_ENV === "preview" && Boolean(environment.HOMA_RUNTIME_BENCH_USER_ID) && now < BENCH_DEADLINE;
}
export type BenchEvent = { type: string; [key: string]: unknown };
export interface BenchDependencies {
  signal: AbortSignal;
  lookup(): Promise<unknown>;
  text(value: string): void;
  trace(event: BenchEvent): void;
}

const lookupDescription = "Read the authenticated family's saved profile, including its children and parent names. Takes no family ID or other arguments.";

/** Decode complete SSE frames even when a UTF-8 character crosses chunks. */
export async function* readSse(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data) as BenchEvent;
    }
  }
  if (buffer.trim()) throw new Error("Provider stream ended in a partial event");
}

export async function runDirect(prompt: string, deps: BenchDependencies) {
  let answer = "";
  const result = streamText({
    model: HOMA_MODEL,
    system: BENCH_INSTRUCTIONS,
    prompt,
    providerOptions: { openai: { reasoningEffort: HOMA_REASONING } },
    abortSignal: deps.signal,
    stopWhen: isStepCount(3),
    maxRetries: 0,
    tools: {
      get_family_profile: tool({
        description: lookupDescription,
        inputSchema: z.object({}).strict(),
        execute: deps.lookup,
      }),
    },
  });
  for await (const event of result.fullStream) {
    deps.trace({ ...event });
    if (event.type === "error") throw new Error("Gateway model request failed");
    if (event.type === "text-delta") {
      answer += event.text;
      deps.text(answer);
    }
  }
  const finishReason = await result.finishReason;
  if (finishReason !== "stop" || !answer.trim()) throw new Error(`Incomplete answer: ${finishReason}`);
}

/** One fresh hosted session per sample, including session startup in the clock. */
export async function runHosted(prompt: string, deps: BenchDependencies) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI access is unavailable");
  async function request(path: string, body?: unknown) {
    const response = await fetch(`https://api.openai.com/v1/agents/sessions${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${key}`, "OpenAI-Beta": "agents=v1", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: deps.signal,
    });
    deps.trace({ type: "provider_http", status: response.status, requestId: response.headers.get("x-request-id"), path });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    return response;
  }
  const response = await request("", {
    agent: {
      model: "gpt-6-astra", reasoning: { effort: HOMA_REASONING }, instructions: BENCH_INSTRUCTIONS,
      tools: [{ type: "function", name: "get_family_profile", description: lookupDescription, parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }],
    },
    environment: { type: "none" }, input: prompt, stream: true,
  });
  if (!response.body) throw new Error("No hosted response stream");
  const parts = new Map<string, string>();
  const handled = new Set<string>();
  let sessionId: string | undefined;
  let completed = false;
  for await (const event of readSse(response.body)) {
    deps.trace(event);
    if (typeof event.session_id === "string") sessionId = event.session_id;
    const session = event.session as { id?: string } | undefined;
    sessionId ??= session?.id;
    if (event.type === "agent.session.turn.output_text.delta" || event.type === "agent.session.turn.output_text.done") {
      const part = `${event.item_id}:${event.content_index}`;
      parts.set(part, event.type.endsWith(".delta") ? (parts.get(part) ?? "") + String(event.delta ?? "") : String(event.text ?? ""));
      deps.text([...parts.values()].join("\n\n"));
    }
    if (event.type === "agent.session.requires_action") {
      if (!sessionId) throw new Error("Missing hosted session identity");
      const state = await (await request(`/${encodeURIComponent(sessionId)}`)).json() as {
        required_actions?: Array<{ type: string; name: string; arguments: unknown; turn_id: string; call_id: string }>;
      };
      for (const action of state.required_actions ?? []) {
        if (handled.has(action.call_id)) continue;
        if (handled.size >= 3 || action.type !== "function_call" || action.name !== "get_family_profile" || !z.object({}).strict().safeParse(action.arguments).success) throw new Error("Unsupported hosted action");
        handled.add(action.call_id);
        const output = await deps.lookup();
        deps.trace({ type: "bench.tool_result", callId: action.call_id, output });
        await request(`/${encodeURIComponent(sessionId)}/events`, { events: [{ type: "agent.session.input.tool_result", turn_id: action.turn_id, call_id: action.call_id, success: true, output: JSON.stringify(output) }] });
      }
    }
    if (event.type === "agent.session.turn.completed") { completed = true; break; }
    if (event.type === "error" || event.type.endsWith(".failed") || event.type.endsWith(".cancelled")) throw new Error(`Hosted turn failed: ${event.type}`);
  }
  if (!completed || ![...parts.values()].join("").trim()) throw new Error("Hosted stream ended without a completed answer");
}

/** Backpressure coalesces text, but never publishes a byte before its save. */
export function createSavedPublisher(save: (text: string) => Promise<void>, publish: (text: string) => void) {
  let pending = "";
  let saved = "";
  let task: Promise<void> | undefined;
  let failure: unknown;
  const pump = async () => {
    while (pending !== saved) {
      const snapshot = pending;
      await save(snapshot);
      saved = snapshot;
      publish(snapshot);
    }
  };
  return {
    update(text: string) {
      if (text.length > 7000) throw new Error("Experiment answer exceeded its storage bound");
      pending = text;
      if (!task && !failure && pending.trim()) task = pump().catch((error) => { failure = error; }).finally(() => { task = undefined; });
    },
    async finish() {
      await task;
      if (failure) throw failure;
      if (pending !== saved && pending.trim()) await pump();
      return saved;
    },
  };
}
