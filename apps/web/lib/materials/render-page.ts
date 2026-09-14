import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import type { Browser, Page } from "puppeteer-core";

import { resolveEvalBlobStore } from "./eval-blob-store";
import { loadBundledPrintableChromium, loadPrintableBrowserDriver } from "./printable-browser-loader";
import {
  isAllowedPrintableSubresourceUrl,
  SHEET_BODY_CLASS,
  SHEET_PAGE_CLASS,
  wrapPrintableDocument,
} from "./page-shell";
import {
  type PageGeometry,
  summarizePageGeometry,
  type SheetBodyMeasurement,
} from "./page-geometry";
import { rasterizePdfToJpegs } from "./rasterize-pdf";
import { REVIEW_MAX_PAGES } from "./review-artifact";

import { verifyLegacyHandwritingLayout } from "./handwriting/legacy";
import type { HandwritingRevisionPlan, LegacyComparisonProof } from "./handwriting/revision";

import { HandwritingDocumentError, type HandwritingExpectation } from "./handwriting/document";
import { verifyHandwritingLayout, verifyHandwritingPdfPages, type HandwritingPlacement } from "./handwriting/verify-render";

/**
 * HTML to print artifacts, in the app runtime (the materials studio's
 * rendering seam; D-print-4 contract from the send-to-printer plan).
 * Headless Chromium renders the agent-composed page exactly the way a
 * browser would, which is what buys the studio its freedom: any CSS, any
 * web font, any illustration URL, no fixed template. Deployed it runs
 * @sparticuz/chromium inside the Vercel function; locally it drives the
 * developer's own Chrome (CHROME_EXECUTABLE_PATH overrides discovery).
 *
 * The browser instance is cached module-level: Fluid Compute reuses the
 * function instance, so warm renders skip the ~2s boot. Every render gets
 * a fresh page and closes it; a crashed browser is relaunched once.
 *
 * Frozen seam: renderPrintableHtml(html) -> { pdf, previewJpeg,
 * pageJpegs, pageCount }. The M0-03/M2-05 sandbox pipeline may replace
 * the internals someday without the tool contract moving.
 *
 * Preview honesty, two incidents deep. Multi-page (the Llanes packet,
 * 2026-07-17: a correct 4-page PDF was reported broken because the only
 * preview was a screen screenshot of the first 11 inches): every page
 * gets its own preview. Screen-vs-print divergence (the sprite-slicing
 * worksheet, 2026-07-19: screen screenshots looked perfect, the vision
 * QC approved them, and the shipped PDF was broken, because Chromium's
 * screen renderer and print engine disagree on CSS like background-size
 * 400% sprite slicing): previews are now rasterized FROM the generated
 * PDF bytes (rasterize-pdf.ts), so the reviewer and the chat card judge
 * the shipped bytes, not a lookalike page. Screenshots remain only as a
 * loudly-logged last-resort fallback, taken under print media emulation.
 * One honest limit: pdf.js reads a PDF the way Chromium does, and the
 * 2026-07-19 sprite PDF proved viewers can disagree about the same bytes
 * (pdf.js drew it fine, Quartz drew blank cells). Constructs known to
 * render viewer-dependently are therefore refused before rendering
 * (hasSpriteSliceMarkup in page-shell.ts) instead of trusted to review.
 */

/** Letter at 96dpi: the render viewport, and the clip grid for the
 * fallback screenshots (which double it via deviceScaleFactor). */
const LETTER_PX = { width: 816, height: 1056 } as const;
const RENDER_TIMEOUT_MS = 60_000;

/** Per-page previews stored for the parent are capped; the PDF always
 * carries every page. */
export const PREVIEW_PAGE_CAP = 6;

/**
 * How many pages are rasterized at all. Higher than PREVIEW_PAGE_CAP on
 * purpose: the reviewer needs pixels for every page, and until gh#368
 * pages 7 and later were never drawn, so nothing (not the reviewer, not
 * the parent, not a screenshot) had ever seen them. Rasterizing is
 * in-process pdf.js work, so the extra pages cost render time rather
 * than storage or model spend, and only the first PREVIEW_PAGE_CAP are
 * uploaded and kept.
 */
export const RASTER_PAGE_CAP = REVIEW_MAX_PAGES;

const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
];

export class RendererUnavailableError extends Error {
  constructor() {
    super(
      "No Chrome executable is available to render pages here. Set CHROME_EXECUTABLE_PATH locally; deployed runtimes bundle their own.",
    );
    this.name = "RendererUnavailableError";
  }
}

