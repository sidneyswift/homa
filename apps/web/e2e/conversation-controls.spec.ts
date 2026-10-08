import type { ChatHistoryMaterial } from "../lib/chat-history-model";
import { randomUUID } from "node:crypto";
import { accessSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";

import { parsePlannerDate, parsePlannerView } from "../lib/unified-planner";
import type { FamilyEventRow } from "../lib/family-events";
import type { ConversationFeedMessage } from "../lib/conversation-feed";
import type { NativeConversationBatch } from "../app/app2/native-conversation-card";
import type { NativeInputResponse } from "../lib/conversation-native-input";

const familyId = "00000000-0000-4000-8000-000000000001", userId = "00000000-0000-4000-8000-000000000002";
const account = `${familyId}:${userId}`, accessEpoch = "00000000-0000-4000-8000-000000000003", conversationId = "00000000-0000-4000-8000-000000000004";
let browser: Browser, server: Server, origin: string;
let fixtureMaterials: ChatHistoryMaterial[] = [];
let messages: ConversationFeedMessage[] = [], changes: { position: number; message: ConversationFeedMessage; deleted?: true }[] = [];
let receipts = new Map<string, { intentId: string; requestId: string; messageId: string }>();
let submissions: { intentId: string; text: string; attachmentIds?: string[] }[] = [];
let feedPaused = false, rejectSubmissions = false, permanentRejection = false, feedRequests: string[] = [];
const plannerKids = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Maya", birthMonth: "2019-05-10", avatarUrl: null, reportToken: null },
  { id: "22222222-2222-4222-8222-222222222222", name: "Leo", birthMonth: "2021-02-10", avatarUrl: null, reportToken: null },
];
let calendarWrites: { name: string; args: unknown[] }[] = [], calendarFailure = false;
let calendarEvents: FamilyEventRow[] = [];
const calendarToday = "2026-10-05";
let boardStatus = 200, checkWrites: Record<string, unknown>[] = [];
let plannerProgress: Record<string, boolean> = {};
const plannerResponse = () => ({ ok: true, board: { timeZone: "America/New_York", kids: plannerKids, plans: plannerKids.map((child, index) => ({
  childId: child.id, subjectId: "math", planRevision: 1, progressRevision: index === 0 ? checkWrites.length : 0,
  done: index === 0 ? Object.values(plannerProgress).filter(Boolean).length : 0, total: 1,
  retestAt: "2026-11-02T16:00:00.000Z",
  weeks: [{ week: 1, focus: "Count together", activities: [index === 0 ? "Count the blue buttons" : "Count the toy cars"] }],
  progress: index === 0 ? plannerProgress : {}, activitySources: {},
})) } });
let nativeBatches: NativeConversationBatch[] = [];
let nativeSubmissions: { account: string; accessEpoch: string; intentId: string; batchId: string; responses: NativeInputResponse[] }[] = [];

