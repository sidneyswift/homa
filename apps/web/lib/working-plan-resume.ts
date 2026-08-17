const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const WORKING_PLAN_RESUME_HEADER = "x-homa-working-plan-id";

export interface WorkingPlanResumePrefill {
  message: string;
  workingPlanId: string;
}

/**
 * Turn one closed Binder deep-link shape into a composer opening. Keeping this
 * separate from the page makes the URL boundary exact and independently
 * testable: query parameters can choose a stored id, never inject chat copy.
 */
export function workingPlanResumeDraft(input: {
  draft?: string;
  workingPlanId?: string;
}): WorkingPlanResumePrefill | undefined {
  if (
    input.draft !== "resume-month-plan"
    || !input.workingPlanId
    || !UUID_PATTERN.test(input.workingPlanId)
  ) {
    return undefined;
  }
  return {
    message: "Open my saved month plan from the Binder so we can keep working on it.",
    workingPlanId: input.workingPlanId,
  };
}

/**
 * A request header may select which family-owned object to open, but it never
 * grants access. preview_month_plan re-scopes this id to the authenticated
 * family before returning any stored content.
 */
export function workingPlanIdFromHeader(value: string | null): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

export function withWorkingPlanResumeHeader(input: {
  headers: Readonly<Record<string, string>>;
  visibleMessage: string | null;
  initialMessage?: string;
  workingPlanId?: string;
}): Readonly<Record<string, string>> {
  if (
    !input.workingPlanId
    || !UUID_PATTERN.test(input.workingPlanId)
    || input.visibleMessage !== input.initialMessage
  ) {
    return input.headers;
  }
  return {
    ...input.headers,
    [WORKING_PLAN_RESUME_HEADER]: input.workingPlanId,
  };
}
