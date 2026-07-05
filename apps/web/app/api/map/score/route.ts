import { MAP_BANK_VERSION, mapScoreRequestSchema } from "@homa/core";

import { sendReportEmail } from "../../../../lib/map/email";
import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireLead } from "../../../../lib/map/session";
import { createReport, markReportEmailed } from "../../../../lib/map/store";

/**
 * POST /api/map/score
 * Step S4: run the deterministic scorer over the child's saved answers,
 * upsert the report row, and send the report email. The report renders on
 * screen immediately (decision D5=A); the email is the durable copy, so an
 * email failure never blocks the response.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`score:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const lead = await requireLead();
  if (!lead) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapScoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    const report = await createReport(lead.id, parsed.data.childId);
    if (!report) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    await emitMapEvent("map.report_generated", {
      lead_id: lead.id,
      child_id: report.childId,
      mapped_domains: report.scores.mappedCount,
      observations: report.scores.observationCount,
      bank_version: MAP_BANK_VERSION,
    });

    const emailed = await sendReportEmail(report.email, report.childName, report.token);
    if (emailed) await markReportEmailed(report.childId);

    return Response.json({ ok: true, token: report.token });
  } catch (error) {
    console.error("map/score failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
