import { mapDb } from "../map/db";

/**
 * When a family's school year starts (gh#418, the filing service).
 *
 * The single fact that unlocks deadlines in 25 states. Their rules count
 * from the day that family began ("within 30 days of starting"), so
 * without it Homa cannot say when anything is due, and founder ruling
 * 2026-07-29 is to ask each family once rather than guess: a family
 * told the wrong date and filing late is worse off than one Homa said
 * nothing to.
 *
 * Validation lives here, apart from the writer, so the parsing rules are
 * testable without a database and shared by every door this arrives
 * through: the settings field, the drip, and later the chat ask.
 */

/** How far off a claimed start date may be before it is more likely a
 * typo than a real answer. Families do report starting a year ago, and
 * some plan a year ahead, so the window is generous in both directions
 * and only refuses dates that cannot be a school year at all. */
const MAX_YEARS_BACK = 2;
const MAX_YEARS_AHEAD = 1;

export type SchoolYearStartParse =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * Parses a school-year start from anything a form or a person supplies.
 * Returns the reason on failure because every caller shows it to a
 * parent, and "that did not save" without a why is the kind of dead end
 * that makes someone give up on the field.
 */
export function parseSchoolYearStart(
  raw: string | null | undefined,
  todayIso: string,
): SchoolYearStartParse {
  const value = String(raw ?? "").trim();
  if (value.length === 0) {
    return { ok: false, reason: "Add the date your school year starts." };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { ok: false, reason: "Use a date like 2026-08-17." };
  }
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, reason: "That is not a date on the calendar." };
  }
  // Round-trip through UTC so February 30 and friends are refused rather
  // than silently rolled into March.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { ok: false, reason: "That is not a date on the calendar." };
  }
  const todayYear = Number(todayIso.slice(0, 4));
  if (!Number.isFinite(todayYear)) {
    return { ok: false, reason: "Could not read today's date." };
  }
  if (year < todayYear - MAX_YEARS_BACK) {
    return { ok: false, reason: "That start date is too far in the past." };
  }
  if (year > todayYear + MAX_YEARS_AHEAD) {
    return { ok: false, reason: "That start date is too far ahead." };
  }
  return { ok: true, value };
}

/**
 * Saves or explicitly clears the family's school-year start. familyId always comes from
 * session auth; this never accepts one from a client or a model.
 */
export async function setSchoolYearStart(
  familyId: string,
  startOn: string | null,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set school_year_start_on = ${startOn}, updated_at = now()
    where id = ${familyId}
  `;
}

/**
 * Saves the parent's name for state filings (gh#424).
 *
 * Deliberately NOT families.first_name or the member display name.
 * Those are how Homa greets someone, they are written only by the
 * signup and waitlist paths, and 48 of 90 real families had no way to
 * set them at all. Null clears it, and the filing then prints a labeled
 * blank rather than putting a greeting name on a government notice.
 *
 * familyId always comes from session auth; this never accepts one from a
 * client or a model.
 */
export async function setFilingParentName(
  familyId: string,
  name: string | null,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set filing_parent_name = ${name}, updated_at = now()
    where id = ${familyId}
  `;
}
