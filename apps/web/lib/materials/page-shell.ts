import { BANNED_WORDS, EM_DASH } from "@homa/core";

import { HOUSE_PATH } from "../../components/brand/Logo";
import { escapeHtml } from "../html-escape";

/**
 * The printable page shell: the fixed contract around agent-composed
 * pages (the materials studio, FR-5). The agent owns everything inside
 * the sheet: layout, fonts, colors, images, or a single full-page image
 * the image model drew end to end (wrapImagePage). The shell owns what
 * must never drift: letter page setup, a safe interior area, and the D7
 * footer ("made with Homa for [child]", journeys/10 §5), added in code
 * so no composition can forget it. Pure functions, no browser imports:
 * render-page.ts feeds the wrapped document to Chromium.
 *
 * Pagination honesty (the Llanes packet incident, 2026-07-17): every
 * page is an exact 11in box that lays out identically on screen and in
 * print. What the preview screenshot shows page by page IS what the
 * printer produces, so the quality reviewer and the parent never again
 * see a "run-on" preview of a PDF that was actually fine, and content
 * that does not fit a page is visibly cut in the preview instead of
 * silently spilling onto a page nobody reviews.
 */

export const SHEET_GATE_NOTE =
  "The page HTML was rejected. Remove every <script>, <iframe>, <object>, <embed> tag and javascript: URL, keep the text free of em dashes and deficit words (behind, delayed, disorder, diagnosis, screening, assessment, percentile), then call the tool again.";

const BLOCKED_MARKUP = /<\s*(script|iframe|object|embed)\b|javascript\s*:/i;

/**
 * Page-break CSS inside ONE page's html is a signal the model is trying
 * to smuggle a whole packet through the single-page path, where pages
 * 2+ would be cut off by the exact-height page box. The tool refuses and
 * points at the pages input instead (create_printable owns the note).
 */
const PAGE_BREAK_MARKUP = /page-break-(?:after|before)|break-(?:after|before)\s*:\s*(?:page|always)/i;

export function hasPageBreakMarkup(html: string): boolean {
  return PAGE_BREAK_MARKUP.test(html);
}

/**
 * Models sometimes deliver the page wrapped in an XML CDATA section
 * (`<![CDATA[ ... ]]>`). Browsers parse the opening marker as a bogus
 * comment and drop it, but the closing `]]>` is plain text, so it printed
 * on real families' pages (found 2026-07-16 on finalized production
 * materials). Strip complete wrappers at intake; a lone `]]>` inside the
 * page is left alone because only the full pair is a wrapper.
 */
export function stripCdataWrapper(html: string): string {
  let result = html;
  for (;;) {
    const match = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(result);
    if (!match) return result;
    result = match[1];
  }
}

