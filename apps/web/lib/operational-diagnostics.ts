export const OPERATIONAL_PHASES = [
  "preparation_load",
  "content_guard",
  "canonical_persist",
  "transport",
  "finalization",
  "recovery_lookup",
  "manual_bookkeeping",
  "reactive_email_postprocess",
] as const;

export type OperationalPhase = (typeof OPERATIONAL_PHASES)[number];
export type OperationalDiagnosticScope =
  | "morning_brief"
  | "dispatch"
  | "manual_dispatch"
  | "email_channel"
  | "email_webhook";
export type OperationalDiagnosticResult =
  | "failed"
  | "blocked"
  | "retry_pending"
  | "runtime_session_unrecorded"
  | "setup_failure_unrecorded";

/**
 * Builds a bounded operator diagnostic from enums only. Callers never pass
 * identifiers, parent content, destinations, or provider error strings.
 */
export function operationalDiagnostic(
  scope: OperationalDiagnosticScope,
  phase: OperationalPhase,
  result: OperationalDiagnosticResult,
): string {
  return `[${scope}] phase=${phase} result=${result}`;
}
