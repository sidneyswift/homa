import { HOUSE_PATH } from "../../components/brand/Logo";
import { escapeHtml } from "../html-escape";
import { SHEET_PAGE_CLASS } from "../materials/page-shell";
import { overrideNoteFor } from "./requirement-overrides";
import type {
  StatePathwayDetail,
  StateRequirementsDetail,
} from "../map/state-requirements";
import {
  anchorDateText,
  type ExtraRequirement,
} from "./deadline-anchor-verify";
import {
  DEADLINE_ANCHORS,
  EXTRA_REQUIREMENTS,
} from "./deadline-anchors.generated";

/**
 * The state pack (plans/2026-07-28-state-pack.md): "Your {State} pack",
 * a per-family PDF of the family's state homeschool requirements,
 * derived deterministically from the reviewed state_requirements payload
 * and the family data Homa verifiably holds. Pure functions only: no
 * database, no browser, no model call anywhere, so every branch is
 * unit-testable against the repository's own reviewed snapshots.
 *
 * The laws this module encodes (council decisions D1-D5, D12-D16, D18):
 * - Every requirement renders the DEFAULT pathway's own typed value,
 *   and a value that genuinely differs across sibling pathways carries
 *   a scope note beside it (derivePathwayDivergence). The cover names
 *   the pathway this pack covers, so no claim ever speaks for all of
 *   them. pathway_varies_detail is never rendered, and the affirmative
 *   zero-duty page still refuses on any varies flag.
 * - Free-text prose (deadline strings, compulsory notes) renders
 *   verbatim, never parsed into dates.
 * - Prefill only complete values; everything else is a labeled blank.
 *   Never derive a grade, a school year, or a child's last name.
 * - No form facsimile, no signature line, no family evidence.
 * - Zero-duty states get an affirmative legal-status pack.
 * - The words "compliance" and "approved" never appear in parent copy;
 *   regulation_level is never printed as a label.
 * - Statutory vocabulary ("assessment") may appear inside values and
 *   citations where the law names it; headings stay friendly.
 */

export interface StatePackChild {
  name: string;
  /** "YYYY-MM-DD" or null; printed on the prep sheet only when present. */
  birthdate: string | null;
}

export interface StatePackFamily {
  familyName: string;
  /** Both name parts, or null (partial names render as blanks, D5). */
  parentName: string | null;
  children: StatePackChild[];
}

export interface StatePackInput {
  detail: StateRequirementsDetail;
  family: StatePackFamily;
  /** Material row id; its first 8 chars stamp every page footer. */
  packId: string;
  /** Family-local generation moment, preformatted by the caller
   * ("July 28, 2026"): pure module, no clock access. */
  generatedOn: string;
}

export interface StatePackPage {
  /** Contents-list title (cover page omits itself). */
  title: string;
  body: string;
}

export interface StatePack {
  title: string;
  /** One body per letter page, cover first. */
  pages: StatePackPage[];
  /** The complete printable HTML document. */
  html: string;
  /** What the materials row stores (page bodies joined on the shared
   * delimiter so the packet reuse path can split them later). */
  zeroDuty: boolean;
}

/* ------------------------------------------------------------------ */
/* Print palette: design-system token values inlined because the pack  */
/* is a standalone document (globals.css never loads in the renderer). */
/* White paper, hairline stone rules, clay text accents under 5%       */
/* coverage, one sage handwritten note. Grayscale-safe by design.      */
/* ------------------------------------------------------------------ */
const INK = "#221E1A"; // stone-900
const BODY = "#332E29"; // stone-800
const MUTED = "#6B6259"; // stone-600
const SUBTLE = "#8A7D6C"; // stone-500
const HAIRLINE = "#E7DDCE"; // stone-200
const RULE = "#D6C8B4"; // stone-300
const LINE = "#B3A492"; // stone-400
const CLAY_SOFT = "#FFBE9C"; // clay-200 (the margin rule)
const CLAY = "#C44C22"; // clay-600 (clay text on white)
const CLAY_DEEP = "#9C3B1B"; // clay-700
const SAGE = "#3D9A50"; // sage-500 (Homa's hand)

const FOOTER_MARK_SVG = `<svg width="11" height="11" viewBox="0 0 48 48" aria-hidden="true"><path d="${HOUSE_PATH}" fill="none" stroke="${SUBTLE}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="17.4" cy="26" r="2.7" fill="${SUBTLE}"/><circle cx="30.6" cy="26" r="2.7" fill="${SUBTLE}"/></svg>`;
const HEADER_MARK_SVG = `<svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path d="${HOUSE_PATH}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="17.4" cy="26" r="2.7" fill="${INK}"/><circle cx="30.6" cy="26" r="2.7" fill="${INK}"/></svg>`;

/** "2026-03-13" -> "March 2026" (the trust signal beside every claim). */
export function verifiedMonthYear(sourceLastVerified: string): string {
  const [year, month] = sourceLastVerified.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return sourceLastVerified;
  const names = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];
  return `${names[month - 1]} ${year}`;
}

/** "2019-01-12" -> "January 12, 2019"; "2019-01" -> "January 2019" (the
 * month-only form prefillBirthdate emits for never-collected days);
 * unparseable input stays blank. */
function birthdateText(birthdate: string): string | null {
  const [year, month, day] = birthdate.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  const names = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];
  return day
    ? `${names[month - 1]} ${day}, ${year}`
    : `${names[month - 1]} ${year}`;
}

/** First day after the 2026-07-08..2026-07-11 month-only intake window
 * (migration #55): rows created from here on carry real days. */
const FULL_BIRTHDAY_COLLECTED_FROM = "2026-07-12";

/**
 * The birthdate a prep sheet may prefill (D5: only complete values).
 * children.birth_month rows created in the month-only window carry a
 * placeholder day of 01 that was never collected, and a placeholder
 * printed on a copy-into-the-official-form sheet is fabrication, so
 * those rows (and real day-01 birthdays saved in the same window, which
 * the data cannot tell apart) prefill month and year only.
 */
export function prefillBirthdate(
  birthMonth: string | null,
  childCreatedAt: string | null,
): string | null {
  if (!birthMonth) return null;
  const parsed = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthMonth.trim());
  if (!parsed) return null;
  const [, year, month, day] = parsed;
  const createdInWindow =
    childCreatedAt !== null &&
    childCreatedAt.slice(0, 10) < FULL_BIRTHDAY_COLLECTED_FROM;
  if (day === "01" && createdInWindow) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

/** "standardized_test" -> "standardized test" (mechanical formatting of
 * upstream enum tokens, not interpretation). */
function humanizeToken(token: string): string {
  return token.replace(/_/g, " ");
}

/** Assessment type tokens a parent should read: the bare upstream
 * "other" carries no information and printed literally ("artifact:
 * other.", 51-state vision QC 2026-07-28), so it is dropped from
 * display; the requirement itself still renders. */
function displayTypes(types: readonly string[]): string {
  return types
    .filter((token) => token !== "other")
    .map(humanizeToken)
    .join(", ");
}

/** Verbatim deadline prose keeps its own punctuation; when the template
 * adds a separator or period right after it, a trailing period doubles
 * ("vary by district.. How often", vision QC). Trimming one terminal
 * period is punctuation normalization, never a content change. */
function trimTrailingPeriod(text: string): string {
  return text.replace(/\.$/, "");
}

/**
 * Which fields genuinely differ between the default pathway and its
 * siblings, computed from the values themselves rather than trusted
 * from the payload's `pathway_varies` flag.
 *
 * The flag is section-level: it fires when ANY sub-field of a section
 * differs across pathways, including sub-fields the pack never renders
 * (Arizona's notification flag fires over an attachments list). Reading
 * it as "this pathway's value is unknowable" was the pack's largest
 * quality defect. Verified against the reviewed snapshots on
 * 2026-07-28: every pathway object carries its OWN typed values (51
 * sections where siblings genuinely disagree prove it, plus 49 more
 * where the flag fired while every pathway agreed), so suppressing the
 * default pathway's value threw away correct data and printed
 * boilerplate in a quarter of the country. Arizona lost its affidavit
 * filing step that way, which is the failure mode that matters: a
 * family reading the checklist would have skipped a real legal filing.
 *
 * So the pack renders the default pathway's own value, and this
 * comparison decides only whether to add a scope note beside it. D3's
 * intent is preserved exactly: never present one pathway's rule as
 * covering all of them (the cover names the covered pathway), and
 * never render pathway_varies_detail.
 */
