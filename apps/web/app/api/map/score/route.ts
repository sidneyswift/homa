import { after } from "next/server";

import { MAP_BANK_VERSION, mapScoreRequestSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { runReportNarrative } from "../../../../lib/map/narrative-runner";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { sendReportEmailOnce } from "../../../../lib/map/report-email";
import { requireFamily } from "../../../../lib/map/session";
import { createReport } from "../../../../lib/map/store";

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
 * One world: the report row IS the workspace's report row, so there is
 * no bridge and no mirror here anymore. The family has existed since the
 * first tap; scoring just fills it in.
 */

// The background phase holds a live model call with no time cap by ruling;
// give the function room so generation is never killed mid-write.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`score:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  // Signup (email) always runs right before this call; a null email here
  // means the client skipped ahead of the flow it was given.
  if (!family.email) {
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
    const report = await createReport(family.id, parsed.data.childId);
    if (!report) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    // A duplicate submission (mid-beat refresh, doubled client POST, a
    // second page context) changed nothing, so it emits nothing: one
    // scoring, one event.
    if (!report.duplicate) {
      await emitMapEvent("map.report_generated", {
        family_id: family.id,
        child_id: report.childId,
        mapped_subjects: report.scores.mappedCount,
        observations: report.scores.observationCount,
        bank_version: MAP_BANK_VERSION,
      });
    }

    // Background phase, post-response: write the narrative (flag-gated,
    // uncapped), THEN send the report email so the emailed link opens a
    // finished report. Each step fails alone; the runner stores "failed"
    // and the page falls back to templates.
    after(async () => {
      if (narrativeEnabled()) {
        try {
          await runReportNarrative(report.childId, family.id);
        } catch (error) {
          console.error(
            "map/score narrative failed:",
            error instanceof Error ? error.message : "unknown",
          );
        }
      }
      try {
        // First scoring only; the claim inside decides, atomically, so a
        // doubled POST (mid-beat refresh, double submit) sends one email.
        if (report.email) {
          await sendReportEmailOnce(family.id, report.childId, report.email, report.childName, report.token);
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