function addMessage(content: string, role: "assistant" | "user" = "assistant", request: ConversationFeedMessage["request"] = null) {
  const id = randomUUID(), atMs = Date.now() + messages.length;
  const message: ConversationFeedMessage = { id, content, role, sessionId: "fixture-session", turnId: id, channel: "web", modality: "text",
    atMs, createdAt: new Date(atMs).toISOString().replace("Z", "000Z"), historyCursor: id,
    recordingPosition: String(changes.length + 1), request, question: null, responseComplete: true };
  messages.push(message); changes.push({ position: changes.length + 1, message }); return message;
}
function addNativeBatch(requests: NativeConversationBatch["requests"]) {
  const message = addMessage(requests.map(request => request.prompt).join("\n"));
  const batch: NativeConversationBatch = { batchId: randomUUID(), createdAt: message.createdAt, state: "pending", answerRequestId: null, responses: null, requests };
  nativeBatches.push(batch); message.nativeInput = batch;
  return { message, batch };
}
async function jsonBody(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = []; for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

test.beforeAll(async () => {
  const require = createRequire(resolve(process.cwd(), "package.json"));
  const compiler = createRequire(require.resolve("tsx"))("esbuild");
  const built = await compiler.build({ entryPoints: [resolve(process.cwd(), "e2e/fixtures/conversation-controls.tsx")],
    bundle: true, write: false, outdir: "fixture", format: "iife", platform: "browser", target: "es2022", jsx: "automatic",
    define: { "process.env.NODE_ENV": JSON.stringify("development"), "process.env": "{}" },
    alias: { react: resolve(process.cwd(), "node_modules/react"), "react-dom": resolve(process.cwd(), "node_modules/react-dom") },
    plugins: [{ name: "external-backend-boundaries", setup(build: { onResolve(options: object, callback: (args: { path: string }) => unknown): void; onLoad(options: object, callback: (args: { path: string }) => unknown): void }) {
      build.onResolve({ filter: /lib\/supabase\/client$/ }, () => ({ path: resolve(process.cwd(), "e2e/fixtures/conversation-auth.ts") }));
      build.onLoad({ filter: /\.tsx?$/ }, args => {
        const source = readFileSync(args.path, "utf8");
        if (!/^['"]use server['"]/u.test(source)) return;
        const names = [...source.matchAll(/export async function (\w+)/gu)].map(match => match[1]);
        return { contents: names.map(name => `export async function ${name}(...args){const response = await fetch('/fixture-action', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:'${name}',args})}); if(!response.ok) throw new Error('Fixture connection failed'); return response.json();}`).join("\n"), loader: "js" };
      });
    } }],
  });
  const js = built.outputFiles.find((file: { path: string }) => file.path.endsWith(".js")).text;
  const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
  const globalCss = (await postcss([require("@tailwindcss/postcss")({ base: process.cwd() })])
    .process(readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8"), { from: resolve(process.cwd(), "app/globals.css") })).css;
  const css = globalCss + built.outputFiles.filter((file: { path: string }) => file.path.endsWith(".css")).map((file: { text: string }) => file.text).join("\n");
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url!, "http://fixture");
      const send = (body: unknown, status = 200) => { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(body)); };
      if (url.pathname === "/fixture-action") {
        const call = await jsonBody(request); calendarWrites.push(call);
        if (calendarFailure) return send({ error: "Fixture connection failed" }, 503);
        if (call.name === "materialVersionsAction") return send([]);
        if (call.name === "setViewContextAction") return send({ ok: true });
        if (call.name === "createFamilyEventAction") {
          const input = call.args[0];
          calendarEvents.push({ id: randomUUID(), familyId, childId: input.childIds[0] ?? null, ...input, createdAt: "2026-10-05T16:00:00Z" });
        } else if (call.name === "deleteFamilyEventOccurrenceAction") {
          const event = calendarEvents.find(event => event.id === call.args[0]);
          if (event) event.occurrenceExceptions = [...event.occurrenceExceptions ?? [], { occurrenceOn: call.args[1], kind: "cancelled", startsOn: null, endsOn: null, startTime: null, endTime: null }];
        } else throw new Error(`Unexpected fixture action ${call.name}`);
        return send({ error: null });
      }
      if (url.pathname === "/api/workspace/planner") {
        const board = plannerResponse().board;
        return send(boardStatus === 200 ? { ok: true, board: { ...board,
          kids: board.kids.map(kid => ({ id: kid.id, name: kid.name, avatar_url: null, birth_month: kid.birthMonth, reportToken: null })),
          now: "2026-10-05T16:00:00.000Z", today: calendarToday,
          activeDate: parsePlannerDate(url.searchParams.get("date") ?? undefined, calendarToday),
          view: parsePlannerView(url.searchParams.get("view") ?? undefined),
          familyEvents: calendarEvents, scheduledActivities: plannerKids.map(kid => ({ id: kid.id, familyId, childId: kid.id, subjectId: "math", week: 1, activityIndex: 0, scheduledDate: calendarToday, createdAt: "2026-10-05T16:00:00Z", updatedAt: "2026-10-05T16:00:00Z" })), learningActivities: [], hoursEntries: [],
        } } : { ok: false }, boardStatus);
      }
      if (url.pathname === "/api/map/plan/board") {
        return send(boardStatus === 200 ? plannerResponse() : { error: "unavailable" }, boardStatus);
      }
      if (url.pathname === "/api/map/plan/check") {
        const input = await jsonBody(request);
        checkWrites.push(input); plannerProgress[input.checkKey] = input.done;
        return send({ status: "applied", planId: plannerKids[0]!.id, planRevision: 1,
          progressRevision: checkWrites.length, progress: plannerProgress, checkKey: input.checkKey, done: input.done });
      }
      if (url.pathname.startsWith("/api/conversation/")) {
        if (request.headers.authorization !== "Bearer fixture-adult-token") return send({ reason: "sign_in" }, 401);
        if (url.pathname === "/api/conversation/native-input") {
          if (request.method === "GET") return send({ batches: nativeBatches });
          const input = await jsonBody(request);
          if (rejectSubmissions) return send({ reason: "retry" }, 503);
          if (permanentRejection) return send({ reason: "invalid" }, 400);
          const batch = nativeBatches.find(value => value.batchId === input.batchId);
          if (!batch) return send({ reason: "deleted" }, 410);
          if (!receipts.has(input.intentId)) {
            const requestId = randomUUID();
            const content = input.responses.map((value: NativeInputResponse) => value.text ?? batch.requests
              .find(question => question.requestId === value.requestId)?.options?.find(option => option.id === value.optionId)?.label).join("\n");
            const message = addMessage(content, "user", { requestId, intentId: input.intentId, state: "queued" });
            receipts.set(input.intentId, { intentId: input.intentId, requestId, messageId: message.id });
            nativeSubmissions.push(input); batch.state = "answered"; batch.answerRequestId = requestId; batch.responses = input.responses;
            const prompt = messages.find(message => message.nativeInput?.batchId === batch.batchId);
            if (prompt) changes.push({ position: changes.length + 1, message: prompt });
          }
          return send({ receipt: receipts.get(input.intentId) }, 202);
        }
        if (url.pathname === "/api/conversation/requests") {
          if (request.method === "GET") return send({ account, accessEpoch, conversationId });
          const input = await jsonBody(request);
          if (rejectSubmissions) return send({ reason: "retry" }, 503);
          if (permanentRejection) return send({ reason: "invalid" }, 400);
          if (!receipts.has(input.intentId)) {
            const requestId = randomUUID();
            const message = addMessage(input.text, "user", { requestId, intentId: input.intentId, state: "queued" });
            receipts.set(input.intentId, { intentId: input.intentId, requestId, messageId: message.id }); submissions.push(input);
          }
          return send({ receipt: receipts.get(input.intentId) }, 202);
        }
        if (url.pathname === "/api/conversation/feed") {
          feedRequests.push(url.search);
          if (feedPaused) return send({ reason: "retry" }, 503);
          const common = { account, accessEpoch, conversationId, materials: fixtureMaterials, requests: [], requestsTruncated: false };
          if (url.searchParams.has("materialsFor")) return send({ ...common, mode: "materials", materialSessions: fixtureMaterials.map(item => item.sessionId), requestedMessageIds: url.searchParams.get("materialsFor")!.split(",") });
          if (url.searchParams.has("after")) {
            const after = Number(url.searchParams.get("after")), page = changes.filter(change => change.position > after).slice(0, 100);
            return send({ ...common, mode: "changes", changes: page.map(change => change.deleted ? { kind: "delete", messageId: change.message.id } : { kind: "upsert", message: change.message }),
              nextChangeCursor: String(page.at(-1)?.position ?? changes.length), hasMore: page.length > 0 && page.at(-1)!.position < changes.length, materialSessions: [] });
          }
          const before = url.searchParams.get("before"), end = before ? messages.findIndex(message => message.id === before) : messages.length;
          const page = messages.slice(Math.max(0, end - 50), end);
          return send({ ...common, mode: "snapshot", messages: page, changeCursor: String(changes.length),
            nextCursor: end > 50 ? page[0]!.id : null, hasOlder: end > 50 });
        }
      }
      if (url.pathname === "/fixture.js") { response.writeHead(200, { "content-type": "text/javascript" }); response.end(js); return; }
      if (url.pathname === "/fixture.css") { response.writeHead(200, { "content-type": "text/css" }); response.end(css); return; }
      if (url.pathname !== "/") return send({ reason: "fixture_scope" }, 404);
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>
        :root { --font-dm-sans: Arial, sans-serif; }
        </style><div id="root"></div><script src="/fixture.js"></script>`);
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  origin = `http://127.0.0.1:${address.port}`;
  let executablePath: string | undefined;
  for (const path of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]) {
    try { accessSync(path); executablePath = path; break; } catch { /* Next candidate. */ }
  }
  browser = await chromium.launch({ headless: true, executablePath: executablePath ?? await serverlessChromium.executablePath(), args: executablePath ? [] : serverlessChromium.args.filter(argument => argument !== "--single-process") });
});
test.afterAll(async () => { await browser?.close(); if (server?.listening) await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); });
test.beforeEach(() => { fixtureMaterials = []; calendarEvents = []; calendarWrites = []; calendarFailure = false; boardStatus = 200; checkWrites = []; plannerProgress = {}; messages = []; changes = []; receipts = new Map(); submissions = []; nativeBatches = []; nativeSubmissions = []; feedPaused = false; rejectSubmissions = false; permanentRejection = false; feedRequests = []; });
async function open() {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.stack ?? error.message));
  await page.goto(origin); await page.waitForTimeout(100);
  if (errors.length) throw new Error(errors.join("\n"));
  return { context, page };
}
const composer = (page: Page) => page.getByPlaceholder("Message Homa…");
async function openPlanner(page: Page) {
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
}
async function submit(page: Page, text: string) { await composer(page).fill(text); await page.getByRole("button", { name: "Send message", exact: true }).click(); }