export interface PathwayDivergence {
  notification: boolean;
  assessment: boolean;
  instructionalTime: boolean;
  recordkeeping: boolean;
  subjects: boolean;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function derivePathwayDivergence(
  detail: StateRequirementsDetail,
): PathwayDivergence {
  const base = detail.defaultPathwayDetail;
  const others = detail.pathways.filter((pathway) => pathway !== base);
  const differs = (pick: (pathway: StatePathwayDetail) => unknown): boolean =>
    base !== null && others.some((other) => !sameValue(pick(base), pick(other)));
  return {
    notification: differs((p) => [
      p.notification.required,
      p.notification.deadline,
      p.notification.recipient,
      p.notification.type,
    ]),
    assessment: differs((p) => [
      p.assessment.required,
      p.assessment.frequency,
      p.assessment.types,
    ]),
    instructionalTime: differs((p) => [
      p.instructionalTime.daysPerYear,
      p.instructionalTime.hoursPerYear,
    ]),
    recordkeeping: differs((p) => [
      p.recordkeeping.attendanceTracking,
      p.recordkeeping.portfolioRequired,
    ]),
    subjects: differs((p) => p.subjects.required),
  };
}

/**
 * The scope marker beside a rendered value when sibling pathways carry a
 * different rule: the value stays (it is the default pathway's own) and
 * the parent learns what it covers. A marker rather than a sentence,
 * because California diverges on five of seven rows and the sentence
 * repeated five times on one page (visual review, 2026-07-28); the
 * sentence itself is printed once under the rows by divergenceFootnote.
 */
const DIVERGENCE_MARK = "°";

function divergenceNote(differs: boolean): string {
  return differs ? `<span class="sp-mark">${DIVERGENCE_MARK}</span>` : "";
}

function divergenceFootnote(
  detail: StateRequirementsDetail,
  duties: Duties,
): string {
  const any = Object.values(duties.divergence).some(Boolean);
  if (!any) return "";
  return `<p class="sp-mark-note"><span class="sp-mark">${DIVERGENCE_MARK}</span> This rule differs on ${escapeHtml(detail.stateName)}'s other pathways, which are listed on the sources page. This pack covers ${duties.pathway ? escapeHtml(duties.pathway.name) : "the default pathway"}.</p>`;
}

interface Duties {
  pathway: StatePathwayDetail | null;
  /** Concrete = required on the DEFAULT pathway, whose object carries
   * its own typed values (see derivePathwayDivergence). Divergence adds
   * a scope note; it never suppresses the value. */
  notification: boolean;
  notificationConcrete: boolean;
  assessmentConcrete: boolean;
  attendance: boolean;
  portfolio: boolean;
  timeConcrete: boolean;
  subjectsConcrete: boolean;
  divergence: PathwayDivergence;
  anyVaries: boolean;
  /** No duty asserted anywhere and nothing varies: the state pack can
   * affirmatively say "you are legal, nothing is required". */
  zeroDuty: boolean;
}

/**
 * A line naming a law change too recent for the upstream snapshot
 * (gh#436), or nothing.
 *
 * A family whose state repealed its rules last month is the one most
 * likely to have read the old rules somewhere else, so saying which way
 * it changed and when is what makes the rest of the page believable.
 * Some of the surrounding citations may still point at sections the act
 * repealed, which is exactly why this line tells them the date to
 * measure everything else against.
 */
function recentChangeNote(detail: StateRequirementsDetail): string {
  const note = overrideNoteFor(detail.stateCode, detail.sourceLastVerified);
  return note
    ? `<p class="sp-change-note">${escapeHtml(note)} Anything you read that is older than this may describe the rules that were replaced.</p>`
    : "";
}

export function deriveDuties(detail: StateRequirementsDetail): Duties {
  const p = detail.defaultPathwayDetail;
  const divergence = derivePathwayDivergence(detail);
  if (!p) {
    return {
      pathway: null,
      notification: false,
      notificationConcrete: false,
      assessmentConcrete: false,
      attendance: false,
      portfolio: false,
      timeConcrete: false,
      subjectsConcrete: false,
      divergence,
      anyVaries: false,
      zeroDuty: false,
    };
  }
  const anyVaries =
    p.notification.varies ||
    p.assessment.varies ||
    p.instructionalTime.varies ||
    p.recordkeeping.varies ||
    p.subjects.varies;
  const hasTime =
    p.instructionalTime.daysPerYear !== null ||
    p.instructionalTime.hoursPerYear !== null;
  // Belt and suspenders for the affirmative "nothing is required" claim:
  // the payload booleans AND the reviewed summary columns must agree. A
  // permissive-parse default (absent field reads false) must never
  // convert into an affirmative negative legal claim on its own.
  const summaryAgreesZero =
    !detail.notificationRequired && !detail.assessmentRequired;
  return {
    pathway: p,
    notification: p.notification.required,
    notificationConcrete: p.notification.required,
    assessmentConcrete: p.assessment.required,
    attendance: p.recordkeeping.attendanceTracking,
    portfolio: p.recordkeeping.portfolioRequired,
    timeConcrete: hasTime,
    subjectsConcrete: p.subjects.required.length > 0,
    divergence,
    anyVaries,
    zeroDuty:
      summaryAgreesZero &&
      !anyVaries &&
      !p.notification.required &&
      !p.assessment.required &&
      !p.recordkeeping.attendanceTracking &&
      !p.recordkeeping.portfolioRequired &&
      !hasTime,
  };
}

/**
 * Whether a citation destination is the state's own publication (or
 * another government body's) rather than a legal publisher or an
 * advocacy organization. Domain-based on purpose: it is a claim about
 * WHO published the page, which a hostname answers honestly, and never
 * a claim about whether the page is correct, which it cannot.
 *
 * Verified against all 355 shipped citations on 2026-07-29: 281
 * official, 74 secondary (Justia 41, HSLDA 5, FindLaw 5, OSCN 4, and a
 * tail of public.law mirrors, court aggregators, and state homeschool
 * associations).
 */
export function isOfficialSource(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (host.endsWith(".gov") || host.includes(".gov.")) return true;
  // State legislature and revisor hosts that predate .gov adoption.
  if (/(^|\.)(leg|legis|legislature|revisor|ilga|oscn)\./.test(host)) return true;
  if (host.endsWith(".state.al.us") || host.endsWith(".us")) return true;
  return false;
}

/** DOE -> state page -> wizard: the link the pack prints wherever it
 * tells the parent to confirm or file (D3, D12). The state education
 * department leads because it is the only genuinely official channel;
 * the first shipped DC pack sent parents to HomeschoolLeap's wizard
 * labeled "the official form" (founder catch, 2026-07-28), and a
 * third-party walkthrough must never wear that label. Every reviewed
 * snapshot carries doe_url today, so the fallbacks are defensive. */
export function officialUrl(detail: StateRequirementsDetail): string | null {
  // Every candidate is filtered through isOfficialSource, so the line
  // that tells a family where to confirm or file can never fall back to
  // a third-party page. All 51 reviewed snapshots carry a doe_url on a
  // state domain, which makes the fallbacks defensive rather than load
  // bearing, and that is exactly how they should stay.
  const candidates = [detail.doeUrl, detail.sourcePageUrl, detail.wizardUrl];
  return candidates.find((url) => url !== null && isOfficialSource(url)) ?? null;
}

function variesLine(detail: StateRequirementsDetail): string {
  const url = officialUrl(detail);
  const link = url
    ? ` <span class="sp-mono">${escapeHtml(url)}</span>`
    : "";
  return `This varies by pathway in ${escapeHtml(detail.stateName)}. Confirm at the official source.${link}`;
}

/* ------------------------------------------------------------------ */
/* Page building blocks                                                */
/* ------------------------------------------------------------------ */

function pageHeader(
  detail: StateRequirementsDetail,
  overline: string,
  title: string,
  support: string | null,
): string {
  return `<header class="sp-header">
  <div class="sp-header-brand">${HEADER_MARK_SVG}</div>
  <div class="sp-header-rule">
    <p class="sp-overline">${escapeHtml(overline)}</p>
    <h1 class="sp-title">${escapeHtml(title)}</h1>
    ${support ? `<p class="sp-support">${escapeHtml(support)}</p>` : ""}
  </div>
</header>`;
}

/**
 * Requirements recovered from this state's default-pathway detail
 * (gh#322), rendered under the row they belong to. Each note is backed
 * by a verbatim quote checked at build time, and the derivation refuses
 * anything that only restates the deadline the row already shows, so a
 * note here is always something the summary would otherwise have
 * missed. Pennsylvania's notarized affidavit is the reason this exists.
 */
function extraFor(
  detail: StateRequirementsDetail,
  section: ExtraRequirement["section"],
): string {
  const entry = EXTRA_REQUIREMENTS[detail.stateCode];
  if (!entry) return "";
  const notes = entry.requirements.filter((r) => r.section === section);
  if (notes.length === 0) return "";
  return notes
    .map((note) => `<span class="sp-also">Also: ${escapeHtml(note.note)}</span>`)
    .join("");
}

function definitionRow(label: string, valueHtml: string, subHtml?: string): string {
  return `<div class="sp-row">
  <p class="sp-row-label">${escapeHtml(label)}</p>
  <div class="sp-row-value"><p>${valueHtml}</p>${subHtml ? `<p class="sp-row-sub">${subHtml}</p>` : ""}</div>
</div>`;
}

function coverPage(
  detail: StateRequirementsDetail,
  family: StatePackFamily,
  generatedOn: string,
  contents: string[],
  duties: Duties,
): string {
  const verified = verifiedMonthYear(detail.sourceLastVerified);
  const stateName = escapeHtml(detail.stateName);
  const pathwayName = duties.pathway
    ? escapeHtml(duties.pathway.name)
    : "default";
  // Only say a state has several routes when it does. Fifteen states
  // publish exactly one (CT DC ID IL KS KY MA NJ NY OK RI TX UT WY, and
  // NH since its 2026 repeal collapsed three into one), and telling
  // those families "different pathways can carry different rules, this
  // pack covers the X pathway" invites them to go hunting for an
  // alternative that does not exist.
  const pathwayScope =
    detail.pathways.length > 1
      ? ` Different pathways in ${stateName} can carry different rules; this pack covers the ${pathwayName} pathway, the one most families use.`
      : ` ${stateName} publishes one route for homeschooling families, and this pack covers it.`;
  const contentsRows = contents
    .map(
      (title, index) =>
        `<li><span>${escapeHtml(title)}</span><span class="sp-leader"></span><span class="sp-mono">${index + 2}</span></li>`,
    )
    .join("\n");
  const staleBanner =
    detail.staleClaimIds.length > 0
      ? `<p class="sp-banner">A few ${stateName} details are being re-verified. Check the linked sources before you file anything.</p>`
      : "";
  const attributionUrl = detail.sourcePageUrl ?? "https://homeschoolleap.com";
  return `${pageHeader(
    detail,
    `Prepared for the ${family.familyName} family · ${generatedOn}`,
    `Homeschooling in ${detail.stateName}`,
    "The requirements, the deadlines, and the records worth keeping, in one place.",
  )}
${staleBanner}
<section class="sp-contents">
  <p class="sp-section-label">What's inside</p>
  <ol class="sp-contents-list">
${contentsRows}
  </ol>
</section>
<section class="sp-colophon">
  <p><strong>State rules last verified ${escapeHtml(verified)}</strong> · source: HomeschoolLeap (CC BY-SA 4.0) · pack made ${escapeHtml(generatedOn)}</p>
  <p>Homeschooling is legal in all 50 states, including ${stateName}. This pack organizes ${stateName}'s published homeschool rules so you can see them in one place. It is legal information, not legal advice, and Homa is not a law firm. Downloading or filling out this pack does not notify ${stateName} and does not by itself satisfy any state requirement of any kind; the record templates become part of your own records once you fill them in, and where a filing is required, this pack links to the official channel.${pathwayScope} Every rule here comes from the sources cited in this pack, last verified ${escapeHtml(verified)}. Laws change, so the current statute is always worth a look before you act on a deadline. Make a fresh pack from Homa before each school year and before filing anything. If your situation is unusual, or a district ever questions your homeschooling, a homeschool-friendly attorney or a legal defense organization can advise you; this pack cannot.</p>
  <p>State requirement data by HomeschoolLeap (<span class="sp-mono">${escapeHtml(attributionUrl)}</span>), used under CC BY-SA 4.0 (<span class="sp-mono">creativecommons.org/licenses/by-sa/4.0</span>). Homa reformatted and summarized this data for your pack, and the requirement summary sections are available under that same license. The data is provided as is by its source. Your family's information and the Homa name and logo are not part of that license.</p>
</section>`;
}

function glancePage(detail: StateRequirementsDetail, duties: Duties): string {
  const p = duties.pathway;
  const rows: string[] = [];
  const cite = (statute: string | null) =>
    statute ? `<span class="sp-mono">${escapeHtml(statute)}</span>` : "";

  if (!p) {
    rows.push(
      definitionRow(
        "Pathways",
        variesLine(detail),
      ),
    );
  } else {
    // Every row below renders the DEFAULT pathway's own typed value and
    // appends a scope note where sibling pathways genuinely differ
    // (derivePathwayDivergence). The cover names the pathway this pack
    // covers, so no row ever claims to speak for all of them.
    const d = duties.divergence;

    // Telling the state.
    if (p.notification.required) {
      const parts = [
        p.notification.type === "simple_notice"
          ? "A simple notice"
          : p.notification.type === "detailed_plan"
            ? "A detailed plan or report"
            : p.notification.type === "approval_required"
              ? "A filing that needs approval"
              : "A notification",
        p.notification.recipient
          ? `goes to ${escapeHtml(p.notification.recipient)}`
          : "is part of this pathway",
      ];
      const deadline = p.notification.deadline
        ? `<strong>${escapeHtml(trimTrailingPeriod(p.notification.deadline))}</strong>`
        : "The source does not list a fixed date; confirm timing at the official source";
      rows.push(
        definitionRow(
          "Telling the state",
          `${parts.join(" ")}.${divergenceNote(d.notification)}`,
          `When: ${deadline}${p.notification.frequency ? ` · how often: ${escapeHtml(humanizeToken(p.notification.frequency))}` : ""}${p.statute ? ` · ${cite(p.statute)}` : ""}${extraFor(detail, "notification")}`,
        ),
      );
    } else {
      rows.push(
        definitionRow(
          "Telling the state",
          `No notification is required on this pathway.${divergenceNote(d.notification)}`,
        ),
      );
    }

    // Year-end check.
    if (p.assessment.required) {
      const types = displayTypes(p.assessment.types);
      rows.push(
        definitionRow(
          "Year-end check",
          `This pathway asks for a year-end artifact${types ? `: ${escapeHtml(types)}` : ""}.${divergenceNote(d.assessment)}`,
          p.assessment.frequency
            ? `How often: ${escapeHtml(humanizeToken(p.assessment.frequency))}`
            : undefined,
        ),
      );
    } else {
      rows.push(
        definitionRow(
          "Year-end check",
          `This pathway asks for no year-end artifact.${divergenceNote(d.assessment)}`,
        ),
      );
    }

    // Instructional time.
    if (duties.timeConcrete) {
      const bits: string[] = [];
      if (p.instructionalTime.daysPerYear) {
        bits.push(`${p.instructionalTime.daysPerYear} days per year`);
      }
      if (p.instructionalTime.hoursPerYear) {
        bits.push(`${p.instructionalTime.hoursPerYear} hours per year`);
      }
      rows.push(
        definitionRow(
          "Instructional time",
          `${escapeHtml(bits.join(" · "))}.${divergenceNote(d.instructionalTime)}`,
        ),
      );
    } else {
      rows.push(
        definitionRow(
          "Instructional time",
          `No minimum is set on this pathway.${divergenceNote(d.instructionalTime)}`,
        ),
      );
    }

    // Records to keep. The row must agree with the template pages that
    // follow it: a state with a time minimum or a year-end check gets
    // those templates, and page 2 saying "no specific records" while
    // page 5 offers a record template read as a contradiction to a
    // district reader (51-state vision QC, 2026-07-28: KS MA SD WI).
    const kept: string[] = [];
    if (p.recordkeeping.attendanceTracking) kept.push("an attendance record");
    if (p.recordkeeping.portfolioRequired) kept.push("a portfolio of work");
    const practical: string[] = [];
    if (duties.timeConcrete) practical.push("the instructional-time minimum");
    if (duties.assessmentConcrete) practical.push("the year-end check");
    rows.push(
      definitionRow(
        "Records to keep",
        (kept.length > 0
          ? `This pathway asks families to keep ${escapeHtml(kept.join(" and "))}.`
          : practical.length > 0
            ? `No record format is prescribed, and this pack includes templates because ${escapeHtml(practical.join(" and "))} ${practical.length > 1 ? "are" : "is"} easier to show with one.`
            : "No specific records are required on this pathway.") +
          divergenceNote(d.recordkeeping) +
          extraFor(detail, "recordkeeping"),
      ),
    );

    // Subjects.
    if (p.subjects.required.length > 0) {
      rows.push(
        definitionRow(
          "Subjects",
          escapeHtml(p.subjects.required.join("; ")) + `.${divergenceNote(d.subjects)}`,
        ),
      );
    } else {
      rows.push(
        definitionRow(
          "Subjects",
          `No subject list is set on this pathway.${divergenceNote(d.subjects)}`,
        ),
      );
    }
  }

  // School-age window (typed summary columns, no varies concept).
  if (detail.compulsoryStartAge !== null && detail.compulsoryEndAge !== null) {
    rows.push(
      definitionRow(
        "School-age window",
        `Ages ${detail.compulsoryStartAge} to ${detail.compulsoryEndAge}.`,
        detail.compulsoryNotes ? escapeHtml(detail.compulsoryNotes) : undefined,
      ),
    );
  }

  if (detail.defaultPathway) {
    rows.push(
      definitionRow(
        "Most families use",
        `${escapeHtml(detail.defaultPathway)}.`,
      ),
    );
  }

  const keyDates = keyDatesBox(detail, duties);

  const highCallout =
    detail.regulationLevel === "high"
      ? `<aside class="sp-callout">
  <p>${escapeHtml(detail.stateName)} has detailed requirements beyond this summary. Confirm with ${detail.doeUrl ? `<span class="sp-mono">${escapeHtml(detail.doeUrl)}</span>` : "the state education department"} and your district before filing.</p>
</aside>`
      : "";

  return `${pageHeader(
    detail,
    `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    "Key requirements at a glance",
    `How ${detail.stateName} works for the pathway most families use, so nothing about it ever surprises you.`,
  )}
