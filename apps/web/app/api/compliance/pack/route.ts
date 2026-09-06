import { randomUUID } from "node:crypto";

import { del } from "@vercel/blob";

import { composeStatePack } from "../../../../lib/compliance/pack";
import {
  getRecentStatePack,
  getStatePackFamily,
  getStatePackRecords,
  insertStatePackRow,
} from "../../../../lib/compliance/pack-store";
import { schoolYearStartFor } from "../../../../lib/compliance/deadlines";
import { emitMapEvent } from "../../../../lib/map/events";
import {
  requireFamilyFromBearer,
  requireFamilyWithActor,
} from "../../../../lib/map/session";
import { getStateRequirementsDetail } from "../../../../lib/map/state-requirements";
import { blobConfigured, uploadMaterialArtifacts } from "../../../../lib/materials/artifact-store";
import { joinPageBodies, printableSlug } from "../../../../lib/materials/page-shell";
import { effectiveTimeZone } from "../../../../lib/time-zone";

/**
 * POST /api/compliance/pack: the one button
 * (plans/2026-07-28-state-pack.md). Generates "Your {State} pack" fresh
 * on every press: family and state resolve from session auth only (the
 * request body is ignored by design), the requirements come from the
 * reviewed state_requirements table at render time, and the result is a
 * new immutable finalized materials row the parent downloads through
 * the existing authenticated materials pdf route.
 *
 * Failure posture: correctness beats delivery. A page-count mismatch
 * between the plan and the rendered PDF means content was cut, and a
 * truncated legal document must never ship, so that path errors rather
 * than uploading (council D15).
 */
export const maxDuration = 300;

const STORED_HTML_MAX = 118_000;

