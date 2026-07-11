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
 */

export const SHEET_GATE_NOTE =
  "The page HTML was rejected. Remove every <script>, <iframe>, <object>, <embed> tag and javascript: URL, keep the text free of em dashes and deficit words (behind, delayed, disorder, diagnosis, screening, assessment, percentile), then call the tool again.";

const BLOCKED_MARKUP = /<\s*(script|iframe|object|embed)\b|javascript\s*:/i;

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

/** The footer's house mark, inlined as raw SVG (same art as the Logo). */
const FOOTER_MARK_SVG = `<svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true"><path d="${HOUSE_PATH}" fill="none" stroke="#8A7D6C" stroke-width="3.2" stroke-linejoin="round"/><circle cx="17.4" cy="26" r="2.7" fill="#8A7D6C"/><circle cx="30.6" cy="26" r="2.7" fill="#8A7D6C"/></svg>`;

/**
 * wrapPrintablePage(bodyHtml, footerFor): string
 * Full HTML document for one letter-size printable. The agent's HTML goes
 * in as-is (it brings its own <style> block and web-font <link>s); the
 * shell contributes the page box, a plain base so an unstyled sheet still
 * prints readably, and the fixed footer (position: fixed repeats it on
 * every page of a multi-page set).
 */
export function wrapPrintablePage(bodyHtml: string, footerFor: string): string {
  const madeFor = footerFor.trim();
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
  .homa-sheet-body {
    box-sizing: border-box;
    min-height: 11in;
    padding: 0.55in 0.6in 0.95in;
  }
  .homa-sheet-footer {
    position: fixed;
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
  <div class="homa-sheet-body">${bodyHtml}</div>
  <div class="homa-sheet-footer">${FOOTER_MARK_SVG}<span>made with Homa${madeFor ? ` for ${escapeHtml(madeFor)}` : ""}</span></div>
</body>
</html>`;
}

/**
 * wrapImagePage(imageUrl, footerFor): the image-direct creation path
 * (MS-2): one model-generated page image fitted onto the letter sheet,
 * D7 footer intact. `contain` keeps every pixel visible whatever shape
 * the model produced; portrait output at 1024x1536 fills the page.
 */
export function wrapImagePage(imageUrl: string, footerFor: string): string {
  const body = `<style>
  .homa-image-page { display: flex; align-items: flex-start; justify-content: center; height: 9.5in; }
  .homa-image-page img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
<div class="homa-image-page"><img src="${escapeHtml(imageUrl)}" alt="" /></div>`;
  return wrapPrintablePage(body, footerFor);
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
