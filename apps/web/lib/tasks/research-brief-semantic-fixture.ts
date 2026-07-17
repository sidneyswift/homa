import { validateResearchBriefFormat } from "./research-brief-format";

export interface ResearchBriefFixtureClaim {
  text: string;
  role: "finding" | "action_shaping";
}

export interface ResearchBriefFixtureTrace {
  knowledgeId: string | null;
  sourceNames: readonly string[];
  topic: string;
  title: string;
  claims: readonly string[];
}

export interface ResearchBriefSemanticFixtureContext {
  allowedSourceNames: readonly string[];
  allowedClaims: readonly ResearchBriefFixtureClaim[];
  selectedKnowledgeId: string;
  selectedChild: string;
  evidenceAnchors: readonly string[];
  quotationRequiredEvidenceAnchors: readonly string[];
  siblingNames: readonly string[];
  allowedChildPronouns: readonly string[];
  recentTraces: readonly ResearchBriefFixtureTrace[];
  expectedParentFacingSkill: string;
  requiredPracticalChangeConcepts: readonly string[];
  allowedArtifactExamples: readonly string[];
  expectedCtaConcepts: readonly string[];
}

export type ResearchBriefSemanticRejection =
  | "format"
  | "carrier_overflow"
  | "generic_source"
  | "invented_source"
  | "unsupported_claim"
  | "missing_finding"
  | "missing_action_shaping_detail"
  | "unexplained_skill_name"
  | "vague_action_shaping_detail"
  | "imperative_research_example"
  | "unsupported_pronoun"
  | "missing_child_anchor"
  | "missing_quoted_child_anchor"
  | "causal_child_connection"
  | "missing_child_attempt"
  | "sibling_reference"
  | "recent_repetition"
  | "invented_artifact_example"
  | "cta_mismatch";

export type ResearchBriefSemanticFixtureResult =
  | { ok: true }
  | { ok: false; reasons: ResearchBriefSemanticRejection[] };

const SENTENCE_SEGMENTER = new Intl.Segmenter("en", {
  granularity: "sentence",
});
const ATTRIBUTION =
  /^(.+?)\s+(?:says|explains|reports|finds|notes|shows|describes)\s+(.+)$/iu;
const GENERIC_SOURCE =
  /^(?:(?:a|an|the)\s+)?(?:(?:current|recent|general|evidence|research)\s+)*(?:source|review|study|guide|research|experts?)$/iu;
const APOSTROPHE_VARIANTS = /[\u02BC\u2018\u2019\uFF07]/gu;
const HYPHEN_VARIANTS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/gu;
const CHILD_PRONOUNS = [
  "he",
  "she",
  "him",
  "her",
  "his",
  "hers",
  "they",
  "them",
  "their",
  "theirs",
] as const;
const IMPERATIVE_EXAMPLE =
  /^(?:for\s+[^,]+,\s*)?(?:hold|add|keep|say|make|move|run|stretch|blend|put|start|try)\b/iu;
const CAUSAL_CHILD_OUTCOME =
  /\b(?:(?:could|may|might|will|can)\s+(?:smooth|improve|fix|strengthen|cause|produce|create|ensure|guarantee|lead\s+to)|turns?|keeps?|prevents?|gives?|makes?|smooths?|improves?|fixes?|strengthens?|causes?)\b/iu;
const DIRECT_CHILD_ATTEMPT =
  /\b(?:can\s+try|can\s+practice|can\s+listen\s+for|has\s+(?:a\s+)?chance\s+to\s+try)\b/iu;
const GENERIC_ARTIFACT_CONTENT_WORDS = new Set([
  "and",
  "family",
  "for",
  "in",
  "of",
  "pattern",
  "practice",
  "row",
  "rows",
  "similar",
  "sound",
  "sounds",
  "the",
  "to",
  "word",
  "words",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(HYPHEN_VARIANTS, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function escapedRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedRegularExpression(normalizedPhrase)}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(normalizedText);
}

function containsQuotedWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return new RegExp(
    `["\u201C](?<![\\p{L}\\p{N}])${escapedRegularExpression(normalizedPhrase)}(?![\\p{L}\\p{N}])["\u201D]`,
    "u",
  ).test(normalizedText);
}

function blockText(draft: string, label: string): string {
  return (
    draft
      .replace(/\r\n/gu, "\n")
      .split("\n")
      .find((line) => line.startsWith(label))
      ?.slice(label.length) ?? ""
  );
}

function sentences(value: string): string[] {
  return Array.from(
    SENTENCE_SEGMENTER.segment(value),
    ({ segment }) => segment.trim(),
  ).filter(Boolean);
}

