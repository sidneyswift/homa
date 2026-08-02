import { generateImage } from "ai";

import {
  gatewayAttribution,
  recordModelUsage,
  type UsageChannel,
} from "../model-usage";
import { isFamilyArtifactUrl, uploadStudioImageBytes } from "./artifact-store";

/**
 * Image generation for the materials studio, through the Vercel AI
 * Gateway (GPT Image 2 by default): the same gateway the chat agent
 * already speaks through, so no separate credential exists. Model id is
 * env-swappable (config over convention): HOMA_IMAGE_MODEL changes the
 * model without a deploy, and the calibration harness
 * (scripts/materials-calibration.mts) re-baselines what the new model
 * can do.
 *
 * Not illustration-shaped on purpose (founder direction 2026-07-10):
 * callers may be making coloring art, a themed header, an infographic,
 * or the entire page in one image. Reference images (the family's own
 * approved finals, validated by isFamilyArtifactUrl) steer style and
 * enable "same page, different character" without re-imagining.
 *
 * Image models return bytes, never a hosted URL, so this module owns
 * the one hop that makes the result reusable: decode, upload to Blob,
 * hand back a plain https URL. Every call records a model_usage row and
 * tags the Gateway request for /v1/report attribution (MS-6).
 */

const DEFAULT_IMAGE_MODEL = "openai/gpt-image-2";
const GENERATION_TIMEOUT_MS = 150_000;
/**
 * Both attempts together, held under TOOL_DEADLINE.generate (240s) with
 * margin. A policy refusal returns in seconds, not minutes, so in
 * practice the fallback has nearly the whole budget; this exists so a
 * slow primary cannot push the pair past the tool's own deadline.
 */
const TOTAL_GENERATION_BUDGET_MS = 200_000;
/** Do not start a fallback that cannot plausibly finish. */
const MIN_FALLBACK_BUDGET_MS = 20_000;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

/** GPT Image 2's five supported output sizes, named for what a page
 * designer actually reaches for. */
const SHAPE_SIZE = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
  tall: "1024x1792",
  wide: "1792x1024",
} as const satisfies Record<string, `${number}x${number}`>;

export const IMAGE_SHAPES = Object.keys(SHAPE_SIZE) as (keyof typeof SHAPE_SIZE)[];
export type ImageShape = keyof typeof SHAPE_SIZE;

export function imageModelId(): string {
  return process.env.HOMA_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
}

/**
 * The model that gets one retry when the primary refuses on content
 * policy, or null when the feature is off.
 *
 * Founder ruling 2026-07-29 (`franchise-character-fallback-model`, gh#449):
 * a parent asking for her kid's favorite character should get that
 * character. Vendors differ on character likeness and each answers for
 * itself, so this is procurement through config, not a way around
 * anyone's control: measured the same day, gpt-image-2 and seedream and
 * grok refuse Pikachu while flux-fast-schnell and imagen-4.0-fast render
 * it faithfully. Setting the variable IS the flag; unset means the
 * refusal stands and Homa offers the theme-object route instead.
 *
 * A fallback model must honor `size`, because SHAPE_SIZE controls whether
 * a full-page material comes out portrait. flux-fast-schnell does exactly
 * (verified 1024x1536 in, 1024x1536 out); imagen-4.0 does not accept
 * `size` at all and would silently square a full-page build, so it is a
 * bad value here despite the cleaner line art. Evidence:
 * docs/homa-planning/materials/calibration/2026-07-29-franchise-refusal-boundary.md
 */
export function imageFallbackModelId(): string | null {
  const configured = process.env.HOMA_IMAGE_FALLBACK_MODEL?.trim();
  if (!configured) return null;
  return configured === imageModelId() ? null : configured;
}

export type StudioImageResult =
  | { ok: true; url: string; viaFallbackModel?: string }
  | { ok: false; note: string };

