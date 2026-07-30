import { headers } from "next/headers";

/**
 * One immediate run of one task, shared by the web action
 * (app/app/tasks/actions.ts) and the mobile API route
 * (api/tasks/[taskId]/run-now). eve's send() only exists inside the agent
 * runtime, so this calls the dispatch channel's own run-now route over
 * HTTP, on the same deployment, authenticated with CRON_SECRET. familyId
 * must come from the caller's OWN membership, never the client; the route
 * re-scopes taskId by it.
 */

export interface RunTaskNowResult {
  ok: boolean;
  note: string | null;
}

const RUN_NOW_FALLBACK_ERROR = "Homa couldn't start this run. Try again in a bit.";

/** This deployment's own origin, from the request headers of the current
 * Server Action or Route Handler. Vercel routes by Host, so the header
 * names one of our own domains (preview included); dev is plain-http
 * localhost. */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function runTaskNow(taskId: string, familyId: string): Promise<RunTaskNowResult> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, note: RUN_NOW_FALLBACK_ERROR };

  try {
    const response = await fetch(`${await requestOrigin()}/eve/v1/dispatch/run-now`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ taskId, familyId }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; note?: string }
      | null;
    if (body?.ok === true) return { ok: true, note: null };
    return { ok: false, note: body?.note ?? RUN_NOW_FALLBACK_ERROR };
  } catch {
    return { ok: false, note: RUN_NOW_FALLBACK_ERROR };
  }
}
