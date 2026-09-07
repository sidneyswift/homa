import { accessSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";

import { createHoursExportGet } from "../app/api/hours/export/route";
import { HoursRecordChildNotFound, type HoursExportRecord } from "../lib/hours-export";
import { ALL_HOURS_RECORDS, matchesHoursRecordScope } from "../lib/hours-record-scope";

// Real component, CSV/preview route and arithmetic. Only authentication and the
// storage boundary use an in-memory family; PostgreSQL has its own contract.
const fixtureRequire = createRequire(resolve(process.cwd(), "package.json"));
const esbuild = fixtureRequire(fixtureRequire.resolve("esbuild", { paths: [fixtureRequire.resolve("tsx")] }));
const postcss = fixtureRequire(fixtureRequire.resolve("postcss", { paths: [fixtureRequire.resolve("@tailwindcss/postcss")] }));
const tailwind = fixtureRequire("@tailwindcss/postcss");
const childA = "a0000000-0000-4000-8000-000000000001";
const childB = "a0000000-0000-4000-8000-000000000002";
const baseline: HoursExportRecord = {
  children: [{ id: childA, name: "Avery" }, { id: childB, name: "Alexandria Clementine Montgomery-Swift" }],
  rows: [
    { id: "old", childId: childA, childName: "Avery", happenedOn: "2026-08-31", subject: "math", minutes: 60, source: "chat", customLabel: null, note: null },
    { id: "a", childId: childA, childName: "Avery", happenedOn: "2026-09-01", subject: "reading", minutes: 20, source: "chat", customLabel: "Narnia", note: 'Chapter "one" 📖' },
    { id: "b", childId: childB, childName: "Alexandria Clementine Montgomery-Swift", happenedOn: "2026-09-01", subject: "math", minutes: 30, source: "chat", customLabel: null, note: "=SUM(A1:A2)" },
    { id: "shared", childId: null, childName: null, happenedOn: "2026-09-06", subject: "art", minutes: 10, source: "chat", customLabel: null, note: "Family project" },
    { id: "future", childId: childA, childName: "Avery", happenedOn: "2026-09-07", subject: "science", minutes: 90, source: "chat", customLabel: null, note: null },
  ],
};
let record: HoursExportRecord;
let mode: "success" | "failure" | "pending";
let release: (() => void) | undefined;
let requests: string[];
let server: Server;
let browser: Browser;
let origin: string;
const screenshots = process.env.HOURS_RECORD_EVIDENCE_DIR;
const dmSansFont = process.env.HOURS_RECORD_DM_SANS_FONT;
const handler = createHoursExportGet({
  resolveActor: async () => ({ family: { id: "11111111-1111-4111-8111-111111111111" }, memberUserId: "fixture-member" }) as never,
  getRecord: async (_familyId, scope = ALL_HOURS_RECORDS) => {
    if (mode === "failure") throw new Error("Synthetic read failure");
    if (mode === "pending") await new Promise<void>((done) => { release = done; });
    if (scope.childId !== null && !record.children.some((child) => child.id === scope.childId)) throw new HoursRecordChildNotFound();
    return { children: record.children, rows: record.rows.filter((row) => matchesHoursRecordScope(row, scope)) };
  },
});

test.beforeAll(async () => {
  if (screenshots) mkdirSync(screenshots, { recursive: true });
  const bundle = await esbuild.build({ entryPoints: [resolve("e2e/fixtures/hours-record-export.tsx")], bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "synthetic-next-link", setup(build: {
      onResolve: (options: { filter: RegExp }, callback: () => unknown) => void;
      onLoad: (options: { filter: RegExp; namespace: string }, callback: () => unknown) => void;
    }) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "import React from 'react'; export default function Link({href,children,prefetch,...props}){return <a {...props} href={href}>{children}</a>}", loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  if (screenshots) writeFileSync(resolve(screenshots, "fixture.js"), bundle.outputFiles[0].text);
  const css = await postcss([tailwind({ base: process.cwd() })]).process(readFileSync("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
  server = createServer(async (request, response) => {
    if (request.url?.startsWith("/api/hours/export")) {
      requests.push(request.url);
      const result = await handler(new Request(origin + request.url));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } else if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); }
    else if (request.url === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css.css + "\n@font-face{font-family:'DM Sans';font-weight:400 700;src:url('/dm-font')}@font-face{font-family:'EB Garamond';src:url('/garamond.ttf');font-weight:600}:root{--font-dm-sans:'DM Sans';--font-eb-garamond:'EB Garamond'}body{margin:0}"); }
    else if (request.url === "/dm-font" || request.url === "/garamond.ttf") { response.setHeader("Content-Type", "application/octet-stream"); response.end(readFileSync(request.url === "/dm-font" && dmSansFont ? dmSansFont : resolve("assets/fonts/quiet-authority", request.url === "/dm-font" ? "dm-sans-700-latin.ttf" : "eb-garamond-600-latin.ttf"))); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hours record fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture failed to bind");
  origin = `http://127.0.0.1:${address.port}`;
});
test.beforeEach(async () => {
  record = structuredClone(baseline); mode = "success"; requests = []; release = undefined;
  let executablePath: string | undefined;
  for (const candidate of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]) {
    try { accessSync(candidate); executablePath = candidate; break; } catch { /* Try the next installed browser. */ }
  }
  browser = await chromium.launch({ executablePath: executablePath ?? await serverlessChromium.executablePath(), args: executablePath ? [] : serverlessChromium.args, headless: true });
});
test.afterEach(async () => { release?.(); await browser?.close(); });
test.afterAll(async () => { if (server) await new Promise<void>((done) => server.close(() => done())); });

async function open(width: number, child: string | null = null, duplicate = false) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, acceptDownloads: true });
  page.on("pageerror", (error) => console.error("Hours record fixture page error:", error.message));
  const params = new URLSearchParams();
  if (child) params.set("child", child);
  if (duplicate) params.set("duplicate", "true");
  await page.goto(`${origin}/?${params}`);
  await page.locator("summary").filter({ hasText: /^Download records$/u }).click();
  return page;
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const file = await pending;
  const path = await file.path();
  expect(path).not.toBeNull();
  return { name: file.suggestedFilename(), text: readFileSync(path!, "utf8") };
}

for (const width of [320, 390, 1280]) {
  test(`${width}px: selected child, inclusive dates, preview and both actual downloaded artifacts agree`, async () => {
    const page = await open(width, childA);
    await expect(page.getByRole("combobox", { name: "For", exact: true })).toHaveValue(childA);
    await page.getByRole("button", { name: "Preview record", exact: true }).click();
    const preview = page.getByRole("region", { name: "Record preview" });
    await expect(preview).toContainText("2 entries · 30m saved time");
    await expect(preview).toContainText("Avery: 2 recorded learning days · 30m");
    await expect(preview).not.toContainText("Alexandria");
    await expect(preview).toContainText("A blank day does not mean absence");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `1095-${width}-child-preview.png`), fullPage: true });
    const entries = await download(page, "Download time entries");
    expect(entries.name).toBe("homa-school-hours.csv");
    expect(entries.text.trimEnd().split("\r\n")).toHaveLength(3);
    expect(entries.text).toContain('"Language arts","Narnia","20"');
    expect(entries.text).toContain('Chapter ""one"" 📖');
    expect(entries.text).not.toContain('"old"');
    expect(entries.text).not.toContain('"future"');
    expect(entries.text).not.toContain(childB);
    const days = await download(page, "Download recorded days");
    expect(days.name).toBe("homa-recorded-learning-days.csv");
    expect(days.text.trimEnd().split("\r\n")).toHaveLength(3);
    expect(days.text.match(new RegExp(childA, "gu"))).toHaveLength(2);
    expect(requests).toHaveLength(3);
    expect(new URL(origin + requests[1]).searchParams.get("revision")).toMatch(/^[a-f0-9]{64}$/u);
    await page.close();
  });
}

