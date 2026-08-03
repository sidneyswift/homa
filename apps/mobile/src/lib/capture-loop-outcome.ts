import { EVE_CHANNEL_HEADER, env } from "./env";
import { supabase } from "./supabase";

interface NativeCaptureLoopOutcomeResponse {
  ok?: boolean;
}

interface NativeScheduleOutcomeCandidate {
  loop_id?: unknown;
  receipt_id?: unknown;
}

export interface NativeScheduleOutcomePointer {
  loopId: string;
  receiptId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function outcomeUrl(): string {
  return `${env.apiUrl.replace(/\/$/u, "")}/api/mobile/capture-loop/outcome`;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
  const token = await accessToken();
  if (!token) return false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(
        outcomeUrl(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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

/**
 * Finds server-owned schedule bindings whose verified outcome is still
 * missing. This closes the crash window where the mutation committed after
 * the lifecycle trace was flushed but before AsyncStorage saved its pointer.
 */
export async function listUnresolvedNativeScheduleOutcomes(): Promise<
  NativeScheduleOutcomePointer[]
> {
  const token = await accessToken();
  if (!token) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(outcomeUrl(), {
      headers: {
        Authorization: `Bearer ${token}`,
        ...EVE_CHANNEL_HEADER,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as {
      outcomes?: unknown;
    } | null;
    if (!Array.isArray(body?.outcomes)) return [];
    return body.outcomes.flatMap((candidate: NativeScheduleOutcomeCandidate) => {
      if (
        typeof candidate.loop_id !== "string" ||
        !UUID_RE.test(candidate.loop_id) ||
        typeof candidate.receipt_id !== "string" ||
        !UUID_RE.test(candidate.receipt_id)
      ) {
        return [];
      }
      return [{ loopId: candidate.loop_id, receiptId: candidate.receipt_id }];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
