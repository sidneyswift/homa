import type { StateDetail } from "./state-requirements-shared.mts";

export interface ReviewedCorrectionReceipt {
  id: string;
  state_code: string;
  field: string;
  checked_on: string;
  source_urls: string[];
  reason: string;
}

export interface ReviewedCorrectionResult {
  detail: StateDetail;
  applied: ReviewedCorrectionReceipt[];
  problems: string[];
}

const AZ_DOE: ReviewedCorrectionReceipt = {
  id: "AZ-doe-url-2026-08-02",
  state_code: "AZ",
  field: "sources.doe_url",
  checked_on: "2026-08-02",
  source_urls: [
    "https://www.azed.gov/adeinfo/agency-faqs",
    "https://www.azleg.gov/ars/15/00802.htm",
  ],
  reason:
    "ADE directs homeschool questions and submissions to county superintendent offices; the upstream URL points to the separate ESA program.",
};

const DC_DEADLINE: ReviewedCorrectionReceipt = {
  id: "DC-notification-deadline-2026-08-02",
  state_code: "DC",
  field: "pathways[home_instruction].notification.deadline",
  checked_on: "2026-08-02",
  source_urls: ["https://osse.dc.gov/page/apply-homeschool"],
  reason:
    "OSSE requires initial notice at least 15 business days before instruction and annual continuation by August 15.",
};

const MS_REPEALED_CITATION: ReviewedCorrectionReceipt = {
  id: "MS-repealed-37-13-93-2026-08-02",
  state_code: "MS",
  field: "citation_urls and sources.additional_statutes",
  checked_on: "2026-08-02",
  source_urls: [
    "https://www.legislature.ms.gov/general-information/",
    "https://law.justia.com/codes/mississippi/title-37/chapter-13/mississippi-compulsory-school-attendance-law/section-37-13-93/",
  ],
  reason:
    "Current Mississippi code marks sections 37-13-93 through 37-13-105 repealed; the upstream label also linked to section 37-13-91.",
};

const OK_NOTES: ReviewedCorrectionReceipt = {
  id: "OK-compulsory-notes-dedupe-2026-08-02",
  state_code: "OK",
  field: "compulsory_education.notes",
  checked_on: "2026-08-02",
  source_urls: ["https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=90120"],
  reason:
    "The numeric age fields already render the 5 through 18 range; the note should carry only the kindergarten opt-out and graduation conditions.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordApplied(
  applied: ReviewedCorrectionReceipt[],
  receipt: ReviewedCorrectionReceipt,
): void {
  if (!applied.some((entry) => entry.id === receipt.id)) applied.push(receipt);
}

function replaceKnownString(
  parent: Record<string, unknown>,
  key: string,
  knownBad: string,
  corrected: string,
  receipt: ReviewedCorrectionReceipt,
  applied: ReviewedCorrectionReceipt[],
  problems: string[],
): void {
  const current = parent[key];
  if (current === corrected) return;
  if (current !== knownBad) {
    problems.push(
      `${receipt.id}: ${receipt.field} changed from both the reviewed bad and corrected values; found ${JSON.stringify(current)}`,
    );
    return;
  }
  parent[key] = corrected;
  recordApplied(applied, receipt);
}

function applyArizona(
  detail: StateDetail,
  applied: ReviewedCorrectionReceipt[],
  problems: string[],
): void {
  const sources = asRecord(detail.sources);
  replaceKnownString(
    sources,
    "doe_url",
    "https://www.azed.gov/esa",
    "https://www.azed.gov/adeinfo/agency-faqs",
    AZ_DOE,
    applied,
    problems,
  );
}

function applyDistrictOfColumbia(
  detail: StateDetail,
  applied: ReviewedCorrectionReceipt[],
  problems: string[],
): void {
  const pathways = Array.isArray(detail.pathways) ? detail.pathways : [];
  const pathway = pathways
    .map(asRecord)
    .find((entry) => entry.id === "home_instruction" || entry.is_default === true);
  if (!pathway) {
    problems.push(`${DC_DEADLINE.id}: home instruction pathway is missing`);
    return;
  }
  replaceKnownString(
    asRecord(pathway.notification),
    "deadline",
    "Before instruction begins; renewed annually before each school year",
    "At least 15 business days before the first date of home instruction; annual continuation due by August 15",
    DC_DEADLINE,
    applied,
    problems,
  );
}

