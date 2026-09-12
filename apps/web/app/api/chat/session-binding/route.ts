import { readWebSessionBinding } from "../../../../lib/conversation-continuity/web-session-binding";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { resolveApiFamily } from "../../../../lib/api-auth";
import { EveAuthServiceUnavailableError } from "../../../../lib/eve-authentication";
import { measureChatPreparation, type ChatPreparationMetadata } from "../../../../lib/observability/chat-preparation";

/**
 * GET /api/chat/session-binding
 *
 * The browser cannot read conversation_thread_bindings through the Data API,
 * by design. This narrow server read returns only the signed-in adult's own
 * web runtime cursor candidate plus its latest durable user-turn sequence;
 * family and member identity come from auth.
 */
export async function GET(request: Request): Promise<Response> {
  const timing: ChatPreparationMetadata = {};
  return measureChatPreparation("binding_total", async () => {
    const response = await readBindingResponse(request);
    timing.statusCode = response.status;
    return response;
  }, undefined, timing);
}

async function readBindingResponse(request: Request): Promise<Response> {
  if (rateLimited(`chat-session-binding:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let auth;
  try {
    auth = await resolveApiFamily(request, {
      transientAuthErrors: "throw", transientMembershipErrors: "throw", traceChatBinding: true,
    });
  } catch (error) {
    if (error instanceof EveAuthServiceUnavailableError) return error.response;
    console.error(
      "chat/session-binding auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!auth) {
    return Response.json(
      { ok: false, reason: "no-session" },
      { status: 401 },
    );
  }
  try {
    const binding = await measureChatPreparation("binding_read", () => readWebSessionBinding({
      familyId: auth.familyId,
      memberUserId: auth.userId,
    }));
    return Response.json({ ok: true, binding });
  } catch (error) {
    console.error(
      "chat/session-binding read failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "read-failed" },
      { status: 503 },
    );
  }
}
