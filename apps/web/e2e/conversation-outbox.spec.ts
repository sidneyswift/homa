import { accessSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import serverlessChromium from "@sparticuz/chromium";
import { chromium, expect, test, type Browser } from "@playwright/test";

type Store = typeof import("../app/app2/conversation-local-store");
type Files = typeof import("../app/app2/conversation-file-staging");
let browser: Browser;
let server: Server;
let origin: string;

test.beforeAll(async () => {
  // Reuse the installed tsx compiler dependency, no runtime product dependency.
  const require = createRequire(resolve(process.cwd(), "package.json"));
  const compiler = createRequire(require.resolve("tsx"))("esbuild");
  const modules = new Map(["conversation-local-store", "conversation-outbox", "conversation-file-staging"].map(name => [
    `/${name}`, compiler.buildSync({ entryPoints: [resolve(process.cwd(), `app/app2/${name}.ts`)],
      bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" }).outputFiles[0].text,
  ]));
  const mounted = compiler.buildSync({
    stdin: { sourcefile: "draft-fixture.tsx", loader: "tsx", resolveDir: process.cwd(), contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { useConversationDraft } from './app/app2/use-conversation-draft';
      function Fixture() {
        const [account, setAccount] = useState<string|null>('adult-a');
        const draft = useConversationDraft(account);
        return <main><div data-testid="owner">{account}</div>
          <div data-testid="reply-target">{draft.replyToQuestionId ?? 'none'}</div>
          <button onClick={() => draft.setReplyToQuestionId('22222222-2222-4222-a222-222222222222')}>Reply to first question</button>
          <button onClick={() => draft.setReplyToQuestionId('33333333-3333-4333-a333-333333333333')}>Reply to second question</button>
          <button onClick={() => draft.clearReplyToQuestion()}>Clear reply target</button>
          <button onClick={() => setAccount(null)}>Log out</button>
          <button onClick={() => setAccount('adult-a')}>Log in</button>
          <button onClick={async () => {
            const pending = draft.queueDraft({ account, accessEpoch: '11111111-1111-4111-a111-111111111111',
              intentId: crypto.randomUUID(), text: draft.draft, submittedAt: Date.now() }, draft.draftRevision);
            draft.setDraft('Newer unsent words');
            draft.setReplyToQuestionId('33333333-3333-4333-a333-333333333333');
            await pending;
          }}>Queue and keep writing</button>
          <button onClick={() => setAccount(account === 'adult-a' ? 'adult-b' : 'adult-a')}>Switch account</button>
          <input aria-label="Draft" value={draft.draft} onChange={e => draft.setDraft(e.target.value)} />
          <button onClick={() => draft.queueDraft({ account, accessEpoch: '11111111-1111-4111-a111-111111111111',
            intentId: crypto.randomUUID(), text: draft.draft, submittedAt: Date.now() })}>Queue</button>
        </main>;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);
    ` }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2022",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  modules.set("/mounted-draft", mounted.outputFiles[0].text);
  server = createServer((request, response) => {
    const source = modules.get(request.url ?? "");
    response.writeHead(200, { "content-type": source ? "text/javascript" : "text/html" });
    response.end(source ?? (request.url === "/mounted"
      ? '<!doctype html><div id="root"></div><script src="/mounted-draft"></script>'
      : "<!doctype html><title>Conversation device storage test</title>"));
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  origin = `http://127.0.0.1:${address.port}`;
  let executablePath: string | undefined;
  for (const path of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]) {
    try { accessSync(path); executablePath = path; break; } catch { /* Next candidate. */ }
  }
  browser = await chromium.launch({ headless: true, executablePath: executablePath ?? await serverlessChromium.executablePath(),
    args: executablePath ? [] : serverlessChromium.args });
});

test.afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done()));
});

test("draft upgrade, immutable sends, two-tab order and exact acknowledgement survive reload", async () => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto(origin);
  await first.evaluate(async () => {
    await new Promise<void>((done, reject) => {
      const open = indexedDB.open("homa-conversation-v2", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("drafts");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put("Unsubmitted old draft", "adult-a");
        tx.oncomplete = () => { open.result.close(); done(); };
      };
    });
  });
  await second.goto(origin);
  const ids = ["ffffffff-ffff-4fff-afff-ffffffffffff", "00000000-0000-4000-a000-000000000000"];
  const firstState = await first.evaluate(async intentId => {
    const store = await (new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const restored = await store.readConversationDraft("adult-a");
    await store.queueConversationIntent({ account: "adult-a", accessEpoch: "11111111-1111-4111-a111-111111111111", intentId, text: restored, submittedAt: 100 });
    return { restored, draft: await store.readConversationDraft("adult-a"), pending: await store.listConversationIntents("adult-a") };
  }, ids[0]);
  expect(firstState.restored).toBe("Unsubmitted old draft");
  expect(firstState.pending).toHaveLength(1);
  const secondState = await second.evaluate(async intentId => {
    const store = await (new Function("return import('/conversation-local-store')")() as Promise<Store>);
    await store.writeConversationDraft("adult-a", "Keep this newer draft");
    await store.queueConversationIntent({ account: "adult-a", accessEpoch: "11111111-1111-4111-a111-111111111111", intentId, text: "Second submitted text", submittedAt: 1 });
    let conflict = false;
    try { await store.queueConversationIntent({ account: "adult-a", accessEpoch: "11111111-1111-4111-a111-111111111111", intentId, text: "Changed words", submittedAt: 1 }); }
    catch { conflict = true; }
    return { conflict, pending: await store.listConversationIntents("adult-a"),
      draft: await store.readConversationDraft("adult-a"), other: await store.listConversationIntents("adult-b") };
  }, ids[1]);
  expect(secondState.conflict).toBe(true);
  expect(secondState.pending.map(r => r.intentId)).toEqual(ids);
  expect(secondState.draft).toBe("Keep this newer draft");
  expect(secondState.other).toEqual([]);
  await first.reload();
  const afterReload = await first.evaluate(async () => {
    const store = await (new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const pending = await store.listConversationIntents("adult-a");
    const first = pending[0];
    const receipt = { intentId: first.intentId, requestId: crypto.randomUUID(), messageId: crypto.randomUUID() };
    await store.acknowledgeConversationIntent(first, receipt);
    await store.acknowledgeConversationIntent(first, receipt);
    return { pending: await store.listConversationIntents("adult-a"), draft: await store.readConversationDraft("adult-a") };
  });
  expect(afterReload.pending.map(r => r.intentId)).toEqual([ids[1]]);
  expect(afterReload.draft).toBe("Keep this newer draft");
  const revisions = await first.evaluate(async () => {
    const store = await (new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const old = crypto.randomUUID();
    const newer = crypto.randomUUID();
    await store.writeConversationDraft("adult-a", "Identical words", old);
    await store.writeConversationDraft("adult-a", "Identical words", newer);
    const entry = { account: "adult-a", accessEpoch: "11111111-1111-4111-a111-111111111111",
      intentId: crypto.randomUUID(), text: "Identical words", submittedAt: 3 };
    await store.queueConversationIntent(entry, old);
    const retained = await store.readConversationDraftState("adult-a");
    await store.rejectConversationIntent(entry, "rejected");
    const failures = await store.listFailedConversationIntents("adult-a");
    const pending = await store.listConversationIntents("adult-a");
    await store.clearConversationDeviceAccount("adult-a");
    return { retained, newer, failures, pendingCount: pending.length,
      cleared: await store.listConversationIntents("adult-a"), draft: await store.readConversationDraft("adult-a") };
  });
  expect(revisions.retained).toEqual({ text: "Identical words", revision: revisions.newer, replyToQuestionId: null });
  expect(revisions.pendingCount).toBe(1);
  expect(revisions.failures.map(r => r.text)).toEqual(["Identical words"]);
  expect(revisions.cleared).toEqual([]);
  expect(revisions.draft).toBe("");
  await context.close();
});

test("revoked access and deleted messages remove queued content without touching a new generation", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const store = await (new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const before = { account: "adult-a", accessEpoch: crypto.randomUUID(),
      intentId: crypto.randomUUID(), text: "Old pending words", submittedAt: 1 };
    const after = { ...before, accessEpoch: crypto.randomUUID(), intentId: crypto.randomUUID(), text: "New membership words" };
    await store.queueConversationIntent(before);
    await store.queueConversationIntent(after);
    await store.revokeConversationIntents(before.account, before.accessEpoch);
    const remaining = await store.listConversationIntents(before.account);
    await store.rejectConversationIntent(after, "deleted");
    await store.rejectConversationIntent(after, "deleted");
    const rows = await new Promise<unknown[]>(done => {
      const open = indexedDB.open("homa-conversation-v2");
      open.onsuccess = () => {
        const tx = open.result.transaction("outbox", "readonly");
        const rows = tx.objectStore("outbox").getAll();
        tx.oncomplete = () => { open.result.close(); done(rows.result); };
      };
    });
    return { remaining: remaining.map(r => r.text), rows, afterId: after.intentId };
  });
  expect(result.remaining).toEqual(["New membership words"]);
  expect(result.rows).toEqual([{ account: "adult-a", intentId: result.afterId, failure: "deleted" }]);
  await context.close();
});

test("mounted account switching never paints or writes another adult's draft", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/mounted`);
  const input = page.getByRole("textbox", { name: "Draft" });
  await input.fill("Adult A private draft");
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect(input).toHaveValue("");
  await input.fill("Adult B private draft");
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect(input).toHaveValue("Adult A private draft");
  await page.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(input).toHaveValue("");
  await page.getByRole("button", { name: "Switch account" }).click();
  await expect(input).toHaveValue("Adult B private draft");
  await context.close();
});


test("offline selected file bytes and explicit Send survive reload, preparation retry freezes receipt before admission",async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(origin);
  const identity=await page.evaluate(async()=>{
    const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const files=await(new Function("return import('/conversation-file-staging')")() as Promise<Files>);
    const account=`${crypto.randomUUID()}:${crypto.randomUUID()}`,accessEpoch=crypto.randomUUID(),intentId=crypto.randomUUID();
    const stagedAttachmentIds=await files.stageConversationFiles(account,[new File(["Exact private file bytes"],"worksheet.pdf",{type:"application/pdf"})]);
    await store.queueConversationIntent({account,accessEpoch,intentId,text:"",stagedAttachmentIds,submittedAt:1});
    return {account,accessEpoch,intentId,visible:(await files.readStagedConversationFiles(account)).length};
  });
  expect(identity.visible).toBe(0);await page.reload();
  const result=await page.evaluate(async identity=>{
    const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const files=await(new Function("return import('/conversation-file-staging')")() as Promise<Files>);
    const [entry]=await store.listConversationIntents(identity.account),[file]=await files.readStagedConversationFiles(identity.account,false);
    const receiptId=crypto.randomUUID();let uploads=0,prepares=0,failed=false;
    const dependencies={upload:async(_path:unknown,bytes:Blob)=>{uploads++;if(await bytes.text()!=="Exact private file bytes")throw new Error("bytes changed");return {url:"https://own.private.blob.vercel-storage.com/file"};},
      image:async()=>null,fetch:async(_url:unknown,options:RequestInit)=>{
        if(options.credentials!=="omit" || (options.headers as Record<string,string>).authorization!=="Bearer first-adult")throw new Error("wrong auth");
        prepares++;if(prepares===1)throw new Error("receipt confirmation lost");return Response.json({ok:true,receipts:[{id:receiptId}]});
      }} as unknown as Parameters<Files["prepareStagedConversationIntent"]>[3];
    try{await files.prepareStagedConversationIntent(entry,"first-adult",new AbortController().signal,dependencies);}catch{failed=true;}
    const prepared=await files.prepareStagedConversationIntent(entry,"first-adult",new AbortController().signal,dependencies);
    const frozen=(await store.listConversationIntents(identity.account))[0];
    let changed=false;
    try{await files.finalizeStagedConversationIntent({...entry,text:"changed"},[crypto.randomUUID()]);}catch{changed=true;}
    await store.acknowledgeConversationIntent(prepared,{intentId:entry.intentId,requestId:crypto.randomUUID(),messageId:crypto.randomUUID()});
    return {bytes:await file.bytes.text(),failed,uploads,prepares,receiptId,preparedIds:prepared.attachmentIds,frozenIds:frozen.attachmentIds,changed,
      other:(await files.readStagedConversationFiles("other",false)).length,remaining:(await files.readStagedConversationFiles(identity.account,false)).length};
  },identity);
  expect(result.bytes).toBe("Exact private file bytes");expect(result.failed).toBe(true);expect(result.uploads).toBe(1);expect(result.prepares).toBe(2);
  expect(result.preparedIds).toEqual([result.receiptId]);expect(result.frozenIds).toEqual([result.receiptId]);expect(result.changed).toBe(true);
  expect(result.other).toBe(0);expect(result.remaining).toBe(0);await context.close();
});

test("draft files are not submitted on reload and logout removes staged bytes and pending intents",async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(origin);
  const account=await page.evaluate(async()=>{
    const files=await(new Function("return import('/conversation-file-staging')")() as Promise<Files>);
    const account=`${crypto.randomUUID()}:${crypto.randomUUID()}`;
    await files.stageConversationFiles(account,[new File(["unsent"],"draft.txt",{type:"text/plain"})]);return account;
  });await page.reload();
  const result=await page.evaluate(async account=>{
    const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);
    const files=await(new Function("return import('/conversation-file-staging')")() as Promise<Files>);
    const before=await files.readStagedConversationFiles(account),pending=await store.listConversationIntents(account);
    await store.clearConversationDeviceAccount(account);
    return {before:before.length,pending:pending.length,after:(await files.readStagedConversationFiles(account,false)).length};
  },account);expect(result).toEqual({before:1,pending:0,after:0});await context.close();
});


test("question reply targets restore without sending and stay with the owning adult",async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(`${origin}/mounted`);
  const input=page.getByRole("textbox",{name:"Draft"}),target=page.getByTestId("reply-target");
  await page.getByRole("button",{name:"Reply to first question",exact:true}).click();
  await input.fill("My answer to the older question");
  await expect.poll(()=>page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);return (await store.readConversationDraftState("adult-a")).text;})).toBe("My answer to the older question");await page.reload();
  await expect(input).toHaveValue("My answer to the older question");await expect(target).toHaveText("22222222-2222-4222-a222-222222222222");
  await page.getByRole("button",{name:"Switch account"}).click();await expect(input).toHaveValue("");await expect(target).toHaveText("none");
  await page.getByRole("button",{name:"Reply to second question",exact:true}).click();await input.fill("Another adult's answer");
  await page.getByRole("button",{name:"Switch account"}).click();await expect(input).toHaveValue("My answer to the older question");
  await expect(target).toHaveText("22222222-2222-4222-a222-222222222222");
  await page.getByRole("button",{name:"Clear reply target"}).click();
  await expect.poll(()=>page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);return (await store.readConversationDraftState("adult-a")).replyToQuestionId;})).toBe(null);await page.reload();
  await expect(input).toHaveValue("My answer to the older question");await expect(target).toHaveText("none");
  expect(await page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);return (await store.listConversationIntents("adult-a")).length;})).toBe(0);
  await context.close();
});

test("sending a question reply preserves a newer draft and its different reply target",async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(`${origin}/mounted`);
  await page.getByRole("button",{name:"Reply to first question",exact:true}).click();
  await page.getByRole("textbox",{name:"Draft"}).fill("Submitted older answer");
  await page.getByRole("button",{name:"Queue and keep writing"}).click();
  await expect(page.getByRole("textbox",{name:"Draft"})).toHaveValue("Newer unsent words");
  const state=await page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);
    return {pending:await store.listConversationIntents("adult-a"),draft:await store.readConversationDraftState("adult-a")};});
  expect(state.pending).toHaveLength(1);expect(state.pending[0].text).toBe("Submitted older answer");
  expect(state.pending[0].replyToQuestionId).toBe("22222222-2222-4222-a222-222222222222");
  expect(state.draft.text).toBe("Newer unsent words");expect(state.draft.replyToQuestionId).toBe("33333333-3333-4333-a333-333333333333");
  await page.reload();await expect(page.getByRole("textbox",{name:"Draft"})).toHaveValue("Newer unsent words");
  await expect(page.getByTestId("reply-target")).toHaveText("33333333-3333-4333-a333-333333333333");await context.close();
});

test("target-only drafts survive refresh, while logout clears the target and pending writes",async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(`${origin}/mounted`);
  await page.getByRole("button",{name:"Reply to first question",exact:true}).click();
  await expect.poll(()=>page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);return (await store.readConversationDraftState("adult-a")).replyToQuestionId;})).toBe("22222222-2222-4222-a222-222222222222");await page.reload();
  await expect(page.getByTestId("reply-target")).toHaveText("22222222-2222-4222-a222-222222222222");
  await page.getByRole("textbox",{name:"Draft"}).fill("Private answer");await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Draft"})).toHaveValue("");await expect(page.getByTestId("reply-target")).toHaveText("none");
  await expect.poll(()=>page.evaluate(async()=>{const store=await(new Function("return import('/conversation-local-store')")() as Promise<Store>);
    return await store.readConversationDraftState("adult-a");})).toEqual({text:"",revision:null,replyToQuestionId:null});
  await page.getByRole("button",{name:"Log in",exact:true}).click();await expect(page.getByRole("textbox",{name:"Draft"})).toHaveValue("");
  await expect(page.getByTestId("reply-target")).toHaveText("none");await context.close();
});

test("last verified access survives refresh for offline Send and logout clears it", async () => {
  const context = await browser.newContext(); const page = await context.newPage(); await page.goto(origin);
  const epoch = "11111111-1111-4111-a111-111111111111";
  await page.evaluate(async value => {
    const store = await import(String("/conversation-local-store")) as Store;
    await store.writeConversationDeviceAccess("adult-a", value);
  }, epoch);
  await page.reload();
  expect(await page.evaluate(async () => (await import(String("/conversation-local-store")) as Store).readConversationDeviceAccess("adult-a"))).toBe(epoch);
  await page.evaluate(async () => {
    const store = await import(String("/conversation-local-store")) as Store;
    await store.clearConversationDeviceAccount("adult-a");
  });
  expect(await page.evaluate(async () => (await import(String("/conversation-local-store")) as Store).readConversationDeviceAccess("adult-a"))).toBeNull();
  await context.close();
});

test("native answers survive refresh and cannot change choice under an existing intent", async () => {
  const context = await browser.newContext(); const page = await context.newPage(); await page.goto(origin);
  await page.evaluate(async () => {
    const store = await import(String("/conversation-local-store")) as Store;
    await store.queueConversationIntent({ account: "adult-a", accessEpoch: "11111111-1111-4111-a111-111111111111",
      intentId: "22222222-2222-4222-a222-222222222222", text: "No", submittedAt: 1,
      nativeInput: { batchId: "33333333-3333-4333-a333-333333333333", responses: [{ requestId: "approval", optionId: "deny" }] } });
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const store = await import(String("/conversation-local-store")) as Store;
    const [entry] = await store.listConversationIntents("adult-a");
    let conflict = false;
    try { await store.queueConversationIntent({ ...entry, nativeInput: { ...entry.nativeInput!, responses: [{ requestId: "approval", optionId: "approve" }] } }); }
    catch { conflict = true; }
    return { conflict, nativeInput: entry.nativeInput };
  });
  expect(result.conflict).toBe(true); expect(result.nativeInput?.responses).toEqual([{ requestId: "approval", optionId: "deny" }]);
  await context.close();
});