<section class="sp-rows">
${rows.join("\n")}
</section>
${divergenceFootnote(detail, duties)}
${keyDates}
${highCallout}`;
}

/** One row per destination: upstream files the same statute under
 * several label variants ("15-802" four ways in AZ, all pointing at one
 * URL, 51-state vision QC), and the shortest label is the cleanest name
 * for the shared destination. */
function dedupeCitationsByUrl(
  citations: readonly { label: string; url: string; sourceType: string | null }[],
): { label: string; url: string; sourceType: string | null }[] {
  const byUrl = new Map<string, { label: string; url: string; sourceType: string | null }>();
  for (const citation of citations) {
    const existing = byUrl.get(citation.url);
    if (!existing || citation.label.length < existing.label.length) {
      byUrl.set(citation.url, citation);
    }
  }
  return [...byUrl.values()];
}

/**
 * "Key dates for your year" (gh#342): the calendar anchors derived from
 * this state's own deadline prose, each one carrying a verbatim quote
 * that was verified against the source at build time
 * (deadline-anchor-verify.ts). A state whose proposal failed
 * verification simply has no entry, and falls back to the verbatim
 * string alone, which is what every state showed before this existed.
 *
 * The rendered date always comes from the anchor's LABEL, never from
 * arithmetic on withinDays: several states count business days (New
 * Hampshire, Vermont) or school days (Arkansas), and only the label
 * carries that distinction. The verbatim source sits underneath as the
 * authority, so a parent can always read the rule the way the statute
 * states it.
 */
function keyDatesBox(
  detail: StateRequirementsDetail,
  duties: Duties,
): string {
  const p = duties.pathway;
  if (!p || !p.notification.required || !p.notification.deadline) return "";
  const entry = DEADLINE_ANCHORS[detail.stateCode];
  const scope = duties.divergence.notification
    ? ` <span class="sp-dates-scope">on the ${escapeHtml(p.name)} pathway</span>`
    : "";
  const anchorRows =
    entry && entry.source === p.notification.deadline
      ? entry.anchors
          .map((anchor) => {
            // An anchor with no calendar date (relative or conditional)
            // leaves the stamp column empty rather than filling it with a
            // word: its label already carries the whole rule, and the
            // count is often in units a bare number would misstate
            // (business days, school days).
            const date = anchorDateText(anchor);
            return `    <li><span class="sp-date-stamp">${date ? escapeHtml(date) : ""}</span><span>${escapeHtml(anchor.label)}</span></li>`;
          })
          .join("\n")
      : "";
  const heading = anchorRows
    ? `Key dates for your year${scope}`
    : `The filing deadline${scope}`;
  return `<aside class="sp-dates">
  <p class="sp-section-label">${heading}</p>
