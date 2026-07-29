"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getFounderSession } from "../../../lib/admin/gate";
import {
  STUDIO_RUN_UUID_PATTERN,
  studioRequestProblem,
} from "../../../lib/materials/studio-brief";
import { studioFeedbackProblem } from "../../../lib/materials/studio-feedback";
import { saveStudioRunFeedback } from "../../../lib/materials/studio-runs";

/**
 * The studio's Run button (/admin/studio, direction lab
 * 2026-07-18-material-studio-admin-directions.html). Same founder gate
 * as every admin action; eve's send() only exists inside the runtime,
 * so this calls the materials-lab channel's own run route over HTTP on
 * this deployment, authenticated with CRON_SECRET, exactly the tasks
 * page's Run now shape. The route re-verifies the target is a sandbox
 * family server-side; this action only ever forwards ids.
 */

const RUN_FALLBACK_ERROR = "The studio couldn't start this run. Try again in a bit.";

export interface StudioRunState {
  error: string | null;
  runId: string | null;
}

/** This deployment's own origin, from the invoking request (twin of the
 * tasks page's helper; Vercel routes by Host, dev is plain-http). */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export interface StudioFeedbackState {
  error: string | null;
}

/** Saves the founder's verdict on one test run. The run row keeps the
 * latest for the improvement packet; every verdict is also appended to the
 * history table, pinned to the material version it judged (D5, gh#328). */
export async function saveStudioRunFeedbackAction(
  runId: string,
  tags: string[],
  feedback: string,
): Promise<StudioFeedbackState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  if (!STUDIO_RUN_UUID_PATTERN.test(runId)) {
    return { error: "That run could not be identified. Reload and try again." };
  }
  const problem = studioFeedbackProblem(feedback, tags);
  if (problem) return { error: problem };

  const saved = await saveStudioRunFeedback(runId, {
    feedback,
    tags,
    leftBy: founder.email,
  });
  if (!saved) return { error: "That run's row is gone. Reload the page." };
  revalidatePath("/admin/studio");
  revalidatePath(`/admin/studio/runs/${runId}`);
  return { error: null };
}

export async function launchStudioRunAction(
  familyId: string,
  childId: string | null,
  request: string,
): Promise<StudioRunState> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this.", runId: null };
  if (
    !STUDIO_RUN_UUID_PATTERN.test(familyId) ||
    (childId !== null && !STUDIO_RUN_UUID_PATTERN.test(childId))
  ) {
    return { error: "That family could not be identified. Reload and try again.", runId: null };
  }
  const requestProblem = studioRequestProblem(request);
  if (requestProblem) return { error: requestProblem, runId: null };

  const secret = process.env.CRON_SECRET;
  if (!secret) return { error: RUN_FALLBACK_ERROR, runId: null };

  try {
    const response = await fetch(`${await requestOrigin()}/eve/v1/materials-lab/run`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        familyId,
        ...(childId ? { childId } : {}),
        request: request.trim(),
        startedBy: founder.email,
      }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; runId?: string; note?: string }
      | null;
    if (body?.ok === true && typeof body.runId === "string") {
      revalidatePath("/admin/studio");
      return { error: null, runId: body.runId };
    }
    return { error: body?.note ?? RUN_FALLBACK_ERROR, runId: null };
  } catch {
    return { error: RUN_FALLBACK_ERROR, runId: null };
  }
}