/**
 * Why a generation failed, in the only three flavors that change what
 * Homa should do next.
 *
 * - policy: the provider refused the prompt (moderation, character
 *   likeness, content filter). Retrying the same subject is futile.
 * - rejected: the provider refused the request as written for a
 *   non-policy reason (an oversized or unreadable reference image, a
 *   malformed field). An identical retry fails identically.
 * - transient: rate limit, provider outage, network. Retrying works.
 *
 * Cause (2026-07-29, the "that is not pokemon" failure): every
 * Pikachu-faithful prompt was refused for trademark likeness, and this
 * module reported all three flavors as "try a reworded prompt", so Homa
 * rewrote toward ever more generic prompts until an off-brand lookalike
 * passed and shipped. The parent was never told exact franchise likeness
 * is unavailable. Same shape as the "Ps5 astrobot" correction in the
 * 07-28 field study (J6).
 */
export type ImageFailureKind = "policy" | "rejected" | "transient";

/**
 * Provider error taxonomy, not natural language: these are machine
 * codes and provider-authored templates ("moderation_blocked",
 * "rejected as a result of our safety system"), so matching them is
 * verification, not the interpretation that models-judge-code-verifies
 * reserves for a model. The structured signals (status code,
 * retryability) lead; this list is the net that catches the code
 * wherever in the error chain the provider left it.
 *
 * Among request failures this errs toward "policy" on purpose: a false
 * positive costs one honest note that names a real alternative, while a
 * miss costs retry decay and an off-brand character on a printed page,
 * which is the bug. Retryable failures are exempt from that lean (see
 * classifyImageFailure).
 */
const POLICY_MARKERS = [
  "moderation_blocked",
  "moderation",
  "content_policy",
  "content policy",
  "content_filter",
  "content filter",
  "safety system",
  "safety_violation",
  "prohibited_content",
  "trademark",
  "copyright",
  "public figure",
] as const;

/**
 * Read only what the PROVIDER said. Never add `requestBodyValues`: it
 * carries our own prompt, so a legitimate page about copyright or
 * trademarks would classify its own unrelated failure as a refusal.
 */
const SIGNAL_KEYS = ["name", "message", "type", "code", "responseBody"] as const;
const MAX_CAUSE_DEPTH = 5;

function stringifySignal(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/**
 * Flatten an error and its cause chain into one lowercased haystack plus
 * the first status code and retryability found. The gateway re-types an
 * upstream refusal by `error.type` and drops `error.code` on the floor,
 * so the raw "moderation_blocked" survives only on the nested
 * APICallError's responseBody and data. Read the whole chain or miss it.
 */
function errorSignals(error: unknown): {
  text: string;
  statusCode?: number;
  retryable?: boolean;
} {
  const parts: string[] = [];
  let statusCode: number | undefined;
  let retryable: boolean | undefined;
  let node: unknown = error;

  for (let depth = 0; node != null && depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof node === "string") {
      parts.push(node);
      break;
    }
    if (typeof node !== "object") break;
    const record = node as Record<string, unknown>;
    for (const key of SIGNAL_KEYS) {
      const value = record[key];
      if (typeof value === "string") parts.push(value);
    }
    if (record.data !== undefined) parts.push(stringifySignal(record.data));
    if (statusCode === undefined && typeof record.statusCode === "number") {
      statusCode = record.statusCode;
    }
    if (retryable === undefined && typeof record.isRetryable === "boolean") {
      retryable = record.isRetryable;
    }
    node = record.cause;
  }

  return { text: parts.join("\n").toLowerCase(), statusCode, retryable };
}

/** Which of the three flavors this provider error is. Exported for tests. */
export function classifyImageFailure(error: unknown): ImageFailureKind {
  const { text, statusCode, retryable } = errorSignals(error);
  // Retryability is the provider's own verdict, and it outranks body text.
  // A 502's HTML error page can carry a "Copyright" footer, and no
  // refusal is ever marked retryable, so reading markers first would let
  // an outage tell a parent her character is blocked. That is a confident
  // lie, which is worse than the generic note this fix replaced.
  if (retryable === true) return "transient";
  if (POLICY_MARKERS.some((marker) => text.includes(marker))) return "policy";
  // A client error the provider marked non-retryable is a request problem:
  // 408 and 429 are the two 4xx codes that mean "come back later".
  if (
    statusCode !== undefined &&
    statusCode >= 400 &&
    statusCode < 500 &&
    statusCode !== 408 &&
    statusCode !== 429
  ) {
    return "rejected";
  }
  return "transient";
}

/**
 * The note Homa reads. Each one has to answer "so what do I do now?"
 * differently, because that is the whole point of classifying.
 */
