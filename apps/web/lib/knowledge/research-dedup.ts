import type { Sql, TransactionSql } from "postgres";

import { mapDb } from "../map/db";

export interface ResearchCitation {
  url: string;
  claim: string;
}

export interface PriorResearchDossier {
  topicKey: string;
  rows: Array<{
    title: string;
    summary: string;
    citations: ResearchCitation[];
  }>;
}

export interface ResearchDuplicates {
  urls: string[];
  claims: string[];
}

const TRACKING_QUERY_KEYS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "share",
  "source",
]);

export function canonicalResearchUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./u, "");

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  const pathname =
    parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/u, "") : parsed.pathname;
  const query = parsed.searchParams.toString();
  return `${parsed.protocol}//${parsed.host}${pathname}${query ? `?${query}` : ""}`;
}

function claimTokens(claim: string): Set<string> {
  return new Set(
    claim
      .normalize("NFKD")
      .toLowerCase()
      .replace(
        /\b(?:isn|aren|wasn|weren|doesn|don|didn|hasn|haven|hadn|couldn|wouldn|shouldn)[’']t\b/gu,
        " not ",
      )
      .replace(/\bcan[’']t\b/gu, " cannot ")
      .replace(/\bwon[’']t\b/gu, " will not ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/u)
      .filter((token) => token.length > 1),
  );
}

const NEGATION_TOKENS = new Set([
  "cannot",
  "doesnt",
  "dont",
  "lacks",
  "never",
  "no",
  "not",
  "without",
]);

const QUANTITY_WORDS = new Set([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "thousand",
  "million",
  "billion",
  "dozen",
  "half",
  "quarter",
]);

function claimsOverlap(left: string, right: string): boolean {
  const leftTokens = claimTokens(left);
  const rightTokens = claimTokens(right);
  const leftNormalized = [...leftTokens].join(" ");
  const rightNormalized = [...rightTokens].join(" ");
  if (leftNormalized === rightNormalized) return true;

  // High token overlap is not sameness when one claim negates the
  // other. This keeps a correction ("does not use") from being blocked
  // by the earlier positive claim ("uses").
  const leftNegated = [...leftTokens].some((token) =>
    NEGATION_TOKENS.has(token),
  );
  const rightNegated = [...rightTokens].some((token) =>
    NEGATION_TOKENS.has(token),
  );
  if (leftNegated !== rightNegated) return false;
  const leftNumbers = [...leftTokens]
    .filter((token) => /^\d+$/u.test(token))
    .sort();
  const rightNumbers = [...rightTokens]
    .filter((token) => /^\d+$/u.test(token))
    .sort();
  if (leftNumbers.join(",") !== rightNumbers.join(",")) return false;
  const leftQuantityWords = [...leftTokens]
    .filter((token) => QUANTITY_WORDS.has(token))
    .sort();
  const rightQuantityWords = [...rightTokens]
    .filter((token) => QUANTITY_WORDS.has(token))
    .sort();
  if (leftQuantityWords.join(",") !== rightQuantityWords.join(",")) {
    return false;
  }
  if (leftTokens.size < 5 || rightTokens.size < 5) return false;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const dice = (2 * intersection) / (leftTokens.size + rightTokens.size);
  return dice >= 0.8;
}

export function findResearchDuplicates(
  citations: ResearchCitation[],
  prior: PriorResearchDossier,
): ResearchDuplicates {
  const priorCitations = prior.rows.flatMap((row) => row.citations);
  const priorUrls = new Set(
    priorCitations.map((citation) => canonicalResearchUrl(citation.url)),
  );

  const duplicateUrls = new Set<string>();
  const duplicateClaims = new Set<string>();
  for (const citation of citations) {
    const canonicalUrl = canonicalResearchUrl(citation.url);
    if (priorUrls.has(canonicalUrl)) duplicateUrls.add(canonicalUrl);
    if (
      priorCitations.some((priorCitation) =>
        claimsOverlap(citation.claim, priorCitation.claim),
      )
    ) {
      duplicateClaims.add(citation.claim);
    }
  }
  return {
    urls: [...duplicateUrls],
    claims: [...duplicateClaims],
  };
}

/**
 * The durable "already researched" dossier for one topic key. It spans
 * every lens, stage, and status on purpose: once Homa has paid to read a
 * specific article for Dimensions Math, another Dimensions Math run
 * should advance to a different page even if the first row was later
 * superseded or flagged. Enforcement intentionally has no row limit:
 * prompt rendering is capped later, but an old article must not become
 * reusable merely because the dossier grew. The current run is excluded
 * so a corrected save_knowledge retry is not blocked by its own earlier
 * flagged row.
 */
export async function loadPriorResearch(
  topicKey: string,
  options: { excludeRunId?: string | null } = {},
): Promise<PriorResearchDossier> {
  return await loadPriorResearchWithDatabase(mapDb(), topicKey, options);
}

export async function loadPriorResearchWithDatabase(
  sql: Sql | TransactionSql,
  topicKey: string,
  options: { excludeRunId?: string | null } = {},
): Promise<PriorResearchDossier> {
  const excludeRunId = options.excludeRunId ?? null;
  const rows = await sql<
    Array<{
      title: string;
      summary: string;
      citations: ResearchCitation[];
    }>
  >`
    select title, summary, citations
    from public.knowledge_bank
    where topic_key = ${topicKey}
      and (${excludeRunId === null} or run_id is distinct from ${excludeRunId})
    order by created_at desc
  `;
  return {
    topicKey,
    rows: rows.map((row) => ({
      title: row.title,
      summary: row.summary,
      citations: Array.isArray(row.citations) ? row.citations : [],
    })),
  };
}
