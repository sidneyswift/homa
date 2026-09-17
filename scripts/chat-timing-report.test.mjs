import assert from 'node:assert/strict';
import test from 'node:test';
import { intervalUnion, extractTimingRecords, timingReport } from './chat-timing-report.mjs';
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
