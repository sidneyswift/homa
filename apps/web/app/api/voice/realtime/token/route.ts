import { openai } from "@ai-sdk/openai";

import { familyHasChannel } from "../../../../../lib/billing/channel-access";
import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { loadFamilyContextPinned, renderFamilyContext } from "../../../../../lib/family-context";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { buildRealtimeInstructions } from "../../../../../lib/voice/realtime-session";
import { realtimeToolDefinitions } from "../../../../../lib/voice/realtime-tools";

/**
 * POST /api/voice/realtime/token: mints a short-lived credential for one
 * browser voice conversation (issue #283, founder direction 2026-07-29).
 *
 * This is in-app voice: she taps the composer's voice button, Homa talks
 * back, and the transcript streams into her chat. It is NOT the phone line.
 * Telnyx stays what it is, for someone who wants to dial a number.
 *
 * Credential posture. This mints against OpenAI directly with
 * `OPENAI_API_KEY`, not through the AI Gateway on Vercel OIDC.
 *
 * That is a correction, not a preference. The gateway route was built first
 * because Vercel's docs say `getToken` accepts "apiKey,
 * AI_GATEWAY_API_KEY, or Vercel OIDC token". It does not: in production it
 * answered `Client secrets can only be minted with a Gateway API key`, so
 * every session failed at connect. The OIDC path for realtime does not
 * exist, and ruling `voice-provider-key-telephony-only` was made on that
 * false premise (see `voice-openai-direct`, 2026-07-29).
 *
 * What going direct does and does not buy, stated honestly because the
 * first version of this comment claimed WebRTC and was wrong. The AI SDK's
 * OpenAI realtime path is WebSocket too (`wss://api.openai.com/v1/realtime`),
 * so the transport is the same as the gateway's. What actually changes: it
 * works at all, the gateway's 25 minute session and 5 minute idle caps do
 * not apply, and image input becomes possible, which the gateway documents
 * as unsupported. WebRTC would be a further step and a different client.
 *
 * The key never reaches the browser. `getToken` exchanges it for a
 * single-use `ek_` client secret, and only that plus the socket URL are
 * returned.
 *
 * The instructions are pinned HERE, server-side, and travel inside the
 * minted secret. A client cannot edit Homa's persona, her capability
 * boundary, or which family she is talking about. That is the whole reason
 * the session config is built in this route rather than passed from the
 * hook: `sessionConfig` on the client would put the honesty law in
 * editable browser code.
 *
 * The tool DEFINITIONS do travel back through the browser, because the hook
 * sends them in its own session update once the socket opens. That is not a
 * hole: definitions only tell the model what it may ask for, and every ask
 * is executed by /api/voice/realtime/tool, which refuses any name outside
 * its allowlist. A tampered list buys a client nothing but a refusal.
 *
 * The success response is the bare setup shape the AI SDK expects
 * ({ token, url, tools }). Failures answer non-2xx with a `reason` the
 * composer can say out loud, which is why the component reads this route
 * again on a failed connect rather than guessing.
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

/** Ruled `voice-marin` (2026-07-29) after listening, not from a document.
 * `marin` is OpenAI's female realtime voice; `cedar` is the male one.
 *
 * This rules the BROWSER voice only. The phone still speaks with Telnyx's
 * "Callie - Encourager" and cannot use `marin`, because Telnyx hosts that
 * voice and OpenAI hosts this one. So Homa has two voices today, and a
 * parent who uses both hears two people. Known, accepted while in-app voice
 * is new, and it resolves only if the phone moves to gpt-realtime (Phase 3). */
const VOICE = "marin";

const MODEL = "gpt-realtime-2.1";

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

  const tools = realtimeToolDefinitions();
  try {
    const { token, url } = await openai.experimental_realtime.getToken({
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
        // Pinned server-side, so the browser cannot add a tool Homa was
        // never meant to have. Derived from the same zod schemas eve
        // validates against, so the model's arguments and the tool's
        // expectations cannot drift apart.
        tools,
      },
    });

    await emitMapEvent(
      "voice.realtime_session_started",
      { family_id: familyId, model: MODEL },
      { familyId },
    );
    return Response.json({ token, url, tools });
  } catch (error) {
    console.error(
      "realtime token: mint failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
}
