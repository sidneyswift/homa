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
 * Sends one outbound text from Homa's number. Returns false (never
 * throws) when the channel is dark or the send fails, so a caller like
 * the journal loop can fall back to email. Telnyx handles STOP/HELP
 * opt-outs at the platform level for this number.
 */
export async function sendHomaSms(toE164: string, text: string): Promise<boolean> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (process.env.TELNYX_SMS_ENABLED !== "true" || !apiKey || !fromNumber) return false;

  try {
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromNumber, to: toE164, text }),
    });
    if (!response.ok) {
      console.error(`sendHomaSms failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "sendHomaSms failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}
