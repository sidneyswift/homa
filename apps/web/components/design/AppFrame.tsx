import type { ReactNode } from "react";

/**
 * The persistent authenticated frame. Route content owns its domain
 * behavior, while AppFrame owns the shared rail, phone bar, and content slot.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="quiet-app-frame quiet-shell" data-app-frame="">
      {children}
    </div>
  );
}
