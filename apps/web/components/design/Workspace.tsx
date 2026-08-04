import type { ReactNode } from "react";

/**
 * Shared route workspace geometry. The optional class lets a route choose a
 * stage or context composition without recreating the page gutter contract.
 */
export function Workspace({
  children,
  className = "",
  layout = "flow",
}: {
  children: ReactNode;
  className?: string;
  layout?: "flow" | "stage-context";
}) {
  return (
    <div
      className={`quiet-workspace quiet-workspace--${layout} ${className}`.trim()}
      data-workspace=""
      data-workspace-layout={layout}
    >
      {children}
    </div>
  );
}
