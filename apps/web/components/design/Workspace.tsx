import type { ReactNode } from "react";

/**
 * Shared route workspace geometry. The optional class lets a route choose a
 * stage or context composition without recreating the page gutter contract.
 */
export function Workspace({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`quiet-workspace ${className}`.trim()} data-workspace="">
      {children}
    </div>
  );
}
