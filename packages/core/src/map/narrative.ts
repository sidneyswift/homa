/**
 * The narrative layer's shapes (D8 overturn, founder rulings 2026-07-06):
 * the model writes every parent-facing sentence of the report and the
 * four-week plan, while every number, position, age, badge, chart point,
 * citation, and movement fact stays computed by the deterministic code.
 * Pure types only; generation lives in apps/web (server), validation in
 * map/narrative-gate.ts (pure, shared).
 */

export interface ReportNarrative {
  /** The note from Homa at the top. */
  note: string;
  /** One line per subject, keyed by domainId (scored + exposure + not_mapped). */
  subjects: Record<string, string>;
  /** The new whole-picture section: cross-subject story, interests woven in,
   * one thing worth doing this month. */
  synthesis: string;
  /** Per-subject drawer explainer, keyed by domainId, scored subjects only. */
  drawers: Record<string, string>;
  /** The memory-box piece: a short dated letter addressed to the CHILD
   * (the one piece not written to the parent), no numbers, no advice,
   * made to be printed and kept. Renders nothing when gate-rejected;
   * there is no template equivalent. */
  keepsake: string;
}

export interface PlanNarrative {
  intro: string;
  /** One framing line per week, index 0 to 3. */
  weeks: string[];
  closing: string;
}

/** Status trail for one generation attempt, stored as jsonb next to the
 * narrative itself. rejectedPieces holds gate-rejected piece keys whose
 * template fallbacks rendered instead. */
export interface NarrativeMeta {
  status: "writing" | "ready" | "failed";
  promptVersion: string;
  model: string;
  startedAt: string;
  generatedAt?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  rejectedPieces?: string[];
  failReason?: string;
}
