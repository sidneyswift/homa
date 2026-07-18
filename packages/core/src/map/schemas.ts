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
 * S1, the true entry screen (founder call 2026-07-08, overturning
 * 2026-07-06's "password is the last question" ruling): email and
 * password, right up front, or Google as a one-tap alternative. This is
 * the moment the anonymous lead becomes a real Supabase Auth account (see
 * attachAuthUser); there is no later, lower-friction account step
 * anymore. Google sign-up skips this entirely (the OAuth callback
 * supplies a real, verified email and profile name). Her name is NOT
 * asked here (founder follow-up, same day): the create-your-family step
 * right after this collects it, and asking twice reads as a bug.
 */
export const mapClaimSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(200),
  usState: z.string().length(2).optional(),
});
export type MapClaimInput = z.infer<typeof mapClaimSchema>;

export const mapChildSchema = z.object({
  name: z.string().trim().min(1).max(80),
  birthDate: z.string().refine(isValidBirthDate, "expected YYYY-MM-DD, a real calendar date"),
  interests: z.array(z.string().trim().min(1).max(40)).max(MAP_INTERESTS_CAP).default([]),
  helpWith: z.string().trim().max(120).optional(),
});
export type MapChildInput = z.infer<typeof mapChildSchema>;

/**
 * The create-your-family step, right after S1's account moment (founder
 * call 2026-07-08: one onboarding for every door, signup popup included).
 * Family name and the parent's name are required; address and phone are
 * asked on the card but tolerated as optional here so a half-filled save
 * can never strand her; the avatar is optional everywhere. The server
 * re-checks that avatarUrl points at OUR storage bucket before storing.
 */
export const mapFamilySetupSchema = z.object({
  familyName: z.string().trim().min(1).max(80),
  parentName: z.string().trim().min(1).max(100),
  addressLine: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  usState: z.string().length(2).optional(),
  zip: z.string().trim().max(12).optional(),
  phone: z.string().trim().max(24).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
});
export type MapFamilySetupInput = z.infer<typeof mapFamilySetupSchema>;

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
  interests: z.array(z.string().trim().min(1).max(40)).max(MAP_INTERESTS_CAP).optional(),
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
  /** Homeschool styles followed, plural since 2026-07-06 (founder:
   * parents must be able to pick more than one, eclectic homes mix).
   * First one listed is the primary; context bags written before this
   * date hold a single `style` string instead, and readers fall back
   * to it. */
  styles: z.array(z.enum(HOMESCHOOL_STYLES)).max(HOMESCHOOL_STYLES.length).optional(),
  /** How closely the styles are followed. */
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

export const mapSubjectLessonBuildSchema = z
  .object({
    childId: z.uuid(),
    subjectId: z.string().min(1).max(40),
  })
  .strict();

export const mapSubjectLessonMutationSchema = z
  .object({
    lessonId: z.uuid(),
  })
  .strict();

/**
 * The living-record write: one or more answer changes from the report
 * page (a tapped correction in a receipts drawer, the inline sharpening
 * question, a staleness re-check), batched so one save means one rescore
 * and one rewrite. The lead comes from the cookie, never here.
 */
export const mapReportCorrectionSchema = z.object({
  childId: z.uuid(),
  source: z.enum(["report_correction", "report_probe", "recheck"]).default("report_correction"),
  changes: z
    .array(
      z.object({
        itemId: z.string().min(1).max(120),
        answer: z.enum(MAP_ANSWERS),
      }),
    )
    .min(1)
    .max(24),
});
export type MapReportCorrection = z.infer<typeof mapReportCorrectionSchema>;

/** Full-map sync of the four-week plan's check-offs (idempotent: the
 * client sends the whole checks map, keyed "week.activityIndex"). */
const PLAN_CHECK_KEY_RE = /^[1-4]\.[0-5]$/;

const mapPlanChecksSchema = z.record(z.string(), z.boolean()).transform((checks) =>
  Object.fromEntries(
    Object.entries(checks).filter(([key]) => PLAN_CHECK_KEY_RE.test(key)),
  ) as Record<string, boolean>,
);

export const mapPlanProgressSchema = z.object({
  childId: z.uuid(),
  subjectId: z.string().min(1).max(40),
  checks: mapPlanChecksSchema,
});
export type MapPlanProgress = z.infer<typeof mapPlanProgressSchema>;

/** The report's one-tap month: consent IS the explicit ask the email
 * doctrine requires before a retest email may ever be armed. */
export const mapPlanConsentSchema = z.object({
  childId: z.uuid(),
  subjectId: z.string().min(1).max(40),
});
export type MapPlanConsent = z.infer<typeof mapPlanConsentSchema>;

/** Body of DELETE /api/map/children. The lead comes from the cookie, never here. */
export const mapChildRemoveSchema = z.object({
  childId: z.uuid(),
});

export const mapResumeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
