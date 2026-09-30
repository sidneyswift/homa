import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { ToolContext } from 'eve/tools';

import { admitConversationRequest, CONVERSATION_DISPATCH_AUTHENTICATOR, CONVERSATION_DISPATCH_CHANNEL } from './conversation-request-admission';
import { acceptConversationRequest, finishConversationRequest, leaseConversationRequest, readConversationAccess } from './conversation-requests';
import { executeConversationOperation, prepareConversationOperation } from './conversation-operations';
import { conversationJobQuoteMatches, observeConversationJobEnd, prepareConversationJobDispatch, releaseConversationJobDispatch, requireConversationJobAccess,
  requireConversationJobDatabaseAccess,startConversationJob } from './conversation-jobs';
import { readConversationFeed, readConversationFeedChanges } from './conversation-feed';
import { loadConversationRequestContext } from './conversation-request-context';
import { EVAL_FIXTURE_FAMILY_ID } from './family-context-eval-fixture';
import { mapDb } from './map/db';
import { completeStageFromWorker } from './jobs/runner';

test('job quotations preserve exact saved words without interpreting a paraphrase as evidence',()=>{
  const accepted='Make a counting page. Keep this private family detail.';
  assert(conversationJobQuoteMatches({},accepted));
  assert(conversationJobQuoteMatches({herWords:'Keep this private family detail.'},accepted));
  for(const herWords of ['keep this private family detail.','Keep the family detail private.','',null,3])
    assert.equal(conversationJobQuoteMatches({herWords},accepted),false);
});

