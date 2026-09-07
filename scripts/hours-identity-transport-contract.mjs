import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,'');
const require=createRequire(root+'/apps/web/package.json');
export async function runMoreContract({sql,family,member,message,raw,captureHoursPinned,foldStubFamilyIntoTx,pass}){
 const rollbackMsg=await message('We did science sessions and this tests a rollback.');
 await sql.unsafe(`create function public.fixture_fail_hours() returns trigger language plpgsql as $$ begin if new.note='force rollback' then raise exception 'synthetic rollback' using errcode='P1000'; end if; return new; end $$;create trigger fixture_fail_hours after insert on public.hours_log for each row execute function public.fixture_fail_hours()`);
 await assert.rejects(()=>captureHoursPinned({...raw,sourceMessageId:rollbackMsg,note:'force rollback'}),{code:'P1000'});
 assert.equal((await sql`select id from learning_write_operations where source_message_id=${rollbackMsg}`).length,0);
 await sql.unsafe('drop trigger fixture_fail_hours on public.hours_log;drop function fixture_fail_hours()');
 assert.equal((await captureHoursPinned({...raw,sourceMessageId:rollbackMsg,note:'force rollback'})).inserted,true);
 pass('database failure after Hours insert rolls back operation and effect; same request can then succeed');
 const lockMsg=await message();
 let release,locked; const lockedPromise=new Promise(r=>locked=r), hold=new Promise(r=>release=r);
 const holder=sql.begin(async tx=>{await tx`select id from families where id=${family} for update`;locked();await hold});
 await lockedPromise;const started=performance.now();
 try{await assert.rejects(()=>captureHoursPinned({...raw,sourceMessageId:lockMsg}),{code:'55P03'})}finally{release();await holder}
 assert.ok(performance.now()-started>=4500&&performance.now()-started<10000);
 pass('actual database lock deadline rejects without leaving a pending operation');
 const [foldSource] = await sql`insert into public.families(context) values('{}') returning id`;
 const foldMessage = await message('We did science sessions before moving this test family.',foldSource.id);
 await captureHoursPinned({...raw,familyId:foldSource.id,sourceMessageId:foldMessage});
 let unlockFold, familyLocked; const foldLocked = new Promise(r=>familyLocked=r), holdFold=new Promise(r=>unlockFold=r);
 const folding=sql.begin(tx=>foldStubFamilyIntoTx(tx,foldSource.id,family,{afterFamilyLocks:async()=>{familyLocked();await holdFold}}));
 await foldLocked;let captureSettled=false;
 const raced=captureHoursPinned({...raw,familyId:foldSource.id,sourceMessageId:foldMessage,sourceActivityOrdinal:2})
  .then(value=>{captureSettled=true;return {value}},error=>{captureSettled=true;return {error}});
 await new Promise(r=>setTimeout(r,100));assert.equal(captureSettled,false);
 unlockFold();assert.equal(await folding,true);assert.equal((await raced).error.code,'42501');
 assert.equal((await sql`select id from learning_write_operations where source_message_id=${foldMessage}`).length,1);
 pass('family fold lock serializes a racing old-family capture; stale family cannot insert after transfer');
 const [collisionSource]=await sql`insert into public.families(context) values('{}') returning id`;
 const collisionMessage=await message('We did science sessions with distinct provenance.',collisionSource.id);
 await captureHoursPinned({...raw,familyId:collisionSource.id,sourceMessageId:collisionMessage});
 const [operation]=await sql`select * from learning_write_operations where source_message_id=${collisionMessage}`;
 await sql`insert into learning_write_operations(id,family_id,operation_key,request,resolved_date,outcome)
  values(${randomUUID()},${family},${operation.operation_key},'{}','2026-09-06','{"fixture":"conflicting provenance"}')`;
 await assert.rejects(()=>sql.begin(tx=>foldStubFamilyIntoTx(tx,collisionSource.id,family)),{code:'23505'});
 assert.equal((await sql`select family_id from conversation_messages where id=${collisionMessage}`)[0].family_id,collisionSource.id);
 assert.equal((await sql`select family_id from learning_write_operations where id=${operation.id}`)[0].family_id,collisionSource.id);
 pass('actual operation collision aborts family transfer without dropping either source record');
 const {createClient}=require('@supabase/supabase-js');let requests=0;
 const token='hours-source-caller-'+randomUUID();
 const server=createServer(async(req,res)=>{
  try{
   assert.equal(req.url,'/rest/v1/rpc/record_hours_operation');assert.equal(req.method,'POST');assert.equal(req.headers.authorization,'Bearer '+token);
   let body='';for await(const chunk of req){body+=chunk;assert.ok(body.length<=16000)}const p=JSON.parse(body);requests++;
   const allowed=['source_message','activity_ordinal','source_quote','target_child','target_subject','target_minutes','requested_date','target_note','target_label'];assert.deepEqual(Object.keys(p).sort(),allowed.sort());
   const receipt=await sql.begin(async tx=>{await tx`set local role authenticated`;await tx`select set_config('request.jwt.claim.sub',${member.user_id},true)`;const[r]=await tx`select public.record_hours_operation(${p.source_message}::uuid,${p.activity_ordinal},${p.source_quote},${p.target_child}::uuid,${p.target_subject},${p.target_minutes},${p.requested_date}::date,${p.target_note},${p.target_label}) as receipt`;return r.receipt});
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(receipt));
  }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:e.code??'LOCAL',message:'Local RPC refused'}))}
 });
 server.requestTimeout=15000;server.headersTimeout=16000;server.keepAliveTimeout=1000;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  const client=createClient(origin,'synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token},fetch:(input,init)=>{assert.equal(new URL(typeof input==='string'?input:input.url).origin,origin);return fetch(input,init)}}});
  const msg=await message();const payload={source_message:msg,activity_ordinal:1,source_quote:'science sessions',target_child:null,target_subject:'science',target_minutes:24,requested_date:null,target_note:null,target_label:null};
  const first=await client.rpc('record_hours_operation',payload).abortSignal(AbortSignal.timeout(12000));assert.equal(first.error,null);assert.equal(first.data.inserted,true);
  const again=await client.rpc('record_hours_operation',payload).abortSignal(AbortSignal.timeout(12000));assert.equal(again.error,null);assert.equal(again.data.inserted,false);assert.equal(again.data.entry.id,first.data.entry.id);
  const conflict=await client.rpc('record_hours_operation',{...payload,target_minutes:25});assert.equal(conflict.error.code,'P1090');
  assert.equal(requests,3);pass('actual Supabase caller SDK over bounded localhost RPC adapter preserves insert replay and conflict receipts');
 }finally{await new Promise(r=>server.close(r))}
}
