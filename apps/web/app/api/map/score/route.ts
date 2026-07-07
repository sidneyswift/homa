import { after } from "next/server";

import { MAP_BANK_VERSION, mapScoreRequestSchema } from "@homa/core";

import { ensureFamilyWorkspace } from "../../../../lib/map/bridge";
import { sendReportEmail } from "../../../../lib/map/email";
import { emitMapEvent } from "../../../../lib/map/events";
import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { runReportNarrative } from "../../../../lib/map/narrative-runner";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireLead } from "../../../../lib/map/session";
import { createReport, markReportEmailed, reportAlreadyEmailed } from "../../../../lib/map/store";

/**
 * POST /api/map/score
 * Step S4: run the deterministic scorer over the child's saved answers,
 * upsert the report row, and respond with the token immediately. The
 * narrative layer (D8 overturn) then writes the report's words in a
 * background phase, uncapped, and the report email (the durable copy,
 * first scoring only) sends AFTER generation so the emailed link opens a
 * finished report. An email or generation failure never blocks anything:
 * the report page falls back to template sentences.
 *
 * Every score (first or rescore) also runs the family-workspace bridge
 * (founder ruling 2026-07-06): her real families/children rows are
 * provisioned or synced from the lead kids, so the agent's family context
 * lights up the moment the first report exists.
 */

// The background phase holds a live model call with no time cap by ruling;
// give the function room so generation is never killed mid-write.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`score:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const lead = await requireLead();
  if (!lead) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  // Signup (email) always runs right before this call; a null email here
  // means the client skipped ahead of the flow it was given.
  if (!lead.email) {
    return Response.json({ ok: false, reason: "not-claimed" }, { status: 409 });
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
    // Rescores (after a deep dive) update the same report row and must not
    // re-send the email; only the first scoring of a child emails her.
    const alreadyEmailed = await reportAlreadyEmailed(parsed.data.childId);

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

    // Best-effort by design: a bridge failure must never block or delay
    // the report itself. Idempotent, so the next score simply retries.
    try {
      await ensureFamilyWorkspace(lead.id);
    } catch (error) {
      console.error(
        "map/score family bridge failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // Background phase, post-response: write the narrative (flag-gated,
    // uncapped), THEN send the report email so the emailed link opens a
    // finished report. Each step fails alone; the runner stores "failed"
    // and the page falls back to templates.
    after(async () => {
      if (narrativeEnabled()) {
        try {
          await runReportNarrative(report.childId);
        } catch (error) {
          console.error(
            "map/score narrative failed:",
            error instanceof Error ? error.message : "unknown",
          );
        }
      }
      try {
        if (!alreadyEmailed && report.email) {
          const emailed = await sendReportEmail(report.email, report.childName, report.token);
          if (emailed) await markReportEmailed(report.childId);
        }
      } catch (error) {
        console.error(
          "map/score email failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });

    return Response.json({ ok: true, token: report.token });
  } catch (error) {
    console.error("map/score failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
