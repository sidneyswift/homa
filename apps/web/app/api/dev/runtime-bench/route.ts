import { randomUUID } from "node:crypto";

import { z } from "zod";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { persistCanonicalMessage } from "../../../../lib/conversation-continuity/ledger";
import { loadFamilyContextPinned, renderFamilyContext } from "../../../../lib/family-context";
import { benchEnabled, createSavedPublisher, runDirect, runHosted, type BenchEvent } from "../../../../lib/runtime-bench";

export const runtime = "nodejs";
export const maxDuration = 180;
export const preferredRegion = "iad1";

const schema = z.object({ arm: z.enum(["direct", "agents"]), prompt: z.string().trim().min(1).max(1000) }).strict();

export async function POST(request: Request) {
  const started = Date.now();
  if (!benchEnabled(process.env)) return new Response("Not found", { status: 404 });
  const auth = await resolveApiFamily(request);
  if (!auth || auth.userId !== process.env.HOMA_RUNTIME_BENCH_USER_ID) return new Response("Not found", { status: 404 });
  const { data: family, error } = await auth.supabase.from("families").select("sandbox,status").eq("id", auth.familyId).single();
  if (error || !family?.sandbox || family.status === "deleted") return new Response("Not found", { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid experiment request", { status: 400 });
  const { arm, prompt } = parsed.data;
  const sessionId = `runtime-bench-${randomUUID()}`;
  const turnId = randomUUID();
  const attributes = { familyId: auth.familyId, memberUserId: auth.userId };
  const base = { attributes, sessionId, turnId, channel: "web" as const };
  const input = await persistCanonicalMessage({ ...base, role: "user", content: prompt, sequence: 0 });
  if (!input) return new Response("Could not save the question", { status: 503 });
  const savedBase = { ...base, attributes: { ...attributes, episodeId: input.episodeId } };
  const trace: BenchEvent[] = [{ type: "bench.prepared", elapsedMs: Date.now() - started }];
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(150000)]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      let closed = false;
      const send = (event: BenchEvent) => { if (!closed) output.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      const record = (event: BenchEvent) => {
        if (trace.length >= 6000) throw new Error("Experiment event limit reached");
        trace.push({ elapsedMs: Date.now() - started, ...event });
      };
      const publisher = createSavedPublisher(async (text) => {
        const saved = await persistCanonicalMessage({ ...savedBase, role: "assistant", content: text, sequence: 1, terminal: false });
        if (!saved) throw new Error("Could not save the answer");
      }, (text) => send({ type: "answer", text, elapsedMs: Date.now() - started }));
      try {
        send({ type: "started", sessionId, arm, model: "gpt-6-astra", reasoning: "medium" });
        const run = arm === "direct" ? runDirect : runHosted;
        await run(prompt, {
          signal, text: publisher.update, trace: record,
          async lookup() {
            signal.throwIfAborted();
            const before = Date.now();
            const profile = renderFamilyContext(await loadFamilyContextPinned(auth.familyId));
            record({ type: "bench.family_lookup", durationMs: Date.now() - before });
            return { profile };
          },
        });
        const answer = await publisher.finish();
        const saved = await persistCanonicalMessage({ ...savedBase, role: "assistant", content: answer, sequence: 1, terminal: true });
        if (!saved) throw new Error("Could not finish saving the answer");
        send({ type: "completed", sessionId, messageId: saved.id, elapsedMs: Date.now() - started, trace });
      } catch (failure) {
        controller.abort();
        await publisher.finish().catch(() => undefined);
        send({ type: "failed", sessionId, message: failure instanceof Error ? failure.message : "Experiment failed", elapsedMs: Date.now() - started, trace });
      } finally {
        closed = true;
        output.close();
      }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform" } });
}
