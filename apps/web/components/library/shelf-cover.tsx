import {
  coverLiveryKey,
  subjectAccent,
  type CoverAccent,
} from "../../lib/materials/library-shelf";

const ACCENT_STYLE: Record<
  CoverAccent,
  { cloth: string; spine: string; ink: string; sub: string }
> = {
  clay: {
    cloth: "var(--homa-midnight-action)",
    spine: "var(--homa-visual-coral)",
    ink: "var(--homa-paper)",
    sub: "color-mix(in srgb, var(--homa-paper) 72%, transparent)",
  },
  sky: {
    cloth: "var(--homa-info-tint)",
    spine: "var(--homa-info-ink)",
    ink: "var(--homa-info-ink)",
    sub: "color-mix(in srgb, var(--homa-info-ink) 72%, transparent)",
  },
  sage: {
    cloth: "var(--homa-constructive-tint)",
    spine: "var(--homa-constructive-ink)",
    ink: "var(--homa-constructive-ink)",
    sub: "color-mix(in srgb, var(--homa-constructive-ink) 72%, transparent)",
  },
  gold: {
    cloth: "var(--homa-highlight-tint)",
    spine: "var(--homa-highlight-ink)",
    ink: "var(--homa-highlight-ink)",
    sub: "color-mix(in srgb, var(--homa-highlight-ink) 72%, transparent)",
  },
  rose: {
    cloth: "var(--homa-error-tint)",
    spine: "var(--homa-error-ink)",
    ink: "var(--homa-error-ink)",
    sub: "color-mix(in srgb, var(--homa-error-ink) 72%, transparent)",
  },
  stone: {
    cloth: "var(--homa-canvas)",
    spine: "var(--homa-control-boundary)",
    ink: "var(--homa-ink)",
    sub: "color-mix(in srgb, var(--homa-ink) 62%, transparent)",
  },
};

function titleSize(title: string): string {
  if (title.length > 68) return "0.72rem";
  if (title.length > 44) return "0.82rem";
  if (title.length > 26) return "0.95rem";
  return "1.08rem";
}

export function ShelfCover({
  title,
  publisher,
  series,
  subject,
  footer,
  imageUrl,
  imageAlt = "",
}: {
  title: string;
  publisher: string | null;
  series?: string | null;
  subject: string | null;
  footer: string;
  imageUrl?: string | null;
  imageAlt?: string;
}) {
  const shared = "quiet-library-cover";

  if (imageUrl) {
    return (
      <div className={`${shared} bg-[var(--homa-canvas)]`}>
        {/* The parent already received this exact family-scoped URL through
            the authenticated Library read. A plain image avoids coupling
            arbitrary Blob hosts to Next image configuration. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt}
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[6px] bg-gradient-to-r from-black/25 to-transparent"
      />
      </div>
    );
  }

  const accent = ACCENT_STYLE[
    subjectAccent(
      subject,
      coverLiveryKey({ publisher, series: series ?? null, title }),
    )
  ];
  return (
    <div
      className={`${shared} flex flex-col justify-between px-3 py-3.5`}
      style={{ background: accent.cloth, color: accent.ink }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[7px]"
        style={{ background: accent.spine }}
      />
      <div className="pl-1.5">
        {publisher ? (
          <p
            className="mb-1.5 line-clamp-1 font-mono text-[0.52rem] font-bold uppercase tracking-[0.14em]"
            style={{ color: accent.sub }}
          >
            {publisher}
          </p>
        ) : null}
        <p
          className="line-clamp-5 font-serif leading-tight"
          style={{ fontSize: titleSize(title) }}
        >
          {title}
        </p>
      </div>
      <div className="pl-1.5">
        <span
          aria-hidden="true"
          className="mb-2 block h-px w-7"
          style={{ background: accent.sub, opacity: 0.6 }}
        />
        <p
          className="line-clamp-1 font-mono text-[0.5rem] font-bold uppercase tracking-[0.12em]"
          style={{ color: accent.sub }}
        >
          {footer}
        </p>
      </div>
    </div>
  );
}
