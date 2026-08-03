import type { HTMLAttributes, ReactNode } from "react";

type QuietFrameProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className"> & {
  tone?: "paper" | "mineral" | "contained";
  as?: "div" | "section" | "article" | "aside";
  children: ReactNode;
  className?: string;
};

export function QuietFrame({
  tone = "paper",
  as: Element = "section",
  children,
  className = "",
  ...props
}: QuietFrameProps) {
  return (
    <Element {...props} className={`quiet-frame quiet-frame--${tone} ${className}`.trim()}>
      {children}
    </Element>
  );
}
