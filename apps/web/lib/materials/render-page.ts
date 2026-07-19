import { existsSync } from "node:fs";

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

import { isAllowedPrintableSubresourceUrl, SHEET_PAGE_CLASS } from "./page-shell";

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
 * Multi-page honesty (the Llanes packet incident, 2026-07-17: a correct
 * 4-page PDF was reported broken because the only preview was a screen
 * screenshot of the first 11 inches): the shell renders each page as an
 * exact 11in box, and this module screenshots each box separately, so
 * the previews the parent and the quality reviewer see are the same
 * pages the printer produces.
 */

/** Letter at 96dpi. The preview doubles it via deviceScaleFactor. */
const LETTER_PX = { width: 816, height: 1056 } as const;
const RENDER_TIMEOUT_MS = 60_000;

/** Per-page previews are capped; the PDF always carries every page. */
export const PREVIEW_PAGE_CAP = 6;

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

export interface RenderedPrintable {
  pdf: Buffer;
  /** Page one, what MMS and the chat card lead with. */
  previewJpeg: Buffer;
  /** One JPEG per page, in order, capped at PREVIEW_PAGE_CAP. */
  pageJpegs: Buffer[];
  /** True page count, from the shell's page boxes (uncapped). */
  pageCount: number;
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
  return isAllowedPrintableSubresourceUrl(url);
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
): Promise<RenderedPrintable> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...LETTER_PX, deviceScaleFactor: 2 });

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
      const allowed = isPrintableRequestAllowed(
        request.resourceType(),
        url,
        policy,
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

    // Page boxes stack at exact 11in intervals on screen (the shell's
    // contract), so page N's true preview is the clip at N * 11in. A
    // document without shell page boxes (a legacy caller) is one page.
    const pageCount = Math.max(
      1,
      await page.evaluate(
        (pageClass) => document.querySelectorAll(`.${pageClass}`).length,
        SHEET_PAGE_CLASS,
      ),
    );
    const pageJpegs: Buffer[] = [];
    for (let index = 0; index < Math.min(pageCount, PREVIEW_PAGE_CAP); index += 1) {
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
    const pdf = Buffer.from(
      await page.pdf({
        format: "letter",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        timeout: RENDER_TIMEOUT_MS,
      }),
    );
    return { pdf, previewJpeg: pageJpegs[0], pageJpegs, pageCount };
  } finally {
    await page.close().catch(() => {
      // A page that will not close is abandoned with its browser.
    });
  }
}
