import { z } from "zod";

/**
 * Waitlist domain types shared by the web form, the API route, and (later)
 * the invite service (MJ-09). Stored values are ASCII; display labels carry
 * typographic en dashes.
 */

export const KID_AGE_BANDS = [
  "under-2",
  "2-3",
  "4-5",
  "6-7",
  "8-10",
  "11-plus",
] as const;

export type KidAgeBand = (typeof KID_AGE_BANDS)[number];

export const KID_AGE_BAND_LABELS: Record<KidAgeBand, string> = {
  "under-2": "under 2",
  "2-3": "2–3",
  "4-5": "4–5",
  "6-7": "6–7",
  "8-10": "8–10",
  "11-plus": "11+",
};

/** Mirrors the check constraint on public.waitlist.source. */
export const WAITLIST_SOURCES = [
  "conference",
  "referral",
  "organic",
  "social",
  "other",
] as const;

export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

/**
 * Validated shape of one waitlist submission. Email is normalized here
 * (trim + lowercase) because the database enforces lowercase storage.
 */
/** UI chips 1–4 store their number; the "5+" chip stores 5. */
export const KID_COUNT_MAX = 5;

export const waitlistSubmissionSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  firstName: z.string().trim().max(100).optional(),
  usState: z.string().length(2).optional(),
  kidCount: z.number().int().min(1).max(KID_COUNT_MAX).optional(),
  kidAgeBands: z.array(z.enum(KID_AGE_BANDS)).max(KID_AGE_BANDS.length).default([]),
  source: z.enum(WAITLIST_SOURCES).default("organic"),
  utm: z.record(z.string(), z.string()).default({}),
});

export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>;
