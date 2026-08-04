import type { HTMLAttributes, ReactNode } from "react";

type VoiceSafeSlotProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  placement?: "bottom" | "inline";
  label?: string;
};

/**
 * Stable presentation host for Voice-owned controls. This component does
 * not infer microphone or session state. The Voice runtime remains owned by
 * its existing route and supplies truthful content when ready.
 */
export function VoiceSafeSlot({
  children,
  placement = "bottom",
  label = "Voice controls",
  className = "",
  ...props
}: VoiceSafeSlotProps) {
  return (
    <div
      {...props}
      role="region"
      aria-label={label}
      className={`quiet-voice-safe-slot quiet-voice-safe-slot--${placement} ${className}`.trim()}
      data-voice-safe-slot=""
      data-voice-placement={placement}
    >
      {children}
    </div>
  );
}
