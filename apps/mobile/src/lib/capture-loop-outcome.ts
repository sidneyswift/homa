import { EVE_CHANNEL_HEADER, env } from "./env";
import { supabase } from "./supabase";

interface NativeCaptureLoopOutcomeResponse {
  ok?: boolean;
}

/**
 * Asks the authenticated server to append a verified outcome for one native
 * schedule receipt. The server re-reads the receipt and owns the outcome
 * event; the app never submits an outcome_verified payload itself.
 */
export async function verifyNativeScheduleOutcome(
  loopId: string,
  receiptId: string,
): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(
        `${env.apiUrl.replace(/\/$/u, "")}/api/mobile/capture-loop/outcome`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...EVE_CHANNEL_HEADER,
          },
          body: JSON.stringify({ loop_id: loopId, receipt_id: receiptId }),
          signal: controller.signal,
        },
      );
      const body = (await response.json().catch(() => null)) as
        | (NativeCaptureLoopOutcomeResponse & { reason?: string })
        | null;
      if (response.ok) return body?.ok === true;
      if (
        body?.reason !== "trace-not-found" &&
        body?.reason !== "trace-not-eligible"
      ) {
        return false;
      }
    } catch {
      if (attempt === 2) return false;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  return false;
}
