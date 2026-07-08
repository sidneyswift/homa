"use client";

/**
 * Opens a subject's drawer and scrolls to it (the read-through fix:
 * tapping a strength card should open the subject, not a text box).
 * Renders its children as the clickable surface.
 */
export function SubjectJump({
  domainId,
  className,
  style,
  children,
}: {
  domainId: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  function open() {
    const details = document.getElementById(`subject-${domainId}`);
    if (!details) return;
    details.setAttribute("open", "");
    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button type="button" onClick={open} className={className} style={style}>
      {children}
    </button>
  );
}