/** Tags stripped to expose the text a child or parent will actually read. */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * validatePrintableHtml(html, extraText): string | null
 * Returns a refusal reason for the model, or null when the sheet passes.
 * Two gates: no executable markup (the renderer draws pages, it never
 * runs the agent's code paths), and the brand laws on visible text.
 */
export function validatePrintableHtml(html: string, extraText: string): string | null {
  if (BLOCKED_MARKUP.test(html)) return SHEET_GATE_NOTE;
  const text = `${visibleText(html)} ${extraText}`;
  if (EM_DASH.test(text) || BANNED_WORDS.test(text)) return SHEET_GATE_NOTE;
  return null;
}

/**
 * The only hosts a printable may fetch a subresource from at render time.
 * Family art lives on Vercel Blob; the studio's fonts come from Google
 * Fonts (materials-studio SKILL.md). Everything else is refused so an
 * injected page cannot beacon family data out through an `<img>`, `<link>`,
 * `srcset`, CSS `url(...)`, or `@import` pointed at an attacker host.
 *
 * This list is the single source of truth; the real wall is the render-time
 * request interceptor in render-page.ts, which drops every off-list network
 * request regardless of how the URL was expressed. A static HTML scan cannot
 * be the wall (CSS and srcset hide URLs, and worksheet text legitimately
 * contains URLs), so enforcement lives at the network boundary, not here.
 */
const PRINTABLE_SUBRESOURCE_HOSTS = [
  "public.blob.vercel-storage.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
] as const;

/**
 * True when a subresource URL is safe for the renderer to fetch. `data:` and
 * `blob:` carry no network egress; `about:` covers the renderer's own blank
 * document; http(s) is allowed only for the exact hosts above (or their
 * subdomains). Anything unparseable or off-list is refused.
 */
export function isAllowedPrintableSubresourceUrl(rawUrl: string): boolean {
  if (/^(data|blob|about):/iu.test(rawUrl)) return true;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return PRINTABLE_SUBRESOURCE_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

/** The footer's house mark, inlined as raw SVG (same art as the Logo). */
const FOOTER_MARK_SVG = `<svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true"><path d="${HOUSE_PATH}" fill="none" stroke="#8A7D6C" stroke-width="3.2" stroke-linejoin="round"/><circle cx="17.4" cy="26" r="2.7" fill="#8A7D6C"/><circle cx="30.6" cy="26" r="2.7" fill="#8A7D6C"/></svg>`;

/**
 * How a multi-page material's pages live in the one `materials.html`
 * column (the revision and reuse seam): joined with this marker, split
 * back on read. The marker is an HTML comment so a stored packet body
 * still renders harmlessly anywhere the split is skipped.
 */
export const PAGE_HTML_DELIMITER = "<!-- homa:page-break -->";

export function joinPageBodies(pageBodies: readonly string[]): string {
  return pageBodies.join(`\n${PAGE_HTML_DELIMITER}\n`);
}

export function splitPageBodies(storedHtml: string): string[] {
  return storedHtml
    .split(PAGE_HTML_DELIMITER)
    .map((body) => body.trim())
    .filter((body) => body.length > 0);
}

/** The class render-page.ts uses to find and screenshot each page box. */
export const SHEET_PAGE_CLASS = "homa-sheet-page";

/**
 * wrapPrintableDocument(pageBodies, footerFor): string
 * Full HTML document for one letter-size printable of one or more pages.
 * Each page body goes into its own exact 11in page box (border-box, the
 * same 0.55/0.6/0.95in interior padding the single-page shell always
 * had), with the D7 footer positioned inside every box. The exact-height
 * box is what makes screen and print agree: on screen the boxes stack at
 * 11in intervals so per-page screenshots are true pages, and in print
 * each box fills exactly one sheet with a forced break after it.
 */
export function wrapPrintableDocument(
  pageBodies: readonly string[],
  footerFor: string,
): string {
  const madeFor = footerFor.trim();
  const footer = `<div class="homa-sheet-footer">${FOOTER_MARK_SVG}<span>made with Homa${madeFor ? ` for ${escapeHtml(madeFor)}` : ""}</span></div>`;
  const pages = pageBodies
    .map(
      (body) =>
        `<div class="${SHEET_PAGE_CLASS}"><div class="homa-sheet-body">${body}</div>${footer}</div>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 8.5in;
    font-family: -apple-system, "Segoe UI", sans-serif;
    color: #221e1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .homa-sheet-page {
    position: relative;
    box-sizing: border-box;
    width: 8.5in;
    height: 11in;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .homa-sheet-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .homa-sheet-body {
    box-sizing: border-box;
    height: 100%;
    padding: 0.55in 0.6in 0.95in;
  }
  .homa-sheet-footer {
    position: absolute;
    bottom: 0.32in;
    left: 0.6in;
    right: 0.6in;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 5px;
    font-size: 9.5px;
    color: #8a7d6c;
  }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}

/**
 * wrapPrintablePage(bodyHtml, footerFor): the one-page case, unchanged
 * contract for existing callers: the agent's HTML goes in as-is (it
 * brings its own <style> block and web-font <link>s) inside a single
 * page box.
 */
export function wrapPrintablePage(bodyHtml: string, footerFor: string): string {
  return wrapPrintableDocument([bodyHtml], footerFor);
}

/**
 * imagePageBody(imageUrl): the image-direct page body (MS-2): one
 * model-generated page image fitted into the printable area, `contain`
 * so every pixel stays visible whatever shape the model produced;
 * portrait output at 1024x1536 fills the page.
 */
export function imagePageBody(imageUrl: string): string {
  return `<style>
  .homa-image-page { display: flex; align-items: flex-start; justify-content: center; height: 9.5in; }
  .homa-image-page img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
<div class="homa-image-page"><img src="${escapeHtml(imageUrl)}" alt="" /></div>`;
}

/**
 * wrapImagePage(imageUrl, footerFor): the image-direct creation path,
 * one image page on the letter sheet, D7 footer intact.
 */
export function wrapImagePage(imageUrl: string, footerFor: string): string {
  return wrapPrintablePage(imagePageBody(imageUrl), footerFor);
}

/** Blob-path-safe slug from a sheet title ("Skye's Big O!" -> "skyes-big-o"). */
export function printableSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "worksheet";
}
