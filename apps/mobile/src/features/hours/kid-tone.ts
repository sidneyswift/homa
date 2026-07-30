import { palette } from "../../theme/tokens";

/**
 * Ported from apps/web/components/dashboard/kid-avatar.tsx's
 * AVATAR_TONES/avatarTone: a kid's color is keyed by position in the
 * family roster, so it stays stable everywhere that kid appears.
 * Duplicated from features/planner/kid-tone.ts rather than imported:
 * the two features ship as separate PRs and this app has no shared
 * package yet (packages/design, per AGENTS.md, is still pending), so
 * this hand-copy follows the same rule the design tokens already do.
 */
const KID_TONES: readonly (readonly [background: string, text: string])[] = [
  [palette.clay100, palette.clay700],
  [palette.sky100, palette.sky600],
  [palette.sage100, palette.sage700],
  [palette.gold100, palette.goldInk],
];

export function kidTone(index: number): readonly [background: string, text: string] {
  return KID_TONES[index % KID_TONES.length];
}
