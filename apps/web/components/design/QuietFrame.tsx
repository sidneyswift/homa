import type { ReactNode } from "react";

export function QuietFrame({
  tone = "paper",
  as: Element = "section",
  children,
  className = "",
}: {
  tone?: "paper" | "mineral" | "contained";
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
  className?: string;
}) {
  return <Element className={`quiet-frame quiet-frame--${tone} ${className}`.trim()}>{children}</Element>;
}