test('PostgreSQL permanent jobs release the foreground and preserve private effect ownership', {skip:!process.env.HOMA_EVAL_DATABASE_URL},async t=>{
  assert(process.env.HOMA_EVAL_DATABASE_URL&&process.env.HOMA_EVAL_BLOB_DIR);assert(!process.env.VERCEL&&process.env.HOMA_EVAL_ALLOW_PROD_WRITES!=='1');
  const sql=mapDb(),flags={HOMA_AGENT_JOBS_ENABLED:process.env.HOMA_AGENT_JOBS_ENABLED,HOMA_CONVERSATION_REQUESTS:process.env.HOMA_CONVERSATION_REQUESTS,HOMA_CONVERSATION_RECORDING:process.env.HOMA_CONVERSATION_RECORDING};
  await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
  try{
    const [target]=await sql`select current_setting('data_directory') as directory,host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
    const root=path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));assert.match(path.basename(root),/^homa-eval-sandbox-/u);
    assert.equal(realpathSync(target.directory),path.join(root,'data'));assert.equal(target.database,'homa_eval');assert.equal(target.owner,'homa_eval');assert([null,'127.0.0.1','::1'].includes(target.address));
    process.env.HOMA_AGENT_JOBS_ENABLED='true';process.env.HOMA_CONVERSATION_REQUESTS='1';process.env.HOMA_CONVERSATION_RECORDING='1';
    async function owner(){const memberUserId=randomUUID(),familyId=EVAL_FIXTURE_FAMILY_ID;
      await sql`insert into auth.users(id,email) values(${memberUserId},${`${memberUserId}@example.test`})`;
      await sql`insert into public.family_members(family_id,user_id) values(${familyId},${memberUserId})`;
      return {familyId,memberUserId,...await readConversationAccess({familyId,memberUserId})};}
    async function foreground(principal:Awaited<ReturnType<typeof owner>>){
      const request=await acceptConversationRequest(principal,{intentId:randomUUID(),text:'Make a counting page. Keep this private family detail.'});
      const lease=await leaseConversationRequest(principal);if(lease.kind!=='leased')throw Error('Expected lease');
      const execution={requestId:request.requestId,leaseToken:lease.leaseToken,sessionId:`foreground-${randomUUID()}`,turnId:'first',sequence:0};
      const auth={authenticator:CONVERSATION_DISPATCH_AUTHENTICATOR,principalId:principal.memberUserId,attributes:{channel:CONVERSATION_DISPATCH_CHANNEL,
        familyId:principal.familyId,memberUserId:principal.memberUserId,conversationRequestId:request.requestId,
        conversationRequestLease:lease.leaseToken,conversationRequestAccessEpoch:principal.accessEpoch}};
      await admitConversationRequest({...execution,auth,text:lease.text});
      const ctx={session:{id:execution.sessionId,turn:{id:'first',sequence:0},auth:{current:auth}},toolExecution:{callId:'start',name:'start_agent_job'}} as unknown as ToolContext;
      return {request,execution,ctx};}
    async function fixture(){const principal=await owner(),fg=await foreground(principal);
      const [child]=await sql`insert into public.children(family_id,name,birth_month) values(${principal.familyId},'Fixture child','2020-01-01') returning id`;
      const input={familyId:principal.familyId,requestedByUserId:principal.memberUserId,sessionId:fg.execution.sessionId,skill:'materials-studio',title:'Private counting page',
        plan:{request:'Count to five, supported by the parent’s exact evidence. Preserve this private phrase.'},totalStages:1,childId:child.id};
      const operation=await prepareConversationOperation(fg.ctx,input,45000);
      const result=await executeConversationOperation(operation,()=>startConversationJob(fg.ctx,input));assert(result.ok);if(!result.ok)throw Error('No job');
      return {principal,fg,input,result};}
    async function worker(f:Awaited<ReturnType<typeof fixture>>){
      await sql`insert into public.agent_job_stages(job_id,family_id,stage_number,status) values(${f.result.jobId},${f.principal.familyId},1,'in_progress')`;
      await sql`update public.agent_jobs set status='running' where id=${f.result.jobId}`;
      const dispatch=await prepareConversationJobDispatch(f.principal.familyId,f.result.jobId);assert(dispatch);
      const session={id:`job-${randomUUID()}`,turn:{id:'build',sequence:0},auth:{current:{authenticator:'agent-job-runner',principalId:`agent-job:${f.principal.familyId}`,
        attributes:{channel:'agent-job',familyId:f.principal.familyId,memberUserId:f.principal.memberUserId,agentJobId:f.result.jobId,agentJobStageNumber:'1',
          conversationJobId:f.result.jobId,conversationJobLease:dispatch.leaseToken,conversationJobEpoch:dispatch.accessEpoch}}}} as unknown as ToolContext['session'];
      await requireConversationJobAccess(session,'prepare');return session;}
    await t.test('false quotations cannot enter a queued brief; an exact correction may start once',async()=>{
      const principal=await owner(),fg=await foreground(principal);
      const [child]=await sql`insert into public.children(family_id,name,birth_month) values(${principal.familyId},'Quote fixture','2020-01-01') returning id`;
      const input={familyId:principal.familyId,requestedByUserId:principal.memberUserId,sessionId:fg.execution.sessionId,skill:'materials-studio',title:'Counting page',
        plan:{request:'Make a counting page.',herWords:'Keep the family detail private.'},totalStages:1,childId:child.id};
      const refused=await executeConversationOperation(await prepareConversationOperation(fg.ctx,input,45000),()=>startConversationJob(fg.ctx,input));
      assert.equal(refused.ok,false);
      assert.equal((await sql`select 1 from public.conversation_jobs where request_id=${fg.request.requestId}`).length,0);
      const corrected={...input,plan:{...input.plan,herWords:'Keep this private family detail.'}},ctx={...fg.ctx,toolExecution:{callId:'corrected-quote',name:'start_agent_job'}} as ToolContext;
      const accepted=await executeConversationOperation(await prepareConversationOperation(ctx,corrected,45000),()=>startConversationJob(ctx,corrected));assert(accepted.ok);
      if(!accepted.ok)throw Error('Expected corrected build');
      const [stored]=await sql`select plan from public.conversation_jobs where job_id=${accepted.jobId}`;assert.equal(stored.plan.herWords,corrected.plan.herWords);
    });
    await t.test('foreground ends while independent work continues; exact own result restores',async()=>{
      const f=await fixture(),[stored]=await sql`select title,plan from public.agent_jobs where id=${f.result.jobId}`;
      assert.equal(stored.title,'Background material');assert.deepEqual(stored.plan,{});
      assert((await loadConversationRequestContext(f.principal,f.fg.request.requestId)).includes('Background material delivery to this conversation is available.'));
      const before=await readConversationFeed(f.principal),work=before.messages.find(m=>m.work?.jobId===f.result.jobId);assert(work);
      await finishConversationRequest(f.principal,f.fg.execution,'completed');
      await acceptConversationRequest(f.principal,{intentId:randomUUID(),text:'We can discuss something else now.'});assert.equal((await leaseConversationRequest(f.principal)).kind,'leased');
      const session=await worker(f);await requireConversationJobAccess(session,'execute');await requireConversationJobDatabaseAccess(session.auth.current!.attributes);
      const ctx={session,toolExecution:{callId:'make',name:'create_printable'}} as ToolContext;let effects=0;
      await executeConversationOperation(await prepareConversationOperation(ctx,{page:'counting'},45000),()=>{effects++;return {id:'receipt'};});
      await executeConversationOperation(await prepareConversationOperation(ctx,{page:'counting'},45000),()=>{effects++;return {id:'wrong'};});assert.equal(effects,1);
      const [material]=await sql`insert into public.materials(family_id,title,html,preview_url,pdf_url,status,generation)
        values(${f.principal.familyId},'Counting page','<p>Count</p>','https://example.test/page.png','https://example.test/page.pdf','final',${sql.json({sessionId:session.id,turnId:session.turn.id})}) returning id`;
      const refused=await completeStageFromWorker(f.principal.familyId,f.result.jobId,1,[material.id,randomUUID()]);assert.equal(refused.ok,false);
      assert.equal((await sql`select 1 from public.agent_job_stage_artifacts where job_id=${f.result.jobId}`).length,0);
      const report={session,toolExecution:{callId:'report',name:'report_agent_job_stage'}} as ToolContext;
      const finished=await executeConversationOperation(await prepareConversationOperation(report,{materialIds:[material.id]},45000),
        ()=>completeStageFromWorker(f.principal.familyId,f.result.jobId,1,[material.id]));assert.deepEqual(finished,{ok:true,status:'completed'});
      await observeConversationJobEnd(f.principal.familyId,f.result.jobId,session);
      const changes=await readConversationFeedChanges(f.principal,{after:before.changeCursor});
      assert(changes.changes.some(c=>c.kind==='upsert'&&c.message.id===work.id&&c.message.content.includes('is ready')));
      assert.equal(changes.materials[0]?.id,material.id);assert.equal(changes.materials[0]?.sessionId,`job:${f.result.jobId}`);
      assert(!(await readConversationFeed(await owner())).messages.some(m=>m.id===work.id));await assert.rejects(requireConversationJobAccess(session,'execute'));
      const seen=await readConversationFeed(f.principal);await sql`update public.materials set deleted_at=clock_timestamp() where id=${material.id}`;
      assert.equal((await readConversationFeedChanges(f.principal,{after:seen.changeCursor})).materials.length,0);
    });
    await t.test('another adult cannot adopt work; a claimed runtime never steals or retries automatically',async()=>{
      const f=await fixture(),other=await owner(),fg=await foreground(other),input={...f.input,requestedByUserId:other.memberUserId,sessionId:fg.execution.sessionId};
      const result=await executeConversationOperation(await prepareConversationOperation(fg.ctx,input,45000),()=>startConversationJob(fg.ctx,input));assert.equal(result.ok,false);
      const session=await worker(f),forged=structuredClone(session);Object.assign(forged,{id:'wrong-runtime'});await assert.rejects(requireConversationJobAccess(forged,'prepare'));
      await observeConversationJobEnd(f.principal.familyId,f.result.jobId,forged);
      await requireConversationJobAccess(session,'execute');
      await observeConversationJobEnd(f.principal.familyId,f.result.jobId,session);await releaseConversationJobDispatch(f.principal.familyId,f.result.jobId);
      await assert.rejects(requireConversationJobAccess(session,'execute'));await assert.rejects(prepareConversationJobDispatch(f.principal.familyId,f.result.jobId));
      const [stage]=await sql`select status from public.agent_job_stages where job_id=${f.result.jobId}`;assert.equal(stage.status,'in_progress');
    });
    await t.test('source erasure racing atomic completion always leaves cancelled private work',async()=>{
      const f=await fixture(),session=await worker(f);
      const [material]=await sql`insert into public.materials(family_id,title,html,preview_url,pdf_url,status,generation)
        values(${f.principal.familyId},'Race fixture','<p>Count</p>','https://example.test/page.png','https://example.test/page.pdf','final',${sql.json({sessionId:session.id,turnId:session.turn.id})}) returning id`;
      await Promise.all([
        completeStageFromWorker(f.principal.familyId,f.result.jobId,1,[material.id]),
        sql`delete from public.conversation_messages where id=${f.fg.request.messageId}`,
      ]);
      const [after]=await sql`select l.state,j.status,l.plan from public.conversation_jobs l join public.agent_jobs j on j.id=l.job_id where l.job_id=${f.result.jobId}`;
      assert.equal(after.state,'revoked');assert.equal(after.status,'cancelled');assert.deepEqual(after.plan,{});
      assert.equal((await completeStageFromWorker(f.principal.familyId,f.result.jobId,1,[material.id])).ok,false);
    });
    await t.test('erasure and membership rejoin fence late private results',async()=>{
      for(const kind of ['erase','rejoin']){const f=await fixture(),session=await worker(f),before=await readConversationFeed(f.principal);
        const operation=await prepareConversationOperation({session,toolExecution:{callId:'late',name:'create_printable'}} as ToolContext,{},45000);
        if(kind==='erase')await sql`delete from public.conversation_messages where id=${f.fg.request.messageId}`;
        else{await finishConversationRequest(f.principal,f.fg.execution,'completed');await sql`delete from public.family_members where family_id=${f.principal.familyId} and user_id=${f.principal.memberUserId}`;
          await sql`insert into public.family_members(family_id,user_id) values(${f.principal.familyId},${f.principal.memberUserId})`;}
        await assert.rejects(requireConversationJobAccess(session,'execute'));await assert.rejects(executeConversationOperation(operation,()=>({privateResult:'must not return'})));
        const [link]=await sql`select state,title,plan from public.conversation_jobs where job_id=${f.result.jobId}`;assert.equal(link.state,'revoked');assert.deepEqual(link.plan,{});assert.equal(link.title,'Unavailable work');
        if(kind==='erase')assert((await readConversationFeedChanges(f.principal,{after:before.changeCursor})).changes.some(c=>c.kind==='delete'&&before.messages.some(m=>m.work&&m.id===c.messageId)));
      }
    });
  }finally{for(const [key,value]of Object.entries(flags)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await sql.end();}
});
