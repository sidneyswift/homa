import { filingDeadlines } from "./deadlines";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";

/**
 * What Homa still needs from a family before their filing is complete,
 * and only the parts she can actually do something about (gh#424).
 *
 * ONLY ACTIONABLE THINGS. This is the list a nudge is built from, and
 * founder ruling 3 is that it "nudges until complete". A nudge for
 * something with nowhere to enter it never completes, so it nags
 * forever. That is the whole reason this is a separate, narrower list
 * from the gaps the filing document prints.
 *
 * The document's gaps and this list are different on purpose:
 *
 *   document gaps          what the notice is missing, all of it
 *   these details          the subset a parent can fix in settings
 *
 * Colorado's planned instruction hours, Virginia's curriculum list and
 * statutory qualification all appear as blanks on the document, because
 * founder ruling 5 says a missing detail must never cost a deadline. But
 * none of them has a home in settings, so none is ever nudged for. They
 * stay hand-write blanks until someone builds a place to put them.
 */

export const FILING_DETAILS = [
  "filing_name",
  "home_address",
  "school_year_start",
  "child_birthdate",
] as const;
export type FilingDetail = (typeof FILING_DETAILS)[number];

/** What the family is asked for, in plain words, and where it lives. */
export const FILING_DETAIL_COPY: Record<
  FilingDetail,
  { ask: string; where: string }
> = {
  filing_name: {
    ask: "your name, the way it should appear on an official filing",
    where: "/app/settings",
  },
  home_address: {
    ask: "your home address",
    where: "/app/settings",
  },
  school_year_start: {
    ask: "the day your school year starts",
    where: "/app/settings",
  },
  child_birthdate: {
    ask: "each child's date of birth",
    where: "/app/settings",
  },
};

export interface FilingDetailInput {
  stateCode: string | null;
  filingParentName: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressZip: string | null;
  schoolYearStartIso: string | null;
  children: { name: string; birthdate: string | null }[];
  todayIso: string;
}

function blank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

/**
 * The details this family is missing, in the order a parent would fill
 * them, or an empty array when the filing is complete.
 *
 * Returns nothing at all for a state that asks for no filing: there is
 * no document to complete, so there is nothing to nudge about. New
 * Hampshire repealed its requirement outright, and a family there being
 * asked for their address "for the filing" would be asked for a filing
 * that does not exist.
 */
export function missingFilingDetails(
  input: FilingDetailInput,
): FilingDetail[] {
  if (!input.stateCode) return [];
  if (FILING_METHODS_BY_STATE[input.stateCode]?.method === "not_required") {
    return [];
  }

  const missing: FilingDetail[] = [];
  if (blank(input.filingParentName)) missing.push("filing_name");
  // Both or neither, the same rule the document uses: half an address is
  // not deliverable and looks filled in.
  if (
    blank(input.addressLine) ||
    blank(input.addressCity) ||
    blank(input.addressZip)
  ) {
    missing.push("home_address");
  }
  // Only where the state's deadline is actually counted from the
  // family's own start. In the 14 states that name a calendar date,
  // asking for it would be asking for something Homa does not need.
  if (blank(input.schoolYearStartIso)) {
    const outcome = filingDeadlines({
      stateCode: input.stateCode,
      schoolYearStartIso: null,
      todayIso: input.todayIso,
    });
    if (!outcome.ok && outcome.reason === "needs_school_year_start") {
      missing.push("school_year_start");
    }
  }
  if (input.children.some((child) => blank(child.birthdate))) {
    missing.push("child_birthdate");
  }
  return missing;
}

/** True when nothing actionable is outstanding. */
export function filingDetailsComplete(input: FilingDetailInput): boolean {
  return missingFilingDetails(input).length === 0;
}
