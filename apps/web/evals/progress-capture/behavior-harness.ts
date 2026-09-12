import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { TOOL_DEADLINE, withToolDeadline } from "../../lib/agent-tool-deadline";
import { assertFamilyArtifactAccess } from "../../lib/account-deletion-artifact-fence";
import { captureJournalClaims, loadJournalFamilyChildren } from "../../lib/child-progress/journal-capture";
import { loadJournalConversationContext } from "../../lib/child-progress/journal-context";
import { PostgresChildProgressRepository } from "../../lib/child-progress/postgres-repository";
import { ChildProgressService } from "../../lib/child-progress/progress-service";
import { buildChildProgressView } from "../../lib/child-progress/projection";
import { executeChildProgressTool, type ChildProgressToolOperations } from "../../lib/child-progress/tool-adapter";
import { createProgressToolContext, parseManageChildProgressCommand, manageChildProgressToolInputSchema } from "../../lib/child-progress/tool-contract";
import { DURABLE_WRITE_ENV_VARS, isEvalIsolationActive } from "../../lib/eval-isolation";
import { mapDb } from "../../lib/map/db";
import { zonedDateString } from "../../lib/time-zone";

export const captureBehaviorCases = {
  named: {
    message: "Maya can cut along a straight line with her child scissors on her own now. Please update her record.",
    previousAssistant: null,
    itemId: "fine_motor.cuts-line", answer: "easily",
  },
  decline: {
    message: "Maya can skip alternating legs, but slowly. Please note that and leave it there. I do not want any more questions today.",
    previousAssistant: null,
    itemId: "gross_motor.skips", answer: "getting_there",
  },
  contextual: {
    message: "She can do all of that easily. Please save it and leave it there today.",
    previousAssistant: "For Maya's fine motor record: can she cut along a straight line with child scissors on her own?",
    itemId: "fine_motor.cuts-line", answer: "easily",
  },
} as const;
export type CaptureBehaviorCase = keyof typeof captureBehaviorCases;
export interface CaptureCall { name: string; input: unknown; output?: unknown; error?: string }

/** Post-authentication tool/service behavior. Full-fleet routing is tested separately. */
export function assertCaptureSandbox(): string {
  const raw = process.env.HOMA_EVAL_DATABASE_URL;
  assert.ok(isEvalIsolationActive(process.env), "Requires canonical eval isolation");
  assert.ok(raw, "Requires eval:sandbox");
  const url = new URL(raw);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.protocol, "postgres:");
  assert.equal(url.pathname, "/homa_eval");
  assert.equal(url.username, "homa_eval");
  for (const key of DURABLE_WRITE_ENV_VARS) assert.equal(process.env[key], undefined, `Durable production credential must be absent: ${key}`);
  assert.equal(process.env.HOMA_LIVE_PROGRESS_ENABLED, "true");
  assert.equal(process.env.HOMA_CLAIM_EXTRACTION_ENABLED, "true");
  return raw;
}