async function launchBrowser(): Promise<Browser> {
  // Vercel (and any Lambda-shaped runtime) gets the bundled binary.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const [puppeteer, chromium] = await Promise.all([
      loadPrintableBrowserDriver(),
      loadBundledPrintableChromium(),
    ]);
    // Worksheets never need WebGL; skipping the graphics stack trims boot.
    chromium.setGraphicsMode = false;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const localPath =
    process.env.CHROME_EXECUTABLE_PATH ??
    LOCAL_CHROME_PATHS.find((path) => existsSync(path));
  if (!localPath) throw new RendererUnavailableError();
  const puppeteer = await loadPrintableBrowserDriver();
  return puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
  });
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const cached = await browserPromise;
      if (cached.connected) return cached;
    } catch {
      // Fall through to a fresh launch.
    }
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

/**
 * Closes the cached browser. Test and script harnesses call this so the
 * process can exit; the deployed function lets the cached instance die
 * with its sandbox instead.
 */
export async function closePrintableRenderer(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // A browser that failed to launch has nothing to close.
  }
}

export interface RenderedPrintable {
  pdf: Buffer;
  /** Page one, what MMS and the chat card lead with. */
  previewJpeg: Buffer;
  /** One JPEG per page rasterized from the pdf bytes, in order, capped
   * at RASTER_PAGE_CAP. Every one of these reaches the reviewer; only
   * the first PREVIEW_PAGE_CAP are uploaded and shown to the parent, so
   * a caller that persists these must slice. */
  pageJpegs: Buffer[];
  /** True page count of the pdf itself (uncapped). */
  pageCount: number;
  /** Which path produced pageJpegs. "pdfjs-raster" rasterizes the shipped
   * pdf, so the image and the pdf agree; "screenshot-fallback" re-renders
   * the page in the browser and its own log warns the previews may not
   * match. Recorded because a pair built from fallback previews is weaker
   * evidence than one built from the pdf (gh#328 render-pair archiver). */
  renderer: "pdfjs-raster" | "screenshot-fallback";
  /** The browser that drew the pdf, when the driver reports one. */
  rendererVersion: string | null;
  /** Deterministic per-page fill/overflow facts (gh#349), one entry per
   * .homa-sheet-body, covering every page regardless of PREVIEW_PAGE_CAP
   * (this is DOM measurement, not rasterization, so it is never capped). */
  pageGeometry: PageGeometry[];
  ordinaryHandwritingGeometry?: PageGeometry[];
  handwriting?: { placements: HandwritingPlacement[]; pdfSha256: string; pageCount: number; pageWidthPoints: number; pageHeightPoints: number; status: "verified" };
}

export interface PrintableRenderPolicy {
  blockImageResources: boolean;
  blockNavigationRequests: boolean;
}

export const SUBJECT_LESSON_RENDER_POLICY: PrintableRenderPolicy = {
  blockImageResources: true,
  blockNavigationRequests: true,
};

export function isPrintableRequestAllowed(
  resourceType: string,
  url: string,
  policy?: PrintableRenderPolicy,
  isNavigationRequest = false,
): boolean {
  if (policy?.blockNavigationRequests) {
    if (resourceType === "document" && url === "about:blank") return true;
    if (isNavigationRequest) return false;
    if (resourceType === "document") return false;
  }
  if (resourceType === "document") return true;
  if (policy?.blockImageResources && resourceType === "image") return false;
  // Sandboxed eval runs only: this run's own generated images live in the
  // loopback blob store, and without this branch the wall silently strips
  // them from every sandbox PDF (found 2026-07-25, the first eval run in
  // which family tools worked end to end). resolveEvalBlobStore is non-null
  // only while eval isolation is active (never on Vercel), and only the
  // exact sandbox origin passes, so the production wall is unchanged.
  const evalBlobStore = resolveEvalBlobStore(process.env);
  if (evalBlobStore && url.startsWith(`${evalBlobStore.baseUrl}/`)) return true;
  return isAllowedPrintableSubresourceUrl(url);
}

/**
 * Last-resort previews when PDF rasterization is unavailable: per-page
 * screenshots under print media emulation. Page boxes stack at exact
 * 11in intervals on screen (the shell's contract), so page N is the
 * clip at N * 11in; a document without shell page boxes (a legacy
 * caller) is one page. Still the screen renderer underneath, so these
 * are NOT proof of the shipped PDF; the caller logs when it lands here.
 */
