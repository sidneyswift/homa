import { agentJobsEnabled } from "../../../../../lib/jobs/flag";
import { kickAgentJobsRunner } from "../../../../../lib/jobs/kick";
import { getJobStatus, startJob } from "../../../../../lib/jobs/store";
import { mapDb } from "../../../../../lib/map/db";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyFromBearer, requireFamilyWithAiConsentFromBearer } from "../../../../../lib/map/session";

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

interface ChildRow {
  id: string;
  name: string;
  birth_month: string | null;
  profile: { interests?: string[]; focus?: string } | null;
}

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - parsed.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < parsed.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 21 ? age : null;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-making:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }
  if (!agentJobsEnabled()) {
    return Response.json({ ok: false, reason: "disabled" }, { status: 503 });
  }

  let access: Awaited<ReturnType<typeof requireFamilyWithAiConsentFromBearer>>;
  try {
    access = await requireFamilyWithAiConsentFromBearer(request);
  } catch {
    return Response.json({ ok: false, reason: "consent-unavailable" }, { status: 503 });
  }
  if (!access) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  if (!access.aiProcessingConsented) {
    return Response.json({ ok: false, reason: "ai-consent-required" }, { status: 403 });
  }
  const { family } = access;

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
    const rows = await sql<ChildRow[]>`
      select id, name, birth_month, profile
      from public.children
      where id = ${childId} and family_id = ${family.id}
    `;
    const child = rows[0];
    if (!child) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 404 });
    }

    const theme = child.profile?.interests?.[0]?.trim() || null;
    const focus = child.profile?.focus?.trim() || null;
    const age = ageFromBirthDate(child.birth_month);

    const title = theme
      ? `${child.name}'s ${theme} page`.slice(0, 90)
      : `${child.name}'s first page`.slice(0, 90);
    const requestText = [
      `One printable page for ${child.name}${age !== null ? `, age ${age}` : ""}.`,
      theme ? `${child.name} loves ${theme}; let that carry the whole page.` : null,
      focus ? `They are working on ${focus}; land the practice right at that edge.` : null,
      "This is the family's very first making from mobile onboarding: one page, print-ready, pitched exactly to this child.",
      // Two kids can share a name (it happened live, 2026-08-21: a
      // 10-year-old's brief lost to a same-named 3-year-old from family
      // context and got a preschool letters page). The facts above are
      // the child; family context never overrides them.
      `If your family context lists another child named ${child.name}, ignore that child entirely: the age and focus in THIS brief are the child this page is for, and create_printable's childId must be ${child.id}.`,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 900);

    const result = await startJob({
      familyId: family.id,
      requestedByUserId: null,
      sessionId: null,
      skill: "materials-studio",
      title,
      plan: {
        request: requestText,
        ...(theme ? { theme } : {}),
        kind: "worksheet",
        childName: child.name,
      },
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
