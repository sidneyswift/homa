/**
 * The trial reminder (founder directive 2026-07-27, the 7-day trial).
 *
 * TRIAL_GATE_TIMELINE promises "Day 4: We email you a reminder, three
 * days before the first charge." Stripe's dashboard-configured trial
 * reminder fires 7 days before trial end, which for a 7-day trial lands
 * on the moment of signup, so that toggle cannot keep this promise. The
 * promise is kept here instead, driven by
 * customer.subscription.trial_will_end, which fires 3 days before trial
 * end at any trial length.
 *
 * Everything in this module is pure. The webhook route owns the I/O.
 * Two things live here because they must be exact and testable rather
 * than plausible: whether a reminder is honest to send at all, and the
 * words for a date and an amount. A reminder that names the wrong day
 * or the wrong number is worse than no reminder, so both are read from
 * the subscription Stripe just sent us, never from a local price table
 * that can drift.
 *
 * This module is the one home for this email's copy; wall-copy.ts owns
 * the gate surfaces and points here for the Day 4 beat.
 */

/** The fields the reminder needs from the Stripe subscription in the
 *  event payload. Flattened at the route boundary so this stays pure and
 *  free of the Stripe SDK types. */
export interface TrialReminderSubscription {
  status: string;
  /** True when the family already chose to end it. Stripe still fires
   *  trial_will_end, but no charge is coming, so promising one would be
   *  a lie. */
  cancelAtPeriodEnd: boolean;
  trialEndSec: number | null;
  amountCents: number | null;
  currency: string | null;
  /** "month" or "year" from the price's recurring interval. */
  interval: string | null;
}

export interface TrialReminderFamily {
  id: string;
  email: string | null;
  firstName: string | null;
  /** Display name for the plan, resolved by the caller from TIER_NAMES. */
  planName: string | null;
  timeZone: string | null;
  billingExempt: boolean;
}

/** Why a reminder was not sent. Every one of these is a normal outcome,
 *  not an error: the route logs the reason and acknowledges the event. */
export type TrialReminderSkip =
  | "no-family"
  | "no-email"
  | "not-trialing"
  | "canceling"
  | "billing-exempt"
  | "already-sent";

export type TrialReminderVerdict =
  | { send: true; to: string }
  | { send: false; reason: TrialReminderSkip };

/**
 * trialReminderVerdict: the one question, with no I/O.
 *
 * Ordered cheapest and most structural first, so the logged reason names
 * the real cause rather than whichever check happened to run. The
 * billing_exempt case matters: a comped family has a Stripe trial that
 * will never charge her, and telling her a charge is coming would be
 * false.
 */
export function trialReminderVerdict(
  family: TrialReminderFamily | null,
  subscription: TrialReminderSubscription,
  alreadySent: boolean,
): TrialReminderVerdict {
  if (!family) return { send: false, reason: "no-family" };
  const to = family.email?.trim();
  if (!to) return { send: false, reason: "no-email" };
  if (subscription.status !== "trialing") return { send: false, reason: "not-trialing" };
  if (subscription.cancelAtPeriodEnd) return { send: false, reason: "canceling" };
  if (family.billingExempt) return { send: false, reason: "billing-exempt" };
  if (alreadySent) return { send: false, reason: "already-sent" };
  return { send: true, to };
}

/**
 * formatTrialEndDate: "August 3", in the family's own time zone.
 *
 * A charge date one day off is the whole value of the email lost, and
 * trial_end is an instant, so the zone is load-bearing. An unset or
 * unrecognized zone falls back to UTC rather than throwing: a reminder
 * with a date computed one zone away still beats no reminder.
 */
export function formatTrialEndDate(
  trialEndSec: number | null,
  timeZone: string | null,
): string | null {
  if (trialEndSec === null || !Number.isFinite(trialEndSec)) return null;
  const date = new Date(trialEndSec * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: timeZone?.trim() || "UTC",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  }
}

/**
 * formatTrialCharge: "$19 a month", "$182 a year".
 *
 * Read from the price Stripe just sent, never from TIER_PRICES: the
 * email states what will actually be charged even if the local table
 * drifts from the dashboard. Whole amounts drop the cents, because
 * "$19.00 a month" reads like a form and "$19 a month" reads like a
 * person. Returns null when anything is missing, and the copy then omits
 * the amount rather than guessing it.
 */
export function formatTrialCharge(
  amountCents: number | null,
  currency: string | null,
  interval: string | null,
): string | null {
  if (amountCents === null || !Number.isFinite(amountCents) || amountCents < 0) return null;
  const code = (currency ?? "usd").trim().toLowerCase();
  const period = interval === "year" ? "a year" : interval === "month" ? "a month" : null;
  if (!period) return null;
  const whole = amountCents % 100 === 0;
  let amount: string;
  try {
    amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amountCents / 100);
  } catch {
    return null;
  }
  return `${amount} ${period}`;
}

export interface TrialReminderContent {
  subject: string;
  preview: string;
  heading: string;
  bodyLines: string[];
  cta: { label: string; url: string };
  footerNote: string;
}

