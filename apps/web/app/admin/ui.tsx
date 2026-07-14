import type { ReactNode } from "react";

/**
 * Shared presentational pieces for the founder console (MJ-14). Design
 * system only: tokens from globals.css, the stat-tile pattern from
 * components/dashboard/stat-tiles.tsx, soft pills like the app's kid and
 * binder chips. Danger red is reserved for machine failures, never for a
 * family's pace (house rule).
 */

export type PillTone = "sage" | "gold" | "rose" | "sky" | "stone" | "clay" | "outline";

const PILL_STYLES: Record<PillTone, { background: string; color: string; border?: string }> = {
  sage: { background: "var(--sage-50)", color: "var(--sage-700)" },
  gold: { background: "var(--gold-100)", color: "var(--gold-ink)" },
  rose: { background: "var(--danger-soft)", color: "var(--rose-600)" },
  sky: { background: "var(--info-soft)", color: "var(--sky-600)" },
  stone: { background: "var(--stone-100)", color: "var(--stone-700)" },
  clay: { background: "var(--brand-soft)", color: "var(--clay-700)" },
  outline: {
    background: "var(--surface-card)",
    color: "var(--stone-600)",
    border: "1px dashed var(--border-default)",
  },
};

export function Pill({
  tone,
  title,
  children,
}: {
  tone: PillTone;
  /** Hover explanation (the stage pills carry their derivation rule here). */
  title?: string;
  children: ReactNode;
}) {
  const style = PILL_STYLES[tone];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[0.72rem] font-bold"
      style={{ background: style.background, color: style.color, border: style.border }}
      title={title}
    >
      {children}
    </span>
  );
}

/** Delivery and task-run statuses share one pill vocabulary. Uncertain is
 * its own tone on purpose: the scary bucket never hides inside sent/failed
 * (founder-dashboard lab, blind spot 4). */
export function statusTone(status: string): PillTone {
  switch (status) {
    case "done":
    case "sent":
    case "delivered":
    case "submitted":
    case "active":
    case "trialing":
      return "sage";
    case "failed":
    case "bounced":
    case "rejected":
    case "complained":
    case "canceled":
    case "past_due":
    case "unpaid":
      return "rose";
    case "uncertain":
    case "partial":
    case "partial_uncertain":
    case "unknown":
    case "pending":
      return "gold";
    case "skipped":
    case "running":
      return "stone";
    default:
      return "stone";
  }
}

export function Tile({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: string;
  sub: string;
  subTone?: "muted" | "sage" | "gold" | "rose";
}) {
  const toneStyle = {
    muted: { color: "var(--text-subtle)" },
    sage: { color: "var(--sage-600)", fontWeight: 600 },
    gold: { color: "var(--gold-ink)", fontWeight: 600 },
    rose: { color: "var(--rose-600)", fontWeight: 600 },
  }[subTone];
  return (
    <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
      <p className="text-[0.72rem] font-bold text-muted">{label}</p>
      <p className="mt-1 font-display text-[1.55rem] font-semibold leading-none text-strong">
        {value}
      </p>
      <p className="mt-1.5 text-[0.72rem]" style={toneStyle}>
        {sub}
      </p>
    </div>
  );
}

export function Spark({ values, width = 110, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 4) + 2;
      const y = height - 3 - (value / max) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const flat = values.every((value) => value === 0);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={flat ? "var(--stone-300)" : "var(--clay-400)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertRow({
  tone,
  action,
  children,
}: {
  tone: "rose" | "gold" | "sky";
  /** Right-aligned control, e.g. the Mark handled chip. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const styles = {
    rose: { background: "var(--danger-soft)", border: "1px solid var(--rose-500)", color: "var(--rose-600)" },
    gold: { background: "var(--gold-100)", border: "1px solid var(--gold-300)", color: "var(--gold-ink-strong)" },
    sky: { background: "var(--info-soft)", border: "1px solid var(--sky-100)", color: "var(--pop-navy, var(--stone-800))" },
  }[tone];
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md px-3.5 py-2.5 text-sm"
      style={styles}
    >
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mt-8">
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        {eyebrow}
      </p>
      <h2 className="mt-0.5 font-display text-lg font-bold text-strong">{title}</h2>
      {sub ? <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-md border border-dashed border-border-default bg-card px-3.5 py-3 text-sm text-subtle">
      {children}
    </p>
  );
}
