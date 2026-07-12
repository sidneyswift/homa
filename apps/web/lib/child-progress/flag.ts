/**
 * Keeps live Progress dark until its additive migration and reconciliation
 * have completed. Only the exact documented value enables the new routes.
 */
export function liveProgressEnabled(): boolean {
  return process.env.HOMA_LIVE_PROGRESS_ENABLED === "true";
}
