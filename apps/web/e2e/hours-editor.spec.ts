import { accessSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test, type Browser } from "@playwright/test";

import type {} from "./fixtures/hours-editor-runtime";

const fixtureRequire = createRequire(resolve(process.cwd(), "package.json"));
const esbuild = fixtureRequire(fixtureRequire.resolve("esbuild", { paths: [fixtureRequire.resolve("tsx")] }));
const postcss = fixtureRequire(fixtureRequire.resolve("postcss", { paths: [fixtureRequire.resolve("@tailwindcss/postcss")] }));
const tailwind = fixtureRequire("@tailwindcss/postcss");
let server: Server;
let browser: Browser;
let origin: string;
const child = "a0000000-0000-4000-8000-000000000001";
const screenshots = process.env.HOURS_EDITOR_EVIDENCE_DIR;
const dmSansFont = process.env.HOURS_EDITOR_DM_SANS_FONT;
const route = (view: string) => `/app/planner?view=${view}&date=2026-09-06&child=${child}`;

test.beforeAll(async () => {
  if (screenshots) mkdirSync(screenshots, { recursive: true });
  const runtime = resolve(process.cwd(), "e2e/fixtures/hours-editor-runtime.ts");
  const navigation = `import React from 'react'; import {fixture} from ${JSON.stringify(runtime)};
    export const useRouter=()=>({refresh:fixture.refresh,push:fixture.navigate,replace:fixture.navigate});
    export default function Link({href,children,prefetch,...props}){return <a {...props} href={href} onClick={e=>{e.preventDefault();fixture.navigate(href)}}>{children}</a>}`;
  const bundle = await esbuild.build({ entryPoints: [resolve(process.cwd(), "e2e/fixtures/hours-editor.tsx")],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "synthetic-boundaries", setup(build: {
      onResolve: (options: { filter: RegExp }, callback: (args: { path: string; importer: string }) => unknown) => void;
      onLoad: (options: { filter: RegExp; namespace: string }, callback: () => unknown) => void;
    }) {
      build.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: "navigation", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: navigation, loader: "tsx", resolveDir: process.cwd() }));
      build.onResolve({ filter: /(^\.\/actions|\/calendar\/actions)$/ }, (args) =>
        args.importer.includes("/app/app/") ? { path: runtime } : undefined);
      build.onResolve({ filter: /use-authenticated-plan-checks$/ }, () => ({ path: "checks", namespace: "checks" }));
      build.onLoad({ filter: /.*/, namespace: "checks" }, () => ({ contents: "export const useAuthenticatedPlanChecks=()=>({isWritable:()=>false,isChecked:()=>false,isPending:()=>false,getMessage:()=>null});", loader: "js" }));
    } }] });
  const css = await postcss([tailwind({ base: process.cwd() })]).process(readFileSync("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle.outputFiles[0].text); }
    else if (request.url === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css.css + "\n@font-face{font-family:'DM Sans';font-weight:400 700;src:url('/dm.ttf')}@font-face{font-family:'EB Garamond';src:url('/garamond.ttf');font-weight:600}:root{--font-dm-sans:'DM Sans';--font-eb-garamond:'EB Garamond'}body{margin:0}"); }
    else if (request.url === "/dm.ttf" || request.url === "/garamond.ttf") { response.setHeader("Content-Type", "font/ttf"); response.end(readFileSync(request.url === "/dm.ttf" && dmSansFont ? dmSansFont : resolve("assets/fonts/quiet-authority", request.url === "/dm.ttf" ? "dm-sans-700-latin.ttf" : "eb-garamond-600-latin.ttf"))); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hours synthetic fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture failed to bind");
  origin = `http://127.0.0.1:${address.port}`;
});

// The Linux serverless build is single-process. Closing a scenario's
// incognito context can exit that browser, so each scenario owns its process.
test.beforeEach(async () => {
  let executablePath: string | undefined;
  for (const candidate of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]) {
    try { accessSync(candidate); executablePath = candidate; break; } catch { /* Try the next installed browser. */ }
  }
  browser = await chromium.launch({ executablePath: executablePath ?? await serverlessChromium.executablePath(), args: executablePath ? [] : serverlessChromium.args, headless: true });
});
test.afterEach(async () => { await browser?.close(); });
test.afterAll(async () => { if (server) await new Promise<void>((done) => server.close(() => done())); });

