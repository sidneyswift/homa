import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Union, not sum: nested and parallel spans must not inflate accounted time. */
export function intervalUnion(intervals, lower, upper) {
  const sorted = intervals.map(([a,b])=>[Math.max(lower,a),Math.min(upper,b)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const [a,b] of sorted){const last=merged.at(-1);if(last && a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}
  let cursor=lower;const gaps=[];
  for(const [a,b] of merged){if(a>cursor)gaps.push([cursor,a]);cursor=b;}
  if(cursor<upper)gaps.push([cursor,upper]);
  return {coveredMs:merged.reduce((n,[a,b])=>n+b-a,0),gaps};
}
export function extractTimingRecords(input) {
  const records=[];
  function visit(value){
    if(typeof value==='string'){
      for(const line of value.split('\n')){const index=line.indexOf('[chat-timing]');if(index<0)continue;try{const record=JSON.parse(line.slice(index+13).trim());if(record.version===1)visit(record);}catch{/* Keep malformed source visible in the raw private log, never fabricate it. */}}
    }else if(Array.isArray(value)){for(const item of value)visit(item);}
    else if(value && typeof value==='object'){if(value.version===1 && value.kind==='batch')visit(value.records);else if(value.version===1 && value.kind)records.push(value);else for(const item of Object.values(value))visit(item);}
  }
  for(const line of input.split('\n')){try{visit(JSON.parse(line));}catch{visit(line);}}
  const seen=new Set();
  return records.filter(record=>{const key=JSON.stringify(record);if(seen.has(key))return false;seen.add(key);return true;});
}
/** Same-clock children explain a parent; its own duration is never evidence of coverage. */
export function spanAttribution(records) {
  const spans=records.filter(r=>r.kind==='span' && Number.isFinite(r.durationMs));
  return spans.map(parent=>{
    const end=parent.startedAtMs+parent.durationMs;
    const children=spans.filter(child=>child.clockId===parent.clockId && child.traceId===parent.traceId && child.parentSpanId===parent.spanId);
    const coverage=intervalUnion(children.map(child=>[child.startedAtMs,child.startedAtMs+child.durationMs]),parent.startedAtMs,end);
    return {name:parent.name,spanId:parent.spanId,clockId:parent.clockId,durationMs:parent.durationMs,childOperations:children.length,childCoveredMs:coverage.coveredMs,selfOrUnexplainedMs:Math.max(0,parent.durationMs-coverage.coveredMs),selfOrUnexplainedIntervals:coverage.gaps};
  });
}
export function browserTimeline(records) {
  const marks=records.filter(r=>r.kind==='browser.mark' && Number.isFinite(r.elapsedMs)).sort((a,b)=>a.elapsedMs-b.elapsedMs);
  const visible=marks.findIndex(r=>r.name==='answer.dom_visible');
  const firstAnswer=visible>=0 ? marks.slice(0,visible+1) : marks;
  let previous={name:'original_send',elapsedMs:0};
  return firstAnswer.map(mark=>{const interval={from:previous.name,to:mark.name,startMs:previous.elapsedMs,endMs:mark.elapsedMs,durationMs:mark.elapsedMs-previous.elapsedMs};previous=mark;return interval;});
}
export function timingReport(records) {
  const sendIds=[...new Set(records.map(r=>r.sendId??r.attributes?.['homa.send.id']).filter(Boolean))];
  return {generatedAt:new Date().toISOString(),recordCount:records.length,clockRule:'Durations are local monotonic durations. Different clock IDs are not assumed synchronized. Browser request/server header receipts bound the offset; no subtraction of unrelated medians.',turns:sendIds.map(sendId=>{
    const direct=records.filter(r=>(r.sendId??r.attributes?.['homa.send.id'])===sendId);
    const sessions=new Set(direct.map(r=>r.sessionId??r.attributes?.['eve.session.id']).filter(Boolean));
    const traceIds=new Set(direct.map(r=>r.traceId).filter(id=>id && !/^0+$/.test(id)));
    const start=direct.find(r=>r.name==='send.begin');const visible=direct.find(r=>r.name==='answer.dom_visible');
    const lower=start ? start.atMs-start.elapsedMs : undefined;const upper=visible?.atMs;
    const associated=records.filter(r=>direct.includes(r)||traceIds.has(r.traceId)||(sessions.has(r.sessionId??r.attributes?.['eve.session.id']) && (lower===undefined || (r.startedAtMs??r.atMs??0)>=lower-1000) && (upper===undefined || (r.startedAtMs??r.atMs??0)<=upper+1000)));
    const clocks=[...new Set(associated.map(r=>r.clockId).filter(Boolean))];
    const clockBounds=direct.filter(r=>r.kind==='browser.request.headers'&&r.serverReceivedMs!==undefined).map(r=>{
      const beginning=direct.find(x=>x.kind==='browser.request.start'&&x.name===r.name&&Math.abs(x.elapsedMs-(r.elapsedMs-r.durationMs))<1);
      return {name:r.name,serverClockOffsetMinMs:r.serverHeadersMs-r.atMs,serverClockOffsetMaxMs:beginning?r.serverReceivedMs-beginning.atMs:null};
    });
    const endedSpans=new Set(records.filter(r=>r.kind==='span').map(r=>r.traceId+':'+r.spanId));
    const unfinishedSpans=associated.filter(r=>r.kind==='span.start'&&!endedSpans.has(r.traceId+':'+r.spanId)).map(r=>({name:r.name,traceId:r.traceId,spanId:r.spanId}));
    const incomplete=associated.filter(r=>r.kind==='runtime'&&r.phase==='start'&&!records.some(x=>x.kind==='runtime'&&x.phase==='end'&&x.receiptId===r.receiptId));
    return {sendId,sessionIds:[...sessions],firstVisibleMs:visible?.elapsedMs??null,clockIds:clocks,clockBounds,incompleteOperations:incomplete.map(r=>r.name),unfinishedSpans,browserTimeline:browserTimeline(direct),operationAttribution:spanAttribution(associated),coverage:'Inspect stage boundaries and platform request spans before claiming complete attribution. Parent spans account for elapsed time but do not explain their uninstrumented interior.',records:associated.sort((a,b)=>(a.startedAtMs??a.atMs??0)-(b.startedAtMs??b.atMs??0))};
  })};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [source,destination]=process.argv.slice(2);if(!source||!destination)throw Error('Usage: node scripts/chat-timing-report.mjs logs.jsonl report.json');
  const input=await readFile(source,'utf8');
  const report=timingReport(extractTimingRecords(input));
  const cappedRequests=new Set();
  for(const line of input.split('\n')){try{const entry=JSON.parse(line);if(entry.logs?.length>=256)cappedRequests.add(entry.id);}catch{/* Non-JSON CLI notices are not measurements. */}}
  report.collection={possiblyTruncatedRequests:[...cappedRequests],complete:cappedRequests.size===0 && report.turns.every(t=>t.firstVisibleMs!==null && t.incompleteOperations.length===0 && t.unfinishedSpans.length===0)};
  await writeFile(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({records:report.recordCount,turns:report.turns.map(t=>({sendId:t.sendId,firstVisibleMs:t.firstVisibleMs,incompleteOperations:t.incompleteOperations}))}));
}
