import type { HTMLAttributes, ReactNode } from "react";

type WorkStageProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: "div" | "section" | "article";
  labelledBy?: string;
  stateLabel?: ReactNode;
  children: ReactNode;
};

/** The dominant work object or current job on a signed-in surface. */
export function WorkStage({
  as: Element = "section",
  labelledBy,
  stateLabel,
  children,
  className = "",
  ...props
}: WorkStageProps) {
  return (
    <Element
      {...props}
      aria-labelledby={labelledBy}
      className={`quiet-work-stage ${className}`.trim()}
      data-work-stage=""
    >
      {stateLabel ? <div className="quiet-work-stage__state" role="status">{stateLabel}</div> : null}
      {children}
    </Element>
  );
}
