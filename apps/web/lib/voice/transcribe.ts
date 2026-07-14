/**
 * Speech transcription, shared by two callers: inbound SMS media (the
 * attachment normalizer, lib/voice/sms-attachments.ts) and the web
 * chat's dictation route (app/api/chat/dictation). Audio becomes text
 * through Telnyx's speech-to-text endpoint
 * (POST /v2/ai/audio/transcriptions, Whisper-backed, OpenAI compatible):
 * ffmpeg on their side decodes whatever container arrives and, for
 * video, extracts the audio track. Chosen over the AI Gateway's STT,
 * which is beta with gradual access rollout, because it runs on the
 * TELNYX_API_KEY the SMS channel already requires: wherever SMS works,
 * transcription works, and the media never leaves the vendor that
 * delivered it. The backend is isolated here so a later swap (say,
 * Twelve Labs for real visual video understanding) is one file.
 *
 * Fail-soft by contract: returns null on any failure (download error,
 * format rejection, API error, silent clip), never throws. The caller
 * decides what a null means.
 *
 * The AMR question (build-log 2026-07-09): phones usually send MMS voice
 * notes as audio/amr or audio/3gpp, which the STT extension allowlist
 * rejects by filename. Verified live against the API (2026-07-09): the
 * allowlist checks ONLY the filename, while ffmpeg decodes the actual
 * bytes by content probing, exactly as the Telnyx audio-formats doc
 * states ("container format doesn't matter as long as ffmpeg can decode
 * it, the validated extension list is the actual restriction"). AMR-NB
 * bytes uploaded as voice-note.mp3 transcribed perfectly; the same bytes
 * as voice-note.amr got HTTP 400. So AMR-family and video types map onto
 * allowlisted extensions below. If Telnyx ever starts trusting the
 * extension for demuxing this breaks loudly, and the
 * sms.attachment_processed event (media_type + outcome) will show it
 * the day it happens.
 */

import { downloadTelnyxMedia } from "./telnyx-api";

const TELNYX_STT_URL = "https://api.telnyx.com/v2/ai/audio/transcriptions";

/** Telnyx STT default engine: Whisper large v3 turbo, 80+ languages. */
const TELNYX_STT_MODEL = "openai/whisper-large-v3-turbo";

/** The STT endpoint validates uploads by filename extension only (the
 *  bytes themselves are content-probed by ffmpeg; verified live, see
 *  header). Known types keep their honest extension; AMR-family audio
 *  and video containers map onto allowlisted neighbors, verified to
 *  transcribe correctly. */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/amr": "mp3",
  "audio/amr-wb": "mp3",
  "audio/3gpp": "mp4",
  "audio/3gpp2": "mp4",
  "video/mp4": "mp4",
  "video/3gpp": "mp4",
  "video/3gpp2": "mp4",
  "video/quicktime": "mp4",
  "video/webm": "webm",
};

/** Unknown types also upload as .mp3: the extension only has to pass
 *  the allowlist, decoding is content-based, and undecodable bytes fail
 *  soft on the API side either way. */
function extensionForContentType(contentType: string): string {
  const bare = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSION_BY_CONTENT_TYPE[bare] ?? "mp3";
}

/**
 * transcribeAudio(audio, contentType): Promise<string | null>
 * Sends audio (or video) bytes to Telnyx STT and returns the speech
 * transcript, or null on any failure (missing key, API error, silent
 * clip). Never throws. The shared core under transcribeSmsMedia and
 * the chat dictation route.
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || audio.byteLength === 0) return null;

  try {
    const form = new FormData();
    form.append("model", TELNYX_STT_MODEL);
    form.append(
      "file",
      new Blob([audio], { type: contentType }),
      `voice-note.${extensionForContentType(contentType)}`,
    );

    const response = await fetch(TELNYX_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      console.error(
        `audio transcription failed: HTTP ${response.status} (${contentType})`,
      );
      return null;
    }

    const payload = (await response.json()) as { text?: string };
    const transcript = payload.text?.trim() ?? "";
    return transcript.length > 0 ? transcript : null;
  } catch (error) {
    console.error(
      "audio transcription failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/**
 * transcribeSmsMedia(mediaUrl, contentType): Promise<string | null>
 * Downloads one MMS audio or video attachment and returns the speech
 * transcript, or null on any failure. Never throws.
 */
export async function transcribeSmsMedia(
  mediaUrl: string,
  contentType: string,
): Promise<string | null> {
  const media = await downloadTelnyxMedia(mediaUrl);
  if (!media) return null;
  return transcribeAudio(media, contentType);
}

/**
 * transcribeAudioUrl(fileUrl): Promise<string | null>
 * Lesson listen's fallback lane (plan 2026-07-13-lesson-listen.md
 * §4.2): a 30 to 60MB Voice Memos file never passes through a Vercel
 * function. Telnyx STT downloads the public URL itself (file_url,
 * 100MB cap, 15s download budget on their side, verified against
 * their REST docs 2026-07-13). Additive on purpose: transcribeAudio
 * and its SMS and dictation callers are untouched. Same fail-soft
 * contract: null on any failure, never throws.
 */
export async function transcribeAudioUrl(
  fileUrl: string,
): Promise<string | null> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || fileUrl.length === 0) return null;

  try {
    const form = new FormData();
    form.append("model", TELNYX_STT_MODEL);
    form.append("file_url", fileUrl);

    const response = await fetch(TELNYX_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      console.error(
        `audio url transcription failed: HTTP ${response.status}`,
      );
      return null;
    }

    const payload = (await response.json()) as { text?: string };
    const transcript = payload.text?.trim() ?? "";
    return transcript.length > 0 ? transcript : null;
  } catch (error) {
    console.error(
      "audio url transcription failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