async function screenshotPagesPrintEmulated(
  page: Page,
): Promise<{ pageJpegs: Buffer[]; pageCount: number }> {
  await page.emulateMediaType("print");
  const pageCount = Math.max(
    1,
    await page.evaluate(
      (pageClass) => document.querySelectorAll(`.${pageClass}`).length,
      SHEET_PAGE_CLASS,
    ),
  );
  const pageJpegs: Buffer[] = [];
  for (let index = 0; index < Math.min(pageCount, RASTER_PAGE_CAP); index += 1) {
    pageJpegs.push(
      Buffer.from(
        await page.screenshot({
          type: "jpeg",
          quality: 85,
          clip: { x: 0, y: index * LETTER_PX.height, ...LETTER_PX },
        }),
      ),
    );
  }
  return { pageJpegs, pageCount };
}

/**
 * measureSheetGeometry(page): one raw measurement per .homa-sheet-body,
 * taken while Chromium still holds the laid-out document (gh#349, the
 * composer authoring blind into an exact-height box is the F1 root
 * cause). Deliberately not scrollHeight/clientHeight: with box-sizing:
 * border-box and an explicit height, both report the BORDER-BOX height
 * (padding included) whether or not the content fills it, so neither can
 * tell a full page from an empty one.
 *
 * It measures INK, not boxes, and that distinction is the whole point.
 * The first version walked every descendant and took the lowest bottom
 * edge, which any full-height layout wrapper defeats: one
 * `height: 100%` flex column around eight division problems reported
 * 100% fill on a three-quarters-empty page, and because the reviewer is
 * told to trust these numbers over the image (review-artifact.ts), the
 * instrument suppressed a correct vision read of exactly the defect it
 * exists to catch. Path 2 was worse: `.homa-image-page` is itself 9.5in
 * tall (page-shell.ts), so every whole-page image measured 100% by
 * construction no matter how letterboxed the art was.
 *
 * So a box counts only where it actually puts something on the paper:
 * text runs measured through a Range, replaced elements (art, rules,
 * form fields), and boxes that paint a background, a border, or a
 * shadow. A bare layout container paints nothing and is skipped, while
 * a bordered card that genuinely stretches still counts, because its
 * bottom border really does print there.
 *
 * Runs under whatever media type the page is currently painting (screen,
 * same as setContent left it): a known limit shared with the rest of
 * this module's screen-vs-print divergence, named rather than hidden.
 *
 * The same two walks also take the size-floor signals (size-floor.ts,
 * 2026-09-02): the largest drawn picture, the largest font size, and the
 * largest bordered box on the page, so a later revision that quietly
 * shrinks what the child traces can be caught by a number instead of by
 * a parent. An IMG is measured at its DRAWN box, not its layout box:
 * imagePageBody (page-shell.ts) uses object-fit: contain, so a
 * letterboxed page image's layout rect overstates what is on the paper.
 */
export interface HandwritingSizeExclusion { page: number; legacySvgOrdinal?: number; guidedRowId?: string; }

