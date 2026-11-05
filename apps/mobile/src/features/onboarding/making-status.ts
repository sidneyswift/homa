/**
 * Job states the first-making screen stops waiting on. "paused" is where
 * the runner parks a stage that ran out of retries, and nothing resumes
 * it on its own, so polling past it held a new parent on "drawing" with
 * no page ever coming (2026-11-04 local walk).
 */
const STOPPED_STATUSES = new Set(["failed", "cancelled", "paused"]);

export function firstMakingStopped(status: string | null | undefined): boolean {
  return typeof status === "string" && STOPPED_STATUSES.has(status);
}
