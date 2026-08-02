import { chatHistoryResponse } from "../../../../lib/chat-history-route";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";

/**
 * GET /api/chat/history
 *
 * Returns the same per-adult durable transcript used by the web chat to a
 * verified mobile bearer session. No family or member identifier is accepted
 * from the request; chatHistoryResponse resolves both through auth and RLS.
 */
export async function GET(request: Request): Promise<Response> {
  if (rateLimited(`chat-history:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }
  return chatHistoryResponse(request);
}
