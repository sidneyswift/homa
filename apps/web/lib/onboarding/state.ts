/**
 * Chat-first onboarding, the family-state layer
 * (plans/2026-07-21-chat-first-onboarding.md §2.2).
 *
 * Onboarding is a state of the FAMILY, not of a page. The parent gives
 * it five minutes, closes the phone, comes back that evening on a
 * laptop, and finishes on Thursday. A page-scoped flow cannot survive
 * that; a row can. So every surface that needs to know "is she still
 * onboarding" (the eve auth walk, the billing wall, the instruction
 * router, the re-entry greeting) asks the same question of the same
 * database truth, and the client is never consulted.
 *
 * Two facts decide it:
 *   families.context.onboarding   the durable stage record, written here
 *   families.profile_completed_at the pre-chat flow's completion stamp
 *
 * The record wins when it exists. The stamp is the fallback for every
 * family that predates this flow. The order matters: reading it the
 * other way round (or reading `state != 'done'` on an absent record)
 * marks all 46 completed families onboarding-active forever, which
 * would quietly take the live $19 door wall down fleet-wide.
 *
 * Derivable stages are NOT stored. Whether kids exist, how many answers
 * a child has, whether a report row was written: those are computed
 * from their own tables, because a copy of them here would go stale and
 * then lie. Only the non-derivable facts live in the record: which
 * beats have fired, which child's checklist reached which status, and
 * whether the paywall has been shown.
 */

/** The record's own state. Anything unrecognized reads as active, so a
 *  future value can never accidentally end a family's onboarding. */
export type OnboardingState = "active" | "done";

export interface OnboardingRecord {
  state: OnboardingState;
  /** Beat ids already delivered (tutorial units, aha moments). Append-only. */
  beatsDone: string[];
  /** childId -> checklist status, e.g. "started", "done". */
  checklist: Record<string, string>;
  /** ISO timestamp of the last write, or null on a record that predates it. */
  updatedAt: string | null;
  /** ISO timestamp the credit lockout was first shown, or null. */
  paywallShownAt: string | null;
}

export const EMPTY_ONBOARDING_RECORD: OnboardingRecord = {
  state: "active",
  beatsDone: [],
  checklist: {},
  updatedAt: null,
  paywallShownAt: null,
};

/**
 * chatOnboardingEnabled(): the rollout flag. Off means the old card
 * flow runs untouched and nothing in this module changes any behavior,
 * including the wall bypass below.
 *
 * Found empty in prod on 2026-07-25 despite being flipped on 2026-07-24;
 * a plain `vercel redeploy` reuses the env snapshot frozen at the
 * original build rather than the current value, so restoring the var
 * alone did not take effect. A second gotcha compounded it: `vercel env
 * add` piped non-interactively defaults to the "Sensitive" type, and
 * Sensitive vars are excluded from the Next.js build step entirely
 * (Vercel only exposes them at runtime), so the flag read empty even
 * in a genuinely fresh build. Use `--no-sensitive` when setting this
 * var from the CLI.
 */
export function chatOnboardingEnabled(): boolean {
  const value = (process.env.HOMA_CHAT_ONBOARDING ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function asIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * readOnboardingRecord(context): the onboarding record inside a
 * families.context blob, or null when the family has never entered the
 * chat flow. Null and "a record saying active" are different facts and
 * the caller needs both, so this does not default.
 */
export function readOnboardingRecord(context: unknown): OnboardingRecord | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const raw = (context as Record<string, unknown>).onboarding;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    state: record.state === "done" ? "done" : "active",
    beatsDone: asStringArray(record.beatsDone),
    checklist: asStringRecord(record.checklist),
    updatedAt: asIsoOrNull(record.updatedAt),
    paywallShownAt: asIsoOrNull(record.paywallShownAt),
  };
}

export interface OnboardingFamilyRow {
  /** families.profile_completed_at, null while the pre-chat flow is unfinished. */
  profileCompletedAt: string | Date | null;
  /** families.context, the whole jsonb blob. */
  context: unknown;
}

/**
 * onboardingActiveForRow(row): the predicate itself, with no flag and
 * no I/O, so it can be tested and reasoned about on its own.
 */
export function onboardingActiveForRow(row: OnboardingFamilyRow): boolean {
  const record = readOnboardingRecord(row.context);
  if (record) return record.state !== "done";
  return row.profileCompletedAt === null;
}

/**
 * familyOnboardingActive(row): the question every surface asks. Flag
 * off returns false before anything else runs, so prod behavior is
 * byte-identical until the founder flips HOMA_CHAT_ONBOARDING.
 */
export function familyOnboardingActive(row: OnboardingFamilyRow): boolean {
  if (!chatOnboardingEnabled()) return false;
  return onboardingActiveForRow(row);
}

/**
 * onboardingRowFromMembership(membership): the two columns this module
 * needs, read out of a PostgREST embed
 * (`family_members.select("..., families(profile_completed_at, context)")`).
 *
 * PostgREST returns a to-one embed as an object, but the same query
 * shape returns an array when the relationship is inferred the other
 * way, and supabase-js types it loosely enough that a shape change
 * would compile fine and silently start reporting every family as
 * onboarding-active. Both shapes are handled, and anything unreadable
 * degrades to "profile complete", which is the safe direction: it keeps
 * the wall up rather than opening it on a parse mistake.
 */
