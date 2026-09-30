import type { ToolContext } from "eve/tools";

import { conversationRequestEnvelope } from "./conversation-request-admission";
import { ConversationRequestError, requestTransaction } from "./conversation-requests";
import { agentJobsEnabled } from "./jobs/flag";
import { parseJobPlan } from "./jobs/contracts";
import type { StageMetering, WorkerStageResult } from "./jobs/runner";
import type { StartJobInput, StartJobResult } from "./jobs/store";
import { mapDb, type DbJson } from "./map/db";

export function conversationJobsEnabled() {
  return agentJobsEnabled() && process.env.HOMA_CONVERSATION_REQUESTS === "1" && process.env.HOMA_CONVERSATION_RECORDING === "1";
}
/** A quotation is optional, but an authored quotation must match the saved input exactly. */
export function conversationJobQuoteMatches(plan: unknown, acceptedText: string): boolean {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return false;
  const quote = (plan as Record<string, unknown>).herWords;
  return quote === undefined ||
    (typeof quote === "string" && quote.length > 0 && acceptedText.includes(quote));
}
export function hasConversationJobContext(attributes: unknown) {
  const a=attributes as Record<string,unknown>|undefined;
  return !!a && ["conversationJobId","conversationJobLease","conversationJobEpoch"].some(key=>key in a);
}
export function conversationJobEnvelope(auth: ToolContext["session"]["auth"]["current"]) {
  if (!hasConversationJobContext(auth?.attributes)) return null;
  const a=auth?.attributes as Record<string,unknown>;
  if (auth?.authenticator!=="agent-job-runner" || a.channel!=="agent-job" || typeof a.familyId!=="string" ||
      typeof a.memberUserId!=="string" || typeof a.conversationJobId!=="string" || typeof a.conversationJobLease!=="string" ||
      typeof a.conversationJobEpoch!=="string" || a.agentJobId!==a.conversationJobId) throw new ConversationRequestError("execution");
  return { attributes:a,familyId:a.familyId,memberUserId:a.memberUserId,jobId:a.conversationJobId,
    leaseToken:a.conversationJobLease,accessEpoch:a.conversationJobEpoch };
}

/** Only an admitted foreground tool call may create the private job link.
 * Job insertion and origin linkage commit together before the caller hears it. */
export async function startConversationJob(ctx: ToolContext,input: StartJobInput): Promise<StartJobResult> {
  if (!conversationJobsEnabled()) return {ok:false,note:"Background delivery is unavailable. Make this in the current turn."};
  const envelope=conversationRequestEnvelope(ctx.session.auth.current),call=ctx.toolExecution;
  if (!envelope || !call || ctx.session.parent) throw new ConversationRequestError("execution");
  if (input.skill!=="materials-studio" || input.totalStages!==1) return {ok:false,note:"Only a new standalone material can use background delivery here. Keep this work in the current turn."};
  const valid=parseJobPlan(input.skill,input.plan);
  if (!valid.ok) return {ok:false,note:valid.note};
  const title=input.title.trim();
  if (!title || title.length>160) return {ok:false,note:"Give this work a short title."};
  return requestTransaction(async tx=>{
    const [record]=await tx`select c.id from public.conversation_records c
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where c.family_id=${envelope.familyId} and c.member_user_id=${envelope.memberUserId}
        and c.access_epoch=${envelope.accessEpoch} and f.status<>'deleted' for update of c`;
    if (!record) throw new ConversationRequestError("execution");
    const [operation]=await tx`select o.id,m.content as accepted_text from public.conversation_operations o join public.conversation_requests r on r.id=o.request_id
      join public.conversation_messages m on m.id=r.canonical_message_id
      where o.request_id=${envelope.requestId} and o.conversation_id=${record.id} and o.access_epoch=${envelope.accessEpoch}
        and o.session_id=${ctx.session.id} and o.turn_id=${ctx.session.turn.id} and o.call_id=${call.callId} and o.tool_name='start_agent_job'
        and o.state='started' and o.deadline_at>clock_timestamp() and r.state='executing' and r.canonical_message_id is not null
        and r.lease_token=${envelope.leaseToken} and r.execution_session_id=${ctx.session.id} and r.execution_turn_id=${ctx.session.turn.id}
        and r.execution_sequence=${ctx.session.turn.sequence}`;
    if (!operation) throw new ConversationRequestError("execution");
    if (!conversationJobQuoteMatches(input.plan, operation.accepted_text))
      return {ok:false,note:"The quoted words do not match this parent's saved message. Use an exact quote from that message, or omit the optional herWords field, then try again. No build was started."};
    const existing=await tx`select j.id,j.status,l.conversation_id,l.access_epoch from public.agent_jobs j
      left join public.conversation_jobs l on l.job_id=j.id where j.family_id=${envelope.familyId} and j.skill=${input.skill}
        and j.child_id is not distinct from ${input.childId??null}::uuid and j.status in ('queued','running','paused','awaiting_input') limit 1`;
    if (existing[0]) {
      if (existing[0].conversation_id!==record.id || existing[0].access_epoch!==envelope.accessEpoch)
        return {ok:false,note:"Another build is already active for this child. This request has not started."};
      return {ok:true,jobId:existing[0].id,status:existing[0].status,alreadyExisted:true,note:"Your existing build is still underway. No second build was started."};
    }
    const [job]=await tx`insert into public.agent_jobs(family_id,child_id,requested_by_user_id,session_id,skill,title,plan,total_stages,start_idempotency_key)
      values(${envelope.familyId},${input.childId??null},${envelope.memberUserId},${ctx.session.id},'materials-studio','Background material','{}',1,${`conversation-operation:${operation.id}`}) returning id,status`;
    await tx`insert into public.conversation_jobs(job_id,conversation_id,request_id,operation_id,access_epoch,title,plan,source_session_id)
      values(${job.id},${record.id},${envelope.requestId},${operation.id},${envelope.accessEpoch},${title},${tx.json(input.plan as DbJson)},${ctx.session.id})`;
    return {ok:true,jobId:job.id,status:job.status,alreadyExisted:false,note:"The material is durably queued and will appear in this conversation. Finish this reply; the parent can keep talking while it is made."};
  });
}

