import type { ReactNode } from "react";

export function QuietStatus({
  tone = "info",
  children,
}: {
  tone?: "info" | "constructive" | "attention" | "error";
  children: ReactNode;
}) {
  return <div className={`quiet-status quiet-status--${tone}`} role="status">{children}</div>;
}