test("real composer acceptance stays visible until canonical feed catches up, then refresh restores it", async () => {
  const { context, page } = await open();
  await expect(composer(page)).toBeVisible();
  feedPaused = true;
  await submit(page, "Please keep these exact words");
  await expect.poll(() => submissions.length).toBe(1);
  await expect(page.getByRole("log").getByText("Please keep these exact words", { exact: true })).toHaveCount(1);
  await page.waitForTimeout(200);
  await expect(page.getByRole("log").getByText("Please keep these exact words", { exact: true })).toHaveCount(1);
  await page.evaluate(() => {
    const state = { vanished: false };
    (window as unknown as { fixtureFlash: typeof state }).fixtureFlash = state;
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[role="log"]')?.textContent?.includes("Please keep these exact words")) state.vanished = true;
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  feedPaused = false;
  await expect(page.locator(`[data-message-id="${receipts.get(submissions[0]!.intentId)!.messageId}"]`)).toBeVisible();
  await expect(page.getByRole("log").getByText("Please keep these exact words", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { fixtureFlash: { vanished: boolean } }).fixtureFlash.vanished)).toBe(false);
  addMessage("Your conversation stays with you.");
  await expect(page.getByRole("log").getByText("Your conversation stays with you.", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("log").getByText("Please keep these exact words", { exact: true })).toBeVisible();
  await expect(page.getByRole("log").getByText("Your conversation stays with you.", { exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/private/tmp/homa-conversation-controls-restored.png", fullPage: true });
  await context.close();
});

test("older reading stays in place during live updates and Newest returns to new content", async () => {
  for (let index = 0; index < 130; index++) addMessage(`History message ${index}`);
  const { context, page } = await open();
  const log = page.getByRole("log"); await expect(log).toBeVisible();
  await log.evaluate(element => { element.scrollTop = 0; });
  await page.getByRole("button", { name: "Earlier messages" }).click();
  await expect(page.getByText("History message 30", { exact: true })).toBeAttached();
  await expect(page.locator('[role="status"][aria-atomic="true"]')).toHaveText("");
  await expect(page.locator('[role="status"][aria-atomic="true"]')).toHaveAttribute("aria-live", "off");
  await log.evaluate(element => { element.scrollTop = 500; });
  const before = await log.evaluate(element => element.scrollTop);
  addMessage("A new reply while reading older messages");
  await expect(page.getByRole("button", { name: "Newest messages" })).toBeVisible();
  await expect.poll(() => feedRequests.some(query => query.includes("after="))).toBe(true);
  await page.waitForTimeout(2200);
  expect(await log.evaluate(element => element.scrollTop)).toBeCloseTo(before, 0);
  await expect(page.getByText("A new reply while reading older messages", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Newest messages" }).click();
  await expect(page.getByLabel("Conversation transcript", { exact: true }).getByText("A new reply while reading older messages", { exact: true })).toBeVisible();
  expect(feedRequests.filter(query => query.includes("before=")).length).toBe(1);
  await context.close();
});

test("two real tabs share queued sends without changing IDs and logout removes private UI", async () => {
  const { context, page: first } = await open(); const second = await context.newPage(); await second.goto(origin);
  rejectSubmissions = true;
  await submit(first, "First tab words"); await expect(first.getByRole("log").getByText("First tab words", { exact: true })).toBeVisible();
  await submit(second, "Second tab words");
  const queued = await first.evaluate(async () => new Promise<{ intentId: string; text: string }[]>((resolve, reject) => {
    const request = indexedDB.open("homa-conversation-v2"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("outbox", "readonly"), rows = tx.objectStore("outbox").getAll();
      tx.oncomplete = () => { request.result.close(); resolve(rows.result); }; };
  }));
  expect(queued).toHaveLength(2); expect(new Set(queued.map(row => row.intentId)).size).toBe(2);
  rejectSubmissions = false;
  await first.evaluate(() => window.dispatchEvent(new Event("online"))); await second.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => submissions.length).toBe(2);
  expect(new Set(submissions.map(row => row.intentId))).toEqual(new Set(queued.map(row => row.intentId)));
  await first.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(first.getByRole("log")).toHaveCount(0); await expect(second.getByRole("log")).toHaveCount(0);
  await expect(composer(first)).toHaveValue(""); await expect(composer(second)).toHaveValue("");
  await context.close();
});

test("real file input stages bytes locally and explicit Send freezes them in the durable queue", async () => {
  const { context, page } = await open();
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "worksheet.txt", mimeType: "text/plain", buffer: Buffer.from("Selected private worksheet") });
  await expect(page.getByLabel("Attachments").getByTitle("worksheet.txt")).toBeVisible();
  expect(submissions).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const stored = async () => page.evaluate(async () => new Promise<{ entries: { stagedAttachmentIds?: string[] }[]; files: { bytes: Blob; visible: boolean }[] }>((resolve, reject) => {
    const request = indexedDB.open("homa-conversation-v2"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction(["outbox", "attachments"], "readonly");
      const entries = tx.objectStore("outbox").getAll(), files = tx.objectStore("attachments").getAll();
      tx.oncomplete = () => { request.result.close(); resolve({ entries: entries.result, files: files.result }); }; };
  }).then(async value => ({ entries: value.entries, files: await Promise.all(value.files.map(async file => ({ text: await file.bytes.text(), visible: file.visible }))) })));
  await expect.poll(async () => (await stored()).entries.length).toBe(1);
  const value = await stored(); expect(value.entries[0]!.stagedAttachmentIds).toHaveLength(1);
  expect(value.files).toEqual([{ text: "Selected private worksheet", visible: false }]);
  await page.reload(); await expect(page.getByLabel("Attachments")).toHaveCount(0);
  expect((await stored()).entries).toHaveLength(1);
  await context.close();
});


test("rejected words remain visible and can become a corrected draft", async () => {
  const { context, page } = await open(); permanentRejection = true;
  await submit(page, "Keep my rejected words");
  const failure = page.getByRole("region", { name: "Message not sent" });
  await expect(failure).toContainText("Keep my rejected words");
  await expect(failure.getByRole("button", { name: "Copy message" })).toBeVisible();
  await composer(page).fill("A newer draft");
  await expect(failure.getByRole("button", { name: "Use as draft" })).toBeDisabled();
  await composer(page).fill(""); await failure.getByRole("button", { name: "Use as draft" }).click();
  await expect(composer(page)).toHaveValue("Keep my rejected words");
  await expect(failure).toContainText("Keep my rejected words");
  await expect(failure.getByRole("button", { name: "Use as draft" })).toBeDisabled();
  expect(submissions).toHaveLength(0);
  await context.close();
});


test("only a newly completed response is announced, and logout clears the live region", async () => {
  addMessage("Earlier completed history");
  const { context, page } = await open();
  const announcement = page.locator('[role="status"][aria-atomic="true"]');
  await expect(page.getByRole("log").getByText("Earlier completed history")).toBeVisible();
  await expect(announcement).toHaveText("");
  const partial = addMessage("A partial response"); partial.responseComplete = false;
  await expect(page.getByRole("log").getByText("A partial response", { exact: true })).toBeVisible();
  await expect(announcement).toHaveText("");
  const completed = { ...partial, content: "The response is complete", responseComplete: true };
  messages[messages.findIndex(row => row.id === completed.id)] = completed;
  changes.push({ position: changes.length + 1, message: completed });
  await expect(announcement).toHaveText("The response is complete");
  await page.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(announcement).toHaveText("");
  await context.close();
});

test("native multi-question choices freeze one complete batch, survive refresh and restore the answered conversation", async () => {
  const preceding = addMessage("Let’s choose an activity.");
  const { batch: { batchId }, message: nativeMessage } = addNativeBatch([
    { requestId: "activity-question", prompt: "Which activity would you like?", display: "select",
      options: [{ id: "apples", label: "Apple activity" }, { id: "leaves", label: "Leaf activity" }] },
    { requestId: "duration-question", prompt: "How many minutes?", display: "text", allowFreeform: true },
  ]);
  rejectSubmissions = true;
  const { context, page } = await open();
  const card = page.getByRole("region", { name: "Homa needs your response" });
  await expect(card).toContainText("Which activity would you like?");
  await card.getByRole("button", { name: "Apple activity", exact: true }).click();
  await expect(card).toContainText("How many minutes?");
  expect(nativeSubmissions).toHaveLength(0);
  await card.getByLabel("Your answer").fill("Twenty minutes, please.");
  await card.getByRole("button", { name: "Send answer", exact: true }).click();
  const queued = () => page.evaluate(async () => new Promise<{ intentId: string; text: string;
    nativeInput?: { batchId: string; responses: NativeInputResponse[] } }[]>((resolve, reject) => {
    const open = indexedDB.open("homa-conversation-v2"); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const tx = open.result.transaction("outbox", "readonly"), query = tx.objectStore("outbox").getAll();
      tx.oncomplete = () => { open.result.close(); resolve(query.result); }; };
  }));
  await expect.poll(async () => (await queued()).length).toBe(1);
  const [entry] = await queued();
  expect(entry!.nativeInput).toEqual({ batchId, responses: [
    { requestId: "activity-question", optionId: "apples" }, { requestId: "duration-question", text: "Twenty minutes, please." },
  ] });
  expect(entry!.text).toBe("Apple activity\nTwenty minutes, please.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Homa’s question and your response", exact: true })).toContainText("Your response is ready to send.");
  expect((await queued())[0]!.intentId).toBe(entry!.intentId);
  rejectSubmissions = false; await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => nativeSubmissions.length).toBe(1);
  expect(nativeSubmissions[0]).toEqual({ account, accessEpoch, intentId: entry!.intentId, ...entry!.nativeInput });
  await expect(page.getByRole("log")).toContainText("Twenty minutes, please.");
  await expect(page.getByRole("region", { name: "Homa needs your response" })).toHaveCount(0);
  const history = page.getByRole("region", { name: "Homa’s question and your response", exact: true });
  await expect(history).toContainText("Which activity would you like?");
  await expect(history).toContainText("How many minutes?");
  await expect(history).toContainText("Apple activity");
  await expect(history).toContainText("Twenty minutes, please.");
  await expect(history.getByRole("button")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("log")).toContainText("Twenty minutes, please.");
  await expect(page.getByRole("region", { name: "Homa needs your response" })).toHaveCount(0);
  await expect(history).toContainText("Answered in the conversation.");
  const ids = await page.getByRole("log").locator("[data-message-id]").evaluateAll(rows => rows.map(row => row.getAttribute("data-message-id")));
  expect(ids.indexOf(preceding.id)).toBeLessThan(ids.indexOf(nativeMessage.id));
  expect(ids.indexOf(nativeMessage.id)).toBeLessThan(ids.indexOf(receipts.get(entry!.intentId)!.messageId));
  await page.screenshot({ path: "/private/tmp/homa-native-question-history.png", fullPage: true });
  expect(nativeSubmissions).toHaveLength(1);
  await context.close();
});

