import { escapeHtml } from "../html-escape";
import type { StateRequirementsDetail } from "../map/state-requirements";
import {
  mayGenerateLetter,
  type FilingMethodEntry,
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
  const cityZip = [family.addressCity?.trim(), family.addressZip?.trim()]
    .filter(Boolean)
    .join(" ");
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

function childRows(children: FilingLetterChild[], gaps: string[]): string {
  if (children.length === 0) {
    gaps.push("The children this notice covers");
    return `<p class="fl-line"><span class="fl-label">Children</span>${BLANK}</p>`;
  }
  return children
    .map((child) => {
      const born = birthdateLong(child.birthdate);
      const cells = [
        `<td>${escapeHtml(child.name)}</td>`,
        born
          ? `<td>${escapeHtml(born)}</td>`
          : `<td>${BLANK}</td>`,
        child.grade
          ? `<td>${escapeHtml(child.grade)}</td>`
          : `<td>${BLANK}</td>`,
      ];
      if (!born) gaps.push(`Date of birth for ${child.name}`);
      // Grade is never derived from age: placement is the parent's call
      // in most states, and guessing it here would put a claim in a
      // government filing that the family never made.
      if (!child.grade) gaps.push(`Grade level for ${child.name}`);
      return `      <tr>${cells.join("")}</tr>`;
    })
    .join("\n");
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

  const table = `<table class="fl-children">
  <thead><tr><th>Child</th><th>Date of birth</th><th>Grade</th></tr></thead>
  <tbody>
${childRows(family.children, gaps)}
  </tbody>
</table>`;

  const assurances = (method?.letterMustContain ?? []).length
    ? `<p class="fl-para">This notice also confirms ${
        method!.letterMustContain!.length === 1 ? "the following" : "each of the following"
      }, as ${stateName} requires:</p>
<ul class="fl-assurances">
${method!.letterMustContain!.map((item) => `  <li>${escapeHtml(item)}</li>`).join("\n")}
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
<p class="fl-para">To ${escapeHtml(recipient)}:</p>
<p class="fl-para">I am giving notice that I intend to provide home instruction for the ${
      family.children.length === 1 ? "child" : "children"
    } named below, under ${stateName} law.</p>
${identity}
${table}
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
