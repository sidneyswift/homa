import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const logoGeometry = {
  source: "packages/design/src/contract/brand.ts",
  mark: "master-homa-house",
  housePath: "M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z",
  eyes: [
    { cx: 17.4, cy: 26, r: 4.8, pupilCx: 18.3, pupilCy: 26.7, pupilR: 2.2 },
    { cx: 30.6, cy: 26, r: 4.8, pupilCx: 31.5, pupilCy: 26.7, pupilR: 2.2 },
  ] as const,
  pupilFill: "#20242B",
  clearSpace: 16,
  minimumMarkPx: 20,
  minimumLockupPx: 88,
  variants: ["light", "dark", "mono", "tiny", "print"] as const,
} as const;

export const roofThread = {
  source: "master-roof-derived-path",
  viewBox: "0 0 320 48",
  path: "M3 30 C34 5 55 44 84 19 S137 6 159 28 S212 43 235 20 S278 3 317 23",
  productStrokePx: 2,
  brandStrokePx: 3,
  maximumTurns: 2,
  caps: "round",
  allowedEndpoints: ["real-learning-object", "useful-next-move"] as const,
  prohibitedCollisions: ["face", "text", "control"] as const,
} as const;

export const characterStates = ["peek", "orient", "working", "needs-you", "ready", "interrupted", "offline", "error", "still"] as const;
export const imageryDirection = {
  subject: "real-family-artifact-first",
  light: "natural-window-light",
  camera: "family-height",
  privacy: "no-identifying-family-data",
  crop: "preserve-object-and-next-move-safe-zone",
  prohibited: ["staged-stock-as-universal-proof", "character-over-object", "decorative-thread-without-meaning"] as const,
} as const;
export const BRAND_CONTRACT = { version: DESIGN_CONTRACT_VERSION, logoGeometry, roofThread, characterStates, imageryDirection } as const;