for (const view of ["day", "week", "hours"]) {
  test(`${view}: full record, cancel, atomic-scope save and unchanged route`, async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (error) => console.error("Fixture page error:", error.message));
    await page.goto(origin + route(view));
    const opener = view === "hours" ? page.getByRole("button", { name: "Edit", exact: true }).first() : page.getByRole("button", { name: "Edit Math, 10m, Avery", exact: true });
    if (view === "hours") {
      await expect(page.getByText("Alexandria Clementine Montgomery-Swift", { exact: true })).toHaveCount(0);
    }
    await opener.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `1092-${view}-390-context.png`) });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Time and subject changes apply to Avery and Alexandria Clementine Montgomery-Swift");
    await expect(dialog).toContainText("Sunday, September 6, 2026");
    await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeInViewport();
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `1092-${view}-390-editor.png`) });
    await dialog.locator("summary").filter({ hasText: "Category and note for Avery" }).click();
    await expect(dialog.getByRole("textbox", { name: "Note for Avery", exact: true })).toHaveValue(/another way to group the same blocks/u);
    await dialog.getByRole("spinbutton", { name: "Minutes", exact: true }).fill("11");
    await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).scrollIntoViewIfNeeded();
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `1092-${view}-390-editor-footer.png`) });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => window.hoursEditorFixture.calls.length)).toBe(0);
    await opener.click();
    await dialog.getByRole("spinbutton", { name: "Minutes", exact: true }).fill("11");
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(route(view));
    expect(await page.evaluate(() => window.hoursEditorFixture.activities()[0].durationMinutes)).toBe(11);
    expect(await page.evaluate(() => window.hoursEditorFixture.entries().slice(0, 2).map((row) => row.minutes))).toEqual([11, 11]);
    await page.close();
  });
}

test("320px: failure keeps values, pending blocks dismissal and shared deletion names everyone", async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.goto(origin + route("week"));
  await page.getByRole("button", { name: "Edit Math, 10m, Avery", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("spinbutton", { name: "Minutes", exact: true }).fill("17");
  await page.evaluate(() => { window.hoursEditorFixture.mode = "failure"; });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nothing changed");
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByRole("spinbutton", { name: "Minutes", exact: true })).toHaveValue("17");
  await page.evaluate(() => { window.hoursEditorFixture.mode = "pending"; });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Delete recorded time", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(1);
  await page.evaluate(() => window.hoursEditorFixture.resolve());
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Math, 17m, Avery", exact: true }).click();
  await dialog.getByRole("spinbutton", { name: "Minutes", exact: true }).fill("19");
  await dialog.locator("summary").filter({ hasText: "Category and note for Avery" }).click();
  await dialog.getByRole("textbox", { name: "Note for Avery", exact: true }).fill("Unsaved note to keep when I go back");
  await dialog.getByRole("textbox", { name: "Category (optional)", exact: true }).fill("club");
  await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).click();
  await expect(dialog.getByRole("button")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await expect(dialog).toContainText("This deletes the recorded time, categories and notes for Avery and Alexandria Clementine Montgomery-Swift.");
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^Sunday, September 6, 2026$/u })).toBeVisible();
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^This deletes the recorded time, categories and notes for/u })).toHaveText("This deletes the recorded time, categories and notes for Avery and Alexandria Clementine Montgomery-Swift.");
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^The activity stays finished/u })).toHaveText("The activity stays finished in Planner, with its Planner notes.");
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^This can't be undone\.$/u })).toBeVisible();
  await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).scrollIntoViewIfNeeded();
  if (screenshots) await page.screenshot({ path: resolve(screenshots, "1092-week-320-delete.png") });
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  expect(await page.evaluate(() => window.hoursEditorFixture.calls.filter((row) => row.kind === "delete").length)).toBe(0);
  await expect(dialog.getByRole("spinbutton", { name: "Minutes", exact: true })).toHaveValue("19");
  await expect(dialog.getByRole("textbox", { name: "Note for Avery", exact: true })).toHaveValue("Unsaved note to keep when I go back");
  await expect(dialog.getByRole("textbox", { name: "Category (optional)", exact: true })).toHaveValue("club");
  await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.hoursEditorFixture.activities()[0].status)).toBe("completed");
  expect(await page.evaluate(() => window.hoursEditorFixture.activities()[0].durationMinutes)).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Edit Math, 17m, Avery", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-brand-surface="planner"]')).toBeFocused();
  await page.close();
});

