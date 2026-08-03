import type { ReactNode } from "react";

export function QuietStatus({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "constructive" | "attention" | "error";
  children: ReactNode;
  className?: string;
}) {
  return <div className={`quiet-status quiet-status--${tone} ${className}`.trim()} role="status">{children}</div>;
}
