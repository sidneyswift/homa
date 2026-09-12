/**
 * The one model id Homa speaks with, everywhere: the chat agent
 * (agent.ts) and the report writer (lib/map/narrative-generate.ts) both
 * import it, so a model-mix change is a one-line swap (founder ruling
 * 2026-07-06: report generation shares the chat agent's voice source and
 * model). Gateway-routed: the string resolves through the Vercel AI
 * Gateway in both eve and the AI SDK.
 */
export const HOMA_MODEL = "openai/gpt-6-astra";

/** Shared turn and background-call effort, selected by the founder in #1159. */
export const HOMA_REASONING = "low" as const;

/** Explicit specialist overrides keep their own provider-default reasoning. */
export function homaModelSettings(model: string = HOMA_MODEL) {
  return {
    model,
    ...(model === HOMA_MODEL ? { reasoning: HOMA_REASONING } : {}),
  };
}
