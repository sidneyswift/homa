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

/**
 * Last-resort fallback, tried once only after the primary model is
 * confirmed exhausted (gh#1012, 2026-08-26): direct probes against the
 * live endpoint that day showed openai/whisper-large-v3-turbo returning
 * HTTP 500 on every input regardless of audio content, duration, or
 * container (silence, a clear tone, ffmpeg- and real MediaRecorder-
 * produced clips, 0.1s to 10s, webm and wav all failed identically),
 * while the exact same bytes transcribed cleanly on this model. So the
 * defect is Telnyx's primary model, not our audio pipeline.
 *
 * English-only (Hugging Face confirms distil-whisper checkpoints have no
 * multilingual release), unlike the 80-language primary, so this is
 * deliberately a fallback, not a replacement: Homa's families dictate in
 * Spanish and other languages, and a wrong-language guess here is
 * recoverable, never silent, because the parent always reviews the
 * transcript before it sends (M1-05's law, top of file). Revisit once
 * Telnyx confirms the primary model is fixed; see gh#1012.
 */
const TELNYX_STT_FALLBACK_MODEL = "distil-whisper/distil-large-v2";

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SttAttempt = { status: number; text?: string };
type SttPost = (model: string) => Promise<SttAttempt>;

/**
 * Runs one model against the STT endpoint, retrying transient failures
 * (HTTP 5xx, or a thrown/network error) up to maxAttempts times before
 * giving up on that model. A 4xx or a clean empty transcript is never
 * retried, since resending identical bytes would not change either
 * outcome. `exhausted: true` means every attempt on this model failed
 * transiently, the caller's cue to try the fallback model.
 */
async function attemptModel(
  post: SttPost,
  model: string,
  label: string,
  maxAttempts: number,
): Promise<{ transcript: string | null; exhausted: boolean }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { status, text } = await post(model);
      if (status >= 500 && attempt < maxAttempts) {
        console.error(
          `audio transcription failed: HTTP ${status} (${label}, ${model}), retrying`,
        );
        await delay(400);
        continue;
      }
      if (status >= 500) {
        console.error(
          `audio transcription failed: HTTP ${status} (${label}, ${model})`,
        );
        return { transcript: null, exhausted: true };
      }
      if (status >= 400) {
        console.error(
          `audio transcription failed: HTTP ${status} (${label}, ${model})`,
        );
        return { transcript: null, exhausted: false };
      }
      const transcript = text?.trim() ?? "";
      return { transcript: transcript.length > 0 ? transcript : null, exhausted: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (attempt < maxAttempts) {
        console.error(
          `audio transcription failed: ${message} (${label}, ${model}), retrying`,
        );
        await delay(400);
        continue;
      }
      console.error(`audio transcription failed: ${message} (${label}, ${model})`);
      return { transcript: null, exhausted: true };
    }
  }
  return { transcript: null, exhausted: true };
}

/**
 * Tries the primary model (one retry on a transient failure), and only
 * when that is fully exhausted falls back once to the secondary model.
 * See TELNYX_STT_FALLBACK_MODEL's comment for why this is a fallback,
 * not a default.
 */
async function transcribeWithFallback(post: SttPost, label: string): Promise<string | null> {
  const primary = await attemptModel(post, TELNYX_STT_MODEL, label, 2);
  if (!primary.exhausted) return primary.transcript;
  const fallback = await attemptModel(post, TELNYX_STT_FALLBACK_MODEL, label, 1);
  return fallback.transcript;
}

async function postFileToTelnyxStt(
  audio: ArrayBuffer,
  contentType: string,
  apiKey: string,
  model: string,
): Promise<SttAttempt> {
  const form = new FormData();
  form.append("model", model);
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
  if (!response.ok) return { status: response.status };

  const payload = (await response.json()) as { text?: string };
  return { status: response.status, text: payload.text };
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

  return transcribeWithFallback(
    (model) => postFileToTelnyxStt(audio, contentType, apiKey, model),
    contentType,
  );
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

async function postUrlToTelnyxStt(
  fileUrl: string,
  apiKey: string,
  model: string,
): Promise<SttAttempt> {
  const form = new FormData();
  form.append("model", model);
  form.append("file_url", fileUrl);

  const response = await fetch(TELNYX_STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) return { status: response.status };

  const payload = (await response.json()) as { text?: string };
  return { status: response.status, text: payload.text };
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

  return transcribeWithFallback(
    (model) => postUrlToTelnyxStt(fileUrl, apiKey, model),
    "file_url",
  );
}
