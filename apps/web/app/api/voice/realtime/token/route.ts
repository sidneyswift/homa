import { gateway } from "@ai-sdk/gateway";

import { familyHasChannel } from "../../../../../lib/billing/channel-access";
import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { loadFamilyContextPinned, renderFamilyContext } from "../../../../../lib/family-context";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { buildRealtimeInstructions } from "../../../../../lib/voice/realtime-session";

/**
 * POST /api/voice/realtime/token: mints a short-lived credential for one
 * browser voice conversation (issue #283, founder direction 2026-07-29).
 *
 * This is in-app voice: she taps the composer's voice button, Homa talks
 * back, and the transcript streams into her chat. It is NOT the phone line.
 * Telnyx stays what it is, for someone who wants to dial a number.
 *
 * Credential posture, per ruling `voice-provider-key-telephony-only`
 * (2026-07-27): this path runs on **Vercel OIDC through the AI Gateway**,
 * so no OpenAI key is involved. `gateway.experimental_realtime.getToken()`
 * exchanges the server's OIDC credential for a single-use `vcst_` client
 * secret. The browser only ever sees that secret and the socket URL.
 *
 * The instructions are pinned HERE, server-side, and travel inside the
 * minted secret. A client cannot edit Homa's persona, her capability
 * boundary, or which family she is talking about. That is the whole reason
 * the session config is built in this route rather than passed from the
 * hook: `sessionConfig` on the client would put the honesty law in
 * editable browser code.
 *
 * familyId never comes from the request. It comes from the caller's own
 * membership row under their own RLS, exactly as /api/voice/call-me does.
 */

/** Matches the phone line's ceiling. A voice conversation is not free, and
 * the gateway bills audio at roughly 10x text. */
const MAX_SESSIONS_PER_FAMILY_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The gateway closes a realtime session at 25 minutes regardless; asking
 * for a shorter credential life bounds how long a leaked secret is worth
 * anything without shortening a real conversation. */
const TOKEN_TTL_SECONDS = 60 * 5;

/** `marin` and `cedar` are OpenAI's recommended pair for gpt-realtime.
 * Casting is a live founder decision (#286), so this is a starting point
 * and deliberately one constant to change. */
const VOICE = "marin";

const MODEL = "openai/gpt-realtime-2.1";

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return Response.json({ ok: false, reason: "no-family" }, { status: 404 });
  }
  const familyId = membership.family_id as string;

  // The wall: starting a voice conversation is an action, not existing
  // content, so there is no exemption. The button shows the offer on 403.
  if ((await familyWallCheckout(familyId)) !== null) {
    return Response.json({ ok: false, reason: "walled" }, { status: 403 });
  }
  if (!(await familyHasChannel(familyId))) {
    await emitMapEvent("sms.channel_gated", { channel: "voice" }, { familyId });
    return Response.json({ ok: false, reason: "not-included" }, { status: 403 });
  }
  if (rateLimited(`realtime-voice:${familyId}`, MAX_SESSIONS_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  // What Homa knows about this family, on the pinned server path because a
  // realtime session has no caller JWT to read under. Fail-soft: an empty
  // block opens a session that is less aware, never one that fails.
  let familyContext = "";
  try {
    const rows = await loadFamilyContextPinned(familyId);
    familyContext = renderFamilyContext(rows, { speakingWith: null });
  } catch (error) {
    console.error(
      "realtime token: family context load failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  try {
    const { token, url } = await gateway.experimental_realtime.getToken({
      model: MODEL,
      expiresAfterSeconds: TOKEN_TTL_SECONDS,
      sessionConfig: {
        voice: VOICE,
        instructions: buildRealtimeInstructions(familyContext),
        // Semantic turn detection handles "she paused to think" better
        // than a silence timer, which matters when a parent is working out
        // loud rather than dictating.
        turnDetection: { type: "semantic-vad" },
        // The transcript is the product here, not a byproduct: she reads it
        // while Homa talks, and it lands in her chat afterwards.
        inputAudioTranscription: {},
        // No tools in v1, stated in code as well as in the instructions so
        // the boundary is not prose alone.
        tools: [],
      },
    });

    await emitMapEvent(
      "voice.realtime_session_started",
      { family_id: familyId, model: MODEL },
      { familyId },
    );
    return Response.json({ ok: true, token, url, model: MODEL });
  } catch (error) {
    console.error(
      "realtime token: mint failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
}
