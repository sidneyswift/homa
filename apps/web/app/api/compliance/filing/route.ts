import { randomUUID } from "node:crypto";

import { del } from "@vercel/blob";

import { filingDeadlines } from "../../../../lib/compliance/deadlines";
import { wrapFilingDocument } from "../../../../lib/compliance/filing-document";
import { composeFilingLetter } from "../../../../lib/compliance/filing-letter";
import { FILING_METHODS_BY_STATE } from "../../../../lib/compliance/filing-methods.data";
import {
  getFilingFamily,
  getRecentFiling,
  insertFilingRow,
} from "../../../../lib/compliance/filing-store";
import { emitMapEvent } from "../../../../lib/map/events";
import { requireFamilyWithActor } from "../../../../lib/map/session";
import { getStateRequirementsDetail } from "../../../../lib/map/state-requirements";
import { blobConfigured, uploadMaterialArtifacts } from "../../../../lib/materials/artifact-store";
import { printableSlug } from "../../../../lib/materials/page-shell";
import { effectiveTimeZone } from "../../../../lib/time-zone";

/**
 * POST /api/compliance/filing: the document a family sends the state
 * (gh#421, plans/2026-07-29-filing-service.md).
 *
 * Same shape as the state pack route: family and state resolve from
 * session auth only, the request body is ignored by design, and the
 * result is a new immutable finalized materials row downloaded through
 * the existing authenticated materials pdf route.
 *
 * Two differences that matter:
 *
 *   - Plus and Elite only (founder ruling 4, 2026-07-29). A regular
 *     family gets a 402 naming the tier, which the card turns into an
 *     upgrade invitation rather than a dead end.
 *   - A page-count mismatch is fatal here for a stronger reason than in
 *     the pack: a notice cut off mid-page is not a short document, it is
 *     an incomplete legal filing that a family would mail believing they
 *     had complied.
 */
export const maxDuration = 300;

const STORED_HTML_MAX = 118_000;

function failure(status: number, reason: string, note: string): Response {
  return Response.json({ ok: false, reason, note }, { status });
}

