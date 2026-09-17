import { resolveApiFamily } from "../../../../lib/api-auth";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { flushTimingRecords, timingRecord } from "../../../../lib/observability/chat-timing";
import { browserTimingBatch } from "../../../../lib/observability/chat-timing-browser-contract";

/** Authenticated, bounded metadata only. Runs after visibility, never in the answer's critical path. */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`chat-timing:${clientIp(request)}`, 60)) return new Response(null, { status: 429 });
  if (!await resolveApiFamily(request)) return new Response(null, { status: 401 });
  if (!request.body) return new Response(null, { status: 400 });
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 64_000) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = browserTimingBatch.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return new Response(null, { status: 400 });
    for (const record of parsed.data) timingRecord({ ...record, source: "authenticated-browser", receivedAtMs: Date.now() });
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
  finally { flushTimingRecords(); }
}