${anchorRows ? `  <ul class="sp-date-list">\n${anchorRows}\n  </ul>\n` : ""}  <p class="sp-dates-source"><strong>${escapeHtml(trimTrailingPeriod(p.notification.deadline))}</strong>${p.notification.recipient ? ` · to ${escapeHtml(p.notification.recipient)}` : ""}${p.notification.frequency ? ` · ${escapeHtml(humanizeToken(p.notification.frequency))}` : ""}</p>
</aside>`;
}

function sourcesPage(detail: StateRequirementsDetail, duties: Duties): string {
  const citations = dedupeCitationsByUrl(
    detail.citations.filter((citation) => citation.sourceType !== "case_law"),
  );
  // Official first, secondary named as secondary: an audit of all 355
  // shipped citations (2026-07-29) found 74 pointing at commercial or
  // advocacy sites, Justia alone 41, every one of them printed under a
  // statute label as though it were the state's own code. Both kinds
  // are worth giving a parent; presenting them as the same thing is
  // what a district reader would rightly object to.
  const official = citations.filter((citation) => isOfficialSource(citation.url));
  const secondary = citations.filter((citation) => !isOfficialSource(citation.url));
  const citeList = (list: typeof citations) =>
    list
      .map(
        (citation) =>
          `<li><span class="sp-cite-label">${escapeHtml(citation.label)}</span><span class="sp-mono sp-cite-url">${escapeHtml(citation.url)}</span></li>`,
      )
      .join("\n");
  const rows =
    secondary.length === 0
      ? citeList(official)
      : `${official.length > 0 ? citeList(official) : ""}`;
  const secondaryBlock =
    secondary.length > 0
      ? `<section class="sp-pathways">
  <p class="sp-section-label">Where to read them elsewhere</p>
  <p class="sp-row-sub">${escapeHtml(detail.stateName)}'s own site does not publish every one of these, so the source below is a legal publisher or a homeschool organization rather than the state. Useful, and not the official text.</p>
  <ul class="sp-cites">
${citeList(secondary)}
  </ul>
