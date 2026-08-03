/**
 * One kid's face across the app: the uploaded profile photo when the
 * family added one (migration #75), otherwise the toned initial circle
 * every surface used before. Decorative on purpose (alt="",
 * aria-hidden): the kid's name is always adjacent text or the host
 * control's label. Tones are keyed by position in the family list so a
 * kid keeps their color everywhere.
 */

const AVATAR_TONES: ReadonlyArray<readonly [string, string]> = [
  ["var(--homa-error-tint)", "var(--homa-brand-text)"],
  ["var(--homa-info-tint)", "var(--homa-info-ink)"],
  ["var(--homa-constructive-tint)", "var(--homa-constructive-ink)"],
  ["var(--homa-highlight-tint)", "var(--homa-highlight-ink)"],
];

/** Deterministic avatar tone per list position, shared with KidCard. */
export function avatarTone(index: number): readonly [string, string] {
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

export function KidAvatar({
  name,
  index,
  avatarUrl,
  size,
  label,
}: {
  name: string;
  /** Position in the family list, drives the fallback tone. */
  index: number;
  avatarUrl: string | null;
  size: number;
  /** When the avatar is the only place the kid's name appears (the
   * planner's tiny chips), it labels itself; otherwise decorative. */
  label?: string;
}) {
  if (avatarUrl) {
    return (
      // Plain <img>: a remote Blob URL; next/image would need
      // remotePatterns config for a tiny avatar (same call as AdultAvatar).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={label ?? ""}
        title={label}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border border-[color:var(--homa-control-boundary)] object-cover"
      />
    );
  }
  const [bg, ink] = avatarTone(index);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, background: bg, color: ink, fontSize: size * 0.45 }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      title={label}
    >
      {name.charAt(0)}
    </span>
  );
}
