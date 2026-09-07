import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {runHoursReceiptPrivacyContract} from './hours-receipt-privacy-postgres-contract.mjs';

// Invoked by the existing CI Planner/Hours disposable PostgreSQL harness. The
// real Supabase client speaks only to this bounded loopback RLS adapter.
export async function runHoursCurrentSourcePrivacyContract({sql,require,family,memberId,childId,captureHoursPinned}) {
 const url=new URL(process.env.HOMA_EVAL_DATABASE_URL);
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/homa_eval');assert.equal(url.username,'homa_eval');
 for(const k of ['SUPABASE_SERVICE_ROLE_KEY','POSTGRES_URL','HOMA_FAMILY_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN'])assert.ok(!process.env[k]);
 const [attested]=await sql`select current_setting('data_directory') as directory,current_database() as database`;
 assert.match(attested.directory,/homa-eval-sandbox/);assert.equal(attested.database,'homa_eval');
 const other=randomUUID();await sql`insert into auth.users(id,email) values(${other},${'hours-source-other-'+other+'@example.test'})`;
 await sql`insert into family_members(family_id,user_id,role) values(${family},${other},'parent')`;
 const [foreign]=await sql`insert into families(context) values('{}') returning id`;
 const [episode]=await sql`insert into conversation_episodes(family_id,member_user_id,scope) values(${family},${other},'member') returning id`;
 const message=async({adult=memberId,visibility='family',role='user',who=family,text='Reading took 19 minutes.'}={})=>{
  const id=randomUUID();await sql`insert into conversation_messages(id,family_id,member_user_id,session_id,sequence,channel,role,visibility,content,created_at) values(${id},${who},${adult},${randomUUID()},1,'web',${role},${visibility},${text},'2026-09-06T12:00:00Z')`;return id;
 };
 const deliver=async(id,recipient=memberId,status='sent')=>sql`insert into conversation_deliveries(family_id,episode_id,message_id,recipient_member_user_id,channel,destination_hash,status) values(${family},${episode.id},${id},${recipient},'web',${'a'.repeat(64)},${status})`;
 const earlier=await message({text:'We read Make Way for Ducklings.'});
 const workContext={sourceMessageId:earlier,sourceQuote:'We read Make Way for Ducklings.',workTitle:'Make Way for Ducklings'};
 const token='synthetic-hours-source-'+randomUUID(),checks=[];let requests=0;
 const pass=label=>{checks.push(label);console.log('PASS '+label)};
 const actor=async(work)=>sql.begin(async tx=>{
  await tx`set local statement_timeout='15s'`;await tx`set local lock_timeout='5s'`;await tx`set local idle_in_transaction_session_timeout='20s'`;
  await tx`set local role authenticated`;await tx`select set_config('request.jwt.claim.sub',${memberId},true)`;return work(tx);
 });
 const server=createServer(async(req,res)=>{
  try{
   assert.equal(req.method,'POST');assert.ok(['/rest/v1/rpc/record_hours_operation','/rest/v1/rpc/record_hours_operation_v2'].includes(req.url));assert.equal(req.headers.authorization,'Bearer '+token);
   assert.ok(++requests<=80,'Bounded exact caller requests');let body='';for await(const chunk of req){body+=chunk;assert.ok(Buffer.byteLength(body)<=16000)}
   const p=JSON.parse(body),v2=req.url.endsWith('_v2');
   assert.deepEqual(Object.keys(p).sort(),['source_message','activity_ordinal','source_quote','target_child','target_subject','target_minutes','requested_date','target_note','target_label','expected_resolved_date',...(v2?['work_context']:[])].sort());
   const value=await actor(async tx=>{
    const [r]=v2?await tx`select public.record_hours_operation_v2(${p.source_message}::uuid,${p.activity_ordinal},${p.source_quote},${p.target_child}::uuid,${p.target_subject},${p.target_minutes},${p.requested_date}::date,${p.target_note},${p.target_label},${p.expected_resolved_date}::date,${p.work_context===null?null:tx.json(p.work_context)}) receipt`:
     await tx`select public.record_hours_operation(${p.source_message}::uuid,${p.activity_ordinal},${p.source_quote},${p.target_child}::uuid,${p.target_subject},${p.target_minutes},${p.requested_date}::date,${p.target_note},${p.target_label},${p.expected_resolved_date}::date) receipt`;
    return r.receipt;
   });res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value));
  }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:e.code??'LOCAL',message:'Local caller source refused'}));}
 });
 server.requestTimeout=20_000;server.headersTimeout=15_000;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const {createClient}=require('@supabase/supabase-js');
 const client=createClient(origin,'synthetic-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+token},fetch:(url,init)=>{assert.equal(new URL(typeof url==='string'?url:url.url).origin,origin);return fetch(url,init)}}});
 try{
  for(const variant of ['v1','v2','v2-context']){
   const method=variant==='v1'?'record_hours_operation':'record_hours_operation_v2';
   const call=id=>client.rpc(method,{source_message:id,activity_ordinal:1,source_quote:'Reading took 19 minutes.',target_child:childId,target_subject:'reading',target_minutes:19,requested_date:null,target_note:variant==='v2-context'?'Make Way for Ducklings · Reading took 19 minutes.':null,target_label:null,expected_resolved_date:null,...(variant==='v1'?{}:{work_context:variant==='v2-context'?workContext:null})}).abortSignal(AbortSignal.timeout(18_000));
   const own=await message();assert.equal((await actor(tx=>tx`select id from conversation_messages where id=${own}`)).length,1);
   const written=await call(own);assert.equal(written.error,null);assert.equal(written.data.inserted,true);assert.equal((await call(own)).data.inserted,false);
   const negative=[
    ['other adult',await message({adult:other})],['own internal',await message({visibility:'internal'})],['unattributed',await message({adult:null})],['foreign family',await message({who:foreign.id})],['assistant',await message({role:'assistant'})],['missing',randomUUID()],
   ];
   const wrongDelivery=await message({adult:other});await deliver(wrongDelivery,other);negative.push(['delivery to other adult',wrongDelivery]);
   const failedDelivery=await message({adult:other});await deliver(failedDelivery,memberId,'failed');negative.push(['failed delivery',failedDelivery]);
   const internalDelivery=await message({adult:other,visibility:'internal'});await deliver(internalDelivery);negative.push(['internal despite delivery',internalDelivery]);
   for(const [label,id]of negative){
    const visible=await actor(tx=>tx`select id from conversation_messages where id=${id}`);
    if(label!=='assistant')assert.equal(visible.length,0,variant+' '+label+' is hidden by actual caller RLS');
    const denied=await call(id);assert.equal(denied.error?.code,'42501',variant+' '+label);
    assert.equal((await sql`select id from learning_write_operations where source_message_id=${id}`).length,0,'Denied source leaves no claim');
   }
   const shared=await message({adult:other});await deliver(shared);assert.equal((await actor(tx=>tx`select id from conversation_messages where id=${shared}`)).length,1);
   assert.equal((await call(shared)).error,null);
   // A valid old operation does not grant access to its source after privacy
   // changes. The immutable stored record remains untouched when replay refuses.
   await sql`update conversation_messages set visibility='internal' where id=${own}`;
   assert.equal((await call(own)).error?.code,'42501');
   assert.equal((await sql`select id from hours_log where id=${written.data.entry.id}`).length,1);
   pass(`${variant}: real SDK preserves caller RLS for owned, other-adult, unattributed, internal, delivered and revoked-source cases`);
  }
  const legacy=await message({adult:null});const pinned=await captureHoursPinned({familyId:family,sourceMessageId:legacy,sourceActivityOrdinal:1,sourceQuote:'Reading took 19 minutes.',subject:'reading',minutes:19,source:'sms'});assert.equal(pinned.inserted,true);
  pass('Private trusted pinned source remains compatible with legacy unattributed canonical parent messages');
  await assert.rejects(()=>actor(tx=>tx`select public.record_hours_operation_pinned(${family}::uuid,${legacy}::uuid,2,'Reading took 19 minutes.',null,'reading',19,null,null,null,'sms')`),{code:'42501'});
  pass('Caller cannot invoke private pinned bypass');
  await runHoursReceiptPrivacyContract({sql,require,family,memberId,childId});
  console.log(JSON.stringify({hoursCurrentSourcePrivacy:true,checks,requests,scope:'Actual caller SDK, role/RLS, and candidate SQL on disposable local PostgreSQL only'}));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
