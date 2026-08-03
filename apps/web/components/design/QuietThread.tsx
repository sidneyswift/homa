export function QuietThread({ className = "", label = "" }: { className?: string; label?: string }) {
  return (
    <svg className={`quiet-thread ${className}`.trim()} viewBox="0 0 320 48" fill="none" aria-hidden={label ? undefined : true} role={label ? "img" : undefined}>
      {label ? <title>{label}</title> : null}
      <path d="M3 30 C34 5 55 44 84 19 S137 6 159 28 S212 43 235 20 S278 3 317 23" />
    </svg>
  );
}