export function onboardingRowFromMembership(membership: unknown): OnboardingFamilyRow {
  const fallback: OnboardingFamilyRow = {
    profileCompletedAt: new Date(0).toISOString(),
    context: null,
  };
  if (!membership || typeof membership !== "object") return fallback;
  const embedded = (membership as Record<string, unknown>).families;
  const family = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!family || typeof family !== "object") return fallback;
  const row = family as Record<string, unknown>;
  const completed = row.profile_completed_at;
  return {
    profileCompletedAt:
      typeof completed === "string" || completed instanceof Date ? completed : null,
    context: row.context ?? null,
  };
}

/**
 * appWouldAdmit(family): would /app let this family in?
 *
 * /app's own gate (lib/app-data.ts getAppData) needs a finished profile
 * AND at least one child, and redirects to /onboarding when either is
 * missing. Anything that hands a family off to /app has to ask the same
 * question or it builds a loop: /onboarding sent every profile-complete
 * family to /app, /app sent the childless ones straight back, and the
 * product was unreachable for anyone who made an account and stopped
 * before adding a child. Which is not an exotic state; it is the most
 * common place to drop out of setup.
 *
 * Kept here, named, and tested, because the bug was two pages
 * disagreeing about who counts as done. One predicate cannot disagree
 * with itself.
 */
export function appWouldAdmit(family: {
  profileCompletedAt: string | Date | null;
  childCount: number;
}): boolean {
  return family.profileCompletedAt !== null && family.childCount > 0;
}

/**
 * The far edge of the free period. A family that entered the chat flow
 * this long ago is done whether or not she ever performed the keystone,
 * because the alternative is the state this constant exists to end.
 *
 * Cause (2026-07-27): completeOnboarding() shipped with no callers, so
 * nothing ever wrote state "done". The record outranks
 * profile_completed_at, so 23 families latched onboarding-active
 * permanently: create_printable and generate_image structurally absent
 * from their web chat every turn, and the $19 door wall bypassed for
 * good. A completion rule that only a happy path can satisfy always has
 * a way to get stuck, so this backstop is not a nicety, it is the part
 * that makes the bug unrepeatable.
 */
export const ONBOARDING_BACKSTOP_DAYS = 14;

export interface OnboardingCompletionFacts {
  /** families.profile_completed_at, null while setup is unfinished. */
  profileCompletedAt: string | Date | null;
  /** How many children the family has. */
  childCount: number;
  /** How many of them have a scored row in child_reports. The keystone:
   *  the plan's §3.3 refuses to call a family complete with the
   *  observable behavior never performed once. */
  scoredReportCount: number;
  /** The onboarding record's updatedAt, null on a record predating it. */
  recordUpdatedAt: string | null;
  /** Injected so the predicate stays pure and the backstop is testable. */
  now: Date;
}

/**
 * onboardingCompletionCause(facts): has this family finished the
 * onboarding arc, and by which door?
 *
 * The counterweight to onboardingActiveForRow. A non-null answer ends
 * the free period: the door wall applies again, onboarding-mode stops
 * loading, and the in-turn generation tools come back. Null keeps her
 * inside it. Both directions cost real money in opposite ways, which is
 * why this is one named predicate with tests rather than a condition
 * inlined at a call site.
 *
 * The cause is the narration the transition event carries (2026-08-30
 * spec, Outcome 5). When both doors are open at once (a scored report
 * exists AND the record sat untouched past the backstop), the keystone
 * wins the telling: she really did finish the arc, and "backstop" must
 * stay reserved for the family the arc never reached, because that is
 * the population the funnel needs to see.
 *
 * Only ever consulted for a family whose record says "active"; a done
 * family is never reopened.
 */
export function onboardingCompletionCause(
  facts: OnboardingCompletionFacts,
): "keystone" | "backstop" | null {
  // Founder ruling 2026-07-31, onboarding-completion-milestones: the
  // first scored report is the end of onboarding once family setup and
  // at least one child are real. These are durable product facts, unlike
  // checklist status strings, and they match the moment the parent has
  // received the core promise she came through onboarding to reach.
  if (
    facts.profileCompletedAt !== null &&
    facts.childCount > 0 &&
    facts.scoredReportCount > 0
  ) {
    return "keystone";
  }

  // The backstop. See ONBOARDING_BACKSTOP_DAYS. Its clock anchors to the
  // record's last write, which the mobile bootstrap refreshes on every
  // open of an unfinished walk, so this means 14 days of silence, not
  // 14 days since onboarding began.
  if (facts.recordUpdatedAt !== null) {
    const ageMs = facts.now.getTime() - new Date(facts.recordUpdatedAt).getTime();
    if (ageMs >= ONBOARDING_BACKSTOP_DAYS * 24 * 60 * 60 * 1000) return "backstop";
  }

  return null;
}

/** The boolean shape of onboardingCompletionCause, kept for callers that
 *  only need the answer and not the telling. */
export function onboardingCompletionReached(
  facts: OnboardingCompletionFacts,
): boolean {
  return onboardingCompletionCause(facts) !== null;
}