export function imageFailureNote(kind: ImageFailureKind): string {
  switch (kind) {
    case "policy":
      return "The image provider declined this prompt as written, likely character likeness or content policy. Refusal is per-franchise, not a rule about all characters, so this is about this request. A reference image from the family's own library is the legitimate lever worth one try; simply re-wording toward a vaguer version of the same character is not, because that is how an off-brand lookalike ships. If it refuses again, tell the parent plainly which character you could not draw and offer what does work: a theme-object header (the poke balls one worked) or a close-but-not-canon original.";
    case "rejected":
      return "The image provider rejected this request as written, and it did not call the failure temporary, so an identical retry fails identically. Change the request itself: simplify the prompt, or drop a reference image that may be too large or an unreadable format.";
    case "transient":
      return "Image generation failed this time. Try a reworded prompt, or design the page without it.";
  }
}

async function fetchReferenceBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > 0 && bytes.byteLength <= MAX_REFERENCE_BYTES
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether a failed attempt earns the one fallback retry. Pure so the rule
 * is testable without a provider: only a content-policy refusal qualifies,
 * because that is the only failure a different vendor's policy can
 * actually change. A transient failure should retry on the SAME model, and
 * a rejected request is broken as written on any model.
 */
export function shouldTryPolicyFallback(input: {
  failure: ImageFailureKind;
  fallbackModel: string | null;
  budgetLeftMs: number;
}): boolean {
  if (input.failure !== "policy") return false;
  if (!input.fallbackModel) return false;
  return input.budgetLeftMs >= MIN_FALLBACK_BUDGET_MS;
}

type AttemptOutcome =
  | { kind: "ok"; base64: string; mediaType?: string; usage: GeneratedUsage; imagesCount: number }
  | { kind: "empty" }
  | { kind: "timeout" }
  | { kind: "failed"; failure: ImageFailureKind; error: unknown };

interface GeneratedUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * One generation attempt against one model. Owns its own abort deadline so
 * the caller can run a second attempt inside a shared wall-clock budget,
 * and classifies its own failure so the caller only decides what to do.
 */
