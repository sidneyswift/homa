import type { LucideIcon } from "lucide-react";

export type HowItWorksStep = {
  icon: LucideIcon;
  title: string;
  body: string;
  tint: string;
  iconColor: string;
};

/**
 * The "how it works" feature-card grid. Presentational only, the copy
 * (title/body) is BUILD.md Deliverable 0's vetted copy, owned by the page
 * that renders this, not by this component.
 */
export function HowItWorks({ steps }: { steps: HowItWorksStep[] }) {
  return (
    <ol className="mt-6 grid gap-4 sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, body, tint, iconColor }) => (
        <li
          key={title}
          className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm"
        >
          <span
            className="inline-flex h-[52px] w-[52px] items-center justify-center"
            style={{ background: tint, borderRadius: "var(--blob-2)" }}
          >
            <Icon size={22} color={iconColor} aria-hidden="true" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-strong">
            {title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}