function applyMississippi(
  detail: StateDetail,
  applied: ReviewedCorrectionReceipt[],
  problems: string[],
): void {
  const citationUrls = asRecord(detail.citation_urls);
  const label = "Miss. Code Ann. 37-13-93";
  const knownBad =
    "https://law.justia.com/codes/mississippi/title-37/chapter-13/mississippi-compulsory-school-attendance-law/section-37-13-91/";
  if (label in citationUrls) {
    if (citationUrls[label] !== knownBad) {
      problems.push(
        `${MS_REPEALED_CITATION.id}: ${label} changed from the reviewed bad URL; found ${JSON.stringify(citationUrls[label])}`,
      );
    } else {
      delete citationUrls[label];
      recordApplied(applied, MS_REPEALED_CITATION);
    }
  }

  const sources = asRecord(detail.sources);
  const statutes = sources.additional_statutes;
  const obsolete = "Miss. Code Ann. 37-13-93 (Penalties for Non-Compliance)";
  if (!Array.isArray(statutes)) {
    problems.push(`${MS_REPEALED_CITATION.id}: sources.additional_statutes is missing`);
    return;
  }
  const next = statutes.filter((entry) => entry !== obsolete);
  if (next.length !== statutes.length) {
    sources.additional_statutes = next;
    recordApplied(applied, MS_REPEALED_CITATION);
  } else if (statutes.some((entry) => String(entry).includes("37-13-93"))) {
    problems.push(
      `${MS_REPEALED_CITATION.id}: a new 37-13-93 label needs human review`,
    );
  }
}

function applyOklahoma(
  detail: StateDetail,
  applied: ReviewedCorrectionReceipt[],
  problems: string[],
): void {
  replaceKnownString(
    asRecord(detail.compulsory_education),
    "notes",
    "Ages 5-18. Compulsory beginning at age 5, but parents may opt a 5-year-old out of kindergarten by notifying the superintendent by certified mail before enrollment or during the first school year. Children must attend until age 18 or high school graduation, whichever comes first.",
    "Parents may opt a 5-year-old out of kindergarten by notifying the superintendent by certified mail before enrollment or during the first school year. Compulsory attendance ends at high school graduation if that comes before age 18.",
    OK_NOTES,
    applied,
    problems,
  );
}

/**
 * Applies only corrections backed by the sources recorded above.
 *
 * Each patch recognizes the exact reviewed bad value and the exact corrected
 * value. Any third value fails the pull so an upstream update is reviewed
 * instead of overwritten.
 */
export function applyReviewedStateRequirementCorrections(
  input: StateDetail,
): ReviewedCorrectionResult {
  const detail = structuredClone(input);
  const applied: ReviewedCorrectionReceipt[] = [];
  const problems: string[] = [];

  if (detail.state_code === "AZ") applyArizona(detail, applied, problems);
  if (detail.state_code === "DC") applyDistrictOfColumbia(detail, applied, problems);
  if (detail.state_code === "MS") applyMississippi(detail, applied, problems);
  if (detail.state_code === "OK") applyOklahoma(detail, applied, problems);

  return { detail, applied, problems };
}

/** Exact label-to-path verification for Justia section URLs. */
export function findCitationUrlMismatches(detail: StateDetail): string[] {
  const problems: string[] = [];
  for (const [label, value] of Object.entries(asRecord(detail.citation_urls))) {
    const rawUrl = typeof value === "string" ? value : asRecord(value).url;
    if (typeof rawUrl !== "string") continue;
    let path: string;
    try {
      path = new URL(rawUrl).pathname;
    } catch {
      continue;
    }
    const labelSection = label.match(/\b\d+(?:[.-]\d+){2,}\b/)?.[0].replaceAll(".", "-");
    const urlSection = path.match(/\/section-(\d+(?:-\d+){2,})\/?$/i)?.[1];
    if (labelSection && urlSection && labelSection !== urlSection) {
      problems.push(
        `${label}: label names section ${labelSection}, URL path names section ${urlSection}`,
      );
    }
  }
  return problems;
}
