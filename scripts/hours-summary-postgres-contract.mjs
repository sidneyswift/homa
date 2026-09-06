import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL, fileURLToPath } from 'node:url';
/** Actual reader and SQL contract. Imported by the existing disposable Planner
 * PostgreSQL harness. Direct execution is a no-op. sourceOverrides is only for
 * offline preparation before repository integration; normal CI supplies none. */
export async function runHoursSummaryReadContract(sql, options = {}) {
const root=options.repositoryRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSource=file=>options.sourceOverrides?.[file] ?? readFileSync(path.join(root,file),'utf8');
const require=createRequire(root+'/apps/web/package.json');
const ts=require('typescript');
const postgres=require('postgres');
const {createClient}=require('@supabase/supabase-js');
const target=new URL(process.env.HOMA_EVAL_DATABASE_URL??'https://missing.invalid');
assert.equal(target.protocol,'postgres:');assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/homa_eval');assert.equal(target.username,'homa_eval');
assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== '1');
const blob=realpathSync(process.env.HOMA_EVAL_BLOB_DIR);assert.equal(path.basename(blob),'blob');assert.match(path.basename(path.dirname(blob)),/^homa-eval-sandbox-/u);
const writer=postgres(target.href,{max:2,prepare:false,connect_timeout:3,idle_timeout:2});
const userA=randomUUID(),userB=randomUUID(),familyA=randomUUID(),familyB=randomUUID(),childA=randomUUID(),childB=randomUUID(),foreignChild=randomUUID();
const tokenA=randomUUID(),tokenB=randomUUID(), tokens=new Map([[tokenA,userA],[tokenB,userB]]);
const results=[],hashes={};let server,origin,mode='normal';const requests=[];
async function test(name,fn){console.log('START '+name);const start=performance.now();try{await fn();}catch(e){console.log('FAIL '+name+' '+e.name+' '+e.message);throw e;}results.push({name,ms:Math.round(performance.now()-start)});console.log('PASS '+name);}
async function caller(user,work){return sql.begin('read only',async tx=>{await tx`set local statement_timeout='5s'`;await tx`set local lock_timeout='1s'`;await tx`select set_config('request.jwt.claim.sub',${user},true)`;await tx`set local role authenticated`;return work(tx);});}
const migration='20260906213000_hours_summary_snapshot.sql';
async function invoke(tx,p){return (await tx`select public.read_hours_summary(${p.target_family_id}::uuid,${p.requested_period}::text,${p.target_child_id}::uuid,${p.include_shared}::boolean,${p.from_on}::text,${p.through_on}::text,${p.target_subject}::text,${p.entry_limit}::integer,${p.reference_at}::timestamptz) as record`)[0].record;}
const NOW=new Date('2026-09-10T04:30:00Z');
function params(options={}){return {target_family_id:familyA,requested_period:'school_year',target_child_id:null,include_shared:true,from_on:null,through_on:null,target_subject:null,entry_limit:20,reference_at:NOW.toISOString(),...options};}
try {
 const [identity]=await sql`select current_database() as database,current_user as username,current_setting('data_directory') as directory`;
 assert.equal(identity.database,'homa_eval');assert.equal(identity.username,'homa_eval');assert.equal(realpathSync(identity.directory),path.join(path.dirname(blob),'data'));
 await sql`set statement_timeout='10s'`;await writer`set statement_timeout='10s'`;
 await sql`insert into auth.users(id,email) values(${userA},${'summary-a-'+userA+'@homatest.invalid'}),(${userB},${'summary-b-'+userB+'@homatest.invalid'})`;
 await sql`insert into public.families(id,name,time_zone,school_year_start_on,status,profile_completed_at,sandbox,billing_exempt) values(${familyA},'Summary A','America/New_York','2020-09-10','claimed',now(),true,true),(${familyB},'Summary B','America/Chicago',null,'claimed',now(),true,true)`;
 await sql`insert into public.family_members(family_id,user_id,role) values(${familyA},${userA},'parent'),(${familyB},${userB},'parent')`;
 await sql`insert into public.children(id,family_id,name,birth_month) values(${childA},${familyA},'Same','2020-01-01'),(${childB},${familyA},'Same','2022-01-01'),(${foreignChild},${familyB},'Foreign','2020-01-01')`;
 await sql`insert into public.hours_log(family_id,child_id,subject,minutes,happened_on,source,note) values(${familyA},${childA},'reading',20,'2026-09-10','chat','Current A'),(${familyA},${childA},'math',5,'2026-09-10','chat','Current repeat A'),(${familyA},${childB},'math',30,'2026-09-10','chat','Current B'),(${familyA},null,'art',10,'2026-09-10','chat','Shared'),(${familyA},${childA},'math',9,'2026-08-31','chat','Before school year'),(${familyA},${childA},'science',600,'2026-09-11','chat','Future'),(${familyB},${foreignChild},'math',500,'2026-09-10','chat','Foreign')`;
 await test('local isolation verifies authenticated family, child and Hours visibility',async()=>{
  await caller(userA,async tx=>{for(const table of ['families','children','hours_log']){const key=table==='families'?'id':'family_id';const other=await tx.unsafe(`select count(*)::int as n from public.${table} where ${key}=$1`,[familyB]);assert.equal(other[0].n,0);}const own=await tx`select count(*)::int as n from public.hours_log where family_id=${familyA}`;assert.equal(own[0].n,6);});
  await sql.begin('read only',async tx=>{await tx`set local role anon`;assert.equal((await tx`select count(*)::int as n from public.hours_log`)[0].n,0);});
 });
 await test('installed migration versions and exact function source match the checked repository',async()=>{
  const {migrationVersionCollisions}=await import(pathToFileURL(root+'/scripts/migration-version-check.mjs'));
  const names=readdirSync(root+'/supabase/migrations').filter(n=>n.endsWith('.sql'));if(!names.includes(migration))names.push(migration);assert.equal(new Set(names).size,names.length);assert.deepEqual(migrationVersionCollisions(names),[]);assert.match(migration,/^\d{14}_[a-z0-9_]+\.sql$/u);
  const source=readSource('supabase/migrations/'+migration);hashes['supabase/migrations/'+migration]=createHash('sha256').update(source).digest('hex');const expected=source.split('as $$')[1].split('$$;')[0].trim();const[installed]=await sql`select prosrc from pg_proc where oid='public.read_hours_summary(uuid,text,uuid,boolean,text,text,text,integer,timestamptz)'::regprocedure`;assert.equal(installed.prosrc.trim(),expected);
 });
 await test('new function is STABLE SECURITY INVOKER and anonymous execution is denied',async()=>{
  const [p]=await sql`select provolatile,prosecdef,proconfig from pg_proc where oid='public.read_hours_summary(uuid,text,uuid,boolean,text,text,text,integer,timestamptz)'::regprocedure`;assert.equal(p.provolatile,'s');assert.equal(p.prosecdef,false);assert.deepEqual(p.proconfig,['search_path=""']);
  await assert.rejects(sql.begin('read only',async tx=>{await tx`set local role anon`;await invoke(tx,params());}),e=>e.code==='42501');
 });
 server=createServer(async(req,res)=>{try{
  assert.equal(req.method,'POST');assert.equal(req.url,'/rest/v1/rpc/read_hours_summary');const user=tokens.get(req.headers.authorization?.slice(7));assert(user);
  let body='';for await(const chunk of req){body+=chunk;assert(body.length<4096);}const p=JSON.parse(body);assert.deepEqual(Object.keys(p).sort(),Object.keys(params()).sort());requests.push({familyId:p.target_family_id,user,mode});
  if(mode==='http_failure'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({message:'Synthetic unavailable'}));return;}
  if(mode==='missing'){res.writeHead(200,{'content-type':'application/json'});res.end('null');return;}
  if(mode==='hang'){await new Promise(resolve=>res.once('close',resolve));return;}
  const record=await caller(user,tx=>invoke(tx,p));res.writeHead(200,{'content-type':'application/json','content-range':'0-0/*'});res.end(JSON.stringify(record));
 }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({message:'Local scalar RPC refused',code:e.code??'LOCAL'}));}});
 server.requestTimeout=20000;server.headersTimeout=20000;server.keepAliveTimeout=100;
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;
 const client=token=>createClient(origin,'local-fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token},fetch:(url,init)=>{const req=new Request(url,init);assert.equal(new URL(req.url).origin,origin);assert.equal(req.method,'POST');return fetch(req,{redirect:'error',signal:init.signal});}}});
 const stubs={'apps/web/lib/map/db':{mapDb:()=>sql}};const loaded=new Map();
 function load(file){if(loaded.has(file))return loaded.get(file).exports;assert(file.startsWith('apps/web/lib/'));const source=readSource(file);hashes[file]=createHash('sha256').update(source).digest('hex');const mod={exports:{}};loaded.set(file,mod);const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const importer=name=>{const key=name.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),name)):name;if(key in stubs)return stubs[key];if(!name.startsWith('.')){assert.equal(name,'zod');return require(name);}return load(key+'.ts');};vm.runInNewContext(code,{module:mod,exports:mod.exports,require:importer,Date,Intl,URLSearchParams,AbortSignal,console},{filename:file});return mod.exports;}
 const reader=load('apps/web/lib/hours-summary-reader.ts');const canonical=load('apps/web/lib/hours-summary.ts');
 const call=(input={},now=NOW)=>reader.readHoursSummaryCaller(client(tokenA),familyA,{period:'school_year',...input},now);
 const pin=(input={},now=NOW)=>reader.readHoursSummaryPinned(familyA,{period:'school_year',...input},now);
 await sql`insert into public.hours_log(family_id,child_id,subject,minutes,happened_on,source,note,custom_label) select ${familyA},${childA},'math',1,'2025-09-01'::date,'chat','History row '||i,'Row '||i from generate_series(1,4001)i`;
 await test('caller SDK and pinned summary include >3000 complete history, with bounded sample and uncropped recent totals',async()=>{
  for(const read of [call,pin]){const recent=await read();assert.equal(recent.entryCount,4);assert.equal(recent.totalMinutes,65);assert.equal(recent.recordedDays,1);assert.equal(recent.recordedDaysByChild.find(c=>c.childId===childA).minutes,35);assert.equal(recent.recordedDaysByChild.find(c=>c.childId===childB).minutes,40);const all=await read({period:'all'});assert.equal(all.entryCount,4006);assert.equal(all.totalMinutes,4075);assert.equal(all.entries.length,20);assert.equal(all.recordedDays,3);const fifty=await read({period:'all',limit:50});assert.equal(fifty.entries.length,50);}
  assert.equal((await reader.readHoursSummaryCaller(client(tokenA),familyA.toUpperCase(),{period:'school_year',childId:childA.toUpperCase()},NOW)).totalMinutes,35);assert.equal((await reader.readHoursSummaryPinned(familyA.toUpperCase(),{period:'school_year',childId:childA.toUpperCase()},NOW)).totalMinutes,35);const a=await call({period:'all'}),b=await pin({period:'all'});assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));assert(requests.every(r=>r.mode==='normal'));
 });
 await test('email and scheduled entry sources remain readable in complete caller and pinned records',async()=>{
  const emailId=randomUUID(),dispatchId=randomUUID();
  await sql`insert into public.hours_log(id,family_id,child_id,subject,minutes,happened_on,source,note) values(${emailId},${familyA},${childA},'reading',2,'2026-09-10','email','Email source fixture'),(${dispatchId},${familyA},${childA},'reading',3,'2026-09-10','dispatch','Scheduled source fixture')`;
  for(const read of [call,pin]){const r=await read();assert.equal(r.totalMinutes,70);assert(r.entries.some(e=>e.source==='email'&&e.minutes===2));assert(r.entries.some(e=>e.source==='dispatch'&&e.minutes===3));}
  await sql`delete from public.hours_log where family_id=${familyA} and id in (${emailId},${dispatchId})`;
 });
 await test('owned child, shared inclusion, date boundaries, subject, repeated days, renamed and duplicate names are exact',async()=>{
  for(const read of [call,pin]){const a=await read({childId:childA});assert.equal(a.totalMinutes,35);assert.equal(a.recordedDaysByChild.length,1);assert.equal(a.recordedDaysByChild[0].recordedDays,1);assert.equal((await read({childId:childA,includeShared:false})).totalMinutes,25);assert.equal((await read({subject:'math'})).totalMinutes,35);const range=await read({period:'all',from:'2026-08-31',through:'2026-09-10'});assert.equal(range.totalMinutes,74);assert.equal(range.window.period,'custom');assert.equal(range.entries.length,5);}
  await sql`update public.children set name='Renamed' where id=${childA}`;assert.equal((await call()).recordedDaysByChild.find(c=>c.childId===childA).childName,'Renamed');
 });
 await test('foreign family and child, missing family, invalid enum/date/limit never yield totals on caller or pinned paths',async()=>{
  await assert.rejects(reader.readHoursSummaryCaller(client(tokenB),familyA,{},NOW),e=>e.reason==='not_found');
  await assert.rejects(reader.readHoursSummaryPinned(randomUUID(),{},NOW),e=>e.reason==='not_found');
  for(const read of [call,pin])for(const input of [{childId:foreignChild},{period:'bad'},{from:'2026-02-29'},{from:'2026-09-12',through:'2026-09-10'},{limit:51},{subject:'foreign'}])await assert.rejects(read(input),e=>e.reason==='invalid');
  for(const p of [params({target_family_id:familyB}),params({target_child_id:foreignChild}),params({from_on:'today'}),params({through_on:'0000-01-01'}),params({include_shared:null})]){const raw=await caller(userA,tx=>invoke(tx,p));assert(['not_found','invalid'].includes(raw.status));assert(!('totalMinutes'in raw));}
 });
 await test('week and month include records before a newly started school year; per-child days do not infer sibling attendance',async()=>{
  await sql`insert into public.hours_log(family_id,child_id,subject,minutes,happened_on,source,note) values(${familyA},${childA},'reading',6,'2026-09-01','chat','Independent month'),(${familyA},${childA},'reading',8,'2026-09-09','chat','Independent week')`;
  for(const read of [call,pin]){const week=await read({period:'week'});assert.equal(week.totalMinutes,73);assert.equal(week.recordedDaysByChild.find(c=>c.childId===childA).recordedDays,2);assert.equal(week.recordedDaysByChild.find(c=>c.childId===childB).recordedDays,1);assert.equal((await read({period:'month'})).totalMinutes,79);assert.equal((await read({period:'school_year'})).totalMinutes,65);}
  await sql`delete from public.hours_log where family_id=${familyA} and note in ('Independent month','Independent week')`;
  for(const read of [call,pin])assert.equal((await read({period:'all',through:''})).totalMinutes,4675);
 });
 await test('SQL anniversary mirror matches actual TS helper including2100, family midnight, unset and invalid saved years',async()=>{
  const cases=[['2020-09-10','America/New_York','2026-09-10T04:30:00Z'],['2020-09-10','America/Los_Angeles','2026-09-10T04:30:00Z'],['2024-02-29','UTC','2100-03-01T12:00:00Z'],['2024-02-29','UTC','2104-02-28T12:00:00Z'],['2024-02-29','UTC','2104-02-29T12:00:00Z'],['2024-02-29','UTC','2025-03-01T12:00:00Z'],[null,'UTC','2026-09-10T12:00:00Z'],['10000-01-01','UTC','2026-09-10T12:00:00Z']];
  for(const[stored,zone,instant]of cases){await sql`update public.families set school_year_start_on=(${stored}::text)::date,time_zone=${zone} where id=${familyA}`;for(const period of ['week','month','school_year','all']){const now=new Date(instant);const r=await call({period},now);const p=await pin({period},now);assert.deepEqual(JSON.parse(JSON.stringify(r)),JSON.parse(JSON.stringify(p)));const window=canonical.resolveHoursWindow(period,r.today,stored);assert.equal(r.window.from,window.from);assert.equal(r.window.through,window.through);assert.equal(r.window.schoolYearFallback,window.schoolYearFallback);}}
  await sql`update public.families set school_year_start_on='2020-09-10',time_zone='America/New_York' where id=${familyA}`;
 });
 await test('missing scalar, actual SDK HTTP failure and tampered window/identity receipt fail closed',async()=>{
  mode='missing';await assert.rejects(call(),e=>e.reason==='unavailable');mode='http_failure';await assert.rejects(call(),e=>e.reason==='unavailable');mode='normal';const r=await call();for(const bad of [{...r,familyId:familyB},{...r,window:{...r.window,from:'2020-01-01'}},{...r,entries:r.entries.slice(1)},{...r,totalMinutes:r.totalMinutes+1}])assert.throws(()=>reader.validateHoursSummaryRecord(bad,familyA,{period:'school_year'},NOW),e=>e.reason==='invalid_receipt');
 });
 await test('single STABLE snapshot cannot mix an old setting/roster with a concurrent committed Hours change',async()=>{
  const key=1781095;let unlock;const held=writer.begin(async tx=>{await tx`select pg_advisory_xact_lock(${key})`;await new Promise(resolve=>{unlock=resolve;});});while(!unlock)await new Promise(r=>setTimeout(r,5));
  const before=await pin();const p=params();
  const blocked=caller(userA,async tx=>(await tx`select public.read_hours_summary(${p.target_family_id}::uuid,${p.requested_period}::text,${p.target_child_id}::uuid,${p.include_shared}::boolean,${p.from_on}::text,${p.through_on}::text,${p.target_subject}::text,${p.entry_limit}::integer,${p.reference_at}::timestamptz) as record from (select pg_advisory_xact_lock(${key})) barrier`)[0].record);
  const deadline=Date.now()+2000;while(!(await writer`select exists(select 1 from pg_locks where locktype='advisory' and objid=${key} and not granted) as waiting`)[0].waiting){assert(Date.now()<deadline);await new Promise(r=>setTimeout(r,5));}
  await writer.begin(async tx=>{await tx`update public.families set school_year_start_on='2020-08-01' where id=${familyA}`;await tx`update public.children set name='Concurrent name' where id=${childA}`;await tx`update public.hours_log set minutes=21 where family_id=${familyA} and note='Current A'`;});unlock();await held;const snapshot=await blocked;assert.equal(snapshot.window.from,before.window.from);assert.equal(snapshot.totalMinutes,before.totalMinutes);assert.equal(snapshot.children.find(c=>c.id===childA).name,'Renamed');const after=await pin();assert.equal(after.window.from,'2026-08-01');assert.equal(after.totalMinutes,75);assert.equal(after.children.find(c=>c.id===childA).name,'Concurrent name');
 });
 await test('pinned actual lock deadline returns unavailable instead of an empty or partial result',async()=>{
  let unlock;const held=writer.begin(async tx=>{await tx`lock table public.hours_log in access exclusive mode`;await new Promise(resolve=>{unlock=resolve;});});while(!unlock)await new Promise(r=>setTimeout(r,5));const start=performance.now();await assert.rejects(pin(),e=>e.reason==='unavailable');assert(performance.now()-start<4000);unlock();await held;
 });
 await test('caller SDK aborts a stalled HTTP response within its15-second read deadline',async()=>{mode='hang';const start=performance.now();await assert.rejects(call(),e=>e.reason==='unavailable');const elapsed=performance.now()-start;assert(elapsed>=14000&&elapsed<18000);mode='normal';});
 await test('true empty and no-child shared family results are complete zeros or exact shared records',async()=>{const empty=await call({from:'2024-01-01',through:'2024-01-02'});assert.equal(empty.entryCount,0);assert.equal(empty.totalMinutes,0);assert.equal(empty.recordedDays,0);await sql`delete from public.hours_log where family_id=${familyB}`;await sql`delete from public.children where family_id=${familyB}`;await sql`insert into public.hours_log(family_id,child_id,subject,minutes,happened_on,source,note) values(${familyB},null,'art',7,'2026-09-10','chat','No children shared')`;const excluded=await reader.readHoursSummaryCaller(client(tokenB),familyB,{period:'all'},NOW);assert.equal(excluded.totalMinutes,0);const r=await reader.readHoursSummaryCaller(client(tokenB),familyB,{period:'all'},new Date('2026-09-10T16:00:00Z'));assert.deepEqual(JSON.parse(JSON.stringify(r.recordedDaysByChild)),[{childId:null,childName:'Whole family',recordedDays:1,minutes:7}]);});
 await test('roster bound fails honestly instead of omitting children from a claimed total',async()=>{await sql`insert into public.children(family_id,name,birth_month) select ${familyB},'Child '||i,'2020-01-01'::date from generate_series(1,1001)i`;await assert.rejects(reader.readHoursSummaryCaller(client(tokenB),familyB,{},NOW),e=>e.reason==='unavailable');});
 const receipt={results,sourceHashes:hashes,requests:requests.length,boundary:'Actual new reader+SQL+canonical date helper; actual Supabase SDK against scalar loopback RPC adapter using SET LOCAL authenticated and real RLS. Fresh disposable PostgreSQL17; no PostgREST server/Auth/Next/model/production calls. HTTP timeout proves local caller cancellation, not deployed database cancellation.'};
 console.log(JSON.stringify({suite:'complete Hours summary PostgreSQL contract',...receipt}));return receipt;
}finally{server?.closeAllConnections();if(server)await new Promise(done=>server.close(done));await writer.end({timeout:1});}
}
