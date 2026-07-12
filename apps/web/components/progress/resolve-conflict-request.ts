import type { ProgressEvidenceAnswer } from "../../lib/child-progress/types";

/**
 * The Progress panel's inline confirm call, with fetch injected so the
 * outcome mapping stays testable without a server.
 *
 * Outcomes: "settled" refreshes the view; "already_settled" means the
 * conflict closed elsewhere first (also refresh, the view carries the
 * truth); "failed" keeps the panel unchanged and shows the retry line.
 */
export type ResolveConflictOutcome =
  | "settled"
  | "already_settled"
  | "failed";

export async function requestConflictResolution(
  input: {
    conflictId: string;
    answer: ProgressEvidenceAnswer;
    idempotencyKey: string;
  },
  dependencies: {
    fetchJson(
      url: string,
      init: RequestInit,
    ): Promise<{ status: number }>;
  },
): Promise<ResolveConflictOutcome> {
  let response: { status: number };
  try {
    response = await dependencies.fetchJson("/api/progress/conflict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return "failed";
  }
  if (response.status === 200) return "settled";
  if (response.status === 409 || response.status === 404) {
    // Resolved by the other adult, by chat, or gone: the refreshed view
    // shows what actually happened.
    return "already_settled";
  }
  return "failed";
}
