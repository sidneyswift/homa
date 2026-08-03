/**
 * Shared class strings for the report view's controls
 * (/onboarding/r/[token]). Centralizes the one thing that silently drifted
 * once already: the Quiet motion and authority contract together with the
 * control geometry and the two color variants. A new report button literally
 * cannot be built without carrying that motion now.
 *
 * Callers still pass their own size, padding, and margins. Those legitimately
 * vary per placement, so keeping them at the call site is intentional, not an
 * oversight. This is a plain string helper (no React) so it works in the
 * report's server components too.
 */

export type ReportButtonVariant =
  | "primary"
  | "primary-strong"
  | "secondary";

/** Control shape plus the motion contract every report button must carry. */
const REPORT_BUTTON_BASE =
  "quiet-action transition duration-(--homa-motion-fast) ease-out motion-safe:active:scale-[var(--press-scale)]";

const REPORT_BUTTON_VARIANT: Record<ReportButtonVariant, string> = {
  /** Midnight action, the main action. */
  primary: "quiet-action--primary",
  /** Same authority treatment for a prominent report action. */
  "primary-strong": "quiet-action--primary",
  /** Bordered paper surface, a secondary or side action. */
  secondary: "quiet-action--secondary",
};

/**
 * Build a report control's className.
 * @param variant `"primary"` (midnight action), `"primary-strong"`
 *                (same authority treatment), or `"secondary"` (bordered).
 * @param layout  per-placement classes: size, padding, margins, `inline-flex`,
 *                `items-center`, `font-semibold`, `print:hidden`, and so on.
 */
export function reportButtonClass(variant: ReportButtonVariant, layout = ""): string {
  const base = `${REPORT_BUTTON_BASE} ${REPORT_BUTTON_VARIANT[variant]}`;
  return layout ? `${base} ${layout}` : base;
}
