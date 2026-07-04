/**
 * Wireframe slot primitives (wireframe stage only).
 *
 * Every undecided piece of copy or media renders as a visibly labeled slot
 * instead of drafted placeholder copy, so no invented voice ships by
 * accident. The copy kit (docs/homa-planning/journeys/07 §5) fills these
 * during the design pass. Delete this file when the last slot is gone.
 */

export function WireframeSlot({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="inline-block rounded border border-dashed border-neutral-400 bg-neutral-50 px-2 py-0.5 text-neutral-500">
      {label}
      {hint ? (
        <span className="ml-2 align-middle text-xs font-normal normal-case tracking-normal text-neutral-400">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

export function WireframeMediaSlot({
  label,
  hint,
  className = "",
}: {
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-neutral-400 bg-neutral-50 p-8 text-center text-sm text-neutral-500 ${className}`}
    >
      <p>{label}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}
