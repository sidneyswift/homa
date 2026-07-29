/**
 * How each state actually wants to be told (gh#420, the filing service).
 *
 * Founder ruling 2026-07-29: research before letters. In 32 of 40 filing
 * states the law asks only for a written notice, which means Homa could
 * generate the finished letter. But "the law accepts a letter" and "this
 * state will accept YOUR letter" are different claims: several states
 * publish their own form or require an online system, and a mailed
 * letter there can be rejected. A rejected filing is worse than no
 * letter at all, because the family believes they have filed.
 *
 * So no state gets a ready-to-sign letter until someone has checked that
 * state's own site and recorded what they found here, with the URL and
 * the date they checked. An unresearched state is not a gap in coverage,
 * it is the honest default: the family gets the filled-in sheet to copy
 * from, which works everywhere.
 */

export const FILING_METHODS = ["letter", "state_form", "portal"] as const;
export type FilingMethod = (typeof FILING_METHODS)[number];

/**
 * Data a state's notice must carry, as a closed set.
 *
 * A closed set rather than free text because composition has to decide,
 * per field, whether Homa can actually supply it. Three of these Homa
 * knows (name, birthdate, address), one it can compute from a known
 * birthdate (age, which is arithmetic on a given fact, unlike grade
 * placement which is a judgment the parent makes). The rest Homa does
 * not hold, so they render as labeled blanks rather than as a claim.
 */
export const LETTER_FIELDS = [
  "child_name",
  "child_birthdate",
  /** Computed from a known birthdate, never guessed from one. */
  "child_age",
  "child_address",
  /** Planned instruction hours. Homa logs hours after the fact, which is
   *  not what a notice filed before the year starts is asking for. */
  "attendance_hours",
  /** The subjects to be studied. Homa's planner knows these, but a
   *  curriculum list in a legal filing is the parent's claim to make. */
  "curriculum_subjects",
  /** Which statutory criterion qualifies the parent to teach. Only the
   *  parent knows which one they meet. */
  "parent_qualification",
] as const;
export type LetterField = (typeof LETTER_FIELDS)[number];

export interface FilingMethodEntry {
  /** letter: the family composes and sends their own written notice, so
   *  Homa may generate a ready-to-sign one.
   *  state_form: the state publishes a form that must be used. Homa
   *  fills a copy-from sheet and links the real form.
   *  portal: the filing happens in an online system. Same as state_form
   *  from the family's side: copy the details in. */
  method: FilingMethod;
  /** The state's own page that says so. Never a third party: this is the
   *  claim that decides whether Homa hands someone a document to mail. */
  sourceUrl: string;
  /** When a human last read that page, "YYYY-MM-DD". */
  checkedOn: string;
  /** What the page actually said, in a sentence, so a later reviewer can
   *  tell a real finding from a guess without re-reading the site. */
  evidence: string;
  /** Where the family sends or enters it, when the page names it. */
  submitTo?: string;
  /** For a letter state only: statements the PARENT MAKES, in the state's
   * own terms. Maine wants assurances about days and subjects; West
   * Virginia wants assurances about subjects and annual assessment.
   * Rendered verbatim as confirmations, because a notice missing a
   * required assurance is incomplete on its face however well addressed
   * it is. Only ever an assurance: a list of required data fields goes in
   * letterMustCarry, and rendering one as the other produces a letter
   * that recites a statute instead of answering it. */
  letterMustState?: string[];
  /** For a letter state only: DATA the notice must carry. Kept as a
   * closed set rather than prose so composition can check the letter
   * actually supplies each one and mark the rest as gaps, instead of
   * asserting completeness it never verified. Florida wants each child's
   * name, address and date of birth; Colorado also wants age and planned
   * hours of attendance. */
  letterMustCarry?: LetterField[];
  /** For a letter state only: what the family must ENCLOSE. West
   * Virginia wants evidence of the instructing parent's diploma. Homa
   * cannot produce these, so they are listed for the parent to attach
   * rather than silently omitted. */
  letterAttachments?: string[];
}

