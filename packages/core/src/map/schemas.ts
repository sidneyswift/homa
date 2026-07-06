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

/**
 * The optional extras collected after the checklist, before the report
 * (founder + Alessa session: context questions come once she's invested,
 * never up front). Everything optional, everything capped.
 */
export const HOMESCHOOL_STYLES = [
  "montessori",
  "charlotte_mason",
  "classical",
  "reggio",
  "waldorf",
  "unit_studies",
  "unschooling",
  "eclectic",
  "traditional",
] as const;

export const mapChildExtrasSchema = z.object({
  childId: z.uuid(),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  helpWith: z.array(z.string().trim().min(1).max(60)).max(6).optional(),
  /** For ahead subjects: what the family is doing that works. Pure gold. */
  whatsWorking: z.string().trim().max(500).optional(),
  /** Catch-all: activities, health, anything she wants Homa to know. */
  notes: z.string().trim().max(1000).optional(),
});
export type MapChildExtras = z.infer<typeof mapChildExtrasSchema>;

export const mapFamilyExtrasSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  usState: z.string().length(2).optional(),
  style: z.enum(HOMESCHOOL_STYLES).optional(),
  /** How closely the style is followed. */
  strictness: z.enum(["closely", "loosely", "exploring"]).optional(),
  curriculums: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  /** Values, faith, aesthetic, anything that should shape materials. */
  values: z.string().trim().max(500).optional(),
});
export type MapFamilyExtras = z.infer<typeof mapFamilyExtrasSchema>;

export const mapExtrasSchema = z.object({
  child: mapChildExtrasSchema.optional(),
  family: mapFamilyExtrasSchema.optional(),
});

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
