import { after } from "next/server";

import { MAP_BANK_VERSION, mapReportCorrectionSchema } from "@homa/core";

import { emitMapEvent } from "../../../../../lib/map/events";
import { narrativeEnabled } from "../../../../../lib/map/narrative-flag";
import { runReportNarrative } from "../../../../../lib/map/narrative-runner";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { mirrorReportToProduct } from "../../../../../lib/map/report-mirror";
import { requireLead } from "../../../../../lib/map/session";
import { correctAnswers, createReport } from "../../../../../lib/map/store";

/**
 * POST /api/map/report/correct
 * The living record's write path: the owning parent changes one or more
 * answers from the report page itself (a receipt correction, the inline
 * sharpening question, a staleness re-check), and the whole derived layer
 * re-derives through the one existing pipe: rescore, history archives the
 * old words next to the old numbers, narrative resets and regenerates.
 * One save = one rescore = one rewrite, which is why changes arrive
 * batched. Never emails (the report email is first-scoring only, and
 * that ship has sailed by the time this page exists).
 */

// The background rewrite holds an uncapped model call by ruling.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`correct:${clientIp(request)}`, 30)) {
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
  const parsed = mapReportCorrectionSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { childId, changes, source } = parsed.data;

  try {
    const saved = await correctAnswers(lead.id, childId, changes, source);
    if (!saved) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    const report = await createReport(lead.id, childId);
    if (!report) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    await emitMapEvent("map.answers_corrected", {
      lead_id: lead.id,
      child_id: childId,
      source,
      changes: changes.length,
    });
    await emitMapEvent("map.report_generated", {
      lead_id: lead.id,
      child_id: childId,
      mapped_domains: report.scores.mappedCount,
      observations: report.scores.observationCount,
      bank_version: MAP_BANK_VERSION,
    });

    // Keep the workspace copy in step with the correction (same two-beat
    // mirror as the score route: numbers now, words after the rewrite).
    try {
      await mirrorReportToProduct(lead.id, childId);
    } catch (error) {
      console.error(
        "map/report/correct mirror failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }

    after(async () => {
      if (!narrativeEnabled()) return;
      try {
        await runReportNarrative(childId);
        await mirrorReportToProduct(lead.id, childId);
      } catch (error) {
        console.error(
          "map/report/correct narrative failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });

    return Response.json({ ok: true, token: report.token });
  } catch (error) {
    console.error(
      "map/report/correct failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
