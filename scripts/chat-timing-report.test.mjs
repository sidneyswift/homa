import assert from 'node:assert/strict';
import test from 'node:test';
import { intervalUnion, extractTimingRecords, timingReport, spanAttribution, browserTimeline } from './chat-timing-report.mjs';
test('overlap is counted once and uncovered intervals remain explicit',()=>{
 assert.deepEqual(intervalUnion([[2,5],[3,7],[8,9]],0,10),{coveredMs:6,gaps:[[0,2],[7,8],[9,10]]});
});
test('only timing records survive extraction, with no unrelated private logs',()=>{
 const data='{"message":"private family text"}\n'+JSON.stringify({message:'[chat-timing] '+JSON.stringify({version:1,kind:'mark',name:'model.input_ready',sendId:'a'})});
 assert.equal(extractTimingRecords(data).length,1);assert.equal(JSON.stringify(extractTimingRecords(data)).includes('private'),false);
});
test('missing first visible text and unfinished operations are not reported as success',()=>{
 const records=[{version:1,kind:'browser.mark',sendId:'a',name:'send.begin',atMs:100,elapsedMs:0},{version:1,kind:'mark',sendId:'a',sessionId:'s',name:'model.input_ready',atMs:110},{version:1,kind:'runtime',phase:'start',sessionId:'s',receiptId:'r',name:'waiting',startedAtMs:105}];
 const t=timingReport(records).turns[0];assert.equal(t.firstVisibleMs,null);assert.deepEqual(t.incompleteOperations,['waiting']);
});

test('parent time is not counted as explained and cross-clock children are excluded',()=>{
 const parent={kind:'span',name:'parent',clockId:'a',traceId:'t',spanId:'p',startedAtMs:0,durationMs:10};
 const child={kind:'span',name:'child',clockId:'a',traceId:'t',spanId:'c',parentSpanId:'p',startedAtMs:2,durationMs:3};
 const other={...child,clockId:'b',startedAtMs:0,durationMs:10};
 const result=spanAttribution([parent,child,other])[0];
 assert.equal(result.childCoveredMs,3);assert.equal(result.selfOrUnexplainedMs,7);
});
test('browser timeline includes pre-handoff queue time without double counting',()=>{
 const result=browserTimeline([{kind:'browser.mark',name:'send.begin',elapsedMs:20},{kind:'browser.mark',name:'answer.dom_visible',elapsedMs:30}]);
 assert.equal(result[0].durationMs,20);assert.equal(result.reduce((sum,r)=>sum+r.durationMs,0),30);
});

test('batched platform logs retain each individual timing record',()=>{
 const raw=JSON.stringify({message:'[chat-timing] '+JSON.stringify({version:1,kind:'batch',records:[{version:1,kind:'mark',name:'first'},{version:1,kind:'mark',name:'last'}]})});
 assert.deepEqual(extractTimingRecords(raw).map(r=>r.name),['first','last']);
});

test('managed receipts bridge platform traces without importing later turns or other clocks',()=>{
 const records=[
  {kind:'browser.mark',sendId:'a',name:'send.begin',atMs:10000,elapsedMs:0},
  {kind:'browser.mark',sendId:'a',name:'answer.dom_visible',atMs:11000,elapsedMs:1000},
  {kind:'mark',sendId:'a',sessionId:'s',atMs:10500},
  {kind:'runtime',sessionId:'s',clockId:'worker',spanId:'dispatch',startedAtMs:10300},
  {kind:'span',clockId:'worker',spanId:'dispatch',traceId:'startup',startedAtMs:10300,durationMs:100},
  {kind:'span',clockId:'worker',spanId:'parent',traceId:'startup',startedAtMs:10200,durationMs:200},
  {kind:'span',clockId:'other',spanId:'dispatch',traceId:'unrelated',startedAtMs:10300,durationMs:100},
  {kind:'runtime',sessionId:'s',clockId:'worker',spanId:'later',startedAtMs:15000},
  {kind:'span',clockId:'worker',spanId:'later',traceId:'later-turn',startedAtMs:15000,durationMs:100},
 ];
 const result=timingReport(records).turns[0].records;
 assert.ok(result.some(r=>r.spanId==='parent'));
 assert.equal(result.some(r=>r.traceId==='unrelated'||r.traceId==='later-turn'),false);
});
