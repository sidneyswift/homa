import { SHEET_PAGE_CLASS } from "../materials/page-shell";
import { colorTokens } from "@homa/design/contract";
import { escapeHtml } from "../html-escape";
import type { FilingLetter } from "./filing-letter";

/**
 * The printable shell around a filing (gh#421).
 *
 * ON BRANDING, a judgment call worth naming rather than burying:
 *
 * The LETTER carries no Homa mark. It is the parent's notice to a
 * government office, written in their voice and signed in their hand,
 * and a vendor footer on it misstates who is speaking. A superintendent
 * should read a letter from a parent, not a letter from a company on a
 * parent's behalf. Every other Homa document keeps its footer (D7); this
 * one is the exception, because this one is the only document a family
 * hands to the state.
 *
 * The WORKSHEET keeps the mark. It is a Homa work aid, it never leaves
 * the house, and a family holding two similar sheets needs to see at a
 * glance which one is theirs to send.
 *
 * Flagged for founder ratification alongside the other state-pack
 * judgment calls (gh#319).
 */

const INK = colorTokens.ink;
const BODY = colorTokens.ink;
const MUTED = "#5B5852";
const SUBTLE = "#77736B";
const HAIRLINE = "#DED8CC";
const LINE = "#77736B";
const CLAY_DEEP = colorTokens.brandText;

const MARK_SVG = `<svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 L42 21 L42 42 L6 42 L6 21 Z" fill="none" stroke="${SUBTLE}" stroke-width="3.2" stroke-linejoin="round"/><circle cx="17.4" cy="26" r="2.7" fill="${SUBTLE}"/><circle cx="30.6" cy="26" r="2.7" fill="${SUBTLE}"/></svg>`;

export interface FilingDocumentFooter {
  familyName: string;
  generatedOn: string;
}

/**
 * One letter-size page carrying the filing. A notice is a page, not a
 * packet: the identity block, the child table and the assurances are
 * short by law in every state researched so far, and the render check in
 * the route refuses rather than silently spilling onto a second page
 * nobody reviewed.
 */
export function wrapFilingDocument(
  letter: FilingLetter,
  footer: FilingDocumentFooter,
): string {
  // The parent's own letter carries no vendor mark; the worksheet does.
  const mark =
    letter.kind === "worksheet"
      ? `<div class="fl-footer">${MARK_SVG}<span>Prepared with Homa for the ${escapeHtml(footer.familyName)} family, ${escapeHtml(footer.generatedOn)}</span></div>`
      : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 8.5in;
    font-family: "DM Sans", -apple-system, "Segoe UI", sans-serif;
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
  .fl-sheet {
    box-sizing: border-box;
    height: 100%;
    padding: 1in 1in 0.9in;
    font-size: 11.5px;
    line-height: 1.55;
  }
  .fl-h1 {
    margin: 0 0 14px;
    font-size: 17px;
    font-weight: 700;
    color: ${INK};
    letter-spacing: -0.01em;
  }
  .fl-date { margin: 0 0 20px; color: ${MUTED}; }
  .fl-para { margin: 0 0 13px; }
  .fl-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 7px;
  }
  .fl-label {
    flex: none;
    color: ${MUTED};
    font-size: 10.5px;
  }
  .fl-value { color: ${INK}; font-weight: 600; }
  .fl-address { margin: 0 0 2px; color: ${INK}; font-weight: 600; }
  /* A gap is a line to write on, sized to be writable in pen. */
  .fl-blank {
    flex: 1 1 auto;
    min-width: 1.6in;
    border-bottom: 1px solid ${LINE};
    height: 13px;
  }
  .fl-children {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0 16px;
    font-size: 11px;
  }
  .fl-children th {
    text-align: left;
    padding: 5px 8px 5px 0;
    border-bottom: 1px solid ${LINE};
    color: ${MUTED};
    font-size: 10px;
    font-weight: 600;
  }
  .fl-children td {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid ${HAIRLINE};
    color: ${INK};
    vertical-align: bottom;
  }
  .fl-children td .fl-blank { display: block; min-width: 0.9in; }
  .fl-assurances { margin: 0 0 14px; padding-left: 18px; }
  .fl-assurances li { margin: 0 0 5px; }
  .fl-carry {
    margin: 0 0 16px;
    padding: 11px 13px;
    border: 1px solid ${HAIRLINE};
    border-radius: 7px;
  }
  .fl-carry-head {
    margin: 0 0 9px;
    font-size: 10.5px;
    font-weight: 600;
    color: ${CLAY_DEEP};
  }
  .fl-carry .fl-line { margin-bottom: 9px; }
  .fl-carry .fl-line:last-child { margin-bottom: 0; }
  .fl-sign { margin-top: 34px; }
  .fl-sign-line {
    margin: 0;
    width: 3.2in;
    border-bottom: 1px solid ${LINE};
    height: 26px;
  }
  .fl-sign-label {
    margin: 3px 0 22px;
    font-size: 10px;
    color: ${MUTED};
  }
  .fl-attach {
    margin-top: 22px;
    padding-top: 13px;
    border-top: 1px solid ${HAIRLINE};
  }
  .fl-attach-head {
    margin: 0 0 7px;
    font-size: 10.5px;
    font-weight: 600;
    color: ${INK};
  }
  .fl-attach ul { margin: 0 0 7px; padding-left: 18px; font-size: 11px; }
  .fl-attach li { margin: 0 0 4px; }
  .fl-attach-note { margin: 0; font-size: 10px; color: ${MUTED}; }
  .fl-footer {
    position: absolute;
    bottom: 0.42in;
    left: 1in;
    right: 1in;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    color: ${SUBTLE};
  }
</style>
</head>
<body>
<div class="${SHEET_PAGE_CLASS}"><div class="fl-sheet">${letter.body}</div>${mark}</div>
</body>
</html>`;
}
