/**
 * The verify half of the deadline-anchor derivation (gh#342): pure
 * deterministic checks a model's proposal must survive before a calendar
 * date is allowed anywhere near a family's compliance document.
 *
 * Split from the build script on purpose. The script needs a model and a
 * network; these rules need neither, so CI can re-verify every shipped
 * anchor against the reviewed snapshots on every push
 * (pnpm check:deadline-anchors), and the unit tests can prove the
 * rejection paths without a gateway token. That separation is what makes
 * "code verifies" a real guarantee rather than a claim about a script
 * that ran once on somebody's laptop.
 *
 * The law being enforced (models-judge-code-verifies): a model proposes
 * and never has authority. Provenance is verified, not phrasing: every
 * anchor carries a quote that must appear VERBATIM in the state's own
 * deadline string, so an anchor can only ever restate text that already
 * passed the snapshot pipeline's human review. A failed check drops the
 * whole state rather than softening it, because a state with no anchors
 * renders its verbatim deadline exactly as it did before this existed,
 * which is correct and honest. A wrong date is not.
 */

export const ANCHOR_KINDS = [
  "fixed",
  "window",
  "relative",
  "conditional",
  "none",
] as const;
export type DeadlineAnchorKind = (typeof ANCHOR_KINDS)[number];

export interface DeadlineAnchor {
  /** Calendar month 1-12, or null when the text names no month. */
  month: number | null;
  /** Day of month, or null when the text names no day. */
  day: number | null;
  /** Days counted from an event, for a relative anchor only. */
  withinDays: number | null;
  /** Plain sentence-case phrase a parent reads at a glance. */
  label: string;
  /** Verbatim substring of the source deadline text. */
  quote: string;
}

export interface DeadlineAnchorEntry {
  stateCode: string;
  kind: DeadlineAnchorKind;
  /** The full source string these anchors were derived from, kept so a
   * reviewer (and the check script) can re-verify without the snapshot. */
  source: string;
  anchors: DeadlineAnchor[];
}

export interface DeadlineProposal {
  kind: DeadlineAnchorKind;
  anchors: {
    month: number | null;
    day: number | null;
    withinDays: number | null;
    label: string;
    quote: string;
  }[];
}

export type VerifyVerdict =
  | { ok: true; entry: DeadlineAnchorEntry }
  | { ok: false; reason: string };

/** Days in a month, ignoring leap years: an anchor is a recurring
 * calendar rule ("by July 1"), never a specific year's date, so
 * February 29 is refused as a deadline a parent could rely on. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Normalizes only what typography does to a string that is otherwise
 * identical: curly quotes, non-breaking spaces, and runs of whitespace.
 * Anything beyond that would let a paraphrase pass as a quote. */
