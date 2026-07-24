/**
 * Minimal server-side Telnyx REST helper for app routes and jobs (the
 * scripts/ folder keeps its own copy in telnyx-shared.mts; this one exists
 * so app code never imports from scripts/). Reads TELNYX_API_KEY from the
 * environment; callers must check telnyxConfigured() first so a
 * deployment without the key degrades to a clean skip, never a crash.
 */

import { planSmsParts, smsSegmentCount } from "../sms-segments";
import { findSmsSuppression } from "../sms-suppression";

const API_BASE = "https://api.telnyx.com/v2";

export function telnyxConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY);
}

export class TelnyxApiError extends Error {
  constructor(
    readonly status: number,
    method: string,
    urlPath: string,
  ) {
    super(`${method} ${urlPath} failed: HTTP ${status}`);
    this.name = "TelnyxApiError";
  }
}

export async function telnyxGet<T = unknown>(urlPath: string): Promise<T> {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new TelnyxApiError(0, "GET", urlPath);
  const response = await fetch(`${API_BASE}${urlPath}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new TelnyxApiError(response.status, "GET", urlPath);
  const text = await response.text();
  return (text.length > 0 ? JSON.parse(text) : {}) as T;
}

/** Telnyx wraps list responses as {data}; tolerate bare arrays too. */
export function telnyxListOf<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const container = payload as { data?: T[] };
  return container.data ?? [];
}

/**
 * downloadTelnyxMedia(mediaUrl): Promise<ArrayBuffer | null>
 * Downloads one inbound MMS media file (used by the SMS attachment
 * lanes: transcription, documents, text files). URLs are ephemeral and
 * may require API-key auth; the bearer header is safe because undici
 * strips Authorization on any cross-origin redirect. Returns null on
 * any failure, never throws, so attachment handling stays fail-soft.
 */
export async function downloadTelnyxMedia(
  mediaUrl: string,
): Promise<ArrayBuffer | null> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      console.error(`telnyx media download failed: HTTP ${response.status}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error(
      "telnyx media download failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/**
 * Sends one outbound text from Homa's number. Returns false (never
 * throws) when the channel is dark or the send fails, so a caller like
 * the journal loop can fall back to email. Telnyx handles STOP/HELP
 * opt-outs at the platform level for this number.
 *
 * mediaUrls upgrades the send to MMS. Printable PDFs are moved into the
 * message text as direct links so the worksheet preview stays below carrier
 * media limits. Media must be publicly fetchable; Blob's random-suffix URLs
 * qualify.
 */
export type HomaSmsSubmission =
  | { status: "submitted"; messageId: string }
  | {
      status: "rejected";
      reason?: string;
      permanentCode?: string;
      unsupportedRegion?: boolean;
    }
  | { status: "unknown" };

export function classifyTelnyxHttpFailure(
  status: number,
): "rejected" | "unknown" {
  return status === 408 || status === 429 || status >= 500
    ? "unknown"
    : "rejected";
}

/**
 * Telnyx error codes that condemn the destination itself, not just this
 * message: 40300 (blocked, the recipient texted STOP). A rejection
 * carrying one is permanent for the number; the delivery path records it
 * in sms_suppressions so the next cycle skips instead of re-burning a
 * guaranteed rejection (morning-brief conversion escalation, 2026-07-23).
 *
 * 40309 used to live in this set too, on the assumption it meant a dead
 * or invalid number. It does not: it means this messaging profile cannot
 * reach the destination's region (see TELNYX_UNSUPPORTED_REGION_CODE
 * below), a number that works fine over email. Suppressing it here would
 * block the email fallback for a family whose only problem is a Canadian
 * area code, so it is handled separately and never enters this set.
 */
const PERMANENT_DESTINATION_FAILURE_CODES = new Set(["40300"]);

export function permanentTelnyxFailureCode(body: string): string | null {
  try {
    const payload = JSON.parse(body) as {
      errors?: Array<{ code?: unknown }>;
    };
    return (
      (payload.errors ?? [])
        .map((entry) => String(entry.code ?? ""))
        .find((code) => PERMANENT_DESTINATION_FAILURE_CODES.has(code)) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Telnyx's own code for a destination whose region this messaging profile
 * cannot reach: "40309 Invalid destination region". Our sole-prop 10DLC
 * profile is US-only, so a Canadian or other non-US +1 number (which passes
 * our +1 normalization and the family_phones shape check) is rejected here
 * on every send. This is the AUTHORITATIVE regional signal: we cannot tell a
 * US +1 from a Canadian +1 by its digits without duplicating the NANP
 * registry, but the provider knows, so we let its verdict drive the
 * email-only switch (dispatch-transport). See the 2026-07-23 founder-console
 * cleanup and the Mani Family (+1 236, British Columbia) daily failures.
 */
const TELNYX_UNSUPPORTED_REGION_CODE = "40309";

/**
 * Keeps printable PDFs out of the MMS media payload and preserves them as
 * direct links in the message text. Carrier document limits are much smaller
 * than Homa's print-quality PDFs, while the preview JPEG remains MMS-safe.
 */
function normalizePrintablePdfMediaAsLinks(
  text: string,
  mediaUrls?: string[],
): { text: string; mediaUrls?: string[] } {
  const printablePdfUrls: string[] = [];
  const mmsMediaUrls: string[] = [];

  for (const mediaUrl of mediaUrls ?? []) {
    const pathWithoutQueryOrFragment = mediaUrl.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
    if (pathWithoutQueryOrFragment.endsWith(".pdf")) {
      printablePdfUrls.push(mediaUrl);
    } else {
      mmsMediaUrls.push(mediaUrl);
    }
  }

  const missingPdfLinks = printablePdfUrls.filter(
    (printablePdfUrl) => !text.includes(printablePdfUrl),
  );
  const normalizedText =
    missingPdfLinks.length === 0
      ? text
      : [text.trim(), ...missingPdfLinks].filter(Boolean).join(" ");

  return {
    text: normalizedText,
    ...(mmsMediaUrls.length > 0 ? { mediaUrls: mmsMediaUrls } : {}),
  };
}

/** Pulls Telnyx's own error codes and titles out of a failure body so
 *  the log line says WHY, not just the HTTP status (the 2026-07-13
 *  morning-brief incident was diagnosable only by replaying the send).
 *  `codes` are the raw error codes (stringified, since Telnyx sends them
 *  as strings but tolerating a number is cheap), so callers can react to a
 *  specific one (40309, unsupported region) without re-parsing. */
function describeTelnyxErrorBody(body: string): {
  detail: string | null;
  codes: string[];
} {
  try {
    const payload = JSON.parse(body) as {
      errors?: Array<{ code?: string | number; title?: string; detail?: string }>;
    };
    const errors = payload.errors ?? [];
    const described = errors
      .map((entry) =>
        [entry.code, entry.title ?? entry.detail].filter(Boolean).join(" "),
      )
      .filter((line) => line.length > 0)
      .join("; ");
    return {
      detail: described.length > 0 ? described.slice(0, 300) : null,
      codes: errors
        .map((entry) => (entry.code === undefined ? "" : String(entry.code)))
        .filter((code) => code.length > 0),
    };
  } catch {
    return { detail: null, codes: [] };
  }
}

/**
 * Detailed submission result for side effects that must distinguish a
 * provider rejection from a transport failure after Telnyx may have
 * accepted the message.
 */
async function submitOneTelnyxMessage(input: {
  apiKey: string;
  fromNumber: string;
  toE164: string;
  text: string;
  mediaUrls?: string[];
  signal?: AbortSignal;
}): Promise<HomaSmsSubmission> {
  try {
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.fromNumber,
        to: input.toE164,
        text: input.text,
        ...(input.mediaUrls ? { media_urls: input.mediaUrls } : {}),
      }),
      signal: input.signal,
    });
    if (!response.ok) {
      const { detail, codes } = describeTelnyxErrorBody(await response.text());
      console.error(
        `sendHomaSms failed: HTTP ${response.status}${detail ? ` (${detail})` : ""}`,
      );
      const status = classifyTelnyxHttpFailure(response.status);
      if (status !== "rejected") return { status };
      const permanentCode = codes.find((code) =>
        PERMANENT_DESTINATION_FAILURE_CODES.has(code),
      );
      return {
        status,
        reason: detail
          ? `Telnyx rejected the send: ${detail}`
          : `Telnyx rejected the send (HTTP ${response.status})`,
        ...(permanentCode ? { permanentCode } : {}),
        // The provider's authoritative "I can't reach this region" verdict:
        // the destination is un-textable from this profile, so the caller
        // switches the family to email-only rather than retrying daily.
        // Mutually exclusive with permanentCode in practice (40300 vs
        // 40309), but both fields are independent so neither masks the
        // other if Telnyx ever returns both codes at once.
        ...(codes.includes(TELNYX_UNSUPPORTED_REGION_CODE)
          ? { unsupportedRegion: true as const }
          : {}),
      };
    }
    const payload = (await response.json()) as { data?: { id?: unknown } };
    const messageId = payload.data?.id;
    if (typeof messageId !== "string" || !messageId) {
      console.error("sendHomaSms returned no message id");
      return { status: "unknown" };
    }
    return { status: "submitted", messageId };
  } catch (error) {
    console.error(
      "sendHomaSms failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { status: "unknown" };
  }
}

export async function submitHomaSms(
  toE164: string,
  text: string,
  mediaUrls?: string[],
  signal?: AbortSignal,
): Promise<HomaSmsSubmission> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (process.env.TELNYX_SMS_ENABLED !== "true" || !apiKey || !fromNumber) {
    return { status: "rejected", reason: "SMS channel not configured" };
  }

  // Internal opt-out honor: a number in sms_suppressions (an inbound
  // STOP, or a prior permanent rejection) is refused before Telnyx ever
  // sees it. The read fails open, so a store outage leaves the carrier
  // block as the backstop, exactly the pre-store behavior.
  const suppression = await findSmsSuppression(toE164);
  if (suppression) {
    return {
      status: "rejected",
      reason: `SMS suppressed (${suppression.reason})`,
    };
  }

  const normalizedPayload = normalizePrintablePdfMediaAsLinks(text, mediaUrls);

  // Telnyx hard-rejects texts over the carrier segment cap (HTTP 400,
  // error 40302). Instead of refusing outright (the 2026-07-16/17 digest
  // failures), oversized texts are transliterated to GSM-7 and, when
  // still too long, split into a few carrier-legal messages. Only a
  // pathological payload is refused. MMS sizes by media, not segments.
  const isMms =
    Boolean(normalizedPayload.mediaUrls) &&
    (normalizedPayload.mediaUrls?.length ?? 0) > 0;
  let bodies = [normalizedPayload.text];
  if (!isMms) {
    const plan = planSmsParts(normalizedPayload.text);
    if (!plan.ok) {
      console.error(`sendHomaSms refused: ${plan.reason}`);
      return { status: "rejected", reason: plan.reason };
    }
    bodies = plan.parts;
    if (bodies.length > 1 || bodies[0] !== normalizedPayload.text) {
      console.error(
        `sendHomaSms adapted an oversized text: ${smsSegmentCount(normalizedPayload.text)} segments into ${bodies.length} ${bodies.length === 1 ? "message" : "messages"}`,
      );
    }
  }

  let firstMessageId: string | null = null;
  for (const [index, body] of bodies.entries()) {
    const result = await submitOneTelnyxMessage({
      apiKey,
      fromNumber,
      toE164,
      text: body,
      ...(isMms ? { mediaUrls: normalizedPayload.mediaUrls } : {}),
      ...(signal ? { signal } : {}),
    });
    if (result.status !== "submitted") {
      // The first part failing is a clean failure; a later part failing
      // means the family holds a partial message, which only "unknown"
      // describes truthfully.
      if (index === 0) return result;
      console.error(
        `sendHomaSms part ${index + 1} of ${bodies.length} did not submit`,
      );
      return { status: "unknown" };
    }
    if (firstMessageId === null) firstMessageId = result.messageId;
  }
  return firstMessageId
    ? { status: "submitted", messageId: firstMessageId }
    : { status: "unknown" };
}

export async function sendHomaSms(
  toE164: string,
  text: string,
  mediaUrls?: string[],
  signal?: AbortSignal,
): Promise<boolean> {
  const result = await submitHomaSms(toE164, text, mediaUrls, signal);
  return result.status === "submitted";
}
