import { accessSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import type {
  LearningProgram,
  ProgramOccurrence,
} from "../lib/learning-programs";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test, type Browser } from "@playwright/test";

const fixtureRequire = createRequire(resolve(process.cwd(), "package.json"));
const esbuild = fixtureRequire(
  fixtureRequire.resolve("esbuild", { paths: [fixtureRequire.resolve("tsx")] }),
);
const postcss = fixtureRequire(
  fixtureRequire.resolve("postcss", {
    paths: [fixtureRequire.resolve("@tailwindcss/postcss")],
  }),
);
const tailwind = fixtureRequire("@tailwindcss/postcss");
let server: Server;
let browser: Browser;
let origin: string;
const screenshots = process.env.PROGRAMS_EVIDENCE_DIR;
test.beforeAll(async () => {
  if (screenshots) mkdirSync(screenshots, { recursive: true });
  const bundle = await esbuild.build({
    entryPoints: [resolve(process.cwd(), "e2e/fixtures/learning-programs.tsx")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "fixture-link",
        setup(build: {
          onResolve: (
            options: { filter: RegExp },
            callback: () => { path: string; namespace: string },
          ) => void;
          onLoad: (
            options: { filter: RegExp; namespace: string },
            callback: () => {
              contents: string;
              loader: string;
              resolveDir: string;
            },
          ) => void;
        }) {
          build.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "fixture",
          }));
          build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              'import React from "react"; export default function Link({children,...props}) { return <a {...props}>{children}</a> }',
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind({ base: process.cwd() })]).process(
    readFileSync("app/globals.css", "utf8"),
    { from: resolve("app/globals.css") },
  );
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url === "/fixture.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(
        css.css +
          "\n@font-face{font-family:'DM Sans';font-weight:400 700;src:url('/dm.ttf')}@font-face{font-family:'EB Garamond';src:url('/garamond.ttf');font-weight:600}:root{--font-dm-sans:'DM Sans';--font-eb-garamond:'EB Garamond'}body{margin:0}",
      );
    } else if (request.url === "/dm.ttf" || request.url === "/garamond.ttf") {
      response.setHeader("Content-Type", "font/ttf");
      response.end(
        readFileSync(
          resolve(
            "assets/fonts/quiet-authority",
            request.url === "/dm.ttf"
              ? "dm-sans-700-latin.ttf"
              : "eb-garamond-600-latin.ttf",
          ),
        ),
      );
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hours synthetic fixture</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>',
      );
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture failed to bind");
  origin = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(async () => {
  let executablePath: string | undefined;
  for (const candidate of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ]) {
    try {
      accessSync(candidate);
      executablePath = candidate;
      break;
    } catch {
      /* Try the next installed browser. */
    }
  }
  browser = await chromium.launch({
    executablePath:
      executablePath ?? (await serverlessChromium.executablePath()),
    args: executablePath ? [] : serverlessChromium.args,
    headless: true,
  });
});
test.afterEach(async () => {
  await browser?.close();
});
test.afterAll(async () => {
  if (server) await new Promise<void>((done) => server.close(() => done()));
});

test("phone program schedule review, safe attendance and failure feedback", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const calls: Array<{ action: string; input: Record<string, unknown> }> = [];
  let programs: LearningProgram[] = [];
  let occurrences: ProgramOccurrence[] = [];
  await page.route("**/api/learning-programs**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { programs, occurrences } });
    const body = route.request().postDataJSON();
    calls.push(body);
    if (body.action === "save") {
      programs = [{ ...body.input, revision: 1 }];
      return route.fulfill({
        json: { status: "saved", id: body.input.id, revision: 1 },
      });
    }
    if (body.action === "schedule") {
      occurrences = ["2026-09-14", "2026-09-28"].map((date, i) => ({
        programId: programs[0].id,
        programName: programs[0].name,
        classId: programs[0].classes[0].id,
        childId: programs[0].classes[0].childIds[0],
        activityId: `b0000000-0000-4000-8000-00000000000${i + 1}`,
        date,
        title: "Nature lab",
        subject: "science",
        status: "planned",
        minutes: null,
        plannedMinutes: 45,
        revision: "2026-09-29T10:00:00.123456+00:00",
      }));
      return route.fulfill({
        json: { status: "scheduled", created: 2, existing: 0, hoursAdded: 0 },
      });
    }
    const row = occurrences.find(
      (row) => row.activityId === body.input.activityId,
    )!;
    if (body.input.operation === "record") {
      row.status = "completed";
      row.minutes = body.input.minutes;
      row.revision = "2026-09-29T10:01:00.123456+00:00";
    } else {
      row.activityId = null;
      row.status = "removed";
      row.minutes = null;
      row.revision = null;
    }
    return route.fulfill({ json: { result: "applied" } });
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Enter a schedule here" }).click();
  await page.getByLabel("Program name", { exact: true }).fill("Monday co-op");
  await page.getByLabel("Class name", { exact: true }).fill("Nature lab");
  await page.getByLabel("Alex", { exact: true }).check();
  await page.getByLabel("Starts", { exact: true }).fill("09:00");
  await page.getByLabel("Ends", { exact: true }).fill("09:45");
  await page
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("No hours");
  expect(programs[0].classes[0].childIds).toEqual([
    "a0000000-0000-4000-8000-000000000001",
  ]);
  expect(programs[0].classes[0].plannedMinutes).toBeNull();
  await page
    .getByText("Weekly schedule and upcoming dates", { exact: true })
    .click();
  await page
    .getByLabel("Show classes from", { exact: true })
    .fill("2026-09-14");
  await page.getByLabel("Through", { exact: true }).fill("2026-09-28");
  await expect(
    page.getByText("Weekly schedule and upcoming dates", { exact: true }),
  ).toBeVisible();
  // Date-range loads remount the details; open it if needed.
  if (!(await page.getByLabel("Skip a holiday or day off").isVisible()))
    await page
      .getByText("Weekly schedule and upcoming dates", { exact: true })
      .click();
  await page.getByLabel("Skip a holiday or day off").fill("2026-09-21");
  await page
    .getByRole("button", { name: "Skip this date", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Add planned classes for these dates",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("No hours recorded");
  expect(calls[1].input.excludedDates).toEqual(["2026-09-21"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (screenshots)
    await page.screenshot({
      path: resolve(screenshots, "programs-phone.png"),
      fullPage: true,
    });
  await expect(
    page.getByText("Planned, no time recorded", { exact: true }),
  ).toHaveCount(2);
  await page.getByLabel("Actual minutes", { exact: true }).first().fill("40");
  await page
    .getByRole("button", { name: "Record attendance and time", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("40 minutes recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Planned, no time recorded", { exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Remove this dated class", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Remove this class and its recorded time for Alex?", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove this class", exact: true })
    .click();
  await expect(
    page.getByText("Removed. Reusing the schedule will not add it again.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Removed. Reusing the schedule will not add it again.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ forcedColors: "none" });
  await page.route("**/api/learning-programs**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Programs could not load. Try again." },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Programs could not load",
  );
  if (screenshots)
    await page.screenshot({
      path: resolve(screenshots, "programs-error.png"),
      fullPage: true,
    });
  await context.close();
});
