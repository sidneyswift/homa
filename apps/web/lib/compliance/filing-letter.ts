import { escapeHtml } from "../html-escape";
import type { StateRequirementsDetail } from "../map/state-requirements";
import {
  mayGenerateLetter,
  type FilingMethodEntry,
  type NoticeField,
} from "./filing-method";

/**
 * The document a family actually sends (gh#421, the filing service).
 *
 * Two shapes, and which one a family gets is decided by research rather
 * than by hope (gh#420, founder ruling 2026-07-29):
 *
 *   - A LETTER, in the eight states whose own sites say a parent may
 *     compose and send their own written notice. This is the filing.
 *     The parent signs it and mails it, and it carries every assurance
 *     that state requires in the state's own terms.
 *   - A WORKSHEET everywhere else, which stages the same details for
 *     copying into the state's form or portal. Correct everywhere, and
 *     the only honest output where a mailed letter can be refused.
 *
 * On signature lines: council decision D1 banned them, and that ban was
 * about the requirements pack's prep sheet, which is a worksheet
 * pretending to be nothing else. This letter IS the filing, so it signs.
 * Confusing the two would either produce an unsignable filing or a
 * worksheet that looks like one.
 *
 * On gaps: founder ruling 2026-07-29 is that a missing detail never
 * costs a family their deadline. Anything Homa does not know renders as
 * a labeled blank line to complete by hand, and is also returned in
 * `gaps` so the covering email can name it. Nothing is ever invented.
 *
 * On required data: a state that names the fields its notice must carry
 * gets those fields SUPPLIED, not quoted back at it. Each one is either
 * filled from what Homa holds or rendered as a labeled blank, decided
 * field by field, so "we filled it in for you" is a checked claim rather
 * than an asserted one.
 */

export interface FilingLetterChild {
  name: string;
  /** "YYYY-MM-DD", or "YYYY-MM" when the day was never collected. */
  birthdate: string | null;
  /** Never derived from age: grade placement is the parent's call. */
  grade: string | null;
}

export interface FilingLetterFamily {
  parentName: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressZip: string | null;
  children: FilingLetterChild[];
}

export interface FilingLetterInput {
  detail: StateRequirementsDetail;
  method: FilingMethodEntry | undefined;
  family: FilingLetterFamily;
  /** Preformatted in the family's timezone; this module has no clock. */
  todayLong: string;
  todayIso: string;
  /** The deadline this filing answers, preformatted, when known. */
  dueLong?: string | null;
}

export interface FilingLetter {
  kind: "letter" | "worksheet";
  title: string;
  body: string;
  /** What the family must complete by hand, in plain words. */
  gaps: string[];
}

const BLANK = '<span class="fl-blank"></span>';

function line(label: string, value: string | null, gaps: string[]): string {
  if (value && value.trim().length > 0) {
    return `<p class="fl-line"><span class="fl-label">${escapeHtml(label)}</span><span class="fl-value">${escapeHtml(value)}</span></p>`;
  }
  gaps.push(label);
  return `<p class="fl-line"><span class="fl-label">${escapeHtml(label)}</span>${BLANK}</p>`;
}

/** "January 12, 2019" from "YYYY-MM-DD", or "January 2019" from
 * "YYYY-MM" when the day was never collected. Never fabricates a day. */
export function birthdateLong(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const parts = birthdate.split("-").map(Number);
  const [year, month, day] = parts;
  if (!year || !month || month < 1 || month > 12) return null;
  const names = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];
  return day ? `${names[month - 1]} ${day}, ${year}` : `${names[month - 1]} ${year}`;
}

function addressBlock(family: FilingLetterFamily, gaps: string[]): string {
  const street = family.addressLine?.trim();
  const city = family.addressCity?.trim();
  const zip = family.addressZip?.trim();
  // Both or neither. A partial line looks filled in and is not
  // deliverable, which is worse than an honest blank: found in
  // production 2026-07-29, where a family with a state but no city
  // printed "OH" as their address line and was never told the rest was
  // missing, because a non-empty string read as present.
  const cityZip = city && zip ? `${city} ${zip}` : "";
  if (!street && !cityZip) {
    gaps.push("Home address");
    return `<p class="fl-line"><span class="fl-label">Home address</span>${BLANK}</p>`;
  }
  const rows = [
    street
      ? `<p class="fl-address">${escapeHtml(street)}</p>`
      : (gaps.push("Street address"), `<p class="fl-line"><span class="fl-label">Street address</span>${BLANK}</p>`),
    cityZip
      ? `<p class="fl-address">${escapeHtml(cityZip)}</p>`
      : (gaps.push("City and zip"), `<p class="fl-line"><span class="fl-label">City and zip</span>${BLANK}</p>`),
  ];
  return rows.join("\n");
}