async function measureSheetGeometry(page: Page, exclusions: readonly HandwritingSizeExclusion[] = []): Promise<SheetBodyMeasurement[]> {
  return page.evaluate(
    (bodyClass: string, pageClass: string, omitted: readonly HandwritingSizeExclusion[]): SheetBodyMeasurement[] => {
      // Everything below is written without inner helper functions on
      // purpose: this callback is serialized into the browser, and any
      // bundler running with keepNames (esbuild under tsx, which the
      // eval and preview scripts use) rewrites a named inner function
      // into a `__name(...)` call that does not exist in page scope.
      // The renderer then throws "__name is not defined" for every
      // material, which is a whole-capability outage on those paths.
      const REPLACED_TAGS = [
        "IMG",
        "SVG",
        "CANVAS",
        "VIDEO",
        "HR",
        "INPUT",
        "TEXTAREA",
        "SELECT",
      ];
      const TRANSPARENT = /^rgba\([^)]*,\s*0(\.0+)?\)$/;
      const SIDES = ["top", "right", "bottom", "left"];
      const bodies = Array.from(document.querySelectorAll(`.${bodyClass}`));
      return bodies.map((body, pageIndex) => {
        const excluded = omitted.filter((item) => item.page === pageIndex + 1).map((item) => item.legacySvgOrdinal ? body.querySelectorAll("svg")[item.legacySvgOrdinal - 1] : Array.from(body.querySelectorAll("[data-homa-handwriting-row]")).find((element) => element.getAttribute("data-homa-handwriting-row") === item.guidedRowId));
        if (excluded.some((element) => !element)) throw new Error("Exact handwriting measurement exclusion is missing.");
        const bodyRect = body.getBoundingClientRect();
        const style = getComputedStyle(body);
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const usablePx = bodyRect.height - paddingTop - paddingBottom;
        const contentTop = bodyRect.top + paddingTop;
        let maxBottom = contentTop;
        let largestTextPx = 0;
        let largestImageArea = 0;
        let largestImagePx: { width: number; height: number } | null = null;
        let largestBoxArea = 0;
        let largestBoxPx: { width: number; height: number } | null = null;
        // The size-floor signals are guarded separately from the fill
        // measurement they ride inside: an exception in them must never
        // turn into "Rendering hiccuped" for the whole page. It nulls the
        // signals and marks the page instead (measurementError).
        let signalError = false;
        const textWalker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
          if (!node.nodeValue || node.nodeValue.trim() === "") continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          let inked = false;
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width > 0 || rect.height > 0) {
              maxBottom = Math.max(maxBottom, rect.bottom);
              inked = true;
            }
          }
          if (inked && node.parentElement && !excluded.some((element) => element?.contains(node))) {
            try {
              const fontSize =
                Number.parseFloat(getComputedStyle(node.parentElement).fontSize) || 0;
              if (fontSize > largestTextPx) largestTextPx = fontSize;
            } catch {
              signalError = true;
            }
          }
        }
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const element = node as Element;
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 && rect.height <= 0) continue;
          try {
            // Inline svg keeps its lowercase tag name (SVG namespace), so
            // the picture check compares case-insensitively.
            const tag = element.tagName.toUpperCase();
            if (excluded.some((item) => item?.contains(element))) {
              // Keep its fill/overflow contribution, omit only size signals.
            } else if (tag === "IMG") {
              const image = element as HTMLImageElement;
              const naturalWidth = image.naturalWidth;
              const naturalHeight = image.naturalHeight;
              const drawnWidth =
                naturalHeight > 0
                  ? Math.min(rect.width, (rect.height * naturalWidth) / naturalHeight)
                  : rect.width;
              const drawnHeight =
                naturalWidth > 0
                  ? Math.min(rect.height, (rect.width * naturalHeight) / naturalWidth)
                  : rect.height;
              const area = drawnWidth * drawnHeight;
              if (area > largestImageArea) {
                largestImageArea = area;
                largestImagePx = { width: drawnWidth, height: drawnHeight };
              }
            } else if (tag === "SVG" || tag === "CANVAS") {
              const area = rect.width * rect.height;
              if (area > largestImageArea) {
                largestImageArea = area;
                largestImagePx = { width: rect.width, height: rect.height };
              }
            }
          } catch {
            signalError = true;
          }
          let paints = REPLACED_TAGS.indexOf(element.tagName.toUpperCase()) !== -1;
          let bordered = false;
          // The paint and border walk is inside the same guard as the
          // other signals: an exception here marks the page instead of
          // failing the render, and the element is then treated as
          // non-painting for the fill measurement (which is what an
          // unreadable style is).
          try {
            if (!paints) {
              const elementStyle = getComputedStyle(element);
              if (elementStyle.visibility !== "hidden") {
                const background = elementStyle.backgroundColor;
                paints =
                  elementStyle.backgroundImage !== "none" ||
                  elementStyle.boxShadow !== "none" ||
                  (background !== "" &&
                    background !== "transparent" &&
                    !TRANSPARENT.test(background));
                // The border walk runs even when the background already
                // paints: a white card with a dashed cut line is still a
                // bordered box for the size floor.
                for (let index = 0; !bordered && index < SIDES.length; index += 1) {
                  const side = SIDES[index];
                  const width =
                    Number.parseFloat(
                      elementStyle.getPropertyValue(`border-${side}-width`),
                    ) || 0;
                  const lineStyle = elementStyle.getPropertyValue(
                    `border-${side}-style`,
                  );
                  const color = elementStyle.getPropertyValue(
                    `border-${side}-color`,
                  );
                  bordered =
                    width > 0 &&
                    lineStyle !== "none" &&
                    lineStyle !== "hidden" &&
                    color !== "transparent" &&
                    !TRANSPARENT.test(color);
                }
                paints = paints || bordered;
              }
            }
            if (bordered && !excluded.some((item) => item?.contains(element))) {
              const area = rect.width * rect.height;
              if (area > largestBoxArea) {
                largestBoxArea = area;
                largestBoxPx = { width: rect.width, height: rect.height };
              }
            }
          } catch {
            signalError = true;
          }
          if (!paints) continue;
          maxBottom = Math.max(maxBottom, rect.bottom);
        }
        // Overflow is measured against the PAGE box's bottom edge (the
        // 11in box that actually clips in print via overflow: hidden),
        // never against this element's own padded interior: content can
        // legitimately run into the body's bottom padding band without
        // being cut, so comparing there would false-flag a fitting page.
        const pageEl = body.closest(`.${pageClass}`);
        const pageBottom = pageEl
          ? pageEl.getBoundingClientRect().bottom
          : bodyRect.bottom;
        return {
          contentPx: maxBottom - contentTop,
          usablePx,
          overflowPx: Math.max(0, maxBottom - pageBottom),
          largestImagePx: signalError ? null : largestImagePx,
          largestTextPx: !signalError && largestTextPx > 0 ? largestTextPx : null,
          largestBoxPx: signalError ? null : largestBoxPx,
          ...(signalError ? { measurementError: true } : {}),
        };
      });
    },
    SHEET_BODY_CLASS,
    SHEET_PAGE_CLASS,
    [...exclusions],
  );
}

