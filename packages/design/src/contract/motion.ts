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
  semanticRoles: {
    press: { duration: 120, properties: ["scale"], endpoint: "accepted-direct-manipulation" },
    select: { duration: { minimum: 120, maximum: 200 }, properties: ["color", "border", "opacity"], endpoint: "selected-context-linked" },
    reveal: { duration: 200, travelPx: { minimum: 4, maximum: 8 }, properties: ["transform", "opacity"], endpoint: "content-relevant" },
    context: { duration: { minimum: 200, maximum: 320 }, origin: "physical-origin", endpoint: "context-open-or-closed" },
    objectContinuity: { durationMaximum: 320, properties: ["transform", "opacity"], endpoint: "same-object-new-state" },
    completion: { durationMaximum: 320, repetitions: 1, prerequisite: "server-or-device-truth", endpoint: "confirmed-completion" },
  },
  interruption: {
    cancellation: "resolve-immediately-to-newest-true-state",
    expiry: "required-for-every-live-motion",
    truthSourceLoss: "stop-and-resolve-to-current-state",
    criticalExitMayDelay: false,
    voiceHandoffMayDelay: false,
  },
} as const;
export const MOTION_CONTRACT = { version: DESIGN_CONTRACT_VERSION, ...motion } as const;
