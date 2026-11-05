/**
 * The immediate-pickup kick (founder directive 2026-07-23: background
 * jobs start immediately). The job-starting tools call this right after
 * a job row commits; it POSTs the agent-job channel's run-now route on
 * this same deployment, which claims and starts the new job's first
 * stage in seconds instead of waiting for the 5-minute sweeper.
 *
 * Best-effort on purpose, and the caller must treat it that way: the
 * fetch is capped at a few seconds and every failure is swallowed,
 * because the sweeper guarantees the job either way. A kick can never
 * make a promise false; it only makes a true one faster. That is also
 * why this lives beside the store instead of inside startJob: enqueue
 * is the durable truth, the kick is acceleration.
 *
 * eve's send() only exists inside the agent runtime, so this goes over
 * HTTP exactly like the tasks page's Run now button, authenticated with
 * CRON_SECRET on the same deployment.
 */

const KICK_TIMEOUT_MS = 5_000;

/** This deployment's own origin, from the environment (tools have no
 * request to read headers from). Production kicks its public domain:
 * the per-deployment *.vercel.app URL sits behind Vercel Authentication,
 * so a kick there landed on the login wall and every production job
 * waited for the 5-minute sweep (found 2026-11-04 verifying a new
 * family's first page live). A preview still kicks its own deployment
 * URL, which the bypass header below gets through when the project has
 * one. The public site URL and the dev port are the fallbacks. Null
 * means nowhere safe to kick, so the sweeper carries it. */
export function agentJobsKickUrl(env: {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
  PORT?: string;
} = process.env): string | null {
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/eve/v1/agent-job/run-now`;
  }
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}/eve/v1/agent-job/run-now`;
  }
  if (env.NEXT_PUBLIC_SITE_URL) {
    return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, "")}/eve/v1/agent-job/run-now`;
  }
  if (env.NODE_ENV !== "production") {
    return `http://localhost:${env.PORT ?? "3000"}/eve/v1/agent-job/run-now`;
  }
  return null;
}

export async function kickAgentJobsRunner(): Promise<boolean> {
  const url = agentJobsKickUrl();
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) return false;
  const headers: Record<string, string> = { authorization: `Bearer ${secret}` };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) headers["x-vercel-protection-bypass"] = bypass;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      // A protection wall answers with a redirect to a login page;
      // following it returned that page's 200 and reported a kick that
      // never reached the runner.
      redirect: "manual",
      signal: AbortSignal.timeout(KICK_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    // The sweeper picks the job up within its interval; nothing to do.
    return false;
  }
}
