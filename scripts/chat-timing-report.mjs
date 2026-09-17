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
      for(const line of value.split('\n')){const index=line.indexOf('[chat-timing]');if(index<0)continue;try{const record=JSON.parse(line.slice(index+13).trim());if(record.version===1)records.push(record);}catch{/* Keep malformed source visible in the raw private log, never fabricate it. */}}
    }else if(Array.isArray(value)){for(const item of value)visit(item);}
    else if(value && typeof value==='object'){if(value.version===1 && value.kind)records.push(value);else for(const item of Object.values(value))visit(item);}
  }
  for(const line of input.split('\n')){try{visit(JSON.parse(line));}catch{visit(line);}}
  return records.filter((r,i,all)=>all.findIndex(x=>JSON.stringify(x)===JSON.stringify(r))===i);
}
export function timingReport(records) {
  const sendIds=[...new Set(records.map(r=>r.sendId??r.attributes?.['homa.send.id']).filter(Boolean))];
  return {generatedAt:new Date().toISOString(),recordCount:records.length,clockRule:'Durations are local monotonic durations. Different clock IDs are not assumed synchronized. Browser request/server header receipts bound the offset; no subtraction of unrelated medians.',turns:sendIds.map(sendId=>{
    const direct=records.filter(r=>(r.sendId??r.attributes?.['homa.send.id'])===sendId);
    const sessions=new Set(direct.map(r=>r.sessionId??r.attributes?.['eve.session.id']).filter(Boolean));
    const traceIds=new Set(direct.map(r=>r.traceId).filter(Boolean));
    const start=direct.find(r=>r.name==='send.begin');const visible=direct.find(r=>r.name==='answer.dom_visible');
    const lower=start ? start.atMs-start.elapsedMs : undefined;const upper=visible?.atMs;
    const associated=records.filter(r=>direct.includes(r)||traceIds.has(r.traceId)||(sessions.has(r.sessionId??r.attributes?.['eve.session.id']) && (lower===undefined || (r.startedAtMs??r.atMs??0)>=lower-1000) && (upper===undefined || (r.startedAtMs??r.atMs??0)<=upper+1000)));
    const clocks=[...new Set(associated.map(r=>r.clockId).filter(Boolean))];
    const clockBounds=direct.filter(r=>r.kind==='browser.request.headers'&&r.serverReceivedMs!==undefined).map(r=>{
      const beginning=direct.find(x=>x.kind==='browser.request.start'&&x.name===r.name&&Math.abs(x.elapsedMs-(r.elapsedMs-r.durationMs))<1);
      return {name:r.name,serverClockOffsetMinMs:r.serverHeadersMs-r.atMs,serverClockOffsetMaxMs:beginning?r.serverReceivedMs-beginning.atMs:null};
    });
    const incomplete=associated.filter(r=>r.kind==='runtime'&&r.phase==='start'&&!records.some(x=>x.kind==='runtime'&&x.phase==='end'&&x.receiptId===r.receiptId));
    return {sendId,sessionIds:[...sessions],firstVisibleMs:visible?.elapsedMs??null,clockIds:clocks,clockBounds,incompleteOperations:incomplete.map(r=>r.name),coverage:'Inspect stage boundaries and platform request spans before claiming complete attribution. Parent spans account for elapsed time but do not explain their uninstrumented interior.',records:associated.sort((a,b)=>(a.startedAtMs??a.atMs??0)-(b.startedAtMs??b.atMs??0))};
  })};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [source,destination]=process.argv.slice(2);if(!source||!destination)throw Error('Usage: node scripts/chat-timing-report.mjs logs.jsonl report.json');
  const report=timingReport(extractTimingRecords(await readFile(source,'utf8')));
  await writeFile(destination,JSON.stringify(report,null,2));console.log(JSON.stringify({records:report.recordCount,turns:report.turns.map(t=>({sendId:t.sendId,firstVisibleMs:t.firstVisibleMs,incompleteOperations:t.incompleteOperations}))}));
}