export async function prepareConversationJobDispatch(familyId:string,jobId:string) {
  return requestTransaction(async tx=>{
    const [link]=await tx`select l.*,c.family_id,c.member_user_id,c.access_epoch as current_epoch,r.canonical_message_id
      from public.conversation_jobs l join public.conversation_records c on c.id=l.conversation_id
      join public.conversation_requests r on r.id=l.request_id where l.job_id=${jobId} and c.family_id=${familyId} for update of l`;
    if (!link) return null;
    const members=await tx`select 1 from public.family_members fm join public.families f on f.id=fm.family_id
      where fm.family_id=${familyId} and fm.user_id=${link.member_user_id} and f.status<>'deleted'`;
    if (!members.length || link.access_epoch!==link.current_epoch || !link.canonical_message_id ||
        !['queued','dispatched'].includes(link.state) || link.execution_session_id) throw new ConversationRequestError("execution");
    await tx`update public.conversation_jobs set state='dispatched' where job_id=${jobId}`;
    return {memberUserId:link.member_user_id as string,accessEpoch:link.access_epoch as string,leaseToken:link.lease_token as string,plan:link.plan};
  });
}

export async function requireConversationJobAccess(session:ToolContext['session'],phase:'prepare'|'execute') {
  const e=conversationJobEnvelope(session.auth.current);
  if (!e) return null;
  if (session.parent) throw new ConversationRequestError('execution');
  return requestTransaction(async tx=>{
    const [row]=await tx`select l.*,c.family_id,c.member_user_id,c.access_epoch as current_epoch,r.canonical_message_id,j.status as job_status
      from public.conversation_jobs l join public.conversation_records c on c.id=l.conversation_id
      join public.conversation_requests r on r.id=l.request_id join public.agent_jobs j on j.id=l.job_id
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
      join public.families f on f.id=c.family_id
      where l.job_id=${e.jobId} and c.family_id=${e.familyId} and c.member_user_id=${e.memberUserId}
        and l.lease_token=${e.leaseToken} and c.access_epoch=${e.accessEpoch} and l.access_epoch=c.access_epoch
        and r.canonical_message_id is not null and f.status<>'deleted' for update of l`;
    if (!row || !['queued','running'].includes(row.job_status)) throw new ConversationRequestError('execution');
    if (phase==='prepare' && row.state==='dispatched' && row.execution_session_id===null) {
      await tx`update public.conversation_jobs set state='executing',execution_session_id=${session.id},execution_turn_id=${session.turn.id},
        execution_sequence=${session.turn.sequence} where job_id=${e.jobId}`;
      await tx`update public.agent_job_stages set status='in_progress',updated_at=clock_timestamp()
        where job_id=${e.jobId} and family_id=${e.familyId} and status='pending'`;
      await tx`update public.agent_jobs set status='running',updated_at=clock_timestamp()
        where id=${e.jobId} and family_id=${e.familyId} and status='queued'`;
    } else if (row.state!=='executing' || row.execution_session_id!==session.id || row.execution_turn_id!==session.turn.id ||
        row.execution_sequence!==session.turn.sequence) throw new ConversationRequestError('execution');
    Object.assign(e.attributes,{conversationJobExecutionSessionId:session.id,conversationJobExecutionTurnId:session.turn.id,
      conversationJobExecutionSequence:String(session.turn.sequence)});
    return {familyId:e.familyId,memberUserId:e.memberUserId};
  });
}