function normalizeForQuoteMatch(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteAppearsVerbatim(source: string, quote: string): boolean {
  const haystack = normalizeForQuoteMatch(source).toLowerCase();
  const needle = normalizeForQuoteMatch(quote).toLowerCase();
  return needle.length > 0 && haystack.includes(needle);
}

/**
 * Verifies one model proposal against the state's own deadline text.
 * Returns the entry to ship, or the reason the whole state is dropped.
 */
export function verifyDeadlineProposal(
  stateCode: string,
  source: string,
  proposal: DeadlineProposal,
): VerifyVerdict {
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return { ok: false, reason: `state code ${stateCode} is not two letters` };
  }
  if (!(ANCHOR_KINDS as readonly string[]).includes(proposal.kind)) {
    return { ok: false, reason: `unknown kind ${String(proposal.kind)}` };
  }
  const anchors = proposal.anchors ?? [];

  // "none" means the text names no timing; anchors would contradict it.
  if (proposal.kind === "none") {
    return anchors.length === 0
      ? { ok: false, reason: "kind none carries no anchors to ship" }
      : { ok: false, reason: "kind none proposed anchors anyway" };
  }
  if (anchors.length === 0) {
    return { ok: false, reason: `kind ${proposal.kind} proposed no anchors` };
  }
  if (anchors.length > 4) {
    return { ok: false, reason: `${anchors.length} anchors is implausible` };
  }

  for (const anchor of anchors) {
    if (!quoteAppearsVerbatim(source, anchor.quote)) {
      return {
        ok: false,
        reason: `quote ${JSON.stringify(anchor.quote)} is not verbatim in the source`,
      };
    }
    if (anchor.month !== null) {
      if (!Number.isInteger(anchor.month) || anchor.month < 1 || anchor.month > 12) {
        return { ok: false, reason: `month ${anchor.month} is not a calendar month` };
      }
      if (anchor.day !== null) {
        if (
          !Number.isInteger(anchor.day) ||
          anchor.day < 1 ||
          anchor.day > DAYS_IN_MONTH[anchor.month - 1]
        ) {
          return {
            ok: false,
            reason: `day ${anchor.day} is not valid in month ${anchor.month}`,
          };
        }
      }
    } else if (anchor.day !== null) {
      return { ok: false, reason: "a day with no month is not a date" };
    }
    if (anchor.withinDays !== null) {
      if (
        !Number.isInteger(anchor.withinDays) ||
        anchor.withinDays < 1 ||
        anchor.withinDays > 365
      ) {
        return {
          ok: false,
          reason: `withinDays ${anchor.withinDays} is out of range`,
        };
      }
      // A counted number must be a number the source actually states:
      // the digits, or the small-number words a statute writes out.
      const spelled = [
        "", "one", "two", "three", "four", "five", "six", "seven", "eight",
        "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
        "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
      ];
      const asWord = anchor.withinDays <= 20 ? spelled[anchor.withinDays] : "";
      const haystack = normalizeForQuoteMatch(source).toLowerCase();
      const hasDigits = new RegExp(`\\b${anchor.withinDays}\\b`).test(haystack);
      const hasWord = asWord.length > 0 && haystack.includes(asWord);
      // Weeks stated as weeks ("within two weeks of withdrawing", KY and
      // WA) are the one unit conversion allowed, because seven days to a
      // week is exact arithmetic rather than interpretation, and the
      // basis still has to be present in the source: the count and the
      // word "week" must both appear. Without this the two states lost
      // real, stated timing to a units mismatch.
      const weeks = anchor.withinDays % 7 === 0 ? anchor.withinDays / 7 : 0;
      const weekWord = weeks > 0 && weeks <= 20 ? spelled[weeks] : "";
      const hasWeeks =
        weeks > 0 &&
        /\bweeks?\b/.test(haystack) &&
        (new RegExp(`\\b${weeks}\\b`).test(haystack) ||
          (weekWord.length > 0 && haystack.includes(weekWord)));
      if (!hasDigits && !hasWord && !hasWeeks) {
        return {
          ok: false,
          reason: `withinDays ${anchor.withinDays} does not appear in the source`,
        };
      }
    }
    const label = anchor.label.trim();
    if (label.length < 3 || label.length > 80) {
      return { ok: false, reason: `label ${JSON.stringify(label)} is out of range` };
    }
    if (label.includes("—")) {
      return { ok: false, reason: "label contains an em dash" };
    }
  }

  // A "fixed" deadline that names no date at all is mislabeled, and a
  // relative one with no counted number is really conditional.
  if (proposal.kind === "fixed" && !anchors.some((a) => a.month !== null)) {
    return { ok: false, reason: "kind fixed names no month" };
  }
  if (
    proposal.kind === "relative" &&
    !anchors.some((a) => a.withinDays !== null)
  ) {
    return { ok: false, reason: "kind relative counts no days" };
  }

  return {
    ok: true,
    entry: {
      stateCode,
      kind: proposal.kind,
      source,
      anchors: anchors.map((anchor) => ({
        month: anchor.month,
        day: anchor.day,
        withinDays: anchor.withinDays,
        label: anchor.label.trim(),
        quote: anchor.quote,
      })),
    },
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

/** "July 1" / "July" / "" for an anchor with no calendar date. */
export function anchorDateText(anchor: DeadlineAnchor): string {
  if (anchor.month === null) return "";
  const month = MONTH_NAMES[anchor.month - 1];
  return anchor.day === null ? month : `${month} ${anchor.day}`;
}