export async function createCaptureBehaviorFixture(name: CaptureBehaviorCase) {
  assertCaptureSandbox();
  const scenario = captureBehaviorCases[name];
  const database = mapDb();
  const familyId = randomUUID(), memberUserId = randomUUID(), childId = randomUUID(), siblingId = randomUUID();
  const episodeId = randomUUID(), inboundMessageId = randomUUID(), previousMessageId = randomUUID();
  const runtimeSessionId = `capture-behavior:${randomUUID()}`, turnId = randomUUID();
  const now = new Date();
  const today = zonedDateString(now, "America/New_York");
  const birthMonth = `${Number(today.slice(0, 4)) - 4}${today.slice(4, 7)}-01`;
  await database.begin(async tx => {
    await tx`insert into auth.users(id) values(${memberUserId})`;
    await tx`insert into public.families(id,name,status,sandbox,billing_exempt,time_zone,profile_completed_at,context)
      values(${familyId},'Capture behavior fixture','claimed',true,true,'America/New_York',now(),'{}'::jsonb)`;
    await tx`insert into public.family_members(family_id,user_id,role) values(${familyId},${memberUserId},'parent')`;
    await tx`insert into public.children(id,family_id,name,birth_month) values
      (${childId},${familyId},'Maya',${birthMonth}),(${siblingId},${familyId},'Leo',${`${Number(today.slice(0, 4)) - 12}${today.slice(4, 7)}-01`})`;
    await tx`insert into public.conversation_episodes(id,family_id,scope,member_user_id) values(${episodeId},${familyId},'member',${memberUserId})`;
    if (scenario.previousAssistant) {
      // The real privacy trigger requires a proven parent before an assistant.
      await tx`insert into public.conversation_messages(id,family_id,member_user_id,session_id,sequence,turn_id,role,channel,content,visibility,created_at,episode_id)
        values(${randomUUID()},${familyId},${memberUserId},${runtimeSessionId},1,'earlier-parent','user','web','Please help me understand Maya cutting.','family',${new Date(now.getTime()-3000).toISOString()},${episodeId})`;
      await tx`insert into public.conversation_messages(id,family_id,member_user_id,session_id,sequence,turn_id,role,channel,content,visibility,created_at,episode_id)
        values(${previousMessageId},${familyId},${memberUserId},${runtimeSessionId},2,'earlier-assistant','assistant','web',${scenario.previousAssistant},'family',${new Date(now.getTime()-2000).toISOString()},${episodeId})`;
    }
    await tx`insert into public.conversation_messages(id,family_id,member_user_id,session_id,sequence,turn_id,role,channel,content,visibility,created_at,episode_id)
      values(${inboundMessageId},${familyId},${memberUserId},${runtimeSessionId},3,${turnId},'user','web',${scenario.message},'family',${new Date(now.getTime()-1000).toISOString()},${episodeId})`;
  });
  // This fixture owns the post-authentication seam. It never fabricates a JWT or
  // changes the production eval channel stamp. Read actual membership and text.
  const [inbound] = await database`select message.content from public.conversation_messages message
    join public.family_members member on member.family_id=message.family_id and member.user_id=message.member_user_id
    where message.id=${inboundMessageId} and message.family_id=${familyId} and message.member_user_id=${memberUserId}
      and message.role='user' and message.visibility='family' and message.channel='web' and message.session_id=${runtimeSessionId}`;
  assert.equal(inbound?.content, scenario.message);
  await assertFamilyArtifactAccess(familyId);
  const context = createProgressToolContext({access:{familyId}, attributes:{channel:"web",memberUserId,episodeId,
    canonicalInboundText:inbound.content,canonicalInboundMessageId:inboundMessageId},sessionId:runtimeSessionId,turnId,now});
  const previous = await loadJournalConversationContext({familyId,memberUserId,runtimeSessionId,inboundMessageId,message:scenario.message,channel:"web"});
  assert.equal(previous?.messageId ?? null, scenario.previousAssistant ? previousMessageId : null);
  assert.equal(previous?.text ?? null, scenario.previousAssistant);
  const roster = await loadJournalFamilyChildren(familyId);
  assert.equal(roster.find(child=>child.childId===childId)?.ageMonths,48);
  const repository = new PostgresChildProgressRepository(()=>database);
  const progress = new ChildProgressService(repository,{buildView:buildChildProgressView});
  const unsupported = async (): Promise<never> => { throw new Error("This bounded capture behavior does not authorize that effect"); };
  const operations: ChildProgressToolOperations = {
    startCheckIn:unsupported,respondCheckIn:unsupported,pauseCheckIn:unsupported,resumeCheckIn:unsupported,stopCheckIn:unsupported,
    takeoverCheckIn:unsupported,resolveConflict:unsupported,undoProgressUpdate:unsupported,markObservationUsed:unsupported,
    listFamilyCheckIns:async()=>[],getChildProgressView:(family,child)=>progress.getChildProgressView(family,child),
    async recordJournalEvidence(ctx,input) {
      assert.equal(input.childId,childId,"Only the explicitly owned target is authorized");
      assert.equal(ctx.canonicalInboundText,scenario.message);
      assert.equal(ctx.inboundMessageId,inboundMessageId);
      // Production judgment/catch/validator pipeline, not a mock claim result.
      const capture=await captureJournalClaims({familyId:ctx.familyId,childId:input.childId,message:ctx.canonicalInboundText!,surface:"journal",
        conversation:{memberUserId:ctx.memberUserId,runtimeSessionId:ctx.runtimeSessionId,inboundMessageId:ctx.inboundMessageId!,channel:"web"}});
      assert.ok(capture.childIds.every(id=>id===childId),"Unexpected sibling attribution fails this focused fixture");
      return progress.recordJournalProgressEvidence({familyId:ctx.familyId,childId:input.childId,memberUserId:ctx.memberUserId,
        quote:ctx.canonicalInboundText!,channel:"web",messageId:ctx.inboundMessageId!,observedAt:ctx.now,idempotencyKey:input.idempotencyKey,
        ...(input.subjectId?{subjectId:input.subjectId}:{}),claims:capture.claims});
    },
  };
  const execute = (raw: unknown) => withToolDeadline(TOOL_DEADLINE.quick,()=>executeChildProgressTool({
    command:parseManageChildProgressCommand(raw),createContext:()=>context,operations}),false);
  async function durableReceipt() {
    const evidence=await database`select id,family_id,child_id,member_user_id,message_id,item_id,answer,quote,source,derivation,channel from public.child_progress_evidence where family_id=${familyId} order by id`;
    const operations=await database`select id,child_id,status,evidence_ids from public.child_progress_operations where family_id=${familyId}`;
    const observations=await database`select child_id,message_id,quote from public.child_observations where family_id=${familyId}`;
    const sittings=await database`select id from public.progress_check_ins where family_id=${familyId}`;
    const [projection]=await database`select child_id,evidence_count,source_revision from public.child_progress_live where family_id=${familyId}`;
    const [revision]=await database`select child_id,revision from public.child_progress_revisions where family_id=${familyId}`;
    return {evidence:[...evidence],operations:[...operations],observations:[...observations],sittings:[...sittings],projection,revision};
  }
  return {scenario,childId,siblingId,familyId,memberUserId,inboundMessageId,previous,roster,context,execute,durableReceipt};
}