export async function requireConversationJobDatabaseAccess(attributes:unknown) {
  if (!hasConversationJobContext(attributes)) return null;
  const a=attributes as Record<string,unknown>;
  const e=conversationJobEnvelope({authenticator:'agent-job-runner',attributes:a} as ToolContext['session']['auth']['current']);
  if (!e || typeof a.conversationJobExecutionSessionId!=='string' || typeof a.conversationJobExecutionTurnId!=='string' ||
      typeof a.conversationJobExecutionSequence!=='string' || !/^\d+$/u.test(a.conversationJobExecutionSequence)) throw new ConversationRequestError('execution');
  const rows=await mapDb()`select 1 from public.conversation_jobs l join public.conversation_records c on c.id=l.conversation_id
    join public.conversation_requests r on r.id=l.request_id join public.agent_jobs j on j.id=l.job_id
    join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id join public.families f on f.id=c.family_id
    where l.job_id=${e.jobId} and c.family_id=${e.familyId} and c.member_user_id=${e.memberUserId} and l.lease_token=${e.leaseToken}
      and l.access_epoch=${e.accessEpoch} and c.access_epoch=l.access_epoch and r.canonical_message_id is not null and f.status<>'deleted'
      and l.state='executing' and j.status in ('queued','running') and l.execution_session_id=${a.conversationJobExecutionSessionId}
      and l.execution_turn_id=${a.conversationJobExecutionTurnId} and l.execution_sequence::text=${a.conversationJobExecutionSequence}`;
  if (!rows.length) throw new ConversationRequestError('execution');
  return {familyId:e.familyId,memberUserId:e.memberUserId};
}

/** A claimed execution is never automatically stolen. Uncertain original work
 * parks for reconciliation; an unclaimed dispatch may retry the same secret. */
export async function releaseConversationJobDispatch(familyId:string,jobId:string):Promise<boolean> {
  return requestTransaction(async tx=>{
    const [link]=await tx`select l.state,l.execution_session_id from public.conversation_jobs l
      join public.conversation_records c on c.id=l.conversation_id where l.job_id=${jobId} and c.family_id=${familyId} for update of l`;
    if (!link) return false;
    if (link.execution_session_id || link.state==='revoked') return true;
    await tx`update public.agent_job_stages set status='pending',updated_at=clock_timestamp() where job_id=${jobId} and family_id=${familyId} and status='in_progress'`;
    await tx`update public.agent_jobs set status='queued',updated_at=clock_timestamp() where id=${jobId} and family_id=${familyId} and status='running'`;
    return true;
  });
}
/** Channel observation proves the actual winning runtime. A denied duplicate
 * must never park the original worker. Only the stale-stage reaper omits it. */
export type ConversationJobObservation = Pick<ToolContext['session'],'id'|'auth'> & {turn?:{id:string;sequence:number}};
export async function observeConversationJobEnd(familyId:string,jobId:string,session?:ConversationJobObservation) {
  const envelope=session?conversationJobEnvelope(session.auth.current):null;
  if (session && (!envelope || envelope.jobId!==jobId || envelope.familyId!==familyId)) return false;
  return requestTransaction(async tx=>{
    const [link]=await tx`select l.*,j.status as job_status from public.conversation_jobs l
      join public.conversation_records c on c.id=l.conversation_id join public.agent_jobs j on j.id=l.job_id
      where l.job_id=${jobId} and c.family_id=${familyId} for update of l`;
    if (!link) return false;
    if (session && (link.execution_session_id!==session.id || link.lease_token!==envelope!.leaseToken ||
        (session.turn && (link.execution_turn_id!==session.turn.id || link.execution_sequence!==session.turn.sequence)))) return true;
    if (!session) {
      const stale=await tx`select 1 from public.agent_job_stages where job_id=${jobId} and status='in_progress'
        and updated_at<clock_timestamp()-interval '20 minutes'`;
      if (!stale.length) return true;
    }
    await tx`update public.conversation_jobs set state=${link.job_status==='completed'?'completed':'recovery_required'}
      where job_id=${jobId} and state='executing'`;
    await tx`update public.agent_jobs j set status='paused',progress_note='This build needs a recovery check.',updated_at=clock_timestamp()
      from public.conversation_jobs l where l.job_id=j.id and j.id=${jobId} and l.state='recovery_required' and j.status='running'`;
    return true;
  });
}
export async function isConversationJob(familyId:string,jobId:string) {
  const rows=await mapDb()`select 1 from public.conversation_jobs l join public.conversation_records c on c.id=l.conversation_id
    where l.job_id=${jobId} and c.family_id=${familyId}`;
  return rows.length>0;
}

