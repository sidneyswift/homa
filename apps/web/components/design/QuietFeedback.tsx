import type { HTMLAttributes, ReactNode } from "react";

export type QuietFeedbackTone = "constructive" | "info" | "highlight" | "error";

export type QuietFeedbackProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: QuietFeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  live?: "polite" | "assertive" | "off";
  busy?: boolean;
};

/**
 * Truthful status feedback. The tone names a semantic state, while the
 * calling route remains responsible for deciding whether work is complete,
 * interrupted, or needs attention.
 */
export function QuietFeedback({
  tone = "info",
  title,
  children,
  live = tone === "error" ? "assertive" : "polite",
  busy = false,
  className = "",
  ...props
}: QuietFeedbackProps) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <div
      {...props}
      className={`quiet-feedback quiet-feedback--${tone} ${className}`.trim()}
      data-tone={tone}
      data-state={busy ? "loading" : "idle"}
      role={role}
      aria-live={live === "off" ? undefined : live}
      aria-atomic="true"
      aria-busy={busy ? true : undefined}
    >
      <div className="quiet-feedback__copy">
        {title ? <strong className="quiet-feedback__title">{title}</strong> : null}
        <div className="quiet-feedback__body">{children}</div>
      </div>
    </div>
  );
}