</section>`
      : "";
  // Six states publish their primary statute only through a legal
  // publisher (AR, GA, MS, NM, TN, WY; MS's is a paywalled LexisNexis
  // container URL). The statute is still named, and the link moves to
  // the secondary block rather than standing beside "the primary
  // statute is" as if the state had published it.
  const primaryUrlOfficial =
    detail.statuteUrl !== null && isOfficialSource(detail.statuteUrl);
  const primary = detail.primaryStatute
    ? `<p class="sp-body">The primary statute is <strong>${escapeHtml(detail.primaryStatute)}</strong>${primaryUrlOfficial ? ` (<span class="sp-mono">${escapeHtml(detail.statuteUrl as string)}</span>)` : ""}.</p>`
    : "";
  const others = detail.pathways.filter((pathway) => !pathway.isDefault);
  const otherRows = others
    .map(
      (pathway) =>
        `<li><strong>${escapeHtml(pathway.name)}</strong>${pathway.statute ? ` · <span class="sp-mono">${escapeHtml(pathway.statute)}</span>` : ""}</li>`,
    )
    .join("\n");
  const officialLink = officialUrl(detail);
  return `${pageHeader(
    detail,
    `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    "Where this comes from",
    "Every rule in this pack traces to a published source you can read yourself.",
  )}
${primary}
${rows ? `${secondary.length > 0 ? `<p class="sp-section-label">${escapeHtml(detail.stateName)}'s own published law</p>` : ""}<ul class="sp-cites">\n${rows}\n</ul>` : ""}
${secondaryBlock}
${
  others.length > 0
    ? `<section class="sp-pathways">
  <p class="sp-section-label">Other pathways in ${escapeHtml(detail.stateName)}</p>
  <p class="sp-body">This pack covers ${duties.pathway ? escapeHtml(duties.pathway.name) : "the default pathway"}. ${escapeHtml(detail.stateName)} also recognizes:</p>
  <ul class="sp-pathway-list">\n${otherRows}\n</ul>
  <p class="sp-row-sub">Different pathways carry different rules. The official source has the full picture${officialLink ? `: <span class="sp-mono">${escapeHtml(officialLink)}</span>` : "."}</p>
</section>`
    : ""
}`;
}

interface ChecklistItem {
  main: string;
  sub: string;
}

export function deriveChecklistItems(
  detail: StateRequirementsDetail,
  duties: Duties,
): ChecklistItem[] {
  const p = duties.pathway;
  if (!p) return [];
  const stateName = escapeHtml(detail.stateName);
  const cite = p.statute
    ? ` <span class="sp-mono">${escapeHtml(p.statute)}</span>`
    : "";
  const items: ChecklistItem[] = [];
  if (duties.notificationConcrete) {
    const recipient = p.notification.recipient
      ? ` with ${escapeHtml(p.notification.recipient)}`
      : "";
    // The deadline is verbatim prose and must only ever follow a labeled
    // clause, never a splice ("file your notice, By July 1" reads as the
    // retired "by By" class).
    const deadline = p.notification.deadline
      ? `When: <strong>${escapeHtml(trimTrailingPeriod(p.notification.deadline))}</strong>.`
      : "The source does not list a fixed date; confirm timing at the official source.";
    items.push({
      main: `${stateName} requires: file your notice${recipient}.`,
      sub: `${deadline}${
        p.notification.frequency
          ? ` How often: ${escapeHtml(humanizeToken(p.notification.frequency))}.`
          : ""
      }${cite}`,
    });
  }
  if (duties.timeConcrete && p) {
    const bits: string[] = [];
    if (p.instructionalTime.daysPerYear) {
      bits.push(`${p.instructionalTime.daysPerYear} days`);
    }
    if (p.instructionalTime.hoursPerYear) {
      bits.push(`${p.instructionalTime.hoursPerYear} hours`);
    }
    items.push({
      main: `${stateName} requires: plan the year around <strong>${escapeHtml(bits.join(" · "))}</strong> of instruction.`,
      sub: `The instructional-time log in this pack is one easy way to keep the running total.${cite}`,
    });
  }
  if (duties.attendance && p) {
    items.push({
      main: `${stateName} requires: keep an <strong>attendance record</strong> through the year.`,
      sub: `There is an attendance page in this pack for each of your children.${cite}`,
    });
  }
  if (duties.portfolio && p) {
    items.push({
      main: `${stateName} requires: keep a <strong>portfolio</strong> of work samples.`,
      sub: `The portfolio index in this pack keeps it organized as you go.${cite}`,
    });
  }
  if (duties.assessmentConcrete && p) {
    const types = displayTypes(p.assessment.types);
    items.push({
      main: `${stateName} requires: arrange the <strong>year-end check</strong>${types ? ` (${escapeHtml(types)})` : ""}.`,
      sub: `${p.assessment.frequency ? `How often: ${escapeHtml(humanizeToken(p.assessment.frequency))}. ` : ""}The year-end record page keeps what you arranged and when.${cite}`,
    });
  }
  if (duties.subjectsConcrete && p) {
    items.push({
      main: `${stateName} requires: cover the <strong>required subjects</strong>.`,
      sub: `${escapeHtml(p.subjects.required.join("; "))}.${cite}`,
    });
  }
  return items;
}

const CHECKLIST_ROWS_PER_PAGE = 8;

function checklistPages(
  detail: StateRequirementsDetail,
  duties: Duties,
  items: ChecklistItem[],
): string[] {
  const pages: string[] = [];
  for (let start = 0; start < items.length; start += CHECKLIST_ROWS_PER_PAGE) {
    const slice = items.slice(start, start + CHECKLIST_ROWS_PER_PAGE);
    const rows = slice
      .map(
        (item) => `<div class="sp-check-row">
  <span class="sp-check-box"></span>
  <div class="sp-check-text">
    <p>${item.main}</p>
    ${item.sub ? `<p class="sp-row-sub">${item.sub}</p>` : ""}
  </div>
  <span class="sp-check-done">Done on ______</span>
</div>`,
      )
      .join("\n");
    const isFirst = start === 0;
    pages.push(`${pageHeader(
      detail,
      `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
      isFirst
        ? `Your ${detail.stateName} checklist`
        : `Your ${detail.stateName} checklist, continued`,
      isFirst
        ? `These steps reflect ${detail.stateName}'s rules for the ${duties.pathway?.name ?? "default"} pathway, the one most families use. Other pathways carry different rules; they are listed on the sources page.`
        : null,
    )}
<section class="sp-checklist">
${rows}
</section>
${isFirst ? `<p class="sp-hand">you've got this</p>` : ""}`);
  }
  if (pages.length === 0 && duties.anyVaries) {
    // Duties exist somewhere but every one of them varies by pathway:
    // the honest checklist is a pathway summary with no imperatives (D3).
    const rows = detail.pathways
      .map(
        (pathway) =>
          `<li><strong>${escapeHtml(pathway.name)}</strong>${pathway.statute ? ` · <span class="sp-mono">${escapeHtml(pathway.statute)}</span>` : ""}</li>`,
      )
      .join("\n");
    const link = officialUrl(detail);
    pages.push(`${pageHeader(
      detail,
      `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
      `Your ${detail.stateName} pathways`,
      `${detail.stateName}'s rules depend on which pathway your family uses, so the right checklist depends on a choice that is yours to make.`,
    )}
<p class="sp-body">Each pathway carries its own notification, record, and year-end rules. The official source walks through them side by side${link ? `: <span class="sp-mono">${escapeHtml(link)}</span>` : "."}</p>
<ul class="sp-pathway-list">
${rows}
</ul>
<p class="sp-hand">you've got this</p>`);
  }
  return pages;
}

function legalityPage(detail: StateRequirementsDetail, duties: Duties): string {
  const p = duties.pathway;
  const statusCitations = detail.citations.filter(
    (citation) => citation.sourceType === "case_law",
  );
  const subjects =
    p && p.subjects.required.length > 0
      ? `<p class="sp-body">The subjects ${escapeHtml(detail.stateName)} names: ${escapeHtml(p.subjects.required.join("; "))}.</p>`
      : "";
  const ages =
    detail.compulsoryStartAge !== null && detail.compulsoryEndAge !== null
      ? `<p class="sp-body">School attendance is compulsory from age ${detail.compulsoryStartAge} to ${detail.compulsoryEndAge}${detail.compulsoryNotes ? `. ${escapeHtml(detail.compulsoryNotes)}` : "."}</p>`
      : "";
  const citations = dedupeCitationsByUrl(
    detail.citations.filter((citation) => citation.sourceType !== "case_law"),
  );
  const citeRows = citations
    .map(
      (citation) =>
        `<li><span class="sp-cite-label">${escapeHtml(citation.label)}</span><span class="sp-mono sp-cite-url">${escapeHtml(citation.url)}</span></li>`,
    )
    .join("\n");
  return `${pageHeader(
    detail,
    `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    `You are legal in ${detail.stateName}`,
    `${detail.stateName} asks almost nothing of homeschooling families, and that is written into its law.`,
  )}
