import { z } from "zod";

import { MAP_ANSWERS } from "./bank";
import { isValidBirthMonth } from "./bands";

/**
 * Validated shapes for the map flow's API payloads, shared by the client
 * and the route handlers (same pattern as waitlist.ts). All writes go
 * through server routes; nothing here grants any client database access.
 */

export const MAP_KID_CAP = 5;
export const MAP_INTERESTS_CAP = 8;

export const mapStartSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  firstName: z.string().trim().max(100).optional(),
  usState: z.string().length(2).optional(),
  source: z.enum(["conference", "referral", "organic", "social", "other"]).default("organic"),
  utm: z.record(z.string(), z.string().max(200)).default({}),
});
export type MapStartInput = z.infer<typeof mapStartSchema>;

export const mapChildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  birthMonth: z.string().refine(isValidBirthMonth, "expected YYYY-MM within a plausible range"),
  interests: z.array(z.string().trim().min(1).max(40)).max(MAP_INTERESTS_CAP).default([]),
  helpWith: z.string().trim().max(120).optional(),
});
export type MapChildInput = z.infer<typeof mapChildSchema>;

export const mapAnswerSchema = z.object({
  childId: z.uuid(),
  itemId: z.string().min(1).max(120),
  answer: z.enum(MAP_ANSWERS),
});
export type MapAnswerPayload = z.infer<typeof mapAnswerSchema>;

export const mapScoreRequestSchema = z.object({
  childId: z.uuid(),
});

export const mapResumeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