function failure(status: number, reason: string, note: string): Response {
  return Response.json({ ok: false, reason, note }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  let access;
  try {
    const hasBearer = request.headers.has("authorization");
    const bearerFamily = hasBearer
      ? await requireFamilyFromBearer(request)
      : null;
    access = hasBearer
      ? bearerFamily
        ? { family: bearerFamily, memberUserId: null }
        : null
      : await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "state pack auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "auth", "Could not verify your session.");
  }
  if (!access) {
    return failure(401, "auth", "Sign in to make your state pack.");
  }
  const { family } = access;

  const stateCode = family.us_state;
  if (!stateCode) {
    return failure(
      409,
      "no-state",
      "Homa does not know your state yet. Add it in settings and try again.",
    );
  }

  // A pack finalized moments ago answers a repeat press (double click,
  // second tab) instead of a second render and a second permanent row.
  const recent = await getRecentStatePack(family.id, 30).catch(() => null);
  if (recent) {
    return Response.json({
      ok: true,
      materialId: recent.id,
      pdfPath: `/api/materials/${recent.id}/pdf`,
      pageCount: recent.pageCount,
      title: null,
    });
  }

  let profile, detail;
  try {
    [profile, detail] = await Promise.all([
      getStatePackFamily(family.id),
      getStateRequirementsDetail(stateCode),
    ]);
  } catch (error) {
    console.error(
      "state pack reads failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "family", "Could not read your family profile.");
  }
  if (!profile) {
    return failure(502, "family", "Could not read your family profile.");
  }
  if (!detail || detail.verificationStatus !== "verified") {
    return failure(
      409,
      "no-data",
      "I do not have your state's pack ready yet.",
    );
  }
  if (!blobConfigured()) {
    return failure(502, "storage", "The pack maker is not available right now.");
  }

  await emitMapEvent("compliance.report_requested", {
    family_id: family.id,
    state: detail.stateCode,
  });

  const timeZone = effectiveTimeZone(profile.timeZone);
  const now = new Date();
  const generatedOn = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const schoolYearStartOn = schoolYearStartFor(profile.schoolYearStartOn, todayIso);
  let recordSet;
  try {
    recordSet = await getStatePackRecords(family.id, schoolYearStartOn, todayIso);
  } catch (error) {
    console.error(
      "state pack record read failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "records", "Could not read your attendance and hours record.");
  }
  if (recordSet.truncated) {
    return failure(
      409,
      "records-too-large",
      "Your Hours record is too large for a complete packet. Nothing was generated.",
    );
  }

  const packId = randomUUID();
  const pack = composeStatePack({
    detail,
    family: {
      familyName: profile.familyName,
      parentName:
        profile.firstName && profile.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : null,
      children: profile.children,
    },
    packId,
    generatedOn,
    records: {
      schoolYearStartOn,
      entries: recordSet.entries,
    },
  });

  const storedHtml = joinPageBodies(pack.pages.map((page) => page.body));
  if (storedHtml.length > STORED_HTML_MAX) {
    console.error(
      `state pack stored html over cap for ${detail.stateCode}: ${storedHtml.length}`,
    );
    return failure(500, "render", "The pack came out too large to save.");
  }

  // The raster stack (puppeteer, pdfjs, native canvas) loads lazily so a
  // load-time failure in those packages degrades to this route's JSON
  // failure contract instead of a framework 500 on every request, which
  // is exactly how this route broke on its first production deploy
  // (2026-07-28: bundled pdf.mjs evaluated DOMMatrix at module load).
  let rendered;
  try {
    const { renderPrintableHtml } = await import(
      "../../../../lib/materials/render-page"
    );
    rendered = await renderPrintableHtml(pack.html);
  } catch (error) {
    console.error(
      "state pack render failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "render", "The pack maker is not available right now.");
  }
  if (rendered.pageCount !== pack.pages.length) {
    console.error(
      `state pack page count mismatch for ${detail.stateCode}: planned ${pack.pages.length}, rendered ${rendered.pageCount}`,
    );
    return failure(
      500,
      "render",
      "The pack did not come out page-complete, so it was not saved.",
    );
  }

  let pdfUrl: string, previewUrl: string, pagePreviewUrls: string[];
  try {
    ({ pdfUrl, previewUrl, pagePreviewUrls } = await uploadMaterialArtifacts({
      familyId: family.id,
      slug: printableSlug(pack.title),
      pdf: rendered.pdf,
      pageJpegs: rendered.pageJpegs,
    }));
  } catch (error) {
    console.error(
      "state pack upload failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "storage", "The pack could not be saved. Try again in a moment.");
  }

  let inserted;
  try {
    inserted = await insertStatePackRow({
      id: packId,
      familyId: family.id,
      title: pack.title,
      pdfUrl,
      previewUrl,
      html: storedHtml,
      generation: {
        pageCount: rendered.pageCount,
        ...(rendered.pageCount > 1 ? { pagePreviewUrls } : {}),
        statePack: {
          state: detail.stateCode,
          sourceLastVerified: detail.sourceLastVerified,
          zeroDuty: pack.zeroDuty,
          generatedOn,
          schoolYearStartOn,
          sourceRecordEntries: recordSet.entries.length,
        },
      },
    });
  } catch (error) {
    console.error(
      "state pack insert failed:",
      error instanceof Error ? error.message : "unknown",
    );
    // The bytes just uploaded have no referencing row; sweep them so a
    // retry does not strand orphans in the family's Blob space forever.
    await del([pdfUrl, ...pagePreviewUrls]).catch((cleanupError) => {
      console.error(
        "state pack orphan cleanup failed:",
        cleanupError instanceof Error ? cleanupError.message : "unknown",
      );
    });
    return failure(502, "save", "The pack could not be saved. Try again in a moment.");
  }

  await emitMapEvent("compliance.report_generated", {
    family_id: family.id,
    state: detail.stateCode,
    latency_ms: Date.now() - startedAt,
    page_count: rendered.pageCount,
  });

  return Response.json({
    ok: true,
    materialId: inserted.id,
    pdfPath: `/api/materials/${inserted.id}/pdf`,
    pageCount: rendered.pageCount,
    title: pack.title,
  });
}