<section class="sp-legal-affirm">
  ${recentChangeNote(detail)}
  <ul class="sp-affirm-list">
    <li>No notice or filing is required on the default path.</li>
    <li>No year-end artifact is required on the default path.</li>
    <li>No attendance record or portfolio is required on the default path.</li>
  </ul>
  ${detail.primaryStatute ? `<p class="sp-body">The legal basis is <strong>${escapeHtml(detail.primaryStatute)}</strong>${detail.statuteUrl ? ` (<span class="sp-mono">${escapeHtml(detail.statuteUrl)}</span>)` : ""}.</p>` : ""}
  ${statusCitations.length > 0 ? `<p class="sp-body">Recognized in ${statusCitations.map((citation) => `<strong>${escapeHtml(citation.label)}</strong> (<span class="sp-mono">${escapeHtml(citation.url)}</span>)`).join("; ")}.</p>` : ""}
  ${subjects}
  ${ages}
</section>
${citeRows ? `<section class="sp-pathways"><p class="sp-section-label">Where this comes from</p><ul class="sp-cites">\n${citeRows}\n</ul></section>` : ""}
<p class="sp-hand">you've got this</p>`;
}

/* Template pages. Every header restates the triggering requirement with
 * its verified date so a photocopied page stands alone (AQ-10, D10). */

const TEMPLATE_INTRO = (detail: StateRequirementsDetail, recordType: string, varies: boolean) =>
  varies
    ? `A record-keeping template. Some ${detail.stateName} pathways ask families to keep ${recordType}; the official source has the rules for yours. Keeping it in this format is one good way, not the only way.`
    : `A record-keeping template, offered because ${detail.stateName}'s default pathway asks families to keep ${recordType}. Keeping it in this format is one good way, not the only way.`;

const MONTH_LABELS = [
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
];

function attendancePage(
  detail: StateRequirementsDetail,
  duties: Duties,
  childName: string,
): string {
  const dayHeaders = Array.from({ length: 31 }, (_, index) => `<th>${index + 1}</th>`).join("");
  const monthRows = MONTH_LABELS.map(
    (month) =>
      `<tr><th class="sp-att-month">${month}</th>${"<td></td>".repeat(31)}<td class="sp-att-tally"></td></tr>`,
  ).join("\n");
  const varies = duties.divergence.recordkeeping;
  return `${pageHeader(
    detail,
    varies
      ? `Attendance rules vary by pathway in ${detail.stateName} · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`
      : `${detail.stateName} asks for an attendance record on the default path · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    `Attendance · ${childName}`,
    TEMPLATE_INTRO(detail, "an attendance record", varies),
  )}
<p class="sp-body">School year: __________ &nbsp;&nbsp; Mark each day you did school. A mark is a mark; you decide what counts as a day.</p>
<table class="sp-att">
  <thead><tr><th></th>${dayHeaders}<th class="sp-att-tally">Days</th></tr></thead>
  <tbody>
${monthRows}
  </tbody>
</table>
<p class="sp-body sp-att-total">Days this year: __________</p>`;
}

function timeLogPage(detail: StateRequirementsDetail, duties: Duties): string {
  const p = duties.pathway;
  const bits: string[] = [];
  if (p?.instructionalTime.daysPerYear) {
    bits.push(`${p.instructionalTime.daysPerYear} days per year`);
  }
  if (p?.instructionalTime.hoursPerYear) {
    bits.push(`${p.instructionalTime.hoursPerYear} hours per year`);
  }
  // 17 rows: 20 overflowed the exact-height page box and cut the total
  // line below the footer (caught on the 2026-07-28 render smoke).
  const rows = Array.from(
    { length: 17 },
    () => `<tr><td class="sp-log-date"></td><td></td><td class="sp-log-time"></td></tr>`,
  ).join("\n");
  return `${pageHeader(
    detail,
    `${detail.stateName} asks for ${bits.join(" and ") || "instructional time"} on the default path · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    "Instructional time log",
    `A record-keeping template, offered because ${detail.stateName}'s default pathway sets an instructional-time minimum. No record format is prescribed; a running log is one good way to show the year, not the only way.`,
  )}
<table class="sp-log">
  <thead><tr><th class="sp-log-date">Date</th><th>What we worked on</th><th class="sp-log-time">Time</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<p class="sp-body sp-att-total">Total this page: __________</p>`;
}

function portfolioPage(detail: StateRequirementsDetail, duties: Duties): string {
  const rows = Array.from(
    { length: 16 },
    () => `<tr><td class="sp-log-date"></td><td></td><td class="sp-log-subject"></td><td></td></tr>`,
  ).join("\n");
  const varies = duties.divergence.recordkeeping;
  return `${pageHeader(
    detail,
    varies
      ? `Portfolio rules vary by pathway in ${detail.stateName} · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`
      : `${detail.stateName} asks for a portfolio on the default path · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    "Portfolio index",
    TEMPLATE_INTRO(detail, "a portfolio of work samples", varies),
  )}
<table class="sp-log">
  <thead><tr><th class="sp-log-date">Date</th><th>Work sample</th><th class="sp-log-subject">Subject</th><th>Notes</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>`;
}

function yearEndPage(
  detail: StateRequirementsDetail,
  duties: Duties,
  children: StatePackChild[],
): string {
  const p = duties.pathway;
  const types = p ? displayTypes(p.assessment.types) : "";
  const childRows = (children.length > 0 ? children : [{ name: "", birthdate: null }])
    .map(
      (child) =>
        `<tr><td class="sp-log-subject">${escapeHtml(child.name)}</td><td></td><td class="sp-log-date"></td><td></td></tr>`,
    )
    .join("\n");
  return `${pageHeader(
    detail,
    `${detail.stateName} asks for a year-end check on the default path · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    "Year-end check record",
    `A place to keep what you arranged for the year-end check ${detail.stateName}'s default pathway asks for: what it was, when, and where you keep the result.${types ? ` The statute names: ${escapeHtml(types)}.` : ""} This format is one good way, not the only way.`,
  )}
<table class="sp-log">
  <thead><tr><th class="sp-log-subject">Child</th><th>What we arranged</th><th class="sp-log-date">Date</th><th>Kept where</th></tr></thead>
  <tbody>
${childRows}
${Array.from({ length: Math.max(0, 8 - Math.max(children.length, 1)) }, () => `<tr><td class="sp-log-subject"></td><td></td><td class="sp-log-date"></td><td></td></tr>`).join("\n")}
  </tbody>
</table>`;
}

function blankLine(label: string): string {
  return `<p class="sp-blank"><span class="sp-blank-label">${escapeHtml(label)}</span><span class="sp-blank-line"></span></p>`;
}

function filledLine(label: string, value: string): string {
  return `<p class="sp-blank"><span class="sp-blank-label">${escapeHtml(label)}</span><span class="sp-filled">${escapeHtml(value)}</span></p>`;
}

function prepSheetPage(
  detail: StateRequirementsDetail,
  duties: Duties,
  family: StatePackFamily,
): string {
  const p = duties.pathway;
  const notification = p?.notification ?? null;
  const asksRows: string[] = [];
  if (!notification) {
    asksRows.push(`<p class="sp-body">${variesLine(detail)}</p>`);
  } else {
    asksRows.push(
      `<p class="sp-body"><strong>Who receives it:</strong> ${notification.recipient ? escapeHtml(notification.recipient) : "confirm at the official source"}.</p>`,
      `<p class="sp-body"><strong>When:</strong> ${notification.deadline ? escapeHtml(notification.deadline) : "the source does not list a fixed date; confirm timing at the official source"}.</p>`,
    );
    if (notification.type) {
      asksRows.push(
        `<p class="sp-body"><strong>What kind:</strong> ${
          notification.type === "simple_notice"
            ? "a simple notice"
            : notification.type === "detailed_plan"
              ? "a detailed plan or report"
              : "a filing that needs approval"
        }.</p>`,
      );
    }
    if (notification.frequency) {
      asksRows.push(
        `<p class="sp-body"><strong>How often:</strong> ${escapeHtml(humanizeToken(notification.frequency))}.</p>`,
      );
    }
  }

  const details: string[] = [];
  details.push(
    family.parentName
      ? filledLine("Parent name", family.parentName)
      : blankLine("Parent name"),
  );
  details.push(blankLine("Home address"));
  details.push(blankLine("City, state, zip"));
  for (const child of family.children) {
    const born = child.birthdate ? birthdateText(child.birthdate) : null;
    details.push(
      born
        ? filledLine("Child", `${child.name} · born ${born}`)
        : filledLine("Child", child.name),
    );
    details.push(blankLine("Last name"));
    details.push(blankLine("Grade level (you choose this)"));
  }

  const link = officialUrl(detail);
  // The deadline string is verbatim prose that often opens with its own
  // preposition ("By July 1 annually..."), so it gets a labeled clause,
  // never a "by" prefix ("by By July 1", caught on the render smoke).
  const sendLine =
    notification?.recipient && notification?.deadline
      ? ` You send it to ${escapeHtml(notification.recipient)}. When: ${escapeHtml(trimTrailingPeriod(notification.deadline))}.`
      : "";
  // "Telling {State}", never "{State}'s notice of intent": the filing
  // instrument's real name varies (California files a Private School
  // Affidavit, Arizona an Affidavit of Intent), and the typed payload
  // does not carry it, so the neutral phrasing is the one that is true
  // in every jurisdiction (51-state vision QC, 2026-07-28).
  return `${pageHeader(
    detail,
    `Your state · rules verified ${verifiedMonthYear(detail.sourceLastVerified)}`,
    `Filing preparation for ${detail.stateName}`,
    `What ${detail.stateName} asks for, next to the details you already have.`,
  )}
