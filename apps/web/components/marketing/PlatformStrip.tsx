import { Globe2, MessageCircle, Smartphone, type LucideIcon } from "lucide-react";

import { PLATFORM_ITEMS, type PlatformKind } from "./landing-content";

const PLATFORM_ICONS: Record<PlatformKind, LucideIcon> = {
  message: MessageCircle,
  web: Globe2,
  phone: Smartphone,
};

/**
 * States the three verified ways a parent can reach Homa without implying
 * public App Store availability.
 */
export function PlatformStrip() {
  return (
    <ul
      aria-label="Ways to use Homa"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 0,
        margin: "16px 0 0",
        listStyle: "none",
      }}
    >
      {PLATFORM_ITEMS.map(({ kind, label }) => {
        const Icon = PLATFORM_ICONS[kind];
        return (
          <li
            key={kind}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              minHeight: 34,
              padding: "6px 11px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-pill)",
              background: "rgba(255,255,255,0.72)",
              color: "var(--stone-700)",
              fontSize: "0.82rem",
              fontWeight: 650,
            }}
          >
            <Icon size={15} color="var(--clay-600)" aria-hidden="true" />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