test("native approval offers only explicit choices and logout removes the private prompt", async () => {
  addNativeBatch([
    { requestId: "approval-question", prompt: "May I make this change?", display: "text", allowFreeform: true,
      options: [{ id: "approve", label: "Yes, make the change" }, { id: "deny", label: "No, leave it" }] },
  ]);
  const { context, page } = await open();
  const card = page.getByRole("region", { name: "Homa needs your response" });
  await expect(card).toContainText("May I make this change?");
  await expect(card.getByRole("textbox")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "No, leave it" })).toBeVisible();
  await page.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText("May I make this change?", { exact: true })).toHaveCount(0);
  expect(nativeSubmissions).toHaveLength(0);
  await context.close();
});

test("rejected approval reopens explicit choices and never offers Use as draft", async () => {
  addNativeBatch([{ requestId: "approval", prompt: "Should I apply this change?", display: "confirmation",
    options: [{ id: "approve", label: "Yes, apply it" }, { id: "deny", label: "No, leave it" }] }]);
  permanentRejection = true;
  const { context, page } = await open();
  const card = page.getByRole("region", { name: "Homa needs your response" });
  await card.getByRole("button", { name: "Yes, apply it", exact: true }).click();
  await expect(card).toContainText("That response was not accepted. Please choose again.");
  const failure = page.getByRole("region", { name: "Message not sent" });
  await expect(failure).toContainText("Yes, apply it");
  await expect(failure.getByRole("button", { name: "Use as draft" })).toHaveCount(0);
  await expect(card.getByRole("textbox")).toHaveCount(0);
  permanentRejection = false;
  await card.getByRole("button", { name: "No, leave it", exact: true }).click();
  await expect.poll(() => nativeSubmissions.length).toBe(1);
  expect(nativeSubmissions[0]!.responses).toEqual([{ requestId: "approval", optionId: "deny" }]);
  await expect(page.getByRole("region", { name: "Homa’s question and your response", exact: true })).toContainText("No, leave it");
  await expect(failure).toHaveCount(0);
  await expect(composer(page)).toHaveValue("");
  await context.close();
});