<div class="sp-prep">
  <div class="sp-prep-col">
    <p class="sp-section-label">What ${escapeHtml(detail.stateName)} asks for</p>
    ${asksRows.join("\n    ")}
  </div>
  <div class="sp-prep-col">
    <p class="sp-section-label">Your details, ready to copy</p>
    ${details.join("\n    ")}
    <p class="sp-row-sub">Check every detail Homa filled in before you copy it.</p>
  </div>
</div>
<aside class="sp-notform">
  <p>This worksheet helps you gather what ${escapeHtml(detail.stateName)} asks for when you tell the state. It is not the official form and cannot be filed. When it is filled in, copy the details into the official form on your state education department's homeschool page${link ? `: <span class="sp-mono">${escapeHtml(link)}</span>` : ""}.${sendLine} Homa does not file it for you.</p>
</aside>`;
}

/* ------------------------------------------------------------------ */
/* Document shell: same exact-height page-box geometry as               */
/* wrapPrintableDocument (page-shell.ts), with the state pack's own    */
/* footer (D10): family line left, provenance right, and the legal     */
/* line on info pages only. The materials footer is untouched.         */
/* ------------------------------------------------------------------ */

export interface StatePackFooterInput {
  familyName: string;
  verifiedMonthYear: string;
  generatedOn: string;
  packId: string;
}

export function wrapStatePackDocument(
  pages: readonly { body: string; legalLine: boolean }[],
  footer: StatePackFooterInput,
): string {
  const packShort = footer.packId.replace(/-/g, "").slice(0, 8);
  const total = pages.length;
  const rendered = pages
    .map((page, index) => {
      const legal = page.legalLine
        ? `<div class="sp-footer-legal">Legal information, not legal advice · data: HomeschoolLeap, CC BY-SA 4.0</div>`
        : "";
      return `<div class="${SHEET_PAGE_CLASS}"><div class="homa-sheet-body">${page.body}</div><div class="sp-footer">
  <div class="sp-footer-left">${FOOTER_MARK_SVG}<span>Prepared with Homa for the ${escapeHtml(footer.familyName)} family</span></div>
  <div class="sp-footer-right">sources verified ${escapeHtml(footer.verifiedMonthYear)} · made ${escapeHtml(footer.generatedOn)} · pack ${escapeHtml(packShort)} · page ${index + 1} of ${total}</div>
