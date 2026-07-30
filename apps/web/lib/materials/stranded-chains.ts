/**
 * The stranded-chain follow-up (gh#197, FD-2(c), founder ruling
 * 2026-07-30).
 *
 * Measured 2026-07-30: 190 of 257 materials made for real families sit in
 * draft, 129 of them more than a week old, and TEN OF FIFTEEN families
 * who ever asked Homa to make something have not one finished thing in
 * their binder. The Chan family has nine drafts, zero finals, and nothing
 * since 2026-07-16. They asked for work, Homa made it, and it went quiet.
 *
 * The in-progress shelf (gh#377) gave that work a home, but a shelf only
 * helps a parent who opens the Binder. This is the one message that tells
 * her it is there.
 *
 * ON NOT NAGGING, which is the whole design constraint. The council's own
 * words (2026-07-24 takes): "a chatty 'want me to lock in last night's
 * version?' message reads as nagging, which your own skill forbids. What
 * I would accept: a one-tap 'Keep this one' on the card itself, and at
 * most one quiet email carrying the PDF link so the night's work is in my
 * inbox either way."
 *
 * So this is deliberately not a prompt, not a question, and not a chore
 * list:
 *
 *   - ONE FAMILY, ONE MESSAGE, EVER. Not one per draft. The Chan family
 *     would otherwise receive nine emails, which is the exact behavior
 *     the ruling exists to prevent.
 *   - It carries the newest thing she made and a link to the rest. It
 *     does not ask her to approve anything, because the shelf already
 *     lets her do that in one tap and offers are never commands.
 *   - It waits until the next morning, so a parent still mid-revision at
 *     11pm is never told about the thing she is actively working on.
 *   - A chain the quality check FAILED is never surfaced. Telling a
 *     parent about work Homa itself judged not good enough is worse than
 *     silence.
 */

export interface StrandedChainRow {
  familyId: string;
  email: string | null;
  firstName: string | null;
  materialId: string;
  title: string;
  /** ISO timestamp the material was created. */
  createdAtIso: string;
  /** null when the chain was never reviewed; false is an explicit fail. */
  reviewPass: boolean | null;
  /** True when anything in this family's library reached final. */
  familyHasFinal: boolean;
}

export interface StrandedSend {
  familyId: string;
  email: string;
  firstName: string | null;
  /** The newest stranded thing, the one the message names. */
  materialId: string;
  title: string;
  /** How many stranded chains this family has, so the copy can say so. */
  strandedCount: number;
  /** The ledger key. One per family, ever. */
  ledgerKind: "materials_stranded";
}

export const STRANDED_SKIP_REASONS = [
  "no_email",
  "too_recent",
  "review_failed",
  "family_already_told",
] as const;
export type StrandedSkipReason = (typeof STRANDED_SKIP_REASONS)[number];

export interface StrandedPlan {
  sends: StrandedSend[];
  skipped: Record<StrandedSkipReason, number>;
}

/**
 * How old a stranded chain must be before it is worth a message.
 *
 * Eighteen hours rather than twenty-four so an evening's work reaches
 * her the next morning rather than the morning after, which is the beat
 * the ruling describes. Anything younger is plausibly still in progress.
 */
export const STRANDED_MIN_AGE_HOURS = 18;

export const STRANDED_LEDGER_KIND = "materials_stranded" as const;

function hoursBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return -1;
  return (to - from) / 3_600_000;
}

/**
 * Pure: the caller supplies the stranded rows, the clock, and which
 * families have already been told. Nothing here reads a database or
 * sends anything, so the "one family, one message" rule is testable
 * without a mailbox.
 */
export function planStrandedFollowups(
  rows: readonly StrandedChainRow[],
  nowIso: string,
  alreadyTold: ReadonlySet<string>,
): StrandedPlan {
  const skipped = Object.fromEntries(
    STRANDED_SKIP_REASONS.map((reason) => [reason, 0]),
  ) as Record<StrandedSkipReason, number>;

  const byFamily = new Map<string, StrandedChainRow[]>();
  for (const row of rows) {
    // A failed quality check means Homa was not happy with it either.
    // Surfacing that is worse than saying nothing.
    if (row.reviewPass === false) {
      skipped.review_failed += 1;
      continue;
    }
    if (hoursBetween(row.createdAtIso, nowIso) < STRANDED_MIN_AGE_HOURS) {
      skipped.too_recent += 1;
      continue;
    }
    if (!row.email || row.email.trim().length === 0) {
      skipped.no_email += 1;
      continue;
    }
    const list = byFamily.get(row.familyId);
    if (list) list.push(row);
    else byFamily.set(row.familyId, [row]);
  }

  const sends: StrandedSend[] = [];
  for (const [familyId, familyRows] of byFamily) {
    if (alreadyTold.has(familyId)) {
      skipped.family_already_told += 1;
      continue;
    }
    // Newest first: the message names the most recent thing she made,
    // which is the one she is most likely to remember asking for.
    const ordered = [...familyRows].sort(
      (a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso),
    );
    const newest = ordered[0];
    sends.push({
      familyId,
      email: newest.email as string,
      firstName: newest.firstName,
      materialId: newest.materialId,
      title: newest.title,
      strandedCount: ordered.length,
      ledgerKind: STRANDED_LEDGER_KIND,
    });
  }

  return { sends, skipped };
}
