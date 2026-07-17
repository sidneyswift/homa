export const RESEARCH_BRIEF_FEEDBACK_KIND = "morning_brief" as const;

export const RESEARCH_BRIEF_FEEDBACK_OUTCOMES = [
  ["done", "sms"],
  ["done", "email"],
  ["done", "none"],
  ["partial", "sms"],
  ["partial", "email"],
  ["partial_uncertain", "sms"],
  ["partial_uncertain", "email"],
] as const;

export const RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS = Object.freeze(
  RESEARCH_BRIEF_FEEDBACK_OUTCOMES.map(
    ([status, channel]) => `${status}:${channel}`,
  ),
);

const RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEY_SET = new Set<string>(
  RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS,
);

interface ResearchBriefFeedbackEligibilityInput {
  kind: string;
  status: string;
  deliveredChannel: string | null;
}

/**
 * One shared eligibility rule for the Tasks UI and durable server write.
 * A save-only done/none run is confirmed because its accepted draft is
 * already family-visible on the Tasks page.
 */
export function isResearchBriefFeedbackEligible(
  run: ResearchBriefFeedbackEligibilityInput,
): boolean {
  const outcomeKey = `${run.status}:${run.deliveredChannel ?? ""}`;
  return (
    run.kind === RESEARCH_BRIEF_FEEDBACK_KIND &&
    RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEY_SET.has(outcomeKey)
  );
}
