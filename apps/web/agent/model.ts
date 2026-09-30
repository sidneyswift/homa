/**
 * The model id Homa speaks with: the chat agent
 * (agent.ts) and the report writer (lib/map/narrative-generate.ts) both
 * import it, so a model-mix change is a one-line swap (founder ruling
 * 2026-07-06: report generation shares the chat agent's voice source and
 * model). Fleet research has its own model under gh#1209. Gateway-routed:
 * the string resolves through the Vercel AI
 * Gateway in both eve and the AI SDK.
 */
export const HOMA_MODEL = "openai/gpt-6-astra";

/** Background corpus research only; family-facing turns stay on HOMA_MODEL. */
export const FLEET_RESEARCH_MODEL = "anthropic/claude-sonnet-5.5";
export type HomaTurnModel = typeof HOMA_MODEL | typeof FLEET_RESEARCH_MODEL;

/** Only the server-created research identity may select the cheaper model. */
export function selectHomaTurnModel(auth: unknown): HomaTurnModel {
  const identity = auth as {
    authenticator?: unknown;
    principalId?: unknown;
    attributes?: { channel?: unknown; taskRunId?: unknown; familyId?: unknown };
  } | null | undefined;
  const attributes = identity?.attributes;
  return identity?.authenticator === "fleet-research"
    && attributes?.channel === "research"
    && typeof attributes.taskRunId === "string"
    && attributes.taskRunId.length > 0
    && identity.principalId === `research:${attributes.taskRunId}`
    && attributes.familyId == null
    ? FLEET_RESEARCH_MODEL
    : HOMA_MODEL;
}

/** Shared turn and background-call effort, selected by the founder in #1161. */
export const HOMA_REASONING = "medium" as const;

/** Explicit specialist overrides keep their own provider-default reasoning. */
export function homaModelSettings(model: string = HOMA_MODEL) {
  return {
    model,
    ...(model === HOMA_MODEL ? { reasoning: HOMA_REASONING } : {}),
  };
}
