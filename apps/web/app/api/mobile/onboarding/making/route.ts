import { agentJobsEnabled } from "../../../../../lib/jobs/flag";
import { kickAgentJobsRunner } from "../../../../../lib/jobs/kick";
import { getJobStatus, startJob } from "../../../../../lib/jobs/store";
import { mapDb } from "../../../../../lib/map/db";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyFromBearer } from "../../../../../lib/map/session";
import {
  mobileFirstMakingJob,
  type MobileFirstMakingChild,
} from "../../../../../lib/onboarding/mobile-first-making";

/**
 * The native first making (mobile onboarding v1 wave 3): the same
 * durable single-stage materials-studio job the web artifact moment
 * enqueues (agent/tools/start_first_making.ts), triggered
 * deterministically from the kid card instead of by the model. Shares
 * the web tool's idempotency key on purpose: a child gets ONE first
 * making ever, whichever surface asks first, and a verbatim retry
 * lands on the same job.
 *
 * POST { childId } starts (or finds) the job. GET ?jobId=... reads its
 * status for the building screen's honest steps. The finished material
 * is read by the app through the existing RLS materials path, never
 * through this route.
 */

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-making:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }
  if (!agentJobsEnabled()) {
    return Response.json({ ok: false, reason: "disabled" }, { status: 503 });
  }

  const family = await requireFamilyFromBearer(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const childId =
    body && typeof body === "object" && "childId" in body
      ? (body as { childId: unknown }).childId
      : null;
  if (typeof childId !== "string" || !/^[0-9a-f-]{36}$/iu.test(childId)) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    // Re-scope the model-free way too: the child must be this family's.
    const sql = mapDb();
    const rows = await sql<MobileFirstMakingChild[]>`
      select id, name, birth_month, profile
      from public.children
      where id = ${childId} and family_id = ${family.id}
    `;
    const child = rows[0];
    if (!child) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 404 });
    }

    const { title, plan } = mobileFirstMakingJob(child);

    const result = await startJob({
      familyId: family.id,
      requestedByUserId: null,
      sessionId: null,
      skill: "materials-studio",
      title,
      plan,
      totalStages: 1,
      childId: child.id,
      // Same key as the web artifact moment: one first making per child.
      startIdempotencyKey: `first-making:${child.id}`,
    });
    if (!result.ok) {
      return Response.json({ ok: false, reason: "not-started" }, { status: 502 });
    }
    if (!result.alreadyExisted) await kickAgentJobsRunner();

    return Response.json({
      ok: true,
      jobId: result.jobId,
      alreadyExisted: result.alreadyExisted,
      title,
    });
  } catch (error) {
    console.error(
      "mobile/onboarding/making failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}

export async function GET(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-making-status:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamilyFromBearer(request);
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const status = await getJobStatus(family.id, jobId);
  if (!status.ok) {
    return Response.json({ ok: false, reason: "unknown-job" }, { status: 404 });
  }
  const job = status.jobs[0];
  return Response.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      title: job.title,
      currentStage: job.currentStage,
      totalStages: job.totalStages,
      progressNote: job.progressNote,
    },
  });
}
