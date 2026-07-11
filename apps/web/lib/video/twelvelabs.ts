/**
 * Twelve Labs video understanding (the video gateway's engine). One
 * vendor, one file, same isolation posture as lib/voice/transcribe.ts:
 * callers hand in a video and get back text, or null, and never need
 * to know which model watched it.
 *
 * Backend: POST /v1.3/analyze (sync), Pegasus 1.5. Chosen over the
 * older index-then-task-then-poll flow because it takes a public video
 * URL or base64 bytes directly and answers in one round trip, which is
 * exactly the gateway's shape: no index to manage, no task table, no
 * polling loop. Constraints from the API reference (2026-07-11):
 * clips must be 4 seconds to 1 hour, at least 360x360, URL uploads to
 * 2GB, base64 to 30MB encoded. Raw fetch, no SDK, so the module stays
 * eve-build safe and dependency-free.
 *
 * Fail-soft by contract: returns null on any failure (missing key,
 * download error, API error, empty output), never throws. The caller
 * decides what a null means (the SMS lane falls back to audio-track
 * transcription; the describe route returns { description: null }).
 *
 * Input floors (founder instruction 2026-07-11, "add the extra
 * second"): when the API rejects a clip for being under 4 seconds or
 * under 360x360 (codes captured live: video_duration_too_short,
 * video_resolution_too_low), the clip gets one conform-and-retry pass
 * through lib/video/pad.ts (freeze-frame tail to 5s, upscale to the
 * floor). Padding needs ffmpeg on the runtime: dev machines have it,
 * Vercel does not yet, and there the retry declines and the original
 * null contract stands.
 *
 * Env: TWELVELABS_API_KEY (server-only). Unset = twelveLabsConfigured()
 * is false and every call returns null, so deployments without the key
 * degrade cleanly.
 */

import { conformVideoToFloors } from "./pad";

const TWELVELABS_ANALYZE_URL = "https://api.twelvelabs.io/v1.3/analyze";

/** Pegasus 1.5: the generative video model (visuals + speech + on-screen
 *  text). 1.2 is the older default; 1.5 is the one that accepts direct
 *  URL/base64 video context without prior indexing. */
const TWELVELABS_MODEL = "pegasus1.5";

/** Descriptions, not essays: enough tokens for a detailed paragraph of
 *  what happened, small enough to keep latency and cost flat. */
const MAX_OUTPUT_TOKENS = 1024;

/** The base64 lane's ceiling: the API caps encoded payloads at 30MB and
 *  base64 inflates bytes by 4/3, so 20MB raw stays safely under it.
 *  (MMS video arrives around 1MB; this guard is for misbehaving URLs.) */
export const VIDEO_BYTES_MAX = 20 * 1024 * 1024;

/** Sync analysis holds the connection while the model watches the clip;
 *  short clips answer in well under a minute, so the default budget is
 *  generous without pinning a serverless function for its full 300s. */
const DEFAULT_TIMEOUT_MS = 240_000;

/**
 * What Homa needs from a parent's video: a text stand-in faithful
 * enough that the agent can respond as if it watched. Who appears and
 * what they do, what is said, and the learning content, because the
 * agent's next moves are usually a warm reply, a memory save, or a
 * time log.
 */
export const HOMA_VIDEO_PROMPT = `This is a short video a homeschooling parent shared with their family's assistant. Describe it so the assistant can respond as if it watched the video itself:
- who appears (say "an adult" or "a child"; never guess names or ages) and what they are doing, concretely
- what is said, quoted or closely paraphrased, noting who says it
- any learning activity: the subject, the specific skill being practiced, materials or books visible, and how the child seems to be doing with it
- anything the parent likely wants noticed (a milestone, a struggle, something funny or sweet)
Write plain prose in 3 to 8 sentences, no headers, no bullet points, no timestamps. If there is no clear learning activity, simply describe what happens. Describe only what is actually visible or audible: if the video is blank, dark, or too unclear to describe faithfully, say exactly that instead of guessing.`;

export interface DescribeVideoOptions {
  /** Replaces HOMA_VIDEO_PROMPT for callers with a sharper question. */
  prompt?: string;
  /** Tighter budgets for latency-sensitive lanes (the SMS reply path). */
  timeoutMs?: number;
}

export function twelveLabsConfigured(): boolean {
  return Boolean(process.env.TWELVELABS_API_KEY);
}

/** The /analyze request's video field: a public direct-file URL, or the
 *  bytes themselves base64-encoded (30MB encoded cap). */