/**
 * renderPrintableHtml(html): Promise<RenderedPrintable>
 * One complete HTML document in; a letter-size PDF plus a JPEG per page
 * out. Waits for network quiet AND document.fonts.ready so web fonts and
 * illustrations are actually painted before capture.
 */
export async function renderPrintableHtml(
  html: string,
  policy?: PrintableRenderPolicy,
  handwriting: readonly HandwritingExpectation[] = [],
  sizeExclusions: readonly HandwritingSizeExclusion[] = [],
): Promise<RenderedPrintable> {
  if (!handwriting.length && /data-homa-handwriting-row\b/i.test(html)) {
    throw new HandwritingDocumentError("Guided handwriting needs its stored server receipts before rerendering. Use the verified individual PDFs when a combined pack cannot carry those receipts.");
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...LETTER_PX, deviceScaleFactor: 2 });
    if (handwriting.length) {
      // Guided rows need a stable print document. Executable or animated
      // mixed packets are refused by verification, never silently rewritten.
      await page.setJavaScriptEnabled(false);
      await page.emulateMediaType("print");
    }
    const composedImages = new Set(handwriting.map((row) => row.src));

    // The egress wall (F11 / render-path exfiltration). The page HTML is
    // model-authored, so an injected model could point an <img>/<link>/CSS
    // url() at an attacker host and beacon family data out at render time,
    // from inside the trusted app runtime. Intercept every request and drop
    // anything off the printable subresource allowlist. This is the real
    // boundary: it catches the request however the URL was expressed, where
    // a static HTML scan cannot. A blocked host is logged (never the URL's
    // query, which could carry the exfiltrated data) as a security signal.
    const blockedHosts = new Set<string>();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const allowed = (request.resourceType() === "image" && composedImages.has(url)) || isPrintableRequestAllowed(
        request.resourceType(),
        url,
        handwriting.length ? { blockImageResources: policy?.blockImageResources ?? false, blockNavigationRequests: true } : policy,
        request.isNavigationRequest(),
      );
      if (allowed) {
        request.continue().catch(() => {
          // Race: the request was already handled or the page is closing.
        });
        return;
      }
      try {
        blockedHosts.add(new URL(url).hostname.toLowerCase());
      } catch {
        blockedHosts.add("(unparseable)");
      }
      request.abort().catch(() => {
        // Same race; aborting a settled request is a no-op we can ignore.
      });
    });

    // "load" waits for subresources (illustrations, stylesheets); the two
    // evaluates below cover late font swaps and image decode, which is
    // everything a static page needs painted before capture.
    await page.setContent(html, {
      waitUntil: "load",
      timeout: RENDER_TIMEOUT_MS,
    });
    if (blockedHosts.size > 0) {
      console.warn(
        `printable render blocked off-allowlist subresource hosts: ${[...blockedHosts].join(", ")}`,
      );
    }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((image) => !image.complete)
          .map((image) => image.decode().catch(() => undefined)),
      ),
    );

    // Measured while the document is laid out and settled, same moment
    // the fallback screenshots would capture it: geometry facts about
    // pages the model composed blind, fed back so it stops guessing.
    const handwritingPlacements = handwriting.length ? await verifyHandwritingLayout(page, handwriting) : [];
    const pageGeometry = summarizePageGeometry(await measureSheetGeometry(page));
    const ordinaryHandwritingGeometry = sizeExclusions.length ? summarizePageGeometry(await measureSheetGeometry(page, sizeExclusions)) : undefined;

    const pdf = Buffer.from(
      await page.pdf({
        format: "letter",
        scale: 1,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        timeout: RENDER_TIMEOUT_MS,
      }),
    );

    const handwritingPdf = handwriting.length
      ? await verifyHandwritingPdfPages(pdf, pageGeometry.length)
      : null;

    // The previews the reviewer and the parent see come from the PDF
    // bytes themselves, never from the live page: Chromium's screen and
    // print renderers diverge on real CSS, and the QC must judge the
    // artifact that ships (the sprite worksheet, 2026-07-19). The
    // screenshot fallback exists only so a broken raster runtime does
    // not take material creation down with it; it emulates print media
    // to stay as close to the shipped PDF as a screenshot can get, and
    // it logs loudly because previews are no longer proof of the PDF.
    let pageJpegs: Buffer[];
    let pageCount: number;
    let renderer: RenderedPrintable["renderer"] = "pdfjs-raster";
    try {
      ({ pageJpegs, pageCount } = await rasterizePdfToJpegs(
        pdf,
        RASTER_PAGE_CAP,
      ));
      if (pageJpegs.length === 0) {
        throw new Error("PDF rasterization produced zero pages");
      }
    } catch (error) {
      if (handwriting.length) throw new HandwritingDocumentError("The printed handwriting could not be checked from its PDF. Nothing was created.");
      console.error(
        "printable preview raster failed; falling back to print-emulated screenshots (previews may not match the shipped PDF):",
        error instanceof Error ? error.message : "unknown",
      );
      ({ pageJpegs, pageCount } = await screenshotPagesPrintEmulated(page));
      renderer = "screenshot-fallback";
    }
    const rendererVersion = await browser.version().catch(() => null);
    return {
      pdf,
      previewJpeg: pageJpegs[0],
      pageJpegs,
      pageCount,
      renderer,
      rendererVersion,
      pageGeometry,
      ...(ordinaryHandwritingGeometry ? { ordinaryHandwritingGeometry } : {}),
      ...(handwritingPdf ? { handwriting: { ...handwritingPdf, placements: handwritingPlacements, pdfSha256: createHash("sha256").update(pdf).digest("hex") } } : {}),
    };
  } finally {
    await page.close().catch(() => {
      // A page that will not close is abandoned with its browser.
    });
  }
}