test("lookup failure has retry and no unsafe controls; keyboard escape restores opener", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + route("day"));
  await page.evaluate(() => { window.hoursEditorFixture.mode = "loadFailure"; });
  const opener = page.getByRole("button", { name: "Edit Math, 10m, Avery", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("couldn't load");
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.hoursEditorFixture.mode = "success"; });
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(dialog.getByRole("spinbutton", { name: "Minutes", exact: true })).toHaveValue("10");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.close();
});


test("Planner detail Save sends one combined action and releases a failed transport without losing the draft", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + route("day"));
  await page.getByRole("button", { name: "Show 1 finished activity", exact: true }).click();
  await page.getByRole("button", { name: /^Our shared math activity/u }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Corrected shared activity");
  await dialog.getByRole("textbox", { name: "Notes", exact: true }).fill("A distinct Planner note");
  await dialog.getByRole("spinbutton", { name: "Reported time in minutes", exact: true }).fill("11");
  await page.evaluate(() => { window.hoursEditorFixture.mode = "throw"; });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("couldn't be confirmed");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Corrected shared activity");
  expect(await page.evaluate(() => window.hoursEditorFixture.activities()[0].title)).toBe("Our shared math activity");
  await page.evaluate(() => { window.hoursEditorFixture.mode = "success"; });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Corrected shared activity", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.hoursEditorFixture.calls.map((row) => row.kind))).toEqual(["plannerSave", "plannerSave"]);
  expect(await page.evaluate(() => window.hoursEditorFixture.activities()[0].durationMinutes)).toBe(11);
  expect(await page.evaluate(() => window.hoursEditorFixture.entries().slice(0, 2).map((row) => row.minutes))).toEqual([11, 11]);
  expect(await page.evaluate(() => window.hoursEditorFixture.entries()[0].note)).toContain("another way to group the same blocks");
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(route("day"));
  await page.close();
});


for (const width of [320, 390]) {
  test(`${width}px shortened viewport: Save stays reachable and Unicode note limit is visible before saving`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 420 } });
    await page.goto(origin + route("day"));
    await page.getByRole("button", { name: "Edit Math, 10m, Avery", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Save changes", exact: true });
    await expect(save).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
    await dialog.getByRole("spinbutton", { name: "Minutes", exact: true }).fill("11");
    await expect(dialog.getByRole("spinbutton", { name: "Minutes", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(save).toBeInViewport();
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `1092-day-${width}-short-editor.png`) });
    await dialog.locator("summary").filter({ hasText: "Category and note for Avery" }).click();
    const note = dialog.getByRole("textbox", { name: "Note for Avery", exact: true });
    await note.fill("🧡".repeat(200));
    await expect(dialog.getByText("200/200 characters", { exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
    await note.fill("🧡".repeat(201));
    await expect(dialog.getByText("201/200 characters. Shorten the note to save.", { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    expect(await page.evaluate(() => window.hoursEditorFixture.calls.length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.close();
  });
}


test("standalone deletion identifies the recorded date and keeps the irreversible warning separate", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + route("hours"));
  await page.getByRole("listitem").filter({ hasText: "Family nature walk" }).getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete recorded time", exact: true }).click();
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^Monday, September 7, 2026$/u })).toBeVisible();
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^This deletes the 10-minute time record/u })).toHaveText("This deletes the 10-minute time record for the whole family, including its category and note.");
  await expect(dialog.getByRole("paragraph").filter({ hasText: /^This can't be undone\.$/u })).toBeVisible();
  await expect(dialog.getByText("The activity stays finished in Planner, with its Planner notes.", { exact: true })).toHaveCount(0);
  if (screenshots) await page.screenshot({ path: resolve(screenshots, "1092-hours-390-standalone-delete.png") });
  await dialog.getByRole("button", { name: "Go back", exact: true }).click();
  await page.evaluate(() => { window.hoursEditorFixture.mode = "throw"; });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Close this editor and reopen the time record to check before trying again.");
  await expect(dialog.getByRole("spinbutton", { name: "Minutes", exact: true })).toHaveValue("10");
  await page.close();
});
