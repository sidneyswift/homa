import { after } from "next/server";

import {
  MAP_ANSWERS,
  MAP_BANK_VERSION,
  mapReportCorrectionSchema,
} from "@homa/core";
import { z } from "zod";

import {
  getChildProgressView,
} from "../../../../../lib/child-progress/runtime";
import { liveProgressEnabled } from "../../../../../lib/child-progress/flag";
import { emitMapEvent } from "../../../../../lib/map/events";
import { narrativeEnabled } from "../../../../../lib/map/narrative-flag";
import { runReportNarrative } from "../../../../../lib/map/narrative-runner";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import {
  correctAnswersWithProgressStatus,
  createReport,
  getReportTokenForChild,
} from "../../../../../lib/map/store";

/**
 * POST /api/map/report/correct
 * The living record's write path: the owning parent changes one or more
 * answers from the report page itself (a receipt correction, the inline
 * sharpening question, a staleness re-check), and the whole derived layer
 * re-derives once. Flag-on correction preserves token and history while
 * rebuilding live and report compatibility in one transaction. Flag-off
 * keeps the deliberate legacy report generation. Never emails because the
 * report email is first-scoring only.
 */

// The background rewrite holds an uncapped model call by ruling.
export const maxDuration = 300;

const correctionRequestSchema = mapReportCorrectionSchema.extend({
  idempotencyKey: z.uuid().optional(),
  changes: z
    .array(
      z.object({
        itemId: z.string().min(1).max(120),
        answer: z.enum(MAP_ANSWERS).nullable(),
      }),
    )
    .min(1)
    .max(24),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`correct:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "map/report/correct auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!access) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = correctionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (liveProgressEnabled() && !parsed.data.idempotencyKey) {
    return Response.json(
      { ok: false, reason: "missing-idempotency-key" },
      { status: 400 },
    );
  }
  const {
    childId,
    changes,
    source,
    idempotencyKey,
  } = parsed.data;

  try {
    const saved = await correctAnswersWithProgressStatus(
      access.family.id,
      childId,
      changes,
      source,
      {
        memberUserId: access.memberUserId,
        idempotencyKey,
      },
    );
    switch (saved.status) {
      case "saved":
        break;
      case "unknown_child_or_item":
        return Response.json(
          { ok: false, reason: "unknown-child-or-item" },
          { status: 400 },
        );
      case "unknown_actor":
        return Response.json(
          { ok: false, reason: "unknown-actor" },
          { status: 403 },
        );
      case "idempotency_mismatch":
        return Response.json(
          { ok: false, reason: "idempotency-mismatch" },
          { status: 409 },
        );
      case "conflict_pending":
        return Response.json(
          {
            ok: false,
            reason: "conflict-pending",
            conflictId: saved.conflictId,
          },
          { status: 409 },
        );
      default: {
        const exhaustiveResult: never = saved;
        return exhaustiveResult;
      }
    }

    const report =
      saved.mode === "legacy"
        ? await createReport(access.family.id, childId)
        : null;
    const liveView =
      saved.mode === "child_progress"
        ? await getChildProgressView(access.family.id, childId)
        : null;
    const token =
      report?.token ??
      await getReportTokenForChild(access.family.id, childId);
    const scores = report?.scores ?? liveView?.scores;
    if (!token || !scores) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    await emitMapEvent("map.answers_corrected", {
      family_id: access.family.id,
      child_id: childId,
      source,
      changes: changes.length,
    });
    // A doubled correction submit rescored nothing the second time
    // (createReport returned the row it already wrote); one scoring,
    // one generated event.
    if (!report?.duplicate) {
      await emitMapEvent("map.report_generated", {
        family_id: access.family.id,
        child_id: childId,
        mapped_subjects: scores.mappedCount,
        observations: scores.observationCount,
        bank_version: MAP_BANK_VERSION,
      });
    }

    after(async () => {
      if (!narrativeEnabled()) return;
      try {
        await runReportNarrative(childId, access.family.id);
      } catch (error) {
        console.error(
          "map/report/correct narrative failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });

    return Response.json({ ok: true, token });
  } catch (error) {
    console.error(
      "map/report/correct failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
