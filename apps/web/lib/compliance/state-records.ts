import { composeFilingLetter } from "./filing-letter";
import { mayGenerateLetter } from "./filing-method";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";
import { getFilingFamily } from "./filing-store";
import { schoolYearStartFor } from "./deadlines";
import { composeStatePack } from "./pack";
import { mapDb } from "../map/db";
import { getStateRequirementsDetail } from "../map/state-requirements";
import { effectiveTimeZone } from "../time-zone";

export interface StateRecordDocument {
  id: string;
  type: "pack" | "filing";
  title: string;
  status: "final" | "superseded";
  previewUrl: string;
  pdfUrl: string;
  pdfPath: string;
  createdAt: string;
  pageCount: number;
  kind: "letter" | "worksheet" | null;
  gaps: string[];
  revisesId: string | null;
}

interface StateRecordMaterialRow {
  id: string;
  title: string;
  subject: string;
  status: "final" | "superseded";
  preview_url: string;
  pdf_url: string;
  created_at: string;
  revises: string | null;
  page_count: number | null;
  filing_kind: string | null;
  filing_gaps: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export async function listStateRecordDocuments(
  familyId: string,
): Promise<StateRecordDocument[]> {
  const sql = mapDb();
  const rows = await sql<StateRecordMaterialRow[]>`
    select id, title, subject, status, preview_url, pdf_url,
           created_at::text as created_at, revises,
           (generation->>'pageCount')::int as page_count,
           generation->'stateFiling'->>'kind' as filing_kind,
           generation->'stateFiling'->'gaps' as filing_gaps
    from public.materials
    where family_id = ${familyId}
      and subject in ('state-pack', 'state-filing')
      and status in ('final', 'superseded')
    order by created_at desc
    limit 40
  `;
  return rows.map((row) => ({
    id: row.id,
    type: row.subject === "state-filing" ? "filing" : "pack",
    title: row.title,
    status: row.status,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    pdfPath: `/api/materials/${row.id}/pdf`,
    createdAt: row.created_at,
    pageCount: row.page_count && row.page_count > 0 ? row.page_count : 1,
    kind:
      row.filing_kind === "letter" || row.filing_kind === "worksheet"
        ? row.filing_kind
        : null,
    gaps: stringList(row.filing_gaps),
    revisesId: row.revises,
  }));
}

export interface StateRecordsSummary {
  state: { code: string; name: string };
  schoolYear: { startOn: string | null; label: string | null };
  includedRecords: string[];
  recordCoverage: {
    loggedEntries: number;
    daysWithLoggedTime: number;
    minutesLogged: number;
  };
  missingInformation: string[];
  sources: { label: string; url: string }[];
  lastVerified: string;
  filing: {
    kind: "letter" | "worksheet" | "not_required";
    entitled: boolean;
  };
  documents: StateRecordDocument[];
  parentAction: string;
}

function schoolYearLabel(startOn: string | null): string | null {
  if (!startOn) return null;
  const year = Number(startOn.slice(0, 4));
  return Number.isInteger(year) ? `${year}-${String(year + 1).slice(-2)}` : null;
}

/**
 * One family-scoped, read-only contract for the native Binder and Voice
 * surfaces. It reuses the reviewed requirements, filing composer and
 * append-only material history. It never decides new state rules and never
 * claims that Homa's logged-time rows are already embedded in the pack PDF.
 */
export async function getStateRecordsSummary(
  familyId: string,
): Promise<StateRecordsSummary | null> {
  const family = await getFilingFamily(familyId);
  if (!family?.usState) return null;
  const detail = await getStateRequirementsDetail(family.usState);
  if (!detail || detail.verificationStatus !== "verified") return null;

  const zone = effectiveTimeZone(family.timeZone);
  const now = new Date();
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayLong = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const currentStart = schoolYearStartFor(family.schoolYearStartOn, todayIso);
  const method = FILING_METHODS_BY_STATE[detail.stateCode];
  const filingKind = method?.method === "not_required"
    ? "not_required"
    : mayGenerateLetter(method, todayIso)
      ? "letter"
      : "worksheet";
  const filingPreview = filingKind === "not_required"
    ? null
    : composeFilingLetter({
        detail,
        method,
        family: {
          parentName: family.parentName,
          addressLine: family.addressLine,
          addressCity: family.addressCity,
          addressZip: family.addressZip,
          children: family.children,
        },
        todayLong,
        todayIso,
      });

  // The pack composer remains the only place that decides which pages a
  // reviewed state pathway earns. The native preview simply names the exact
  // pages that same composer would render.
  const includedRecords = composeStatePack({
    detail,
    family: {
      familyName: family.familyName,
      parentName: family.parentName,
      children: family.children,
    },
    packId: "native-preview",
    generatedOn: todayLong,
  }).pages.map((page) => page.title);

  const sql = mapDb();
  const coverage = await sql<{
    logged_entries: number;
    logged_days: number;
    minutes_logged: number;
  }[]>`
    select count(*)::int as logged_entries,
           count(distinct happened_on)::int as logged_days,
           coalesce(sum(minutes), 0)::int as minutes_logged
    from public.hours_log
    where family_id = ${familyId}
      and (${currentStart}::date is null or happened_on >= ${currentStart}::date)
      and happened_on <= ${todayIso}::date
  `;
  const row = coverage[0] ?? { logged_entries: 0, logged_days: 0, minutes_logged: 0 };
  const documents = await listStateRecordDocuments(familyId);
  const sources = [
    ...(detail.sourcePageUrl ? [{ label: `${detail.stateName} requirements`, url: detail.sourcePageUrl }] : []),
    ...(detail.statuteUrl ? [{ label: "State law", url: detail.statuteUrl }] : []),
    ...(detail.doeUrl ? [{ label: "State education department", url: detail.doeUrl }] : []),
    ...(method?.sourceUrl ? [{ label: "Filing method", url: method.sourceUrl }] : []),
  ].filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index);

  return {
    state: { code: detail.stateCode, name: detail.stateName },
    schoolYear: { startOn: currentStart, label: schoolYearLabel(currentStart) },
    includedRecords,
    recordCoverage: {
      loggedEntries: row.logged_entries,
      daysWithLoggedTime: row.logged_days,
      minutesLogged: row.minutes_logged,
    },
    missingInformation: [
      ...(currentStart ? [] : ["School year start date"]),
      ...(filingPreview?.gaps ?? []),
    ].filter((item, index, all) => all.indexOf(item) === index),
    sources,
    lastVerified: detail.sourceLastVerified,
    filing: {
      kind: filingKind,
      entitled: family.planTier === "plus" || family.planTier === "elite",
    },
    documents,
    parentAction:
      "Review every page and fill any blanks. When a document needs a signature or filing, you do that yourself. Homa does not submit state paperwork.",
  };
}
