import { accessSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test } from "@playwright/test";

const fixtureRequire = createRequire(resolve(process.cwd(), "package.json"));
// tsx is a pinned workspace tool and supplies the bundler used by this fixture.
const { build } = createRequire(fixtureRequire.resolve("tsx/package.json"))("esbuild");
const candidate = process.env.HOMA_EVE_CANDIDATE_PACKAGE;

test("React chat streams, flushes a queue, stops locally, and adopts recovery", async () => {
  const bundle = await build({
    entryPoints: [resolve("e2e/chat-recovery.fixture.tsx")],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { USES_SESSION_HANDLES: candidate ? "true" : "false", "process.env.NODE_ENV": '"development"' },
    ...(candidate ? { alias: { "eve/client": resolve(candidate, "dist/src/client/index.js") } } : {}),
  });
  let executablePath: string | undefined;
  for (const path of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]) {
    try { accessSync(path); executablePath = path; break; } catch { /* Try the next installed browser. */ }
  }
  const browser = await chromium.launch({
    executablePath: executablePath ?? await serverlessChromium.executablePath(),
    args: executablePath ? [] : serverlessChromium.args, headless: true,
  });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.locator("#session")).toHaveText("none");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#text")).toHaveText("Answer 1");
    await expect(page.locator("#status")).toHaveText("streaming");
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.locator("#status")).toHaveText("ready");
    await expect(page.locator("#finishes")).toHaveText("1");
    await page.getByRole("button", { name: "Send with queue" }).click();
    await expect(page.locator("#text")).toContainText("Answer 2");
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.locator("#text")).toContainText("Answer 3");
    await expect(page.locator("#finishes")).toHaveText("2");
    await page.getByRole("button", { name: "Stop listening" }).click();
    await expect(page.locator("#status")).toHaveText("ready");
    await expect(page.locator("#finishes")).toHaveText("3");
    await expect(page.locator("#text")).toContainText("Answer 3");
    await page.getByRole("button", { name: "Adopt recovered" }).click();
    await expect(page.locator("#session")).toHaveText("fixture-recovered");
    await expect(page.locator("#text")).toBeEmpty();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#text")).toHaveText("Answer 4");
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(page.locator("#finishes")).toHaveText("4");
    await page.getByRole("button", { name: "Inspect requests" }).click();
    const requests = JSON.parse(await page.locator("#requests").innerText()) as { method: string; path: string; message?: string }[];
    const posts = requests.filter(request => request.method === "POST");
    expect(posts.map(request => request.message)).toEqual(["First question", "Before queued question", "Queued question", "First question"]);
    expect(posts.map(request => request.path)).toEqual(["/eve/v1/session", "/eve/v1/session/fixture-session-1", "/eve/v1/session/fixture-session-1", "/eve/v1/session/fixture-recovered"]);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#session")).toHaveText("none");
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
