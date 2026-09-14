const importPuppeteer = () => import("puppeteer-core");
const importChromium = () => import("@sparticuz/chromium");

/** Text turns do not render printables. Literal imports preserve deployment
 * tracing while keeping the browser drivers out of ordinary agent startup. */
export async function loadPrintableBrowserDriver() {
  return (await importPuppeteer()).default;
}

export async function loadBundledPrintableChromium() {
  return (await importChromium()).default;
}
