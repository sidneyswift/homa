import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { chromium, expect, test, type Browser } from "@playwright/test";

const fixtureRequire = createRequire(resolve(process.cwd(), "package.json"));
const esbuild = fixtureRequire(fixtureRequire.resolve("esbuild", {paths: [fixtureRequire.resolve("tsx")]}));
const postcss = fixtureRequire(fixtureRequire.resolve("postcss", {paths: [fixtureRequire.resolve("@tailwindcss/postcss")]}));
const tailwind = fixtureRequire("@tailwindcss/postcss");
const childId = "11111111-1111-4111-8111-111111111111";
let browser: Browser;
let server: Server;
let origin: string;
let sends: unknown[] = [];
let receiptStatus: "not_started" | "accepted" | "delivered" | "terminal" = "not_started";
let unavailable = false;
let receiptRevision = 1;
const screenshots = resolve(process.env.DEEPER_PROGRESS_SCREENSHOTS ?? "test-results/deeper-progress");

const entry = `
import React, {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useSelectedAssessment} from './app/app/use-selected-assessment';
import {SelectedAssessmentNotice} from './app/app/selected-assessment-notice';
import {ProgressQuestionCard} from './app/app/progress-question-card';
import {ProgressWorkflowCard} from './app/app/progress-workflow-card';
import {ProgressSubjects} from './components/progress/progress-subjects';
import {PROGRESS_FIXTURE_VIEW} from './components/progress/progress-view.fixture';
import {resolveAssessmentAction} from './lib/child-progress/assessment-intent';
const params=new URLSearchParams(location.search);
const action=resolveAssessmentAction({requestId:params.get('request'),childId:'${childId}',subjectId:'math'},[{id:'${childId}',name:'Maya'}]);
function App(){
 const [ready,setReady]=useState(params.get('ready')!=='false');
 const [walled,setWalled]=useState(params.get('wall')==='true');
 const [draft,setDraft]=useState('My unrelated draft');
 const selected=useSelectedAssessment({action:params.get('mode')==='handoff'?action:null,storageKey:'deeper-fixture',ready,walled,send:(message,source)=>{fetch('/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,source})});return 'sent';}});
 if(params.get('mode')==='return') return <main><h1 id="progress-heading" tabIndex={-1}>Maya's Progress</h1><ProgressSubjects childId="${childId}" initialSubjectId={params.get('subject')} subjects={PROGRESS_FIXTURE_VIEW.subjects} tiles={[]} conflicts={[]} timeZone="America/New_York" deeperChecks><p>Progress overview</p></ProgressSubjects></main>;
 if(params.get('mode')==='question') return <main><ProgressQuestionCard card={{checkInId:'${childId}',revision:1,childName:'Maya',subjectDisplayName:'Math',statement:'Maya counts out loud to 10 without skipping numbers.',answerLabels:['Easily','Getting there','Not yet','Not sure','Skip'],acceptedResponseCount:2,responseLimit:8}} onSendSuggestion={setDraft} onFocusComposer={()=>document.querySelector("textarea")?.focus()}/><label>Message<textarea value={draft} onChange={e=>setDraft(e.target.value)}/></label></main>;
 if(params.get('mode')==='complete') return <main><ProgressWorkflowCard item={{kind:'progress_workflow',label:'Check-in saved',scope:{childId:'${childId}',childName:'Maya',subjectId:'math',subjectDisplayName:'Math'},completion:{reason:params.get('reason')||'sitting_limit',acceptedResponseCount:8,uncertainResponseCount:2,mixedEvidence:params.has('mixed')}}}/></main>;
 return <main><SelectedAssessmentNotice action={action} unavailable={false} state={selected.state} walled={walled} onRetry={selected.retry} onAccountSetup={()=>setWalled(false)}/><label>Message<textarea value={draft} onChange={e=>setDraft(e.target.value)}/></label><button onClick={()=>setReady(!ready)}>Toggle ready</button><output data-testid="state">{selected.state}</output></main>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`;