export function assertCaptureSaved(fixture: Awaited<ReturnType<typeof createCaptureBehaviorFixture>>, result: Awaited<ReturnType<typeof fixture.durableReceipt>>, output: unknown) {
  assert.equal((output as {kind?:string})?.kind,"progress_update","A caught extraction failure or observation cannot pass save acceptance");
  assert.equal(result.evidence.length,1);
  const evidence=result.evidence[0]!;
  assert.equal(evidence.child_id,fixture.childId);assert.equal(evidence.family_id,fixture.familyId);
  assert.equal(evidence.member_user_id,fixture.memberUserId);assert.equal(evidence.message_id,fixture.inboundMessageId);
  assert.equal(evidence.item_id,fixture.scenario.itemId);assert.equal(evidence.answer,fixture.scenario.answer);
  assert.equal(evidence.source,"journal");assert.equal(evidence.channel,"web");
  assert.ok(typeof evidence.quote==="string"&&evidence.quote.length>0&&fixture.scenario.message.includes(evidence.quote));
  assert.equal(result.operations.length,1);assert.equal(result.operations[0]?.status,"recorded");
  assert.deepEqual(result.operations[0]?.evidence_ids,[evidence.id]);
  assert.equal(result.sittings.length,0);assert.equal(result.observations.length,0);
  assert.equal(result.projection?.child_id,fixture.childId);assert.equal(result.projection?.evidence_count,1);
  assert.equal(String(result.projection?.source_revision),String(result.revision?.revision));
}

export async function runCaptureBehavior(name: CaptureBehaviorCase, signal: AbortSignal) {
  assert.ok(process.env.VERCEL_OIDC_TOKEN,"Requires Vercel OIDC");
  const fixture=await createCaptureBehaviorFixture(name);
  const skill=await readFile(resolve(process.cwd(),"agent/skills/progress-capture/SKILL.md"),"utf8");
  const laws=await readFile(resolve(process.cwd(),"agent/instructions.md"),"utf8");
  const calls:CaptureCall[]=[];let loaded=false,attempts=0;
  const result=await generateText({model:HOMA_MODEL,maxRetries:0,maxOutputTokens:1200,stopWhen:stepCountIs(4),abortSignal:AbortSignal.any([signal,AbortSignal.timeout(90_000)]),
    system:[laws,"This is an isolated post-authentication parent conversation. Load progress-capture before responding. The tools below are the available effects; do not simulate an unavailable effect.",JSON.stringify({children:fixture.roster,selectedChildId:fixture.childId})].join("\n\n"),
    messages:[...(fixture.previous?[{role:"assistant" as const,content:fixture.previous.text}]:[]),{role:"user",content:fixture.scenario.message}],
    tools:{load_skill:tool({description:"Load a fleet procedure.",inputSchema:z.object({skill:z.literal("progress-capture")}),execute:async input=>{assert.equal(loaded,false);loaded=true;const output={content:skill};calls.push({name:"load_skill",input,output});return output;}}),
      manage_child_progress:tool({description:"Record the authenticated current parent report. Only the actual returned result establishes saved evidence.",inputSchema:manageChildProgressToolInputSchema,execute:async input=>{
        const call:CaptureCall={name:"manage_child_progress",input};calls.push(call);
        try{assert.ok(loaded);assert.equal(++attempts,1,"One operation per current report");call.output=await fixture.execute(input);return call.output;}
        catch(error){call.error=error instanceof Error?error.name:"unknown";throw error;}
      }})},
  });
  const durable=await fixture.durableReceipt();
  return {fixture,result,calls,durable};
}

/** Tool errors cannot disappear into a later successful model reply. */
export function assertCaptureBehavior(run: Awaited<ReturnType<typeof runCaptureBehavior>>) {
  assert.equal(run.calls.filter(call=>call.name==="load_skill").length,1);
  const writes=run.calls.filter(call=>call.name==="manage_child_progress");
  assert.equal(writes.length,1,"Exactly one capture attempt; no rejected check-in or extra write");
  assert.ok(run.calls.every(call=>call.error===undefined));
  assertCaptureSaved(run.fixture,run.durable,writes[0]?.output);
}
