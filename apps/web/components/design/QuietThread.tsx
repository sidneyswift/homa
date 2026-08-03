import { roofThread } from "@homa/design/contract";

export function QuietThread({ className = "", label = "" }: { className?: string; label?: string }) {
  return (
    <svg className={`quiet-thread ${className}`.trim()} viewBox={roofThread.viewBox} fill="none" aria-hidden={label ? undefined : true} role={label ? "img" : undefined}>
      {label ? <title>{label}</title> : null}
      <path d={roofThread.path} />
    </svg>
  );
}
