import { after } from "next/server";
import { z } from "zod";
import { persistCanonicalMessage } from "../../../../lib/conversation-continuity/ledger";
import { resolveApiFamily, requestAuthTransport } from "../../../../lib/api-auth";
import { projectTurn, runForeground } from "../../../../lib/foreground-preview/runner";
import { activeStatus, createTurnStore, PreviewConflict, PreviewNotFound, type Turn } from "../../../../lib/foreground-preview/store";

export const runtime = "nodejs";
export const maxDuration = 180;
export const preferredRegion = "iad1";
const deadline = Date.parse("2026-09-15T05:20:00Z");
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), sessionId: z.string().uuid(), turnId: z.string().uuid(), prompt: z.string().trim().min(1).max(2000), fault: z.enum(["none", "before_model", "during_tool", "worker_loss"]).default("none") }).strict(),
  z.object({ action: z.literal("cancel"), sessionId: z.string().uuid(), turnId: z.string().uuid() }).strict(),
]);
async function authorize(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || Date.now() >= deadline || !process.env.HOMA_FOREGROUND_PREVIEW_USER_ID) return null;
  const auth = await resolveApiFamily(request);
  if (!auth || auth.userId !== process.env.HOMA_FOREGROUND_PREVIEW_USER_ID) return null;
  const { data, error } = await auth.supabase.from("families").select("sandbox,status").eq("id", auth.familyId).single();
  return !error && data?.sandbox && data.status !== "deleted" ? auth : null;
}
function view(turn: Turn) {
  return { id: turn.id, prompt: turn.prompt, answer: turn.answer, status: turn.status, error: turn.error, sequence: turn.event_sequence };
}
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth) return new Response("Not found", { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid request", { status: 400 });
  const input = parsed.data;
  const owner = { userId: auth.userId, familyId: auth.familyId };
  const store = createTurnStore();
  try {
    if (input.action === "cancel") {
      await store.cancel(owner, input.sessionId, input.turnId);
      const turn = (await store.read(owner, input.sessionId)).find((item) => item.id === input.turnId);
      if (!turn) return new Response("Not found", { status: 404 });
      await projectTurn(owner, turn);
      return Response.json({ turn: view(turn) });
    }
    const transport = requestAuthTransport(request);
    const accessToken = transport.kind === "bearer" ? transport.token : (await auth.supabase.auth.getSession()).data.session?.access_token;
    if (!accessToken) return new Response("Please sign in again", { status: 401 });
    const result = await store.accept(owner, input.sessionId, input.turnId, input.prompt);
    if (result.claimed) {
      const saved = await persistCanonicalMessage({ attributes: { familyId: owner.familyId, memberUserId: owner.userId },
        sessionId: `foreground-${input.sessionId}`, turnId: input.turnId, channel: "web", role: "user", sequence: 0, content: input.prompt });
      if (!saved) throw new Error("Could not save the question to conversation history");
      // The promise starts now. Next's waitUntil-backed after keeps it alive when the browser disconnects.
      after(runForeground(owner, result.turn, accessToken, input.fault));
    }
    return Response.json({ claimed: result.claimed, turn: view(result.turn) }, { status: result.claimed ? 202 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PreviewNotFound) return new Response("Not found", { status: 404 });
    if (error instanceof PreviewConflict) return new Response(error.message, { status: 409 });
    return new Response("Could not start the saved answer", { status: 503 });
  }
}
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return new Response("Not found", { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("session");
  if (!z.string().uuid().safeParse(sessionId).success) return new Response("Invalid conversation", { status: 400 });
  const owner = { userId: auth.userId, familyId: auth.familyId };
  const store = createTurnStore();
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      let previous = "";
      const started = Date.now();
      try {
        while (!closed && !request.signal.aborted && Date.now() - started < 150000) {
          const turns = await store.read(owner, sessionId!);
          for (const turn of turns) if (turn.status === "interrupted" && !turn.projected_at) await projectTurn(owner, turn);
          const value = JSON.stringify({ type: "turns", turns: turns.map(view) });
          if (value !== previous && !closed) { output.enqueue(encoder.encode(value + "\n")); previous = value; }
          if (!turns.some((turn) => activeStatus(turn.status))) break;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch {
        if (!closed) output.enqueue(encoder.encode(JSON.stringify({ type: "connection_error" }) + "\n"));
      } finally { if (!closed) { closed = true; output.close(); } }
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform" } });
}
