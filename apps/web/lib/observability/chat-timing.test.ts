import assert from "node:assert/strict";
import test from "node:test";
import { type ReadableSpan } from "@opentelemetry/sdk-trace-node";

import { registerChatTiming, spanRecord, timeServer } from "./chat-timing-server";
import { registerTimingFetch, timedSql } from "./chat-timing-io";
import { chatTimingMiddleware } from "./chat-timing-model";
import { browserTimingBatch } from "./chat-timing-browser-contract";
import { timingId, timingRecord, flushTimingRecords } from "./chat-timing";

test("span export excludes prompts, SQL, errors, tool payloads and unknown event attributes", () => {
  const span = {
    name:"ai.streamText", attributes:{"ai.prompt":"PRIVATE","db.statement":"PRIVATE","eve.session.id":"session", "ai.usage.inputTokens":42,"ai.settings.context.homa.send.id":"send","ai.settings.context.private":"PRIVATE"},
    startTime:[1,0], duration:[0,12500000], status:{code:2,message:"PRIVATE"},
    spanContext:()=>({traceId:"trace",spanId:"span"}),
    events:[{name:"exception",time:[1,0],attributes:{message:"PRIVATE"}},{name:"model.first_answer_text",time:[1,1000000],attributes:{text:"PRIVATE"}}],
  } as unknown as ReadableSpan;
  const result=spanRecord(span);assert.equal(result.durationMs,12.5);assert.equal(result.outcome,"error");
  assert.equal(JSON.stringify(result).includes("PRIVATE"),false);assert.equal(result.events.length,1);assert.equal(result.attributes["homa.send.id"],"send");
});
test("correlation accepts only bounded opaque IDs",()=>{
  assert.equal(timingId("secret-token"),undefined);assert.equal(timingId("a".repeat(10000)),undefined);
  assert.equal(timingId("00112233-4455-6677-8899-aabbccddeeff"),"00112233-4455-6677-8899-aabbccddeeff");
});
test("timing preserves the original result and rejection",async()=>{
  const result={ok:true};assert.equal(await timeServer("homa.test",()=>result),result);
  const error=new Error("private");await assert.rejects(timeServer("homa.test",()=>Promise.reject(error)),e=>e===error);
});
test("SQL observer remains lazy and executes only once when awaited twice",async()=>{
  let executed=0;const rows=[{value:7}];const query={then(resolve:(v:typeof rows)=>unknown){executed++;return Promise.resolve(rows).then(resolve);}};
  const sql=timedSql(()=>query);const pending=sql();assert.equal(executed,0);
  assert.equal(await pending,rows);assert.equal(await pending,rows);assert.equal(executed,1);
});
test("SQL fluent operations retain receiver and cancellation",async()=>{
  let cancelled=false;const value={then(resolve:(v:number)=>unknown){return Promise.resolve(7).then(resolve);},values(){assert.equal(this,value);return this;},cancel(){cancelled=true;}};
  const pending=timedSql(()=>value)();assert.equal(await pending.values(),7);pending.cancel();assert.equal(cancelled,true);
});
test("provider observer preserves every chunk and propagates cancellation",async()=>{
  const chunks=[{type:"reasoning-delta",id:"r",delta:"hidden"},{type:"text-delta",id:"t",delta:"answer"}];let cancelled=false;
  const upstream=new ReadableStream({pull(c){const next=chunks.shift();if(next)c.enqueue(next);else c.close();},cancel(){cancelled=true;}},{highWaterMark:0});
  const wrap=chatTimingMiddleware.wrapStream!;
  const output=await wrap({doStream:async()=>({stream:upstream}),params:{}} as unknown as Parameters<typeof wrap>[0]);
  const reader=output.stream.getReader();assert.deepEqual((await reader.read()).value,{type:"reasoning-delta",id:"r",delta:"hidden"});
  assert.deepEqual((await reader.read()).value,{type:"text-delta",id:"t",delta:"answer"});await reader.cancel();assert.equal(cancelled,true);
});

test("browser contract rejects content, forged labels and oversized batches",()=>{
  const record={kind:"browser.mark",name:"send.begin",sendId:"00112233-4455-4677-8899-aabbccddeeff",atMs:100,elapsedMs:0};
  assert.equal(browserTimingBatch.safeParse([record]).success,true);
  assert.equal(browserTimingBatch.safeParse([{...record,message:"private"}]).success,false);
  assert.equal(browserTimingBatch.safeParse([{...record,name:"private-message-content"}]).success,false);
  assert.equal(browserTimingBatch.safeParse(Array(201).fill(record)).success,false);
});


test("outbound observer preserves lazy bytes, response metadata and cancellation", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  registerChatTiming();
  let pulls = 0, cancelled = false;
  const bytes = new Uint8Array([1, 2, 3]);
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    const response = new Response(new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(bytes); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }), { status: 206, headers: { "x-test": "present" } });
    Object.defineProperty(response, "url", { value: "https://example.com/private" });
    return response;
  };
  try {
    registerTimingFetch();
    await timeServer("homa.test.request", async () => {
      const response = await fetch("https://example.com/private");
      assert.equal(pulls, 0);
      flushTimingRecords();
      assert.ok(logs.some(row => String(row[1]).includes('"kind":"span","name":"homa.http.outbound"')), "request headers must be timed even if nobody reads the body");
      assert.equal(response.status, 206);
      assert.equal(response.url, "https://example.com/private");
      assert.equal(response.headers.get("x-test"), "present");
      const reader = response.body!.getReader();
      assert.deepEqual((await reader.read()).value, bytes);
      await reader.cancel();
    });
    assert.equal(cancelled, true);
    flushTimingRecords();
    const records = logs.filter(row => row[0] === "[chat-timing]").flatMap(row => { const record = JSON.parse(row[1] as string); return record.kind === "batch" ? record.records : [record]; });
    const outbound = records.find(row => row.kind === "span" && row.name === "homa.http.outbound");
    const parent = records.find(row => row.kind === "span" && row.name === "homa.test.request");
    assert.ok(outbound && parent);
    assert.equal(outbound.parentSpanId, parent.spanId);
    assert.equal(outbound.traceId, parent.traceId);
    assert.doesNotMatch(JSON.stringify(records), /private/);
  } finally { globalThis.fetch = original; }
});


test("batched timing retains every record within bounded log entries", t => {
  flushTimingRecords();
  const entries: string[] = [];
  t.mock.method(console, "info", (_label: string, value: string) => entries.push(value));
  for (let i = 0; i < 1500; i++) timingRecord({ kind: "test", index: i });
  flushTimingRecords();
  const records = entries.flatMap(entry => JSON.parse(entry).records);
  assert.equal(records.length, 1500);
  assert.deepEqual(records.map(record => record.index), Array.from({length: 1500}, (_, i) => i));
  assert.ok(entries.length < 50);
  assert.ok(entries.every(entry => entry.length < 17000));
});
