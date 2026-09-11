import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveApiFamily } from "../../../../../lib/api-auth";
import { familyHasChannel } from "../../../../../lib/billing/channel-access";
import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { loadFamilyContextPinned, renderFamilyContext } from "../../../../../lib/family-context";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import { buildLiveSession } from "../../../../../lib/voice/live-session";
import { voiceSpeakerName } from "../../../../../lib/voice/realtime-session";

export const maxDuration = 60;
const API = "https://api.openai.com/v1/live/sessions";

function closeToken(sessionId: string, familyId: string, userId: string, key: string) {
  return createHmac("sha256", key).update(JSON.stringify(["homa-live-close", sessionId, familyId, userId])).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  if ((await familyWallCheckout(auth.familyId)) !== null) return Response.json({ ok: false, reason: "walled" }, { status: 403 });
  if (!(await familyHasChannel(auth.familyId))) return Response.json({ ok: false, reason: "not-included" }, { status: 403 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  let body: { sdp?: unknown } | null;
  try { body = await request.json(); } catch { return Response.json({ ok: false, reason: "bad-json" }, { status: 400 }); }
  if (typeof body?.sdp !== "string" || !body.sdp.startsWith("v=0") || body.sdp.length > 64_000) {
    return Response.json({ ok: false, reason: "bad-offer" }, { status: 400 });
  }
  if (rateLimited(`realtime-voice:${auth.familyId}`, 10, 86_400_000)) return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  let context = "";
  try {
    const rows = await loadFamilyContextPinned(auth.familyId);
    context = renderFamilyContext(rows, { speakingWith: voiceSpeakerName(rows.members, auth.userId) });
  } catch { /* Eve retrieves family facts on delegation if startup context is unavailable. */ }
  try {
    const session = buildLiveSession(context);
    // Existing voice-openai-direct credential ruling. Never retry a charged
    // create request after an ambiguous timeout and never expose the key.
    const response = await fetch(API, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session, transport: { type: "webrtc", sdp: body.sdp } }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (!response.ok || typeof result.session?.id !== "string" || typeof result.transport?.sdp !== "string") {
      console.error("Live session creation failed", response.status, result.error?.code);
      return Response.json({ ok: false, reason: "provider-error" }, { status: 502 });
    }
    const sessionId = result.session.id;
    await emitMapEvent("voice.realtime_session_started", { family_id: auth.familyId, model: session.model }, { familyId: auth.familyId }).catch(() => {});
    return Response.json({ sessionId, sdp: result.transport.sdp,
      closeToken: closeToken(sessionId, auth.familyId, auth.userId, key) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, reason: "provider-error" }, { status: 502 });
  }
}

/** A signed handle binds cleanup to the same authenticated adult and family.
 * It lets clients release paid sessions even when WebRTC setup fails. */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) return Response.json({ ok: false }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ ok: false }, { status: 503 });
  let body: { sessionId?: unknown; closeToken?: unknown } | null;
  try { body = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (typeof body?.sessionId !== "string" || body.sessionId.length > 200 || typeof body.closeToken !== "string" || !/^[a-f0-9]{64}$/.test(body.closeToken)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const expected = closeToken(body.sessionId, auth.familyId, auth.userId, key);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(body.closeToken))) return Response.json({ ok: false }, { status: 403 });
  try {
    const response = await fetch(`${API}/${encodeURIComponent(body.sessionId)}/hangup`, {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000),
    });
    return Response.json({ ok: response.ok }, { status: response.ok ? 200 : 502 });
  } catch { return Response.json({ ok: false }, { status: 502 }); }
}