async function attemptGeneration(input: {
  model: string;
  familyId: string;
  prompt: string | { images: Uint8Array[]; text: string };
  size: `${number}x${number}`;
  timeoutMs: number;
}): Promise<AttemptOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const result = await generateImage({
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: gatewayAttribution(input.familyId, "materials_image"),
      },
    });
    const image = result.image;
    if (!image?.base64) return { kind: "empty" };
    return {
      kind: "ok",
      base64: image.base64,
      mediaType: image.mediaType,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      imagesCount: result.images.length,
    };
  } catch (error) {
    if (controller.signal.aborted) return { kind: "timeout" };
    return { kind: "failed", failure: classifyImageFailure(error), error };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * generateStudioImage(...): one hosted image URL or a model-readable
 * failure note. Never throws: a generation hiccup should read as "try a
 * simpler prompt", not a broken turn.
 *
 * On a content-policy refusal it retries once on HOMA_IMAGE_FALLBACK_MODEL
 * when one is configured (founder ruling 2026-07-29, gh#449), because
 * vendors disagree about character likeness and a parent asking for her
 * kid's favorite character should get that character. If the fallback
 * also fails, for any reason, the honest policy note stands: a broken
 * fallback must never turn into a vaguer message than the refusal it was
 * trying to rescue.
 */
export async function generateStudioImage(input: {
  familyId: string;
  channel: UsageChannel;
  sessionId: string;
  turnId: string;
  prompt: string;
  shape?: ImageShape;
  referenceImageUrls?: string[];
  /**
   * Pre-trusted reference bytes from the fleet anchor registry (no family
   * data, no URL). The tool resolves anchor ids to these bytes; they are
   * NOT subject to isFamilyArtifactUrl because they never came from a URL
   * and carry no tenant boundary. Anchors lead, so they set the bar.
   */
  anchorBytes?: readonly Uint8Array[];
}): Promise<StudioImageResult> {
  const anchorReferences = (input.anchorBytes ?? []).slice(0, MAX_REFERENCE_IMAGES);
  const urlBudget = MAX_REFERENCE_IMAGES - anchorReferences.length;
  const referenceUrls = (input.referenceImageUrls ?? []).slice(0, Math.max(0, urlBudget));
  for (const url of referenceUrls) {
    if (!isFamilyArtifactUrl(url, input.familyId)) {
      return {
        ok: false,
        note: "Reference images must come from this family's own library (a previewUrl or image url a tool returned). Drop the outside URL and try again.",
      };
    }
  }

  const references: Uint8Array[] = [...anchorReferences];
  for (const url of referenceUrls) {
    const bytes = await fetchReferenceBytes(url);
    if (!bytes) {
      return {
        ok: false,
        note: "One of the reference images could not be loaded. Re-check it with find_materials, or generate without references.",
      };
    }
    references.push(bytes);
  }

  const size = SHAPE_SIZE[input.shape ?? "square"];
  const prompt =
    references.length > 0
      ? { images: references, text: input.prompt }
      : input.prompt;
  const startedAt = Date.now();
  const budgetLeft = () =>
    TOTAL_GENERATION_BUDGET_MS - (Date.now() - startedAt);

  const primaryModel = imageModelId();
  let attemptStartedAt = startedAt;
  let outcome = await attemptGeneration({
    model: primaryModel,
    familyId: input.familyId,
    prompt,
    size,
    timeoutMs: Math.min(GENERATION_TIMEOUT_MS, budgetLeft()),
  });
  let usedModel = primaryModel;
  let fallbackModel: string | null = null;

  if (outcome.kind === "failed") {
    // Runtime logs are the per-turn diagnostics surface for tool failures,
    // so the classification goes in the log line: "image_failure=policy"
    // is greppable, and a policy cluster is a product signal, not noise.
    console.error(
      `generateStudioImage failed: image_failure=${outcome.failure} model=${primaryModel}`,
      outcome.error instanceof Error ? outcome.error.message : "unknown",
    );

    const candidate = imageFallbackModelId();
    if (
      candidate &&
      shouldTryPolicyFallback({
        failure: outcome.failure,
        fallbackModel: candidate,
        budgetLeftMs: budgetLeft(),
      })
    ) {
      const refusalNote = imageFailureNote(outcome.failure);
      attemptStartedAt = Date.now();
      const retried = await attemptGeneration({
        model: candidate,
        familyId: input.familyId,
        prompt,
        size,
        timeoutMs: Math.min(GENERATION_TIMEOUT_MS, budgetLeft()),
      });
      if (retried.kind === "ok") {
        console.log(
          `generateStudioImage policy fallback succeeded: model=${candidate}`,
        );
        outcome = retried;
        usedModel = candidate;
        fallbackModel = candidate;
      } else {
        // The fallback is a bonus, never an excuse to report something
        // vaguer than the refusal that triggered it.
        console.error(
          `generateStudioImage policy fallback failed: model=${candidate} outcome=${retried.kind}`,
        );
        return { ok: false, note: refusalNote };
      }
    } else {
      return { ok: false, note: imageFailureNote(outcome.failure) };
    }
  }

  if (outcome.kind === "timeout") {
    return {
      ok: false,
      note: "The image is taking too long. Try once more with a simpler prompt, or design the page without it.",
    };
  }
  if (outcome.kind === "empty") {
    return {
      ok: false,
      note: "The image provider returned nothing usable. Try a reworded prompt, or design the page without it.",
    };
  }

  await recordModelUsage({
    familyId: input.familyId,
    surface: "materials_image",
    channel: input.channel,
    // The model that actually produced the bytes, so a fallback's spend is
    // attributed to the fallback and not hidden under the primary.
    model: usedModel,
    modality: "image",
    inputTokens: outcome.usage.inputTokens,
    outputTokens: outcome.usage.outputTokens,
    imagesCount: outcome.imagesCount,
    imageSize: size,
    durationMs: Date.now() - attemptStartedAt,
    sessionId: input.sessionId,
    turnId: input.turnId,
  });

  const url = await uploadStudioImageBytes({
    familyId: input.familyId,
    bytes: Buffer.from(outcome.base64, "base64"),
    mediaType: outcome.mediaType ?? "image/png",
  });
  return fallbackModel
    ? { ok: true, url, viaFallbackModel: fallbackModel }
    : { ok: true, url };
}
