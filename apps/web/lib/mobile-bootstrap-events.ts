import {
  MOBILE_BOOTSTRAP_FAILURE_REASONS,
  MOBILE_BOOTSTRAP_STAGES,
} from "@homa/core";
import { z } from "zod";

export const mobileBootstrapEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("attempted"),
      stage: z.enum(MOBILE_BOOTSTRAP_STAGES),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["failed", "recovered"]),
      stage: z.enum(MOBILE_BOOTSTRAP_STAGES),
      reason: z.enum(MOBILE_BOOTSTRAP_FAILURE_REASONS),
    })
    .strict(),
]);
