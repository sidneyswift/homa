/**
 * Shared class strings for the report view's pill buttons
 * (/onboarding/r/[token]). Centralizes the one thing that silently drifted
 * once already: the emil-design-eng motion contract (brand ease-out transition
 * plus a reduced-motion-safe press scale) together with the pill shape and the
 * two color variants. A new report button literally cannot be built without
 * carrying that motion now.
 *
 * Callers still pass their own size, padding, and margins. Those legitimately
 * vary per placement, so keeping them at the call site is intentional, not an
 * oversight. This is a plain string helper (no React) so it works in the
 * report's server components too.
 */

export type ReportButtonVariant = "primary" | "secondary";

/** Pill shape plus the motion contract every report button must carry. */
const REPORT_BUTTON_BASE =
  "rounded-pill transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)]";

const REPORT_BUTTON_VARIANT: Record<ReportButtonVariant, string> = {
  /** Solid clay, the main action. */
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  /** Bordered card surface, a secondary or side action. */
  secondary: "border border-border bg-card text-strong hover:border-brand",
};

/**
 * Build a report pill button's className.
 * @param variant `"primary"` (solid clay) or `"secondary"` (bordered).
 * @param layout  per-placement classes: size, padding, margins, `inline-flex`,
 *                `items-center`, `font-semibold`, `print:hidden`, and so on.
 */
export function reportButtonClass(variant: ReportButtonVariant, layout = ""): string {
  const base = `${REPORT_BUTTON_BASE} ${REPORT_BUTTON_VARIANT[variant]}`;
  return layout ? `${base} ${layout}` : base;
}
