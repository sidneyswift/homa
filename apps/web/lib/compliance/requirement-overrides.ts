import type { StateRequirementsDetail } from "../map/state-requirements";

/**
 * Hand-verified corrections to the upstream state_requirements snapshot
 * (gh#436).
 *
 * The snapshot is reviewed, seeded data and stays the source of truth.
 * But it is a snapshot, and legislatures do not wait for it: New
 * Hampshire repealed its entire home education framework on 2026-07-10,
 * four months after that state's row was last verified, and every NH
 * family generating a pack was being told to notify a superintendent,
 * keep a portfolio and arrange an annual evaluation. All three duties
 * had ceased to exist.
 *
 * "Wait for the next upstream pull" is not an answer when the wrong
 * output is a legal claim in a parent's hands. So this layer exists, and
 * it is deliberately narrow:
 *
 *   - An override may only REMOVE a duty, never add one. Telling a
 *     family they must do something is the claim that needs the most
 *     evidence, and this file is not where that evidence lives. Adding a
 *     duty goes through the reviewed upstream pipeline.
 *   - It carries the state's own primary source, the date a human read
 *     it, and a verbatim quote of the operative language.
 *   - It carries the date the change took legal effect, which is what
 *     the pack shows instead of the stale snapshot verification date.
 *     Printing "rules verified March 2026" over a July change is how a
 *     correct fix still misleads.
 *   - Every entry is checked by verifyRequirementOverride in CI.
 *
 * Retire an entry as soon as the upstream snapshot catches up: an
 * override that agrees with the snapshot is dead weight that will
 * eventually disagree with it for the wrong reason.
 */

export interface RequirementOverride {
  /** Only false is meaningful: an override removes duties, never adds. */
  notificationRequired?: false;
  assessmentRequired?: false;
  portfolioRequired?: false;
  attendanceTracking?: false;
  /** Replaces every pathway's name, in the state's current term.
   *
   * A pathway name is prose, and a repeal makes it lie: New Hampshire's
   * pathways are named "Home Education - Notify Resident District
   * Superintendent", which the pack printed two lines under "No
   * notification is required". Set this only to the state's own current
   * wording, never an invented label. */
  pathwayName?: string;
  /** Collapses the alternate pathways into the default one.
   *
   * Only correct when the repeal is what DISTINGUISHED them. New
   * Hampshire's three pathways differed by which body you notified, so
   * with notification gone they are one path, and listing three would
   * invent a choice the law no longer offers. Never set this where the
   * pathways differ on anything the override did not remove. */
  collapsePathways?: true;
  /** The state's own page or statute. Never a third party. */
  sourceUrl: string;
  /** When a human last read that source, "YYYY-MM-DD". */
  checkedOn: string;
  /** When the change took legal effect, "YYYY-MM-DD". */
  effectiveOn: string;
  /** The operative language, quoted, so a later reviewer can check this
   *  without re-reading the whole act. */
  evidence: string;
  /** One plain sentence for the family, in Homa's voice. */
  familyNote: string;
}

export const REQUIREMENT_OVERRIDES: Record<string, RequirementOverride> = {
  // 2026 Chapter 297 (HB 1268, "modifying the structure and
  // administration of home education programs"), signed by Governor
  // Ayotte on 2026-07-10, effective on passage. It repealed and
  // reenacted RSA 193-A:1-5 and separately repealed RSA 193-A:6
  // outright, which is what removed record keeping and evaluation
  // together with the notification. Verified against the General
  // Court's own amendment text (2026-0606h) and bill status, 2026-07-29.
  //
  // The codified RSA 193-A page still showed the OLD sections on that
  // date, which is normal lag for a freshly chaptered act and is
  // exactly why this override reads the act rather than the code.
  NH: {
    notificationRequired: false,
    assessmentRequired: false,
    portfolioRequired: false,
    attendanceTracking: false,
    // RSA 193-A:2 is titled "Program Established" and the reenacted
    // chapter calls it a home education program throughout. The three
    // snapshot pathways were "Notify Resident District Superintendent",
    // "Notify NH Department of Education" and "Notify Participating
    // Nonpublic School": they differed only by who received the notice,
    // so the repeal leaves one path, not three.
    pathwayName: "Home education program",
    collapsePathways: true,
    sourceUrl: "https://gc.nh.gov/bill_status/pdf.aspx?q=amendment&id=2026-0606H",
    checkedOn: "2026-07-29",
    effectiveOn: "2026-07-10",
    evidence:
      'New RSA 193-A:3 reads "A declaration of home education shall not be required, except to obtain access to public school programs pursuant to RSA 193:1-c or upon withdrawal from a public school." Section 8 of the act repeals "RSA 193-A:6, relative to the record keeping and evaluation of home education programs" and "RSA 193-A:11, relative to the authority of school district officials." New RSA 193-A:4, II adds that no school or state official "shall propose, adopt, or enforce any policy or procedure governing home educated pupils" outside RSA 193:1-c.',
    familyNote:
      "New Hampshire changed its law in July 2026. There is no notice to file, no portfolio to keep, and no annual evaluation to arrange.",
  },
};

export type OverrideVerdict =
  | { ok: true; entry: RequirementOverride }
  | { ok: false; reason: string };

/** How long a hand-read of a statute is trusted before it should be
 *  re-read. Shorter than the filing-method window: an override
 *  SUPPRESSES a legal duty, so a stale one fails toward telling a family
 *  they owe nothing, which is the more dangerous direction. */
export const OVERRIDE_MAX_AGE_DAYS = 180;

function isOfficialHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (host.endsWith(".gov") || host.includes(".gov.")) return true;
  if (/(^|\.)(leg|legis|legislature|revisor|ilga|oscn)\./.test(host)) return true;
  return host.endsWith(".us");
}

function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function verifyRequirementOverride(
  stateCode: string,
  entry: RequirementOverride,
): OverrideVerdict {
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return { ok: false, reason: `state code ${stateCode} is not two letters` };
  }
  if (!isOfficialHost(entry.sourceUrl)) {
    return {
      ok: false,
      reason: `source ${entry.sourceUrl} is not an official state page`,
    };
  }
  for (const [field, value] of [
    ["checkedOn", entry.checkedOn],
    ["effectiveOn", entry.effectiveOn],
  ] as const) {
    if (!isIsoDay(value)) {
      return { ok: false, reason: `${field} ${value} is not a real date` };
    }
  }
  // An override that suppresses a duty rests entirely on its quote, so
  // the bar is higher than the filing table's.
  if (entry.evidence.trim().length < 80) {
    return {
      ok: false,
      reason: "evidence is too thin to suppress a legal duty",
    };
  }
  if (
    entry.evidence.includes("\u2014") ||
    entry.familyNote.includes("\u2014")
  ) {
    return { ok: false, reason: "an override contains an em dash" };
  }
  if (entry.familyNote.trim().length < 20) {
    return { ok: false, reason: "familyNote is too short to explain itself" };
  }
  const removes =
    entry.notificationRequired === false ||
    entry.assessmentRequired === false ||
    entry.portfolioRequired === false ||
    entry.attendanceTracking === false;
  if (!removes) {
    return { ok: false, reason: "an override that removes nothing does nothing" };
  }
  return { ok: true, entry };
}

export function isOverrideStale(
  entry: RequirementOverride,
  todayIso: string,
  maxAgeDays: number = OVERRIDE_MAX_AGE_DAYS,
): boolean {
  if (!isIsoDay(entry.checkedOn) || !isIsoDay(todayIso)) return true;
  const checked = Date.parse(`${entry.checkedOn}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return (today - checked) / 86_400_000 > maxAgeDays;
}

/**
 * Applies a verified override to a parsed detail, on EVERY pathway.
 *
 * Per pathway rather than only the default, because a repeal removes the
 * duty for everyone: leaving the alternate pathways asserting a
 * notification the legislature deleted would put the contradiction on
 * the pack's own "other pathways" page.
 *
 * Returns the detail untouched when there is no override, when the
 * override fails verification, or when it has gone stale. Failing back
 * to the reviewed snapshot is always the safe direction, because the
 * snapshot overstates duties rather than understating them.
 */
export function applyRequirementOverride(
  detail: StateRequirementsDetail,
  todayIso: string,
): StateRequirementsDetail {
  const entry = REQUIREMENT_OVERRIDES[detail.stateCode];
  if (!entry) return detail;
  if (!verifyRequirementOverride(detail.stateCode, entry).ok) return detail;
  if (isOverrideStale(entry, todayIso)) return detail;

  const patch = (pathway: StateRequirementsDetail["pathways"][number]) => ({
    ...pathway,
    name: entry.pathwayName ?? pathway.name,
    notification:
      entry.notificationRequired === false
        ? {
            ...pathway.notification,
            required: false,
            varies: false,
            type: null,
            deadline: null,
            recipient: null,
            frequency: null,
          }
        : pathway.notification,
    assessment:
      entry.assessmentRequired === false
        ? {
            ...pathway.assessment,
            required: false,
            varies: false,
            frequency: null,
            types: [],
          }
        : pathway.assessment,
    recordkeeping: {
      ...pathway.recordkeeping,
      varies:
        entry.portfolioRequired === false && entry.attendanceTracking === false
          ? false
          : pathway.recordkeeping.varies,
      portfolioRequired:
        entry.portfolioRequired === false
          ? false
          : pathway.recordkeeping.portfolioRequired,
      attendanceTracking:
        entry.attendanceTracking === false
          ? false
          : pathway.recordkeeping.attendanceTracking,
    },
  });

  const patchedDefault = detail.defaultPathwayDetail
    ? patch(detail.defaultPathwayDetail)
    : null;
  // Collapsing keeps the default only. Without it the pack's "other
  // pathways" page would offer a choice between three routes the repeal
  // made identical, all still named for a notice nobody has to send.
  const pathways =
    entry.collapsePathways && patchedDefault
      ? [patchedDefault]
      : detail.pathways.map(patch);
  return {
    ...detail,
    defaultPathway: entry.pathwayName ?? detail.defaultPathway,
    notificationRequired:
      entry.notificationRequired === false ? false : detail.notificationRequired,
    assessmentRequired:
      entry.assessmentRequired === false ? false : detail.assessmentRequired,
    pathways,
    defaultPathwayDetail: patchedDefault,
    // The pack prints this as "rules verified <month year>". Leaving the
    // stale date would stamp a July change with a March reading, which
    // is a correct fix that still misleads.
    sourceLastVerified: entry.checkedOn,
  };
}

/** The family-facing sentence for an applied override, or null. */
export function overrideNoteFor(
  stateCode: string,
  todayIso: string,
): string | null {
  const entry = REQUIREMENT_OVERRIDES[stateCode];
  if (!entry) return null;
  if (!verifyRequirementOverride(stateCode, entry).ok) return null;
  if (isOverrideStale(entry, todayIso)) return null;
  return entry.familyNote;
}
