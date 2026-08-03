import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const motion = {
  sequence: ["peek", "orient", "draw", "land", "still"],
  durations: { fast: 120, base: 200, slow: 320 },
  totalMaximum: 900,
  easeOut: "cubic-bezier(0.22, 0.8, 0.28, 1)",
  easeInOut: "cubic-bezier(0.5, 0, 0.2, 1)",
  pressScale: 0.98,
  reducedMotionEndpoint: "final-still-immediately",
  loopPolicy: "truthful-live-state-only",
} as const;
export const MOTION_CONTRACT = { version: DESIGN_CONTRACT_VERSION, ...motion } as const;
