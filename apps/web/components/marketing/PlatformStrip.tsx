import { Icon } from "../design/Icon";
import type { SemanticIconName } from "../design/Icon";
import { PLATFORM_ITEMS, type PlatformKind } from "./landing-content";

const PLATFORM_ICONS: Record<PlatformKind, SemanticIconName> = {
  message: "chat",
  web: "globe",
  phone: "mobile",
};

/**
 * Sticker tints per chip. Each ink is the darkest AA-passing step of its
 * family on that tint: text on gold tints is always --gold-ink (brand
 * rule), and sky-600 fails AA on sky-100 at this size, so the web chip
 * borrows the cobalt pop, which stays inside the same blue family.
 */
const PLATFORM_TINTS: Record<PlatformKind, { bg: string; ink: string; edge: string; tilt: string; drop: number }> = {
  // Tilts under ~1.5deg are imperceptible at chip size; these plus the
  // middle chip's baseline drop are what make the row read hand-placed.
  message: { bg: "var(--sage-50)", ink: "var(--sage-700)", edge: "var(--sage-200)", tilt: "rotate(-2.2deg)", drop: 0 },
  web: { bg: "var(--sky-100)", ink: "var(--pop-cobalt-deep)", edge: "var(--sky-300)", tilt: "rotate(1.8deg)", drop: 3 },
  phone: { bg: "var(--gold-100)", ink: "var(--gold-ink)", edge: "var(--gold-300)", tilt: "rotate(-1.6deg)", drop: 0 },
};

/**
 * Size and rhythm live in classes (per-chip tint stays inline) so media
 * queries can compact the row: at laptop and phone widths the chips slim
 * down enough that all three stay on one row down to about 600px, and
 * when the row finally must wrap the third sticker tucks up against the
 * first row like a stacked sticker instead of stranding as an orphan.
 */
const PLATFORM_CSS = `
.lp-platform-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  padding: 0;
  margin: 20px 0 0;
  list-style: none;
}
.lp-platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 0.82rem;
  font-weight: 700;
  box-shadow: 0 0 0 2.5px var(--surface-card), 0 2px 4px rgba(51, 42, 33, 0.08);
}
.lp-platform-chip svg { width: 15px; height: 15px; }
@media (max-width: 960px) {
  .lp-platform-strip { gap: 8px 9px; }
  .lp-platform-chip {
    gap: 6px;
    min-height: 30px;
    padding: 5px 11px;
    font-size: 0.78rem;
  }
  .lp-platform-chip svg { width: 13px; height: 13px; }
}
@media (max-width: 600px) {
  .lp-platform-chip:nth-child(3) { margin-top: -1px !important; }
}
/* Phone widths wrap the row 2+1. A deeper indent, a stronger re-tilt
   (standalone rotate composes with the inline transform tilt), and a
   tuck up into the row above (the negative margin lets the 2.5px white
   rims overlap, selling die-cut sticker stacking) make the second row
   read as deliberate placement, not overflow. margin-top needs
   !important to outrank the max-width 600px nth-child(3) rule. */
@media (max-width: 420px) {
  .lp-platform-chip:last-child {
    margin-left: 34px;
    margin-top: -3px !important;
    rotate: -2deg;
  }
}
`;

/**
 * States the three verified ways a parent can reach Homa without implying
 * public App Store availability. Styled as die-cut sticker pills (tint
 * fill, white rim, hand-placed tilt) so they read as printed matter, not
 * form controls.
 */
export function PlatformStrip() {
  return (
    <>
      <style>{PLATFORM_CSS}</style>
      <ul className="lp-platform-strip" aria-label="Ways to use Homa">
        {PLATFORM_ITEMS.map(({ kind, label }) => {
          const icon = PLATFORM_ICONS[kind];
          const tint = PLATFORM_TINTS[kind];
          return (
            <li
              key={kind}
              className="lp-platform-chip"
              style={{
                border: `1px solid ${tint.edge}`,
                background: tint.bg,
                color: tint.ink,
                transform: tint.tilt,
                marginTop: tint.drop,
              }}
            >
              <Icon name={icon} size={16} />
              {label}
            </li>
          );
        })}
      </ul>
    </>
  );
}
