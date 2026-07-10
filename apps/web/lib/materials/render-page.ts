import { existsSync } from "node:fs";

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

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
 * Frozen seam: renderPrintableHtml(html) -> { pdf, previewJpeg }. The
 * M0-03/M2-05 sandbox pipeline may replace the internals someday without
 * the tool contract moving.
 */

/** Letter at 96dpi. The preview doubles it via deviceScaleFactor. */
const LETTER_PX = { width: 816, height: 1056 } as const;
const RENDER_TIMEOUT_MS = 60_000;

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
  previewJpeg: Buffer;
}

/**
 * renderPrintableHtml(html): Promise<RenderedPrintable>
 * One complete HTML document in; a letter-size PDF plus a JPEG of page
 * one out (the JPEG is what MMS and the chat card show). Waits for
 * network quiet AND document.fonts.ready so web fonts and fal
 * illustrations are actually painted before capture.
 */
export async function renderPrintableHtml(html: string): Promise<RenderedPrintable> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...LETTER_PX, deviceScaleFactor: 2 });
    // "load" waits for subresources (illustrations, stylesheets); the two
    // evaluates below cover late font swaps and image decode, which is
    // everything a static page needs painted before capture.
    await page.setContent(html, {
      waitUntil: "load",
      timeout: RENDER_TIMEOUT_MS,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((image) => !image.complete)
          .map((image) => image.decode().catch(() => undefined)),
      ),
    );

    const previewJpeg = Buffer.from(
      await page.screenshot({
        type: "jpeg",
        quality: 85,
        clip: { x: 0, y: 0, ...LETTER_PX },
      }),
    );
    const pdf = Buffer.from(
      await page.pdf({
        format: "letter",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        timeout: RENDER_TIMEOUT_MS,
      }),
    );
    return { pdf, previewJpeg };
  } finally {
    await page.close().catch(() => {
      // A page that will not close is abandoned with its browser.
    });
  }
}
