/** Advisories do not override a blocking verdict (observed in gh#1105). */
export function materialReviewAdvisoryNotes(input: {
  reviewPassed: boolean;
  advisoryIssues: readonly string[];
  checklistAdvisory: readonly string[];
}): string {
  const findings = [
    ...(input.advisoryIssues.length
      ? [`On later pages the check also found: ${input.advisoryIssues.join("; ")}.`]
      : []),
    ...(input.checklistAdvisory.length
      ? [`The check also noted on the pages it judged: ${input.checklistAdvisory.join("; ")}.`]
      : []),
  ];
  if (!findings.length) return "";
  const disposition = input.reviewPassed
    ? "This version is available to her. Tell her which page in one plain sentence and offer to fix it; do not rebuild until she says yes, and do not call it a technical problem."
    : "This version remains hidden because of the blocking quality issues. Fix those before offering a revised version; these advisory findings do not make it visible.";
  return ` ${findings.join(" ")} ${disposition}`;
}