test("native question history follows message paging and canonical deletion", async () => {
  const { batch, message } = addNativeBatch([{ requestId: "old-question", prompt: "Which old activity?", display: "select",
    options: [{ id: "apples", label: "Apple activity" }] }]);
  batch.state = "answered"; batch.responses = [{ requestId: "old-question", optionId: "apples" }];
  for (let index = 0; index < 120; index++) addMessage(`Later history ${index}`);
  const { context, page } = await open();
  const card = page.getByRole("region", { name: "Homa’s question and your response", exact: true });
  await expect(page.getByRole("log")).toBeVisible();
  await expect(card).toHaveCount(0);
  for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
    await page.getByRole("log").evaluate(element => { element.scrollTop = 0; });
    await page.getByRole("button", { name: "Earlier messages" }).click();
    await page.waitForTimeout(100);
  }
  await expect(card).toContainText("Which old activity?");
  await expect(card).toContainText("Apple activity");
  await expect(page.locator('[role="status"][aria-atomic="true"]')).toHaveText("");
  messages = messages.filter(row => row.id !== message.id);
  changes.push({ position: changes.length + 1, message, deleted: true });
  await expect(card).toHaveCount(0);
  await context.close();
});


test("workspace navigation reveals labeled destinations and Escape preserves the open planner", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await composer(page).fill("Keep my thought");
  const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
  await expect(page.getByText("Your week", { exact: true })).toHaveCount(0);
  const bounds = await toggle.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x).toBeLessThan(40);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Planner", exact: true })).toBeFocused();
  for (const name of ["Binder", "Progress"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.screenshot({ path: "/private/tmp/homa-navigation-desktop.png" });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Planner", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
  await expect(composer(page)).toHaveValue("Keep my thought");
  await context.close();
});

test("workspace navigation fits phones and dismisses without intercepting the composer", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Progress", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await composer(page).fill("Still here");
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.screenshot({ path: "/private/tmp/homa-navigation-phone.png" });
  await page.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: /^Binder/ })).toHaveCount(0);
  await context.close();
});

