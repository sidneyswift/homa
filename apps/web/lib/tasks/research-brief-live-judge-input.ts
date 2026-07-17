export interface ResearchBriefQuotationEvidence {
  exactEvidenceAnchors: readonly string[];
  quotationRequiredEvidenceAnchors: readonly string[];
}

export function buildResearchBriefLiveJudgeInput<
  TEvidence extends ResearchBriefQuotationEvidence,
  TRubric extends Record<string, string>,
>(input: {
  draft: string;
  evidence: TEvidence;
  rubric: TRubric;
}): {
  draft: string;
  evidence: TEvidence;
  rubric: TRubric & { usesExactChildAnchor: string };
} {
  const quotationRule =
    input.evidence.quotationRequiredEvidenceAnchors.length > 0
      ? input.evidence.quotationRequiredEvidenceAnchors
          .map(
            (anchor) =>
              `The marked word or phrase "${anchor}" must remain quoted exactly as supplied.`,
          )
          .join(" ")
      : "No evidence anchor is marked as requiring quotation. Do not require or invent a quoted word.";

  return {
    draft: input.draft,
    evidence: input.evidence,
    rubric: {
      ...input.rubric,
      usesExactChildAnchor:
        `Why it's interesting must name the selected child and use an exact supplied evidence anchor without embellishment. ${quotationRule}`,
    },
  };
}