</div>${legal}</div>`;
    })
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@600&display=swap" rel="stylesheet" />
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 8.5in;
    font-family: "Hanken Grotesk", -apple-system, "Segoe UI", sans-serif;
    color: ${BODY};
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .${SHEET_PAGE_CLASS} {
    position: relative;
    box-sizing: border-box;
    width: 8.5in;
    height: 11in;
    overflow: hidden;
    background: #ffffff;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .${SHEET_PAGE_CLASS}:last-child { page-break-after: auto; break-after: auto; }
  .homa-sheet-body {
    box-sizing: border-box;
    height: 100%;
    padding: 0.55in 0.6in 1in;
  }
  .sp-footer {
    position: absolute;
    bottom: 0.42in;
    left: 0.6in;
    right: 0.6in;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 8.5px;
    color: ${SUBTLE};
  }
  .sp-footer-left { display: flex; align-items: center; gap: 5px; }
  .sp-footer-right { font-family: "JetBrains Mono", monospace; font-size: 7.5px; }
  .sp-footer-legal {
    position: absolute;
    bottom: 0.26in;
    left: 0.6in;
    right: 0.6in;
    font-size: 8px;
    color: ${SUBTLE};
  }
  .sp-header { margin-bottom: 0.22in; }
  .sp-header-brand { display: flex; align-items: center; gap: 6px; margin-bottom: 0.14in; }
  .sp-header-rule { border-left: 3px solid ${CLAY_SOFT}; padding-left: 0.16in; }
  .sp-overline { margin: 0; font-family: "JetBrains Mono", monospace; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.14em; color: ${CLAY}; }
  .sp-title { margin: 3px 0 0; font-family: "Schibsted Grotesk", sans-serif; font-weight: 700; font-size: 26px; letter-spacing: -0.015em; color: ${INK}; }
  .sp-support { margin: 5px 0 0; font-size: 11px; color: ${MUTED}; max-width: 5.6in; }
  .sp-section-label { margin: 0 0 8px; font-family: "JetBrains Mono", monospace; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.14em; color: ${SUBTLE}; }
  .sp-body { font-size: 10.5px; line-height: 1.55; color: ${BODY}; margin: 6px 0; }
  .sp-mono { font-family: "JetBrains Mono", monospace; font-size: 8.5px; color: ${CLAY_DEEP}; overflow-wrap: break-word; }
  .sp-banner { border: 1px solid ${RULE}; border-radius: 6px; padding: 8px 12px; font-size: 10px; color: ${MUTED}; background: #ffffff; }
  .sp-contents { margin-top: 0.35in; }
  .sp-contents-list { list-style: none; margin: 0; padding: 0; }
  .sp-contents-list li { display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: ${BODY}; padding: 5px 0; }
  .sp-leader { flex: 1; border-bottom: 1px dotted ${RULE}; }
  .sp-colophon { position: absolute; bottom: 0.85in; left: 0.6in; right: 0.6in; border: 1px solid ${HAIRLINE}; border-radius: 8px; padding: 12px 14px; }
  .sp-colophon p { margin: 0 0 7px; font-size: 8.6px; line-height: 1.5; color: ${MUTED}; }
  .sp-colophon p:first-child { color: ${BODY}; font-size: 9.5px; }
  .sp-colophon p:last-child { margin-bottom: 0; }
  .sp-rows { display: flex; flex-direction: column; }
  .sp-row { display: flex; gap: 0.18in; padding: 8px 0; border-bottom: 1px solid ${HAIRLINE}; }
  .sp-row-label { flex: 0 0 1.45in; margin: 0; font-size: 10.5px; font-weight: 700; color: ${INK}; }
  .sp-row-value { flex: 1; }
  .sp-row-value p { margin: 0; font-size: 10.5px; line-height: 1.5; color: ${BODY}; }
  .sp-row-sub { margin-top: 3px !important; font-size: 9px !important; color: ${MUTED} !important; }
  .sp-dates { margin-top: 0.16in; border: 1.5px solid ${RULE}; border-radius: 8px; padding: 10px 14px; }
  .sp-dates p { margin: 0; font-size: 11.5px; color: ${INK}; }
  .sp-also { display: block; margin-top: 3px; font-size: 9.5px; line-height: 1.45; color: ${BODY}; }
  .sp-mark { color: ${CLAY}; font-weight: 700; }
  .sp-mark-note { margin: 7px 0 0; font-size: 8.6px; line-height: 1.45; color: ${MUTED}; }
  .sp-dates-scope { font-family: "Hanken Grotesk", sans-serif; text-transform: none; letter-spacing: 0; font-size: 8.5px; color: ${SUBTLE}; }
  .sp-date-list { list-style: none; margin: 2px 0 8px; padding: 0; }
  .sp-date-list li { display: flex; align-items: baseline; gap: 9px; padding: 3px 0; font-size: 11.5px; color: ${INK}; }
  .sp-date-stamp { flex: 0 0 auto; min-width: 1.05in; font-family: "JetBrains Mono", monospace; font-size: 10px; font-weight: 500; color: ${CLAY_DEEP}; }
  .sp-date-stamp-soft { color: ${SUBTLE}; }
  .sp-dates-source { padding-top: 6px; border-top: 1px solid ${HAIRLINE}; font-size: 9.5px !important; color: ${MUTED} !important; }
  .sp-callout { margin-top: 0.14in; border: 1px solid ${HAIRLINE}; border-left: 3px solid ${CLAY_SOFT}; border-radius: 6px; padding: 9px 12px; }
  .sp-callout p { margin: 0; font-size: 9.5px; line-height: 1.5; color: ${MUTED}; }
  .sp-cites { list-style: none; margin: 8px 0 0; padding: 0; }
  .sp-cites li { display: flex; flex-direction: column; padding: 5px 0; border-bottom: 1px solid ${HAIRLINE}; }
  .sp-cite-label { font-size: 10px; font-weight: 600; color: ${BODY}; }
  .sp-cite-url { margin-top: 1px; }
  .sp-pathways { margin-top: 0.24in; }
  .sp-pathway-list { list-style: none; margin: 6px 0 0; padding: 0; }
  .sp-pathway-list li { font-size: 10.5px; color: ${BODY}; padding: 4px 0; border-bottom: 1px solid ${HAIRLINE}; }
  .sp-checklist { display: flex; flex-direction: column; }
  .sp-check-row { display: flex; gap: 0.14in; align-items: flex-start; padding: 11px 0; border-bottom: 1px solid ${HAIRLINE}; min-height: 0.42in; }
  .sp-check-box { flex: 0 0 auto; width: 0.18in; height: 0.18in; border: 1.5px solid ${SUBTLE}; border-radius: 3px; background: #ffffff; margin-top: 1px; }
  .sp-check-text { flex: 1; }
  .sp-check-text p { margin: 0; font-size: 10.5px; line-height: 1.5; color: ${BODY}; }
  .sp-check-done { flex: 0 0 auto; font-family: "JetBrains Mono", monospace; font-size: 8px; color: ${SUBTLE}; margin-top: 2px; }
  .sp-hand { font-family: "Caveat", cursive; font-weight: 600; font-size: 19px; color: ${SAGE}; transform: rotate(-2deg); margin: 0.24in 0 0 0.1in; }
  .sp-legal-affirm { margin-top: 0.1in; }
  .sp-change-note { margin: 0 0 12px; padding: 9px 11px; border-left: 2px solid ${CLAY_SOFT}; background: #FFF8F4; font-size: 11.5px; line-height: 1.5; color: ${BODY}; }
  .sp-affirm-list { list-style: none; margin: 0 0 10px; padding: 0; }
  .sp-affirm-list li { font-size: 12.5px; font-weight: 600; color: ${INK}; padding: 7px 0; border-bottom: 1px solid ${HAIRLINE}; }
  .sp-att { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
  .sp-att th, .sp-att td { border: 1px solid ${RULE}; height: 0.26in; padding: 0; font-size: 7px; color: ${MUTED}; text-align: center; font-weight: 500; }
  .sp-att thead th { height: 0.18in; border-color: ${RULE}; font-family: "JetBrains Mono", monospace; font-size: 6.5px; }
  .sp-att-month { width: 0.42in; font-size: 8px !important; font-weight: 700 !important; color: ${BODY} !important; }
  .sp-att-tally { width: 0.42in; }
  .sp-att-total { margin-top: 10px; font-weight: 600; }
  .sp-log { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .sp-log th { font-size: 9px; font-weight: 700; color: ${INK}; text-align: left; padding: 4px 6px; border-bottom: 1.5px solid ${LINE}; }
  .sp-log td { height: 0.38in; border-bottom: 1px solid ${RULE}; padding: 2px 6px; font-size: 10px; color: ${BODY}; }
  .sp-log-date { width: 0.9in; }
  .sp-log-time { width: 0.8in; }
  .sp-log-subject { width: 1.2in; }
  .sp-prep { display: flex; gap: 0.3in; margin-top: 0.1in; }
  .sp-prep-col { flex: 1; }
  .sp-blank { display: flex; align-items: baseline; gap: 8px; margin: 0 0 14px; }
  .sp-blank-label { flex: 0 0 auto; font-size: 9px; color: ${MUTED}; }
  .sp-blank-line { flex: 1; border-bottom: 1.5px solid ${LINE}; min-height: 14px; }
  .sp-filled { flex: 1; font-size: 11px; color: ${INK}; border-bottom: 1px solid ${HAIRLINE}; padding-bottom: 2px; }
  .sp-notform { margin-top: 0.28in; border: 1.5px solid ${RULE}; border-radius: 8px; padding: 11px 14px; }
  .sp-notform p { margin: 0; font-size: 9.5px; line-height: 1.55; color: ${BODY}; }
</style>
</head>
<body>
${rendered}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function composeStatePack(input: StatePackInput): StatePack {
  const { detail, family, packId, generatedOn } = input;
  const duties = deriveDuties(detail);
  const contentPages: { page: StatePackPage; legalLine: boolean }[] = [];

  if (duties.zeroDuty) {
    contentPages.push({
      page: { title: `You are legal in ${detail.stateName}`, body: legalityPage(detail, duties) },
      legalLine: true,
    });
    contentPages.push({
      page: { title: "Key requirements at a glance", body: glancePage(detail, duties) },
      legalLine: true,
    });
  } else {
    contentPages.push({
      page: { title: "Key requirements at a glance", body: glancePage(detail, duties) },
      legalLine: true,
    });
    contentPages.push({
      page: { title: "Where this comes from", body: sourcesPage(detail, duties) },
      legalLine: true,
    });
    const items = deriveChecklistItems(detail, duties);
    const checklists = checklistPages(detail, duties, items);
    checklists.forEach((body, index) => {
      contentPages.push({
        page: {
          title:
            checklists.length === 1 || index === 0
              ? items.length > 0
                ? `Your ${detail.stateName} checklist`
                : `Your ${detail.stateName} pathways`
              : `Your ${detail.stateName} checklist, continued`,
          body,
        },
        legalLine: true,
      });
    });
    if (duties.attendance) {
      const children = family.children.length > 0 ? family.children : [{ name: "", birthdate: null }];
      for (const child of children) {
        contentPages.push({
          page: {
            title: child.name ? `Attendance · ${child.name}` : "Attendance",
            body: attendancePage(detail, duties, child.name),
          },
          legalLine: false,
        });
      }
    }
    if (duties.timeConcrete) {
      contentPages.push({
        page: { title: "Instructional time log", body: timeLogPage(detail, duties) },
        legalLine: false,
      });
    }
    if (duties.portfolio) {
      contentPages.push({
        page: { title: "Portfolio index", body: portfolioPage(detail, duties) },
        legalLine: false,
      });
    }
    if (duties.assessmentConcrete) {
      contentPages.push({
        page: {
          title: "Year-end check record",
          body: yearEndPage(detail, duties, family.children),
        },
        legalLine: false,
      });
    }
    if (duties.notification) {
      contentPages.push({
        page: {
          title: `Filing preparation for ${detail.stateName}`,
          body: prepSheetPage(detail, duties, family),
        },
        legalLine: true,
      });
    }
  }

  const cover: StatePackPage = {
    title: `Homeschooling in ${detail.stateName}`,
    body: coverPage(
      detail,
      family,
      generatedOn,
      contentPages.map((entry) => entry.page.title),
      duties,
    ),
  };
  const pages = [cover, ...contentPages.map((entry) => entry.page)];
  const html = wrapStatePackDocument(
    [
      { body: cover.body, legalLine: true },
      ...contentPages.map((entry) => ({
        body: entry.page.body,
        legalLine: entry.legalLine,
      })),
    ],
    {
      familyName: family.familyName,
      verifiedMonthYear: verifiedMonthYear(detail.sourceLastVerified),
      generatedOn,
      packId,
    },
  );
  return {
    title: `Your ${detail.stateName} pack`,
    pages,
    html,
    zeroDuty: duties.zeroDuty,
  };
}
