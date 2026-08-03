import type { CSSProperties, ReactNode } from "react";

export type QuietMediaKind = "artifact" | "photo" | "thumbnail";

export type QuietMediaProps = {
  src?: string | null;
  /** Use an empty string only for intentionally decorative media. */
  alt: string;
  caption?: ReactNode;
  kind?: QuietMediaKind;
  width?: number;
  height?: number;
  loading?: "eager" | "lazy";
  className?: string;
  style?: CSSProperties;
};

/**
 * Media adapter for family artifacts and approved imagery.
 *
 * It keeps the semantic figure, alt text, stable loading slot, and artifact
 * first object-fit rule in one place. A route may provide a storage or CDN URL,
 * but it may not replace the accessibility or privacy-facing media contract.
 */
export function QuietMedia({
  src,
  alt,
  caption,
  kind = "artifact",
  width,
  height,
  loading = "lazy",
  className = "",
  style,
}: QuietMediaProps) {
  const decorative = alt.length === 0;
  return (
    <figure
      className={`quiet-media quiet-media--${kind} ${className}`.trim()}
      data-kind={kind}
      data-state={src ? "ready" : "loading"}
      style={style}
    >
      {src ? (
        // Plain img keeps storage and provider URLs at the adapter boundary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="quiet-media__image"
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
        />
      ) : (
        <div
          className="quiet-media__placeholder"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : alt}
          aria-hidden={decorative ? true : undefined}
          aria-busy="true"
        >
          <span>Preparing the preview</span>
        </div>
      )}
      {caption ? <figcaption className="quiet-media__caption">{caption}</figcaption> : null}
    </figure>
  );
}