test("family/shared choice invalidates the old preview; all dates exports the full archive", async () => {
  const page = await open(390);
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  const preview = page.getByRole("region", { name: "Record preview" });
  await expect(preview).toContainText("3 entries · 1h saved time");
  await expect(preview).toContainText("Shared time counts once in the entry total and toward each child's record");
  await expect(preview).toContainText("Alexandria Clementine Montgomery-Swift: 2 recorded learning days · 40m");
  if (screenshots) await page.screenshot({ path: resolve(screenshots, "1095-390-family-preview.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Shared time", exact: true }).selectOption("exclude");
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download time entries", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(preview).toContainText("2 entries · 50m saved time");
  await page.getByRole("combobox", { name: "Shared time", exact: true }).selectOption("include");
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Through", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(preview).toContainText("5 entries · 3h 30m saved time");
  const csv = await download(page, "Download time entries");
  expect(csv.text.trimEnd().split("\r\n")).toHaveLength(6);
  expect(csv.text).toContain("'=SUM(A1:A2)");
  await page.close();
});

test("same-name children have distinct selection and preview labels while CSV keeps original names and IDs", async () => {
  record.children.forEach((child) => { child.name = "Same"; });
  record.rows.forEach((row) => { if (row.childId) row.childName = "Same"; });
  const page = await open(320, null, true);
  await expect(page.getByRole("option", { name: "Same (record 000001)", exact: true })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "Same (record 000002)", exact: true })).toHaveCount(1);
  await page.getByRole("combobox", { name: "For", exact: true }).selectOption({ label: "Same (record 000002)" });
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Record preview" })).toContainText("Same (record 000002): 2 recorded learning days · 40m");
  await page.evaluate(() => document.fonts.ready);
  if (screenshots) await page.screenshot({ path: resolve(screenshots, "1095-320-same-name-preview.png"), fullPage: true });
  const csv = await download(page, "Download time entries");
  expect(csv.text).toContain(`"Same","${childB}"`);
  expect(csv.text).not.toContain(childA);
  expect(csv.text).not.toContain("(record");
  await page.close();
});

test("changed data refuses a stale download and offers an honest fresh preview", async () => {
  const page = await open(320, childA);
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Record preview" })).toBeVisible();
  record.rows[1].minutes = 21;
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download time entries", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Your record changed since this preview");
  await expect(page.getByRole("region", { name: "Record preview" })).toHaveCount(0);
  expect(downloads).toBe(0);
  if (screenshots) await page.screenshot({ path: resolve(screenshots, "1095-320-stale-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Record preview" })).toContainText("31m saved time");
  await page.close();
});

test("pending, invalid dates, failed read and empty window never invent a record", async () => {
  const page = await open(390, childA);
  await page.getByLabel("From", { exact: true }).fill("2026-09-07");
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Choose valid dates");
  expect(requests).toHaveLength(0);
  await page.getByLabel("From", { exact: true }).fill("2026-09-01");
  mode = "failure";
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The record didn't load");
  await expect(page.getByRole("region", { name: "Record preview" })).toHaveCount(0);
  mode = "pending";
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByLabel("From", { exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "For", exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  mode = "success"; release?.();
  await expect(page.getByRole("region", { name: "Record preview" })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("2026-09-02");
  await page.getByLabel("Through", { exact: true }).fill("2026-09-05");
  await page.getByRole("button", { name: "Preview record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Record preview" })).toContainText("No timed entries match these choices");
  const csv = await download(page, "Download recorded days");
  expect(csv.text.trimEnd().split("\r\n")).toHaveLength(1);
  await page.close();
});
