import type { HTMLAttributes, ReactNode } from "react";

type ContextPanelProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: "aside" | "section" | "div";
  mode?: "docked" | "overlay" | "sheet";
  labelledBy?: string;
  open?: boolean;
  children: ReactNode;
};

/**
 * Details for the selected work object. Geometry changes by mode at the
 * breakpoint layer, so the route does not clone panel markup for phone and
 * desktop.
 */
export function ContextPanel({
  as: Element = "aside",
  mode = "docked",
  labelledBy,
  open = true,
  children,
  className = "",
  ...props
}: ContextPanelProps) {
  return (
    <Element
      {...props}
      aria-labelledby={labelledBy}
      className={`quiet-context-panel quiet-context-panel--${mode} ${className}`.trim()}
      data-context-panel=""
      data-context-mode={mode}
      data-open={open ? "true" : "false"}
      hidden={!open}
    >
      {children}
    </Element>
  );
}
