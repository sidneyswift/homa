import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const spacing = { base: 4, scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] } as const;
export const radii = { control: 12, card: 18, frame: 28, compactPill: 999 } as const;
export const elevation = {
  rest: "none",
  raised: "0 8px 24px rgba(32, 36, 43, 0.08)",
  overlay: "0 20px 48px rgba(32, 36, 43, 0.14)",
} as const;
export const containers = { prose: 720, workspace: 1280, phoneGutter: 20, desktopGutter: 32 } as const;
export const LAYOUT_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  spacing,
  radii,
  elevation,
  containers,
  maximumElevationLevels: 2,
  nestedBorderedCardDefault: false,
  pillPolicy: { default: false, usage: "compact-selections-only" },
} as const;
