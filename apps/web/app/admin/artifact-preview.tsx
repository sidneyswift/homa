/**
 * The operator view of a generated artifact is still an artifact surface.
 * Keep its preview chrome on the same Quiet atom as the family Library so
 * founder review does not drift into a second card language.
 */
export function AdminArtifactPreview({
  src,
  alt,
  href,
  className,
  imageClassName = "h-auto w-full object-cover object-top",
}: {
  src: string;
  alt: string;
  href?: string;
  className?: string;
  imageClassName?: string;
}) {
  const preview = (
    <span
      data-brand-layer="admin-artifact-preview"
      className={`quiet-artifact-card__preview block ${className ?? ""}`.trim()}
    >
      {/* Blob preview JPEGs have no next/image loader config, so this mirrors
          the existing artifact preview path without changing its source URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`block ${imageClassName}`.trim()} loading="lazy" />
    </span>
  );

  if (!href) return preview;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="quiet-artifact-card block"
      aria-label={`Open ${alt.replace(/^Preview of /u, "").replace(/ preview$/u, "")} PDF`}
    >
      {preview}
    </a>
  );
}
