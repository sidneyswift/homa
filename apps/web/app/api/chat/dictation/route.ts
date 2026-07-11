import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { transcribeAudio } from "../../../../lib/voice/transcribe";

/**
 * POST /api/chat/dictation: the web chat's voice input (PRD FR-4's
 * MediaRecorder -> Whisper leg; backlog M0-04/M1-05). The composer's mic
 * records with MediaRecorder, uploads the clip here as multipart form
 * data, and gets the transcript back to drop into the draft. The parent
 * reviews and edits the words before anything sends; this route never
 * touches the conversation itself.
 *
 * Auth: signed-in users only (the caller's cookie session). Nothing here
 * is family-scoped, no data is written; the gate exists because each
 * call spends Telnyx STT credits. Audio goes straight to the same
 * transcription core the SMS channel uses (lib/voice/transcribe.ts) and
 * is never stored.
 *
 * Fail-soft contract, matching the SMS lane: a clip we cannot hear
 * returns { transcript: null } with 200, and the client offers a retry
 * in Homa's voice. Hard failures use honest status codes.
 */

/** Vercel functions reject request bodies past ~4.5MB, so cap below it
 *  with a clear response instead of a platform error. At Opus voice
 *  bitrates this is roughly 15 minutes, far past a dictated prompt. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ transcript: null }, { status: 401 });
  }

  // Each clip spends Telnyx STT credits, so throttle per signed-in user
  // (IP as a fallback key) even though the route is auth-gated
  // (2026-07-11 review, CR-21). ~40 clips/hour is far past normal dictation.
  if (rateLimited(`dictation:${userData.user.id || clientIp(request)}`, 40, 60 * 60 * 1000)) {
    return Response.json({ transcript: null, reason: "rate-limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ transcript: null }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ transcript: null }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ transcript: null }, { status: 413 });
  }

  // MediaRecorder reports e.g. "audio/webm;codecs=opus" (Chrome) or
  // "audio/mp4" (iOS Safari); the transcriber maps both. An empty type
  // still transcribes: Telnyx content-probes the bytes.
  const contentType = audio.type.length > 0 ? audio.type : "audio/webm";
  const transcript = await transcribeAudio(await audio.arrayBuffer(), contentType);

  return Response.json({ transcript });
}