type VideoContext =
  | { type: "url"; url: string }
  | { type: "base64_string"; base64_string: string };

/** Non-streaming /analyze response, per the v1.3 OpenAPI spec. */
interface AnalyzeResponse {
  id?: string;
  data?: string;
  finish_reason?: string;
  error?: { message?: string };
}

/** Rejections the conform pass can actually fix (captured live
 *  2026-07-11 against real under-floor clips). */
const CONFORMABLE_ERROR_CODES = new Set([
  "video_duration_too_short",
  "video_resolution_too_low",
]);

/** Internal result: public functions collapse this to string | null,
 *  but the retry logic needs to see WHY an attempt failed. */
type AnalyzeAttempt =
  | { ok: true; text: string }
  | { ok: false; conformable: boolean };

async function analyzeVideo(
  video: VideoContext,
  options?: DescribeVideoOptions,
): Promise<AnalyzeAttempt> {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) return { ok: false, conformable: false };

  try {
    const response = await fetch(TWELVELABS_ANALYZE_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_name: TWELVELABS_MODEL,
        video,
        prompt: options?.prompt ?? HOMA_VIDEO_PROMPT,
        stream: false,
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      let code: string | null = null;
      try {
        code = (JSON.parse(detail) as { code?: string }).code ?? null;
      } catch {
        // Non-JSON error body; the log below still carries the text.
      }
      console.error(
        `twelvelabs analyze failed: HTTP ${response.status} ${detail.slice(0, 300)}`,
      );
      return {
        ok: false,
        conformable: code !== null && CONFORMABLE_ERROR_CODES.has(code),
      };
    }

    const payload = (await response.json()) as AnalyzeResponse;
    // finish_reason "length" still carries usable partial text in data,
    // so only emptiness counts as failure.
    const text = payload.data?.trim() ?? "";
    return text.length > 0
      ? { ok: true, text }
      : { ok: false, conformable: false };
  } catch (error) {
    console.error(
      "twelvelabs analyze failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { ok: false, conformable: false };
  }
}

/** The shared retry: when an attempt failed on an input floor, conform
 *  the bytes (pad/upscale) and try once more. Bytes must already be in
 *  hand; a null from the pad (no ffmpeg here, nothing fixable) keeps
 *  the original failure. */
async function retryConformed(
  bytes: ArrayBuffer,
  options?: DescribeVideoOptions,
): Promise<string | null> {
  const conformed = await conformVideoToFloors(bytes);
  if (!conformed) return null;
  const retried = await analyzeVideo(
    {
      type: "base64_string",
      base64_string: Buffer.from(conformed).toString("base64"),
    },
    options,
  );
  return retried.ok ? retried.text : null;
}

/**
 * describeVideoAtUrl(url, options?): Promise<string | null>
 * Has Pegasus watch a video at a publicly fetchable direct-file URL
 * (Blob's random-suffix URLs qualify) and returns descriptive text, or
 * null on any failure. When the video sits under an input floor, the
 * bytes come down once for a conform-and-retry pass. Never throws.
 * Used by the describe route, which verifies URL ownership before
 * calling; this module fetches only what its caller already vetted.
 */
export async function describeVideoAtUrl(
  url: string,
  options?: DescribeVideoOptions,
): Promise<string | null> {
  const attempt = await analyzeVideo({ type: "url", url }, options);
  if (attempt.ok) return attempt.text;
  if (!attempt.conformable) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > VIDEO_BYTES_MAX) return null;
    return await retryConformed(bytes, options);
  } catch (error) {
    console.error(
      "twelvelabs conform download failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/**
 * describeVideoBytes(bytes, options?): Promise<string | null>
 * Same, for video bytes already in hand (the SMS lane's Telnyx media,
 * which sits behind auth headers Twelve Labs cannot send). Bytes above
 * VIDEO_BYTES_MAX return null immediately; under-floor clips get one
 * conform-and-retry pass. Never throws.
 */
export async function describeVideoBytes(
  bytes: ArrayBuffer,
  options?: DescribeVideoOptions,
): Promise<string | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > VIDEO_BYTES_MAX) return null;
  const attempt = await analyzeVideo(
    {
      type: "base64_string",
      base64_string: Buffer.from(bytes).toString("base64"),
    },
    options,
  );
  if (attempt.ok) return attempt.text;
  if (!attempt.conformable) return null;
  return await retryConformed(bytes, options);
}