/**
 * trialReminderContent: the email itself.
 *
 * Copy laws (.agents/skills/homa-copy-writer): reassure before inform,
 * so the first thing she reads is that nothing has been charged. Offers
 * never commands, so cancelling is named as a door she may use, not an
 * instruction. One idea per sentence. No comparison, no urgency, no
 * count-down framing: this is a receipt of a promise we made at the
 * gate, not a sales push.
 *
 * Every fact is conditional on being known. A missing amount or date
 * drops that sentence instead of shipping a placeholder, because the
 * only thing worse than a vague reminder is a confident wrong one.
 *
 * Both copy gates ran 2026-07-27 (reader, then editor). Three calls the
 * reader gate made, each kept here because the reason outlives the
 * session:
 *
 * - The CTA names cancelling. "Manage your plan" was the exact line the
 *   reader put the phone down on: the paragraph above it says she can
 *   cancel and then the button would not say the word, which reads as
 *   the cancel link being buried. The portal really does cancel, change
 *   a card, and show invoices (app/api/billing/portal/route.ts), so the
 *   label promises nothing the tap does not do.
 * - The saved-work line claims preservation, never continued access.
 *   "Stays in your account either way" invited the reading "so I can
 *   still open it", which accountAccessDecision (lib/billing/wall.ts)
 *   does not grant: a canceled family is walled at the account gate and
 *   meets TRIAL_GATE_LAPSED_REASSURANCE, whose words this line matches
 *   on purpose. Overpromising access in the one legally required
 *   billing notice is the worst place in the product to do it.
 * - The heading carries a fact instead of an echo. "Your free days end
 *   soon" was vaguer than the subject line that delivered her here, so
 *   the first thing inside the email told her less than the thing that
 *   got her to open it, and "ending" got said three times before any
 *   new information arrived.
 *
 * Known gap, deliberately not papered over: the reader wanted one
 * concrete thing from her own four days as evidence for the $19, and
 * this function has no family data to give her one. An invented detail
 * would break the no-invented-numbers law, so the email stays honest
 * and thin rather than warm and made up.
 *
 * Then the editor gate, whose calls are also load-bearing:
 *
 * - The charge is stated in the affirmative. "Your plan starts" is a
 *   euphemism for money leaving a card, and "charged" appeared in the
 *   whole email exactly once, in the negative. A required disclosure
 *   names the transaction plainly, so the heading and the body both do.
 * - Nothing points at a moment by pronoun. "Cancel before then" made
 *   the one deadline she would act on depend on a three-sentence
 *   referent chain, and in the undated variant "starts then" and
 *   "before then" landed back to back pointing at a moment nothing had
 *   named. "Before your first charge" is self-contained in every
 *   variant.
 * - One name for one thing: these are "your 7 free days" here exactly
 *   as they are at the gate (the wall-copy.ts vocabulary law), never
 *   "your trial" in one line and "your free days" in the next.
 * - A missing first name drops the greeting instead of rendering a bare
 *   "Hi, ", which reads as an unfilled merge field in the one email
 *   where looking automated is most expensive.
 */
/**
 * The line under the card, which every other email lets default.
 *
 * The shared default in lib/map/email.ts ends "Every kind of email has an
 * off switch." That is true of the drip and false here: this notice
 * deliberately ships without unsubscribe headers, because it is the
 * warning before a charge she agreed to, and an off switch on it would
 * be an off switch on being told about her own money. The default also
 * says "never promotions", which is a strange thing to tell someone in
 * an email about a payment. Overriding it is the same move
 * sendFamilyInviteEmail makes for the same reason: the default describes
 * a relationship this particular email is not in.
 */
export const TRIAL_REMINDER_OUTER_NOTE =
  "You are getting this because you started 7 free days with Homa at thankshoma.com. It tells you about your own billing, so it has no off switch. Reply to this email and Homa answers.";

export function trialReminderContent(input: {
  firstName: string | null;
  planName: string | null;
  endDate: string | null;
  charge: string | null;
  manageUrl: string;
}): TrialReminderContent {
  const { firstName, planName, endDate, charge, manageUrl } = input;
  const plan = planName ?? "Homa";

  // "that day" only once a real date has been named; "then" still points
  // at the end of the free days when it has not.
  const when = endDate ? "that day" : "then";

  // No name means no greeting at all: "Hi, nothing has been charged yet"
  // reads as a merge field that failed to fill.
  const opener = firstName ? `Hi ${firstName}, nothing` : "Nothing";
  const bodyLines: string[] = [
    endDate
      ? `${opener} has been charged yet. Your 7 free days end on ${endDate}.`
      : `${opener} has been charged yet. Your 7 free days end in three days.`,
  ];
  bodyLines.push(
    charge
      ? `Your ${plan} plan starts ${when}. We will charge your card ${charge}.`
      : `Your ${plan} plan starts ${when}. We will charge your card, and your billing page shows the amount.`,
  );
  // The door out, then what it costs her, in that order: the old copy put
  // preservation first and had to carry it with a vague "either way".
  // "Before your first charge" names the deadline without pointing back
  // at a date three sentences up, and reads the same in every variant.
  bodyLines.push(
    "If Homa is not the right fit for your family, you can cancel before your first charge and pay nothing.",
  );
  bodyLines.push("Everything you and Homa have made is saved to your account.");

  return {
    subject: endDate
      ? `Your free days with Homa end ${endDate}`
      : "Your free days with Homa end in three days",
    preview: "Nothing has been charged yet.",
    heading: endDate ? `Your first charge is on ${endDate}` : "Your first charge is in three days",
    bodyLines,
    cta: { label: "Cancel or update your card", url: manageUrl },
    footerNote:
      "You started your 7 free days with Homa. This is the only reminder we send about them.",
  };
}
