import { z } from "zod";

import { MAP_ANSWERS } from "./bank";
import { isValidBirthDate } from "./bands";

/**
 * Validated shapes for the map flow's API payloads, shared by the client
 * and the route handlers (same pattern as waitlist.ts). All writes go
 * through server routes; nothing here grants any client database access.
 */

export const MAP_KID_CAP = 5;
export const MAP_INTERESTS_CAP = 8;

/**
 * S1: opens an anonymous session, no email. Kids and the checklist
 * auto-save under this cookie-only lead; email is captured once, at
 * signup, right before the report is scored (see mapClaimSchema).
 */
export const mapStartSchema = z.object({
  source: z.enum(["conference", "referral", "organic", "social", "other"]).default("organic"),
  utm: z.record(z.string(), z.string().max(200)).default({}),
});
export type MapStartInput = z.infer<typeof mapStartSchema>;

/**
 * The very first question (founder call 2026-07-06, revised same day):
 * email, right at S1, before anything about the kids. Not yet a full
 * account, just the address the report goes to; see mapSignupSchema for
 * the moment it becomes one. Google sign-up skips this entirely (the
 * OAuth callback supplies a real, verified email).
 */
export const mapClaimSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  firstName: z.string().trim().max(100).optional(),
  usState: z.string().length(2).optional(),
});
export type MapClaimInput = z.infer<typeof mapClaimSchema>;

/**
 * The last question, right before the report (founder call 2026-07-06,
 * second revision: "have them create a password as the LAST question
 * before they get results"). Turns the anonymous, email-only lead into a
 * real Supabase Auth account. Google sign-ups never see this: they
 * already have an account the moment they return from the OAuth
 * redirect. One simple name field in the UI, split into first/last on
 * the first space, same as the old name step.
 */
export const mapSignupSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  password: z.string().min(8).max(200),
});
export type MapSignupInput = z.infer<typeof mapSignupSchema>;

export const mapChildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  birthDate: z.string().refine(isValidBirthDate, "expected YYYY-MM-DD, a real calendar date"),
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
  /** Per-subject "what we're doing that works" (the ahead follow-up). */
  whatsWorking: z.record(z.string().max(40), z.string().trim().min(1).max(500)).optional(),
  /** Activities and clubs outside school: gymnastics, Spanish class... */
  activities: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  /** Catch-all: health, temperament, anything she wants Homa to know. */
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
  /** The crew that can appear in personalized materials later: family
   * members, pets, stuffed animals, the neighbor kid. Names only, no
   * photos (the D4 consent floor gates photo upload until DPAs exist). */
  crew: z.array(z.string().trim().min(1).max(60)).max(16).optional(),
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

/** Body of DELETE /api/map/children. The lead comes from the cookie, never here. */
export const mapChildRemoveSchema = z.object({
  childId: z.uuid(),
});

export const mapResumeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