test("workspace opens beside the real chat, preserves the draft, and follows browser history", async () => {
  addMessage("Let’s plan a calm week.");
  const { context, page } = await open();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await composer(page).fill("Keep this unfinished thought");
  const input = await composer(page).elementHandle();
  await openPlanner(page);
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeFocused();
  await expect(page.getByRole("complementary", { name: "Planner" })).toBeVisible();
  await expect(page.getByRole("log")).toBeVisible();
  const panel = await page.getByRole("complementary").boundingBox(), chat = await page.getByRole("log").boundingBox();
  expect(chat!.x + chat!.width).toBeLessThanOrEqual(panel!.x);
  await expect(composer(page)).toHaveValue("Keep this unfinished thought");
  expect(await input!.evaluate(node => node === document.querySelector('[placeholder="Message Homa…"]'))).toBe(true);
  await page.getByRole("combobox", { name: "Whose plan" }).selectOption(plannerKids[0]!.id);
  await expect(page.getByText("Count the blue buttons", { exact: true })).toBeVisible();
  await expect(page.getByText("Count the toy cars", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Whose plan" })).toHaveValue("");
  await page.goBack();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
  await page.goForward();
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(composer(page)).toHaveValue("Keep this unfinished thought");
  await expect(page.getByText("Count the blue buttons", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/private/tmp/homa-workspace-desktop.png" });
  await context.close();
});

test("workspace on a phone keeps the composer usable and covered conversation out of keyboard navigation", async () => {
  addMessage("This conversation stays mounted.");
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanner(page);
  await expect(page.getByText("Count the blue buttons", { exact: true })).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
  expect(await page.locator('[role="log"]').evaluate(element => Boolean(element.closest("[inert]")))).toBe(true);
  const panel = await page.getByRole("complementary").boundingBox(), input = await composer(page).boundingBox();
  expect(panel!.y + panel!.height).toBeLessThan(input!.y);
  await submit(page, "Keep planning while I type");
  await expect.poll(() => submissions.length).toBe(1);
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.screenshot({ path: "/private/tmp/homa-workspace-phone.png" });
  await page.getByRole("button", { name: "Close planner" }).click();
  await expect(page.getByRole("log")).toContainText("Keep planning while I type");
  await expect(page.getByRole("button", { name: "Start voice", exact: true })).toBeVisible();
  await context.close();
});

test("workspace retry never turns a failed load into an empty week", async () => {
  boardStatus = 503;
  const { context, page } = await open();
  await openPlanner(page);
  await expect(page.getByRole("alert")).toContainText("Your week couldn’t load");
  await expect(page.getByText("There's no month set up yet.")).toHaveCount(0);
  boardStatus = 200;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Count the blue buttons", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
  await context.close();
});

test("workspace deep links reject missing children and restore valid selection after refresh", async () => {
  const { context, page } = await open();
  await page.goto(`${origin}/?workspace=planner&child=not-a-family-child`);
  await expect(page.getByText("This child’s planner is no longer available to this account.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Show your family’s week" }).click();
  await page.getByRole("combobox").selectOption(plannerKids[1]!.id);
  await page.reload();
  await expect(page.getByText("Count the toy cars", { exact: true })).toBeVisible();
  await expect(page.getByText("Count the blue buttons", { exact: true })).toHaveCount(0);
  await context.close();
});

test("workspace completion uses the existing atomic endpoint and survives reopening", async () => {
  const { context, page } = await open();
  await openPlanner(page);
  await page.getByRole("button", { name: "Mark finished: Count the blue buttons" }).click();
  await expect.poll(() => checkWrites.length).toBe(1);
  expect(checkWrites[0]).toMatchObject({ childId: plannerKids[0]!.id, subjectId: "math", planRevision: 1, checkKey: "1.0", done: true });
  await page.getByRole("button", { name: "Close planner" }).click();
  await openPlanner(page);
  await page.getByRole("button", { name: "Show 1 finished activity" }).click();
  await expect(page.getByRole("button", { name: "Mark not finished: Count the blue buttons" })).toHaveAttribute("aria-pressed", "true");
  await context.close();
});

test("workspace removes private planner data immediately on sign out", async () => {
  const { context, page } = await open();
  await openPlanner(page);
  await expect(page.getByText("Count the blue buttons", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeDisabled();
  expect(new URL(page.url()).searchParams.has("workspace")).toBe(false);
  await context.close();
});

test("workspace fits a narrow short screen with large text and forced colors", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await openPlanner(page);
  await expect(page.getByRole("button", { name: "Close planner" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start voice", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const panel = await page.getByRole("complementary").boundingBox(), input = await composer(page).boundingBox();
  expect(panel!.height).toBeGreaterThan(100);
  expect(panel!.y + panel!.height).toBeLessThan(input!.y);
  await page.screenshot({ path: "/private/tmp/homa-workspace-phone-forced.png" });
  await context.close();
});


test("workspace phone keeps failed-message recovery above the composer", async () => {
  permanentRejection = true;
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await submit(page, "Please keep my words");
  const failure = page.getByRole("region", { name: "Message not sent" });
  await expect(failure).toBeVisible();
  await openPlanner(page);
  await expect(page.getByRole("complementary")).toBeVisible();
  const panel = await page.getByRole("complementary").boundingBox(), notice = await failure.boundingBox();
  expect(panel!.y + panel!.height).toBeLessThan(notice!.y);
  await failure.getByRole("button", { name: "Use as draft" }).click();
  await expect(composer(page)).toHaveValue("Please keep my words");
  await expect(page.getByRole("complementary")).toBeVisible();
  await context.close();
});


test("workspace calendar navigation restores exact dates without losing the chat", async () => {
  const { context, page } = await open();
  await composer(page).fill("Keep my draft");
  await openPlanner(page);
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByRole("region", { name: "Week summary" })).toBeVisible();
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/workspaceDate=2026-10-12/);
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("link", { name: "Month", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(composer(page)).toHaveValue("Keep my draft");
  await page.goBack();
  await expect(page.getByRole("link", { name: "Week", exact: true })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "/private/tmp/homa-workspace-calendar-week.png" });
  await context.close();
});

test("workspace event form survives a failed save and keeps the composer reachable", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await composer(page).fill("A thought for Homa");
  await openPlanner(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Event Appointment/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "What's happening?" }).fill("Nature walk");
  calendarFailure = true;
  await dialog.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("couldn’t be confirmed");
  await expect(dialog.getByRole("textbox", { name: "What's happening?" })).toHaveValue("Nature walk");
  await composer(page).fill("Still able to type");
  calendarFailure = false;
  await dialog.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Nature walk/ })).toBeVisible();
  expect(calendarWrites[1]).toMatchObject({ name: "createFamilyEventAction", args: [{ title: "Nature walk", startsOn: calendarToday, childIds: [] }] });
  await page.screenshot({ path: "/private/tmp/homa-workspace-calendar-phone.png" });
  await context.close();
});

test("workspace recurring deletion targets one occurrence and Escape keeps the planner open", async () => {
  calendarEvents = [{ id: "11111111-aaaa-4111-8111-111111111111", familyId, childId: plannerKids[0]!.id, childIds: [plannerKids[0]!.id],
    title: "Nature club", startsOn: calendarToday, endsOn: calendarToday, startTime: "10:00", endTime: "11:00", note: null,
    recurrence: { frequency: "weekly", interval: 1, weekdays: [1], until: null }, createdAt: "2026-10-01T16:00:00Z" }];
  const { context, page } = await open();
  await openPlanner(page);
  await page.getByRole("button", { name: /Nature club/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.getByRole("button", { name: /Nature club/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: /^Delete this event/ }).click();
  await expect.poll(() => calendarWrites.length).toBe(1);
  expect(calendarWrites[0]).toEqual({ name: "deleteFamilyEventOccurrenceAction", args: [calendarEvents[0]!.id, calendarToday] });
  await context.close();
});

test("workspace Add menu leaves the composer usable and Escape only closes the menu", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanner(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const menu = page.locator("[data-workspace-add-menu]");
  const box = await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  await composer(page).fill("Still here");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("complementary")).toBeVisible();
  await context.close();
});

test("workspace activity help sends separately without consuming the parent draft", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 1440, height: 900 });
  await composer(page).fill("Keep this thought.");
  await openPlanner(page);
  await page.getByText("Count the blue buttons", { exact: true }).click();
  await page.getByRole("button", { name: "Ask about the steps" }).click();
  await expect(composer(page)).toHaveValue("Keep this thought.");
  expect(submissions).toHaveLength(0);
  await page.getByRole("button", { name: "Send this question", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  await expect(composer(page)).toHaveValue("Keep this thought.");
  await expect(page.getByRole("region", { name: "Prepared question" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await context.close();
});

test("workspace event detail opens visibly after scrolling and restores the list position", async () => {
  calendarEvents = Array.from({ length: 24 }, (_, index) => ({ id: `event-${index}`, familyId, childId: null,
    title: `Outing ${String(index).padStart(2, "0")}`, startsOn: calendarToday, endsOn: calendarToday,
    startTime: null, endTime: null, note: null, createdAt: "2026-10-01T16:00:00Z" }));
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanner(page);
  await page.getByRole("button", { name: /Outing 23/ }).click();
  const title = page.getByRole("dialog").getByRole("heading", { name: "Outing 23" });
  await expect(title).toBeVisible();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  const panel = await page.getByRole("complementary").boundingBox(), heading = await title.boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(panel!.y);
  expect(heading!.y).toBeLessThan(panel!.y + panel!.height);
  await page.screenshot({ path: "/private/tmp/homa-workspace-calendar-detail.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  expect(await page.locator("[data-workspace-scroll]").evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  await context.close();
});

for (const width of [1440, 390]) test(`Binder and Progress stay in the workspace at ${width}px`, async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width, height: 1000 });
  await composer(page).fill("Keep this draft");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Binder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close binder" })).toBeVisible();
  await expect(page.getByText("Garden counting", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Garden counting/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");
  await composer(page).fill("Keep this draft while viewing a worksheet");
  const detail = await page.getByRole("dialog").boundingBox();
  const input = await composer(page).boundingBox();
  if (width < 960) expect(detail!.y + detail!.height).toBeLessThan(input!.y);
  await page.screenshot({ path: `/private/tmp/homa-binder-${width}.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Maya’s progress" })).toBeVisible();
  await page.getByLabel("Whose progress").selectOption("22222222-2222-4222-8222-222222222222");
  await expect(page.getByRole("heading", { name: "Leo’s progress" })).toBeVisible();
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");
  await composer(page).focus();
  await expect(composer(page)).toBeFocused();
  await page.screenshot({ path: `/private/tmp/homa-progress-detail-${width}.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Ask Homa about Leo" }).click();
  await expect(page.getByRole("button", { name: "Send this question", exact: true })).toBeFocused();
  await expect(composer(page)).toHaveValue("Keep this draft while viewing a worksheet");
  await page.getByRole("button", { name: "Dismiss question", exact: true }).click();
  await expect(composer(page)).toHaveValue("Keep this draft while viewing a worksheet");
  expect(submissions).toHaveLength(0);
  await page.screenshot({ path: `/private/tmp/homa-progress-${width}.png` });
  await page.getByRole("button", { name: "Close progress" }).click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Leo’s progress" })).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  await context.close();
});


test("unfinished workspace event survives close and section changes, then clears after save", async () => {
  const { context, page } = await open();
  await openPlanner(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Event Appointment, co-op, trip, or outing" }).click();
  await page.getByLabel("What's happening?").fill("Library afternoon");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByText("Unsaved event: Library afternoon")).toBeVisible();
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Binder", exact: true }).click();
  await openPlanner(page);
  await page.getByRole("button", { name: "Continue editing", exact: true }).click();
  await expect(page.getByLabel("What's happening?")).toHaveValue("Library afternoon");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(page.getByRole("button", { name: /Library afternoon Whole family/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue editing", exact: true })).toHaveCount(0);
  await context.close();
});

test("worksheet revision stays in App2 and does not send or overwrite the parent's draft", async () => {
  const { context, page } = await open();
  await composer(page).fill("My original thought");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: "Binder", exact: true }).click();
  await page.getByRole("button", { name: "Garden counting. View and print." }).click();
  await page.getByRole("button", { name: "Discuss changes" }).click();
  await expect(composer(page)).toHaveValue("My original thought");
  await expect(page.getByRole("region", { name: "Prepared question" })).toContainText("Garden counting");
  expect(context.pages()).toHaveLength(1);
  expect(submissions).toHaveLength(0);
  await context.close();
});


test("phone contextual send reveals the conversation and preserves a draft and attached file", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  await composer(page).fill("Ask about reading later");
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("My draft attachment") });
  await expect(page.getByLabel("Attachments").getByTitle("notes.txt")).toBeVisible();
  await openPlanner(page);
  await page.getByText("Count the blue buttons", { exact: true }).click();
  await page.getByRole("button", { name: "Ask about the steps" }).click();
  await page.getByRole("button", { name: "Send this question", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("Give me simple steps");
  await expect(composer(page)).toHaveValue("Ask about reading later");
  await expect(page.getByLabel("Attachments").getByTitle("notes.txt")).toBeVisible();
  expect(submissions[0].attachmentIds ?? []).toHaveLength(0);
  await context.close();
});

test("dismissing an empty-composer question keeps it empty and sign out clears an unsaved event", async () => {
  const { context, page } = await open();
  await openPlanner(page);
  await page.getByText("Count the blue buttons", { exact: true }).click();
  await page.getByRole("button", { name: "Ask about the steps" }).click();
  await expect(composer(page)).toHaveValue("");
  await page.getByRole("button", { name: "Dismiss question", exact: true }).click();
  await expect(composer(page)).toHaveValue("");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: /^Event Appointment/ }).click();
  await page.getByLabel("What's happening?").fill("Private event draft");
  await page.getByRole("button", { name: "Fixture sign out" }).click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByText("Private event draft")).toHaveCount(0);
  expect(submissions).toHaveLength(0);
  await context.close();
});


test("workspace primary actions retain readable foreground and background pairs", async () => {
  const { context, page } = await open();
  await openPlanner(page);
  async function contrast(name: string) {
    return page.getByRole("button", { name, exact: true }).evaluate(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
        const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => {
          const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ink = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05);
    });
  }
  expect(await contrast("Add")).toBeGreaterThanOrEqual(4.5);
  await page.getByText("Count the blue buttons", { exact: true }).click();
  expect(await contrast("Ask about the steps")).toBeGreaterThanOrEqual(4.5);
  await context.close();
});


test("saved activity plan adjusts locally and prepares an explicit save request", async () => {
  const { context, page } = await open();
  await page.setViewportSize({ width: 390, height: 844 });
  const message = addMessage("Here is a little counting plan.");
  fixtureMaterials = [{ id: "11111111-1111-4111-8111-111111111119", title: "Count together", kind: "other", skill: "Counting", childName: "Maya", previewUrl: "/fixture.png", pdfUrl: "/fixture.pdf", pageCount: 1, pagePreviewUrls: null, sources: [], sessionId: message.sessionId!, atMs: message.atMs, order: message.atMs, status: "draft", revisesId: null, reviewPass: true, activityPlan: { version: 1, introduction: "A little counting with things you already have.", minutes: 20, swapped: [], activities: [1, 2].map(n => ({ id: `step-${n}`, title: n === 1 ? "Count the buttons" : "Make a number trail", minutes: 10, instructions: n === 1 ? "Set out five buttons. Touch each one as you count together." : "Place number cards across the floor. Step along them and say each number.", materials: n === 1 ? ["Five buttons"] : ["Paper", "Pencil"], alternative: { title: `Count steps ${n}`, instructions: "Take five steps together, saying one number with each step." } })) } }];
  await page.reload();
  const card = page.getByRole("region", { name: "Count together activity plan" });
  await expect(card).toBeVisible();
  const slider = card.getByRole("slider");
  await slider.fill("25");
  await card.getByRole("button", { name: "Try another idea" }).first().click();
  await expect(card.getByText("Count steps 1", { exact: true })).toBeVisible();
  await expect(card.getByRole("status")).toContainText("not saved yet");
  expect(submissions).toHaveLength(0);
  await card.getByRole("button", { name: "Try this activity" }).first().click();
  await expect(card.getByRole("button", { name: "Help us get started" })).toBeVisible();
  expect(checkWrites).toHaveLength(0);
  await card.getByRole("button", { name: "Ask Homa to save changes" }).scrollIntoViewIfNeeded();
  const actionBox = await card.getByRole("button", { name: "Ask Homa to save changes" }).boundingBox();
  const composerBox = await composer(page).boundingBox();
  expect(actionBox!.y + actionBox!.height).toBeLessThan(composerBox!.y);
  await page.screenshot({ path: "/private/tmp/homa-activity-plan-phone.png" });
  await card.getByRole("button", { name: "Ask Homa to save changes" }).click();
  await expect(page.getByRole("button", { name: "Send this question" })).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.getByRole("button", { name: "Send this question" }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0].text).toContain("25 minutes");
  expect(submissions[0].text).toContain("Selected alternatives: step-1");
  await page.reload();
  await expect(slider).toHaveValue("20");
  await expect(card.getByRole("status")).toContainText("stored with your materials");
  expect(checkWrites).toHaveLength(0);
  await context.close();
});
