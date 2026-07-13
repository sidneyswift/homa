import type { ReactNode } from "react";

/**
 * A subsection header inside the one family card on /app/settings
 * (settings consolidation, founder direction 2026-07-12): quiet
 * uppercase label with a hairline above, so kids, parents, homeschool,
 * and details read as one card's chapters instead of separate cards.
 */
export function SectionHeading({
  children,
  first = false,
}: {
  children: ReactNode;
  /** The first section skips the hairline (the card heading sits above). */
  first?: boolean;
}) {
  return (
    <p
      className={`text-[0.66rem] font-bold uppercase tracking-[0.14em] text-subtle ${
        first ? "mt-4" : "mt-6 border-t border-[var(--stone-100)] pt-5"
      }`}
    >
      {children}
    </p>
  );
}