/**
 * Whole years old on a given date, from a COMPLETE birthdate only.
 *
 * A month-only birthdate is ambiguous by up to a month, which near a
 * birthday is the difference between two answers. In an age-gated legal
 * filing that is not a rounding error, so this refuses rather than
 * picking one.
 */
export function ageOn(birthdate: string | null, onIso: string): number | null {
  if (!birthdate) return null;
  const born = birthdate.split("-").map(Number);
  const now = onIso.slice(0, 10).split("-").map(Number);
  if (born.length !== 3 || now.length !== 3) return null;
  const [by, bm, bd] = born;
  const [ny, nm, nd] = now;
  if (!by || !bm || !bd || !ny || !nm || !nd) return null;
  let age = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Plain-language name for a field a state's notice must carry, used
 *  both on the blank line and in the covering email's gap list. */
function fieldLabel(field: NoticeField, stateName: string): string {
  switch (field) {
    case "attendance_hours":
      return "Hours of instruction you plan for the year";
    case "curriculum_subjects":
      return "Subjects you plan to teach this year";
    case "parent_qualification":
      return `What qualifies you to teach under ${stateName} law`;
    default:
      return field;
  }
}

function childRows(
  children: FilingLetterChild[],
  gaps: string[],
  options: { showAge: boolean; showGrade: boolean; onIso: string },
): string {
  if (children.length === 0) {
    gaps.push("The children this notice covers");
    return `<p class="fl-line"><span class="fl-label">Children</span>${BLANK}</p>`;
  }
  return children
    .map((child) => {
      const born = birthdateLong(child.birthdate);
      const cells = [`<td>${escapeHtml(child.name)}</td>`];
      if (options.showAge) {
        const age = ageOn(child.birthdate, options.onIso);
        cells.push(age === null ? `<td>${BLANK}</td>` : `<td>${age}</td>`);
        if (age === null) gaps.push(`Age for ${child.name}`);
      }
      cells.push(born ? `<td>${escapeHtml(born)}</td>` : `<td>${BLANK}</td>`);
      if (options.showGrade) {
        cells.push(
          child.grade ? `<td>${escapeHtml(child.grade)}</td>` : `<td>${BLANK}</td>`,
        );
        // Grade is never derived from age: placement is the parent's call
        // in most states, and guessing it here would put a claim in a
        // government filing that the family never made.
        if (!child.grade) gaps.push(`Grade level for ${child.name}`);
      }
      if (!born) gaps.push(`Date of birth for ${child.name}`);
      return `      <tr>${cells.join("")}</tr>`;
    })
    .join("\n");
}

/**
 * The fields a state names that Homa cannot fill from what it holds.
 *
 * child_name, child_birthdate, child_age and child_address are already
 * carried by the identity block and the child table above, so requiring
 * them adds nothing here. The rest are things only the family can answer,
 * and each becomes a labeled blank plus a named gap.
 */
function carriedFieldBlanks(
  fields: readonly NoticeField[],
  stateName: string,
  gaps: string[],
): string {
  const askable = fields.filter(
    (field) =>
      field === "attendance_hours" ||
      field === "curriculum_subjects" ||
      field === "parent_qualification",
  );
  if (askable.length === 0) return "";
  const rows = askable
    .map((field) => {
      const label = fieldLabel(field, stateName);
      gaps.push(label);
      return `  <p class="fl-line"><span class="fl-label">${escapeHtml(label)}</span>${BLANK}</p>`;
    })
    .join("\n");
  return `<div class="fl-carry">
  <p class="fl-carry-head">${escapeHtml(stateName)} also asks for this, and only you can answer it</p>
${rows}
</div>`;
}

export function composeFilingLetter(input: FilingLetterInput): FilingLetter {
  const { detail, method, family, todayLong, todayIso, dueLong } = input;
  const gaps: string[] = [];
  const canMail = mayGenerateLetter(method, todayIso);
  const stateName = escapeHtml(detail.stateName);
  const recipient = method?.submitTo ?? "your state education department";

  const identity = [
    line("Parent or guardian", family.parentName, gaps),
    addressBlock(family, gaps),
  ].join("\n");

  const carry = method?.noticeMustCarry ?? [];
  const showAge = carry.includes("child_age");
  // Only where the state's own notice asks for it. No state that accepts
  // a letter does; Arkansas and New Mexico ask on their forms. A Grade
  // column on every document invented a blank nothing wanted, and fed
  // that phantom gap to the drip that asks families to fill gaps in.
  const showGrade = carry.includes("child_grade");
  const headers = [
    "Child",
    ...(showAge ? ["Age"] : []),
    "Date of birth",
    ...(showGrade ? ["Grade"] : []),
  ];

  const table = `<table class="fl-children">
  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>
${childRows(family.children, gaps, { showAge, showGrade, onIso: todayIso })}
  </tbody>
</table>`;

  const carried = carriedFieldBlanks(carry, detail.stateName, gaps);

  // The lead-in makes the state's own phrasing read as something the
  // parent is saying. Maine records "an assurance of at least 175 days of
  // instruction annually"; under "I give ... the following" that is a
  // sentence, and the state's words are never rewritten.
  const assurances = (method?.letterMustState ?? []).length
    ? `<p class="fl-para">By signing below I give ${stateName} ${
        method!.letterMustState!.length === 1
          ? "the following assurance"
          : "each of the following assurances"
      }:</p>
<ul class="fl-assurances">
${method!.letterMustState!.map((item) => `  <li>${escapeHtml(item)}</li>`).join("\n")}
</ul>`
    : "";

  const attachments = (method?.letterAttachments ?? []).length
    ? `<div class="fl-attach">
  <p class="fl-attach-head">Enclose with this letter</p>
  <ul>
${method!.letterAttachments!.map((item) => `    <li>${escapeHtml(item)}</li>`).join("\n")}
  </ul>
  <p class="fl-attach-note">Homa cannot produce these for you. The filing is incomplete without them.</p>
</div>`
    : "";

  if (method?.method === "not_required") {
    // A state that asks for nothing gets no manufactured filing. New
    // Hampshire repealed its notification requirement outright, and
    // producing a signed notice for it would invent an obligation.
    return {
      kind: "worksheet",
      title: `${detail.stateName} does not ask you to file`,
      gaps: [],
      body: `<h1 class="fl-h1">${stateName} does not ask you to file</h1>
<p class="fl-para">There is nothing to send. ${stateName} does not require you to notify anyone that you are homeschooling, so this is not the filing and there is no filing to make.</p>
<p class="fl-para">Two situations are different: withdrawing a child from a public school, and asking to use public school programs. Either of those goes to your local school, not to the state.</p>
<p class="fl-para">Keep this with your records so you can show what the rule was on ${escapeHtml(todayLong)}.</p>`,
    };
  }

  if (!canMail) {
    // Everywhere a mailed letter can be refused, the honest output is a
    // worksheet: the same details, staged for the state's own form or
    // portal, with no signature line because this is not the filing.
    const where =
      method?.method === "portal"
        ? `${stateName} takes this filing through its own online system.`
        : method?.method === "state_form"
          ? `${stateName} requires its own form for this filing.`
          : `Homa has not confirmed what ${stateName} accepts, so this stages your details rather than standing in for the filing.`;
    return {
      kind: "worksheet",
      title: `Your details for telling ${detail.stateName}`,
      gaps,
      body: `<h1 class="fl-h1">Your details for telling ${stateName}</h1>
<p class="fl-para">${where} Copy these details across. This sheet is not the filing and cannot be sent in place of it.</p>
${identity}
${table}
${carried}
${assurances}
${attachments}
<p class="fl-para">You send it to ${escapeHtml(recipient)}.${dueLong ? ` It is due ${escapeHtml(dueLong)}.` : ""}</p>`,
    };
  }

  return {
    kind: "letter",
    title: `Notice of intent to homeschool, ${detail.stateName}`,
    gaps,
    body: `<p class="fl-date">${escapeHtml(todayLong)}</p>
<p class="fl-para">To ${escapeHtml(method?.letterAddressee ?? "the school district")}:</p>
<p class="fl-para">I am giving notice that I intend to provide home instruction for the ${
      family.children.length === 1 ? "child" : "children"
    } named below, under ${stateName} law.</p>
${identity}
${table}
${carried}
${assurances}
<p class="fl-para">Please contact me at the address above if anything further is needed.</p>
<div class="fl-sign">
  <p class="fl-sign-line"></p>
  <p class="fl-sign-label">Signature of parent or guardian</p>
  <p class="fl-sign-line"></p>
  <p class="fl-sign-label">Date</p>
</div>
${attachments}`,
  };
}