export async function POST(): Promise<Response> {
  const startedAt = Date.now();

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "filing auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "auth", "Could not verify your session.");
  }
  if (!access) {
    return failure(401, "auth", "Sign in to make your filing.");
  }
  const { family } = access;

  let profile;
  try {
    profile = await getFilingFamily(family.id);
  } catch (error) {
    console.error(
      "filing family read failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "family", "Could not read your family profile.");
  }
  if (!profile) {
    return failure(502, "family", "Could not read your family profile.");
  }

  if (profile.planTier !== "plus" && profile.planTier !== "elite") {
    return failure(
      402,
      "plan",
      "Homa Plus fills in your state filing and reminds you when it is due.",
    );
  }

  const stateCode = profile.usState;
  if (!stateCode) {
    return failure(
      409,
      "no-state",
      "Homa does not know your state yet. Add it in settings and try again.",
    );
  }

  const recent = await getRecentFiling(family.id, 30).catch(() => null);
  if (recent) {
    return Response.json({
      ok: true,
      materialId: recent.id,
      pdfPath: `/api/materials/${recent.id}/pdf`,
      title: null,
      gaps: [],
    });
  }

  let detail;
  try {
    detail = await getStateRequirementsDetail(stateCode);
  } catch (error) {
    console.error(
      "filing requirements read failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "no-data", "Could not read your state's requirements.");
  }
  if (!detail || detail.verificationStatus !== "verified") {
    return failure(409, "no-data", "I do not have your state's filing ready yet.");
  }
  if (!blobConfigured()) {
    return failure(502, "storage", "The filing maker is not available right now.");
  }

  const zone = effectiveTimeZone(profile.timeZone);
  const longDate = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const now = new Date();
  const todayLong = longDate.format(now);
  // The route's clock, resolved in the family's zone: the composer takes
  // dates already formatted so it stays pure and testable.
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const deadlines = filingDeadlines({
    stateCode: detail.stateCode,
    schoolYearStartIso: profile.schoolYearStartOn,
    todayIso,
  });
  const nextDue = deadlines.ok ? deadlines.deadlines[0] : null;

  const filingId = randomUUID();
  const letter = composeFilingLetter({
    detail,
    method: FILING_METHODS_BY_STATE[detail.stateCode],
    family: {
      parentName: profile.parentName,
      addressLine: profile.addressLine,
      addressCity: profile.addressCity,
      addressZip: profile.addressZip,
      children: profile.children,
    },
    todayLong,
    todayIso,
    dueLong: nextDue
      ? longDate.format(new Date(`${nextDue.dueOn}T12:00:00Z`))
      : null,
  });

  const html = wrapFilingDocument(letter, {
    familyName: profile.familyName,
    generatedOn: todayLong,
  });
  if (letter.body.length > STORED_HTML_MAX) {
    console.error(
      `filing stored html over cap for ${detail.stateCode}: ${letter.body.length}`,
    );
    return failure(500, "render", "The filing came out too large to save.");
  }

  await emitMapEvent("compliance.report_requested", {
    family_id: family.id,
    state: detail.stateCode,
  });

  let rendered;
  try {
    const { renderPrintableHtml } = await import(
      "../../../../lib/materials/render-page"
    );
    rendered = await renderPrintableHtml(html);
  } catch (error) {
    console.error(
      "filing render failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "render", "The filing maker is not available right now.");
  }
  // A notice is one page by design. More than one means content spilled
  // past the page box, and a filing cut mid-sentence is worse than none:
  // the family would mail it believing they had complied.
  if (rendered.pageCount !== 1) {
    console.error(
      `filing page count wrong for ${detail.stateCode}: rendered ${rendered.pageCount}`,
    );
    return failure(
      500,
      "render",
      "The filing did not come out page-complete, so it was not saved.",
    );
  }

  let pdfUrl: string, previewUrl: string, pagePreviewUrls: string[];
  try {
    ({ pdfUrl, previewUrl, pagePreviewUrls } = await uploadMaterialArtifacts({
      familyId: family.id,
      slug: printableSlug(letter.title),
      pdf: rendered.pdf,
      pageJpegs: rendered.pageJpegs,
    }));
  } catch (error) {
    console.error(
      "filing upload failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return failure(502, "storage", "The filing could not be saved. Try again in a moment.");
  }

  let inserted;
  try {
    inserted = await insertFilingRow({
      id: filingId,
      familyId: family.id,
      title: letter.title,
      pdfUrl,
      previewUrl,
      html: letter.body,
      generation: {
        pageCount: 1,
        stateFiling: {
          state: detail.stateCode,
          kind: letter.kind,
          gaps: letter.gaps,
          dueOn: nextDue?.dueOn ?? null,
          sourceLastVerified: detail.sourceLastVerified,
          generatedOn: todayLong,
        },
      },
    });
  } catch (error) {
    console.error(
      "filing insert failed:",
      error instanceof Error ? error.message : "unknown",
    );
    await del([pdfUrl, ...pagePreviewUrls]).catch((cleanupError) => {
      console.error(
        "filing orphan cleanup failed:",
        cleanupError instanceof Error ? cleanupError.message : "unknown",
      );
    });
    return failure(502, "save", "The filing could not be saved. Try again in a moment.");
  }

  await emitMapEvent("compliance.report_generated", {
    family_id: family.id,
    state: detail.stateCode,
    latency_ms: Date.now() - startedAt,
    page_count: 1,
  });

  return Response.json({
    ok: true,
    materialId: inserted.id,
    pdfPath: `/api/materials/${inserted.id}/pdf`,
    title: letter.title,
    kind: letter.kind,
    gaps: letter.gaps,
    dueOn: nextDue?.dueOn ?? null,
  });
}