/** Linked single-stage work publishes its exact artifacts and terminal state
 * together. The older multi-stage runner keeps its existing behavior. */
export async function completeConversationJobStage(familyId:string,jobId:string,stageNumber:number,
  materialIds:string[],metering:StageMetering):Promise<WorkerStageResult|null> {
  return requestTransaction(async tx=>{
    const [record]=await tx`select c.id from public.conversation_records c join public.conversation_jobs l on l.conversation_id=c.id
      where l.job_id=${jobId} and c.family_id=${familyId} for update of c`;
    if (!record) return null;
    const [job]=await tx`select l.state,l.execution_session_id,l.execution_turn_id,j.child_id,j.status,s.id as stage_id,s.status as stage_status
      from public.conversation_jobs l join public.conversation_records c on c.id=l.conversation_id
      join public.conversation_requests r on r.id=l.request_id join public.agent_jobs j on j.id=l.job_id
      join public.agent_job_stages s on s.job_id=j.id and s.family_id=j.family_id and s.stage_number=${stageNumber}
      join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id join public.families f on f.id=c.family_id
      where l.job_id=${jobId} and c.id=${record.id} and l.access_epoch=c.access_epoch and r.canonical_message_id is not null
        and f.status<>'deleted' and j.skill='materials-studio' and j.total_stages=1 and ${stageNumber}=1
        and l.state in ('executing','recovery_required') and j.status in ('running','paused') and j.cancel_requested_at is null
      for update of l,j,s`;
    if (!job || job.stage_status!=='in_progress') return {ok:false,note:"This build can no longer accept a result. Nothing was published."};
    const ids=[...new Set(materialIds)];
    if (!ids.length || ids.length>12) return {ok:false,note:"Name the material created by this build."};
    const materials=await tx`select id,child_id from public.materials where family_id=${familyId} and id=any(${tx.array(ids)}::uuid[])
      and deleted_at is null and generation->>'sessionId'=${job.execution_session_id}
      and generation->>'turnId'=${job.execution_turn_id} for update`;
    if (materials.length!==ids.length) return {ok:false,note:"Every material must be available and created in this build's own turn. Nothing was published."};
    for (const material of materials) {
      await tx`insert into public.agent_job_stage_artifacts(stage_id,job_id,family_id,kind,material_id)
        values(${job.stage_id},${jobId},${familyId},'material',${material.id}) on conflict do nothing`;
      if (job.child_id && material.child_id===null) await tx`update public.materials set child_id=${job.child_id} where id=${material.id} and family_id=${familyId}`;
    }
    await tx`update public.agent_job_stages set status='approved',completed_at=clock_timestamp(),updated_at=clock_timestamp(),
      sandbox_cpu_seconds=${metering.sandboxCpuSeconds??null},page_fetch_count=${metering.pageFetchCount??null},model_tokens=${metering.modelTokens??null}
      where id=${job.stage_id}`;
    await tx`update public.agent_jobs set status='completed',current_stage=1,completed_at=clock_timestamp(),updated_at=clock_timestamp()
      where id=${jobId} and family_id=${familyId}`;
    await tx`update public.conversation_jobs set state='completed' where job_id=${jobId}`;
    await tx`insert into public.agent_job_events(job_id,family_id,stage_number,kind,payload)
      values(${jobId},${familyId},1,'stage_completed','{"gated":false}'::jsonb),
        (${jobId},${familyId},null,'milestone','{"event":"completed"}'::jsonb)`;
    return {ok:true,status:'completed'};
  });
}
