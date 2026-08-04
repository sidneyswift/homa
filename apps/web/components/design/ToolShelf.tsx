import type { HTMLAttributes, ReactNode } from "react";

type ToolShelfProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  label: string;
  orientation?: "row" | "column";
  children: ReactNode;
};

/** Bounded local actions, distinct from global navigation and the work stage. */
export function ToolShelf({
  label,
  orientation = "row",
  children,
  className = "",
  ...props
}: ToolShelfProps) {
  return (
    <nav
      {...props}
      aria-label={label}
      className={`quiet-tool-shelf quiet-tool-shelf--${orientation} ${className}`.trim()}
      data-tool-shelf=""
    >
      {children}
    </nav>
  );
}