function artifactContentExamples(cta: string): string[] {
  const contents = /\bwith\s+(.+?)\s+for\b/iu.exec(cta)?.[1] ?? "";
  return (
    contents
      .match(/\p{L}[\p{L}'-]*/gu)
      ?.flatMap((word) => normalizeText(word).split("-"))
      .filter(
        (word) =>
          word.length > 0 && !GENERIC_ARTIFACT_CONTENT_WORDS.has(word),
      ) ?? []
  );
}

function uniqueReasons(
  reasons: ResearchBriefSemanticRejection[],
): ResearchBriefSemanticRejection[] {
  return [...new Set(reasons)];
}

/**
 * Grades hand-authored fixtures against explicit evidence. This is not a
 * production copy validator and does not infer whether arbitrary prose is
 * pedagogically sound. Exact claim text and claim roles make every rejection
 * deterministic and explainable.
 */
export function evaluateResearchBriefFixture(
  draft: string,
  context: ResearchBriefSemanticFixtureContext,
): ResearchBriefSemanticFixtureResult {
  const reasons: ResearchBriefSemanticRejection[] = [];
  const format = validateResearchBriefFormat(draft);
  if (!format.ok) {
    const carrierErrors = new Set(["SMS segments", "visible characters"]);
    if (format.errors.some((error) => carrierErrors.has(error))) {
      reasons.push("carrier_overflow");
    }
    if (format.errors.some((error) => !carrierErrors.has(error))) {
      reasons.push("format");
    }
  }

  const learned = blockText(draft, "What I learned: ");
  const interesting = blockText(draft, "Why it's interesting: ");
  const cta = blockText(draft, "Want me to ").replace(/\?$/u, "");
  const learnedSentences = sentences(learned);
  const firstAttribution = ATTRIBUTION.exec(learnedSentences[0] ?? "");
  const attributedSource = firstAttribution?.[1] ?? "";
  const sourceIsAllowed = context.allowedSourceNames.some(
    (sourceName) => normalizeText(sourceName) === normalizeText(attributedSource),
  );
  if (!sourceIsAllowed) {
    reasons.push(
      GENERIC_SOURCE.test(attributedSource)
        ? "generic_source"
        : "invented_source",
    );
  }

  const claimTexts = learnedSentences.map((sentence, index) =>
    index === 0 && firstAttribution ? firstAttribution[2] : sentence
  );
  const matchedClaims = claimTexts.map((claimText) =>
    context.allowedClaims.find(
      (claim) => normalizeText(claim.text) === normalizeText(claimText),
    )
  );
  const hasUnsupportedClaim = matchedClaims.some((claim) => !claim);
  if (hasUnsupportedClaim) {
    reasons.push("unsupported_claim");
  } else {
    if (!matchedClaims.some((claim) => claim?.role === "finding")) {
      reasons.push("missing_finding");
    }
    const actionShapingClaims = matchedClaims.filter(
      (claim) => claim?.role === "action_shaping",
    );
    if (actionShapingClaims.length === 0) {
      reasons.push("missing_action_shaping_detail");
    } else {
      const practicalDetail = actionShapingClaims
        .map((claim) => claim?.text ?? "")
        .join(" ");
      if (
        context.requiredPracticalChangeConcepts.some(
          (concept) => !containsWholePhrase(practicalDetail, concept),
        )
      ) {
        reasons.push("vague_action_shaping_detail");
      }
      if (
        actionShapingClaims.some((claim) =>
          IMPERATIVE_EXAMPLE.test(claim?.text ?? "")
        )
      ) {
        reasons.push("imperative_research_example");
      }
    }
  }

  const hasSelectedChild = containsWholePhrase(
    interesting,
    context.selectedChild,
  );
  const hasEvidenceAnchor = context.evidenceAnchors.some((anchor) =>
    containsWholePhrase(interesting, anchor)
  );
  if (!hasSelectedChild || !hasEvidenceAnchor) {
    reasons.push("missing_child_anchor");
  }
  if (
    context.quotationRequiredEvidenceAnchors.some(
      (anchor) => !containsQuotedWholePhrase(interesting, anchor),
    )
  ) {
    reasons.push("missing_quoted_child_anchor");
  }
  if (CAUSAL_CHILD_OUTCOME.test(interesting)) {
    reasons.push("causal_child_connection");
  } else if (!DIRECT_CHILD_ATTEMPT.test(interesting)) {
    reasons.push("missing_child_attempt");
  }
  if (
    context.siblingNames.some((siblingName) =>
      containsWholePhrase(draft, siblingName)
    )
  ) {
    reasons.push("sibling_reference");
  }
  if (
    CHILD_PRONOUNS.some(
      (pronoun) =>
        !context.allowedChildPronouns.includes(pronoun) &&
        containsWholePhrase(draft, pronoun),
    )
  ) {
    reasons.push("unsupported_pronoun");
  }

  const topic = /^(?:Last night|This morning) I researched (.+)$/mu.exec(
    draft,
  )?.[1] ?? "";
  if (
    normalizeText(topic) !== normalizeText(context.expectedParentFacingSkill)
  ) {
    reasons.push("unexplained_skill_name");
  }
  const normalizedClaims = claimTexts.map(normalizeText);
  const repeatsRecentTrace = context.recentTraces.some((trace) => {
    if (
      trace.knowledgeId &&
      trace.knowledgeId === context.selectedKnowledgeId
    ) {
      return true;
    }
    const repeatsTopic = normalizeText(trace.topic) === normalizeText(topic);
    const repeatsSource = trace.sourceNames.some(
        (sourceName) =>
          normalizeText(sourceName) === normalizeText(attributedSource),
    );
    const repeatsClaim = trace.claims.some((claim) =>
      normalizedClaims.includes(normalizeText(claim))
    );
    return repeatsTopic && repeatsSource && repeatsClaim;
  });
  if (repeatsRecentTrace) reasons.push("recent_repetition");

  if (
    context.expectedCtaConcepts.some(
      (concept) => !containsWholePhrase(cta, concept),
    )
  ) {
    reasons.push("cta_mismatch");
  }
  const allowedArtifactExamples = context.allowedArtifactExamples.map(
    normalizeText,
  );
  if (
    artifactContentExamples(cta).some(
      (example) => !allowedArtifactExamples.includes(example),
    )
  ) {
    reasons.push("invented_artifact_example");
  }

  const unique = uniqueReasons(reasons);
  return unique.length === 0 ? { ok: true } : { ok: false, reasons: unique };
}