test.beforeAll(async () => {
  mkdirSync(screenshots, {recursive: true});
  const built = await esbuild.build({stdin: {contents: entry, resolveDir: process.cwd(), loader: "tsx"}, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: {"process.env.NODE_ENV": '"development"'}, plugins: [{name: "fixture-boundaries", setup(build: {onResolve: (options: {filter: RegExp; namespace?: string}, callback: (args: {path: string; importer: string}) => unknown) => void; onLoad: (options: {filter: RegExp; namespace?: string}, callback: (args: {path: string}) => unknown) => void}) {
      build.onResolve({filter: /^next\/(server|headers)$/}, (args: {path: string; importer: string}) => {throw new Error(`Unexpected server import ${args.path} from ${args.importer}`);});
      build.onResolve({filter: /assessment-actions$/}, () => ({path: "actions", namespace: "fixture"}));
      build.onResolve({filter: /view-context-actions$/}, () => ({path: "view", namespace: "fixture"}));
      build.onResolve({filter: /^next\/navigation$/}, () => ({path: "navigation", namespace: "fixture"}));
      build.onResolve({filter: /^next\/link$/}, () => ({path: "link", namespace: "fixture"}));
      build.onLoad({filter: /.*/, namespace: "fixture"}, (args: {path: string}) => ({loader: "tsx", resolveDir: process.cwd(), contents: args.path === "navigation" ? `export const useRouter=()=>({push:href=>location.assign(href),refresh:()=>{}});` : args.path === "view" ? `export const setViewContextAction=async()=>{};` : args.path === "actions"
        ? `export const selectedAssessmentStatus=async action=>{const r=await fetch('/status');return r.json()};export const clearSelectedAssessment=async()=>{};`
        : `import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}` }));
    }}]});
  const css = await postcss([tailwind({base: process.cwd()})]).process(readFileSync(resolve("app/globals.css"), "utf8"), {from: resolve("app/globals.css")});
  const chunks = resolve(".next/static/chunks");
  const fonts = existsSync(chunks) ? readdirSync(chunks).filter(name=>name.endsWith(".css")).flatMap(name=>readFileSync(resolve(chunks,name),"utf8").match(/@font-face\{[^}]+\}/g) ?? []).join("\n").replaceAll("../media/", "/fonts/") : "";
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://fixture.invalid");
    if (url.pathname.startsWith("/fonts/") && /^[a-zA-Z0-9._-]+\.woff2$/.test(url.pathname.slice(7))) {res.setHeader("content-type","font/woff2");res.end(readFileSync(resolve(".next/static/media",url.pathname.slice(7))));return;}
    if (url.pathname === "/bundle.js") {res.setHeader("content-type", "text/javascript"); res.end(built.outputFiles[0].text); return;}
    if (url.pathname === "/style.css") {res.setHeader("content-type", "text/css"); res.end(css.css + fonts + ":root{--font-dm-sans:\"DM Sans\";--font-eb-garamond:\"EB Garamond\"}body{margin:0}main{padding:20px;max-width:700px;margin:auto}textarea{display:block;width:100%}"); return;}
    if (url.pathname === "/status") {res.setHeader("content-type", "application/json");res.end(JSON.stringify({status: unavailable ? "unavailable" : receiptStatus, checkInId: childId, revision: receiptRevision}));return;}
    if (url.pathname === "/send") {let body="";for await(const chunk of req)body+=chunk;sends.push(JSON.parse(body));res.end("ok");return;}
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}), headless: true});
});
test.beforeEach(() => {sends=[];receiptStatus="not_started";receiptRevision=1;unavailable=false;});
test.afterAll(async () => {await browser?.close();await new Promise<void>(done => server?.close(()=>done()));});

test("dispatches exactly once after restore, preserves draft, and reload only checks the same action", async () => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  const request = randomUUID();
  await page.goto(`${origin}/app?mode=handoff&request=${request}&ready=false`);
  await expect(page.getByTestId("state")).toHaveText("opening");
  expect(sends).toHaveLength(0);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(screenshots,"opening-390.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button", {name: "Toggle ready"}).click();
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toEqual({message: "Ask me deeper math questions for Maya.", source: {kind:"assessment_action",assessmentAction:{requestId:request,childId,subjectId:"math"}}});
  await expect(page.getByRole("textbox", {name: "Message"})).toHaveValue("My unrelated draft");
  await page.reload();
  await page.getByRole("button", {name: "Toggle ready"}).click();
  await expect(page.getByTestId("state")).toHaveText("uncertain");
  await page.screenshot({path:resolve(screenshots,"uncertain-390.png"),fullPage:true,animations:"disabled"});
  expect(sends).toHaveLength(1);
  await page.getByRole("button", {name: "Check and try again"}).click();
  await expect.poll(() => sends.length).toBe(2);
  expect(sends[1]).toEqual(sends[0]);
  receiptStatus = "delivered";
  await expect(page.getByTestId("state")).toHaveText("complete", {timeout: 12_000});
  expect(new URL(page.url()).searchParams.has("request")).toBe(false);
  expect(sends).toHaveLength(2);
  await context.close();
});

