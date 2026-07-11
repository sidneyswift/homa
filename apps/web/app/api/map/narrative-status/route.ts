import { after } from "next/server";

import { narrativeEnabled } from "../../../../lib/map/narrative-flag";
import { runPlanNarrative, runReportNarrative } from "../../../../lib/map/narrative-runner";
import {
  getPlanNarrativeStatusByToken,
  getReportNarrativeStatusByToken,
} from "../../../../lib/map/narrative-store";

/**
 * GET /api/map/narrative-status?token=...[&subject=...]
 * The writing beat's poll target, token-scoped exactly like the report
 * page itself (the token IS the access grant; no lead ids in, none out).
 * Also the self-healing seam: a "writing" attempt whose startedAt is past
 * the stale window, or a flag-on report with no attempt at all, gets a
 * fresh background generation kicked here, guarded by the runner's
 * single-flight claim. A crashed function costs one wait, never a stuck
 * report.
 */

export const maxDuration = 300;

const STALE_MS = 10 * 60 * 1000;

function isStaleWriting(meta: { status: string; startedAt: string } | null): boolean {
  if (!meta) return true;
  if (meta.status !== "writing") return false;
  const started = Date.parse(meta.startedAt);
  return Number.isNaN(started) || Date.now() - started > STALE_MS;
}

export async function GET(request: Request): Promise<Response> {
  if (!narrativeEnabled()) {
    return Response.json({ ok: true, status: "off" });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const subjectId = url.searchParams.get("subject");
  if (!token) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    const row = subjectId
      ? await getPlanNarrativeStatusByToken(token, subjectId)
      : await getReportNarrativeStatusByToken(token);
    if (!row) {
      return Response.json({ ok: false }, { status: 404 });
    }

    const status = row.meta?.status ?? "none";
    if (status === "none" || isStaleWriting(row.meta)) {
      const childId = row.childId;
      after(async () => {
        try {
          if (subjectId) {
            await runPlanNarrative(childId, subjectId);
          } else {
            await runReportNarrative(childId);
          }
        } catch (error) {
          console.error(
            "narrative-status self-heal failed:",
            error instanceof Error ? error.message : "unknown",
          );
        }
      });
      return Response.json({ ok: true, status: "writing" });
    }

    return Response.json({ ok: true, status });
  } catch (error) {
    console.error("narrative-status failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
