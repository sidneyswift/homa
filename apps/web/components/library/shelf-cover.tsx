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
    cloth: "var(--clay-700)",
    spine: "var(--clay-800, #7d2f15)",
    ink: "#FFF6F1",
    sub: "var(--clay-200)",
  },
  sky: {
    cloth: "var(--sky-600)",
    spine: "#2E7488",
    ink: "#F2FBFE",
    sub: "var(--sky-100)",
  },
  sage: {
    cloth: "var(--sage-700)",
    spine: "#1E4B29",
    ink: "#F3FAF4",
    sub: "var(--sage-200)",
  },
  gold: {
    cloth: "var(--gold-500)",
    spine: "#C89C00",
    ink: "#3A2E00",
    sub: "#7A6200",
  },
  rose: {
    cloth: "var(--rose-600)",
    spine: "#96351D",
    ink: "#FFF4F1",
    sub: "var(--rose-100)",
  },
  stone: {
    cloth: "var(--stone-700)",
    spine: "var(--stone-800)",
    ink: "#FBF7F0",
    sub: "var(--stone-300)",
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
  const shared =
    "relative aspect-[3/4] w-full overflow-hidden rounded-[3px_var(--radius-sm)_var(--radius-sm)_3px] shadow-[var(--shadow-md)]";

  if (imageUrl) {
    return (
      <div className={`${shared} bg-[var(--stone-200)]`}>
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