test("holds the selected scope through the account wall, and unavailable receipt reads never dispatch", async () => {
  const context = await browser.newContext({viewport:{width:390,height:844}});const page = await context.newPage();
  await page.goto(`${origin}/app?mode=handoff&request=${randomUUID()}&wall=true`);
  await expect(page.getByRole("status").filter({hasText:"Math questions for Maya"})).toContainText("Math questions for Maya");
  expect(sends).toHaveLength(0);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(screenshots,"account-wall-390.png"),fullPage:true,animations:"disabled"});
  unavailable=true;
  await page.getByRole("button", {name:"Continue account setup"}).click();
  await expect(page.getByTestId("state")).toHaveText("unavailable");
  await page.screenshot({path:resolve(screenshots,"unavailable-390.png"),fullPage:true,animations:"disabled"});
  expect(sends).toHaveLength(0);
  await context.close();
});

test("delivered receipt replay finishes without sending another model turn", async () => {
  receiptStatus="delivered";const context=await browser.newContext();const page=await context.newPage();
  await page.goto(`${origin}/app?mode=handoff&request=${randomUUID()}`);
  await expect(page.getByTestId("state")).toHaveText("complete");expect(sends).toHaveLength(0);
  await context.close();
});

test("actual question and completion cards fit narrow screens and return to the exact subject", async () => {
  const context = await browser.newContext({viewport:{width:320,height:740}});const page=await context.newPage();
  await page.goto(`${origin}/app?mode=question`);
  await expect(page.getByRole("region",{name:"Progress question for Maya"})).toContainText("2 of 8 answers");
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:resolve(screenshots,"question-320.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Ask Homa something else",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Message"})).toBeFocused();
  await expect(page.getByRole("textbox",{name:"Message"})).toHaveValue("My unrelated draft");
  await page.getByRole("button",{name:"Getting there",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Message"})).toHaveValue("Getting there");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto(`${origin}/app?mode=complete&mixed=1`);
  await expect(page.getByText("Some answers point in different directions, so this check-in leaves that open.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Open updated Progress"})).toHaveAttribute("href",`/app/${childId}/progress?subject=math`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:resolve(screenshots,"completion-mixed-320.png"),fullPage:true,animations:"disabled"});
  await page.goto(`${origin}/app/${childId}/progress?mode=return&subject=math`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Math",exact:true})).toBeVisible();
  await page.screenshot({path:resolve(screenshots,"selected-subject-320.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Close",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#progress-heading")).toBeFocused();
  await context.close();
});

test("reload after a committed start exposes explicit recovery until its exact question is delivered", async () => {
  receiptStatus = "accepted";
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  const request = randomUUID();
  await page.goto(`${origin}/app?mode=handoff&request=${request}`);
  await expect(page.getByTestId("state")).toHaveText("accepted");
  expect(sends).toHaveLength(0);
  expect(new URL(page.url()).searchParams.get("request")).toBe(request);
  await page.reload();
  await expect(page.getByTestId("state")).toHaveText("accepted");
  expect(sends).toHaveLength(0);
  await page.screenshot({path: resolve(screenshots, "accepted-undelivered-390.png"), fullPage: true, animations: "disabled"});
  await page.getByRole("button", {name: "Check and try again"}).click();
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toEqual({message: "Ask me deeper math questions for Maya.", source: {kind: "assessment_action",
    assessmentAction: {requestId: request, childId, subjectId: "math", retryRevision: 1}}});
  await expect(page.getByRole("textbox", {name: "Message"})).toHaveValue("My unrelated draft");
  receiptRevision = 2;
  await page.reload();
  await expect(page.getByTestId("state")).toHaveText("accepted");
  expect(new URL(page.url()).searchParams.get("request")).toBe(request);
  expect(sends).toHaveLength(1);
  await page.getByRole("button", {name: "Check and try again"}).click();
  await expect.poll(() => sends.length).toBe(2);
  expect(sends[1]).toEqual({message: "Ask me deeper math questions for Maya.", source: {kind: "assessment_action",
    assessmentAction: {requestId: request, childId, subjectId: "math", retryRevision: 2}}});
  receiptStatus = "delivered";
  await expect(page.getByTestId("state")).toHaveText("complete", {timeout: 12_000});
  expect(new URL(page.url()).searchParams.has("request")).toBe(false);
  expect(sends).toHaveLength(2);
  await context.close();
});

test("a terminal selected action never starts another sitting on reload", async () => {
  receiptStatus = "terminal";
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/app?mode=handoff&request=${randomUUID()}`);
  await expect(page.getByTestId("state")).toHaveText("complete");
  expect(sends).toHaveLength(0);
  await context.close();
});