export type FilingMethodVerdict =
  | { ok: true; entry: FilingMethodEntry }
  | { ok: false; reason: string };

/** State pages move and get rewritten. A check older than this is stale
 * enough that the letter decision should be re-made rather than trusted,
 * which the CI guard reports rather than silently honoring. */
export const FILING_METHOD_MAX_AGE_DAYS = 365;

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

/**
 * Verifies one researched entry before it is allowed to decide whether a
 * family receives a mailable letter. Deterministic and offline, so CI
 * re-checks every shipped entry on every push.
 */
export function verifyFilingMethod(
  stateCode: string,
  entry: FilingMethodEntry,
): FilingMethodVerdict {
  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return { ok: false, reason: `state code ${stateCode} is not two letters` };
  }
  if (!(FILING_METHODS as readonly string[]).includes(entry.method)) {
    return { ok: false, reason: `unknown method ${String(entry.method)}` };
  }
  // The source must be the state's own site. A homeschool association's
  // summary may be accurate and still is not the state saying it, and
  // this entry is what puts a document in an envelope.
  if (!isOfficialHost(entry.sourceUrl)) {
    return {
      ok: false,
      reason: `source ${entry.sourceUrl} is not an official state page`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedOn)) {
    return { ok: false, reason: `checkedOn ${entry.checkedOn} is not a date` };
  }
  const evidence = entry.evidence.trim();
  if (evidence.length < 25) {
    return {
      ok: false,
      reason: "evidence is too thin to tell a finding from a guess",
    };
  }
  if (evidence.includes("\u2014")) {
    return { ok: false, reason: "evidence contains an em dash" };
  }
  // Letter-only fields on a form or portal state are silently dead: the
  // composer never reaches them, so a real requirement recorded on the
  // wrong row would look researched and render nowhere.
  if (entry.method !== "letter") {
    for (const field of ["letterMustState", "letterMustCarry", "letterAttachments"] as const) {
      if (entry[field] !== undefined) {
        return {
          ok: false,
          reason: `${field} is set on a ${entry.method} state, where it can never render`,
        };
      }
    }
  }
  for (const assurance of entry.letterMustState ?? []) {
    // An assurance is printed verbatim in a government filing, so it has
    // to read as a statement the parent makes. A field name recorded
    // here instead would produce a letter that recites its own
    // requirements ("this notice confirms: the date of birth").
    if (assurance.trim().split(/\s+/).length < 5) {
      return { ok: false, reason: `assurance "${assurance}" is too short to be one` };
    }
    if (assurance.includes("\u2014")) {
      return { ok: false, reason: "an assurance contains an em dash" };
    }
  }
  for (const field of entry.letterMustCarry ?? []) {
    if (!(LETTER_FIELDS as readonly string[]).includes(field)) {
      return { ok: false, reason: `unknown required field ${String(field)}` };
    }
  }
  return { ok: true, entry };
}

/** True when the check is old enough that the decision should be remade. */
export function isFilingMethodStale(
  entry: FilingMethodEntry,
  todayIso: string,
  maxAgeDays: number = FILING_METHOD_MAX_AGE_DAYS,
): boolean {
  const checked = Date.parse(`${entry.checkedOn}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(checked) || Number.isNaN(today)) return true;
  return (today - checked) / 86_400_000 > maxAgeDays;
}

/**
 * Whether Homa may hand this family a letter to sign and mail.
 *
 * The default is no. A state Homa has not researched, or whose check has
 * gone stale, gets the copy-from sheet, which is correct everywhere and
 * cannot get anyone rejected.
 */
export function mayGenerateLetter(
  entry: FilingMethodEntry | undefined,
  todayIso: string,
): boolean {
  if (!entry) return false;
  // Re-check the two things that make this entry trustworthy at the
  // moment of use, rather than trusting that CI saw this row: the claim
  // came from the state itself, and somebody read it recently enough.
  if (!isOfficialHost(entry.sourceUrl)) return false;
  if (isFilingMethodStale(entry, todayIso)) return false;
  return entry.method === "letter";
}