/** A bounded no-network replay of the exact saved source, solely for a
 * declared legacy guide conversion. Never a substitute for original PDF ink. */
export async function inspectLegacyHandwriting(plan: HandwritingRevisionPlan): Promise<LegacyComparisonProof> {
  if (!plan.legacyTargets.length || plan.legacyTargets.length > 24) throw new HandwritingDocumentError("Select a bounded set of exact legacy rows.");
  const browser = await getBrowser();
  const page = await browser.newPage();
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); void page.close().catch(() => undefined); }, 15_000);
  let blocked = false;
  try {
    await page.setViewport({ ...LETTER_PX, deviceScaleFactor: 2 });
    await page.setJavaScriptEnabled(false);
    await page.emulateMediaType("print");
    await page.setOfflineMode(true);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:") || request.url() === "about:blank") void request.continue().catch(() => undefined);
      else { blocked = true; void request.abort().catch(() => undefined); }
    });
    await page.setContent(wrapPrintableDocument(plan.sourceBodies, ""), { waitUntil: "load", timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    const rows = await verifyLegacyHandwritingLayout(page, plan.legacyTargets);
    const originalGeometry = summarizePageGeometry(await measureSheetGeometry(page));
    const ordinaryGeometry = summarizePageGeometry(await measureSheetGeometry(page, plan.legacyTargets.map((row) => ({ page: row.page, legacySvgOrdinal: row.svgOrdinal }))));
    if (blocked || controller.signal.aborted) throw new HandwritingDocumentError("The old page needs unsaved network resources or its comparison expired.");
    return { sourceHtmlSha256: plan.sourceHtmlSha256, rows, originalGeometry, ordinaryGeometry };
  } catch (error) {
    if (error instanceof HandwritingDocumentError) throw error;
    throw new HandwritingDocumentError("The exact old page could not be inspected within the bounded offline comparison. No size exception was made.", { cause: error });
  } finally { clearTimeout(timeout); await page.close().catch(() => undefined); }
}
