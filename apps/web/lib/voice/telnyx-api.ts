/**
 * Minimal server-side Telnyx REST helper for app routes and jobs (the
 * scripts/ folder keeps its own copy in telnyx-shared.mts; this one exists
 * so app code never imports from scripts/). Reads TELNYX_API_KEY from the
 * environment; callers must check telnyxConfigured() first so a
 * deployment without the key degrades to a clean skip, never a crash.
 */

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
 * mediaUrls upgrades the send to MMS (the worksheet studio texts the
 * rendered preview + PDF this way). Media must be publicly fetchable;
 * Blob's random-suffix URLs qualify. Keep the combined payload small,
 * carriers get unreliable past about 1MB.
 */
export type HomaSmsSubmission =
  | { status: "submitted"; messageId: string }
  | { status: "rejected" }
  | { status: "unknown" };

export function classifyTelnyxHttpFailure(
  status: number,
): "rejected" | "unknown" {
  return status === 408 || status === 429 || status >= 500
    ? "unknown"
    : "rejected";
}

/**
 * Detailed submission result for side effects that must distinguish a
 * provider rejection from a transport failure after Telnyx may have
 * accepted the message.
 */
export async function submitHomaSms(
  toE164: string,
  text: string,
  mediaUrls?: string[],
  signal?: AbortSignal,
): Promise<HomaSmsSubmission> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (process.env.TELNYX_SMS_ENABLED !== "true" || !apiKey || !fromNumber) {
    return { status: "rejected" };
  }

  try {
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromNumber,
        to: toE164,
        text,
        ...(mediaUrls && mediaUrls.length > 0 ? { media_urls: mediaUrls } : {}),
      }),
      signal,
    });
    if (!response.ok) {
      console.error(`sendHomaSms failed: HTTP ${response.status}`);
      return { status: classifyTelnyxHttpFailure(response.status) };
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

export async function sendHomaSms(
  toE164: string,
  text: string,
  mediaUrls?: string[],
  signal?: AbortSignal,
): Promise<boolean> {
  const result = await submitHomaSms(toE164, text, mediaUrls, signal);
  return result.status === "submitted";
}
