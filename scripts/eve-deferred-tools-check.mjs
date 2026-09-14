import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Offline actual-Eve/SDK checks. The required preload rejects all real networking.
assert.ok(Array.isArray(globalThis.__startupNetworkAttempts), "Run through pnpm check:eve-deferred-tools");
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const web = join(repo, "apps/web");
const webRequire = createRequire(join(web, "package.json"));
const candidate = dirname(webRequire.resolve("eve/package.json"));
const metadata = JSON.parse(readFileSync(join(candidate, "package.json"), "utf8"));
assert.equal(metadata.version, "0.19.0", "Review this private harness integration before an Eve upgrade");
const isolate = "network-disabled repository test process";
process.env.VERCEL_ENV='preview';
process.env.HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS='1';
delete process.env.HOMA_PREVIEW_ASTRA_PRIORITY;
const {jsonSchema}=await import(web+'/node_modules/ai/dist/index.js');
const {createOpenAI}=await import(web+'/node_modules/@ai-sdk/openai/dist/index.js');
const {createGateway}=await import(web+'/node_modules/@ai-sdk/gateway/dist/index.js');
const source=join(candidate,'dist/src');
const {createToolLoopHarness}=await import(source+'/harness/tool-loop.js');
const {ContextContainer,contextStorage}=await import(source+'/context/container.js');
const keys=await import(source+'/context/keys.js');
const {getHarnessEmissionState}=await import(source+'/harness/emission.js');
const {hasPendingInputBatch}=await import(source+'/harness/input-requests.js');
const {buildToolSet,buildToolApproval}=await import(source+'/harness/tools.js');
const {applyPreviewDeferredTools,selectSkillLinkedToolNames}=await import(source+'/harness/preview-deferred-tools.js');
const {BundleKey}=await import(source+'/runtime/sessions/runtime-context-keys.js');
const MODEL='openai/gpt-6-astra';
const schema={type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false};
const loaded={type:'function',name:'offline_read',description:'Synthetic exact read.',parameters:schema,defer_loading:true};
const usage={input_tokens:0,output_tokens:0};
function sse(chunks){return new Response(chunks.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});}
function providerChunks(round){
 const parts=[{type:'response.created',response:{id:`resp_${round}`,created_at:0,model:'gpt-6-astra'}}];
 if(round===0){
  const call={type:'tool_search_call',id:'search_call_1',execution:'server',call_id:null,status:'completed',arguments:{query:'Find the exact read tool'}};
  const output={type:'tool_search_output',id:'search_output_1',execution:'server',call_id:null,status:'completed',tools:[loaded]};
  parts.push({type:'response.output_item.added',output_index:0,item:{...call,status:'in_progress'}},{type:'response.output_item.done',output_index:0,item:call},{type:'response.output_item.added',output_index:1,item:output},{type:'response.output_item.done',output_index:1,item:output});
  const tool={type:'function_call',id:'fc_1',call_id:'call_read_1',name:'offline_read',arguments:JSON.stringify({value:'synthetic'}),status:'completed'};
  parts.push({type:'response.output_item.added',output_index:2,item:tool},{type:'response.output_item.done',output_index:2,item:tool});
 }else{
  parts.push({type:'response.output_item.added',output_index:0,item:{type:'message',id:'msg_1'}},{type:'response.output_text.delta',item_id:'msg_1',output_index:0,content_index:0,delta:'Synthetic completed answer.'},{type:'response.output_item.done',output_index:0,item:{type:'message',id:'msg_1'}});
 }
 parts.push({type:'response.completed',response:{usage}});return parts;
}
const OpenAIClass=createOpenAI().responses('gpt-6-astra').constructor;
const GatewayClass=createGateway()(MODEL).constructor;
const checks=[];
async function scenario(outcome,store){
 const events=[],providerRequests=[],gatewayRequests=[],providerParts=[],executions=[];
 let round=0;
 const openaiModel=new OpenAIClass('gpt-6-astra',{provider:'openai.responses',url:({path})=>'https://offline.invalid'+path,headers:()=>({}),fetch:async(url,init)=>{
  assert.equal(String(url),'https://offline.invalid/responses');assert.ok(round<2,'Unexpected model round');providerRequests.push(JSON.parse(init.body));return sse(providerChunks(round++));
 }});
 const gatewayModel=new GatewayClass(MODEL,{provider:'gateway',baseURL:'https://offline.invalid/gateway',headers:()=>({}),o11yHeaders:()=>({}),fetch:async(url,init)=>{
  assert.equal(String(url),'https://offline.invalid/gateway/language-model');const args=JSON.parse(init.body);gatewayRequests.push(args);
  const result=await openaiModel.doStream(args),parts=[];for await(const part of result.stream)parts.push(part);providerParts.push(parts);return sse(parts);
 }});
 globalThis.AI_SDK_DEFAULT_PROVIDER={specificationVersion:'v4',languageModel(id){assert.equal(id,MODEL);return gatewayModel;}};
 const tools=new Map([['offline_read',{name:'offline_read',description:'Synthetic exact read.',inputSchema:jsonSchema(schema),approval:outcome==='none'?undefined:async ctx=>!ctx.approvedTools.has('offline_read'),execute:async input=>{executions.push(input);return {read:true,value:input.value};}}]]);
 let session={agent:{system:'Offline synthetic instructions.',modelReference:{id:MODEL,providerOptions:{openai:{store}}},reasoning:'medium',tools:[]},compaction:{recentWindowSize:8,threshold:1000000},continuationToken:'offline',history:[],sessionId:'offline-session'};
 const principal={authenticator:'offline',principalId:'fixture-parent',principalType:'user',attributes:{familyId:'fixture-family'}};
 async function invoke(input){
  const ctx=new ContextContainer(),emission=getHarnessEmissionState(session.state);
  ctx.set(keys.SessionKey,{sessionId:session.sessionId,auth:{current:principal,initiator:principal},turn:{id:emission.turnId||`turn_${emission.sequence}`,sequence:emission.sequence}});ctx.set(keys.AuthKey,principal);ctx.set(keys.InitiatorAuthKey,principal);
  const run=createToolLoopHarness({mode:'conversation',workflow:true,capabilities:{requestInput:true},tools,resolveModel:async()=>MODEL,handleEvent:async event=>{events.push(structuredClone(event));if(event.type==='turn.started')ctx.set(keys.SessionKey,{...ctx.require(keys.SessionKey),turn:{id:event.data.turnId,sequence:event.data.sequence}});}});
  const result=await contextStorage.run(ctx,()=>run(session,input));session=JSON.parse(JSON.stringify(result.session));return result;
 }
 const first=await invoke({message:'Synthetic read request.'});
 assert.equal(round,1);assert.equal(providerRequests[0].tools.find(t=>t.name==='offline_read').defer_loading,true);assert.ok(providerRequests[0].tools.some(t=>t.type==='tool_search'));
 if(outcome!=='none'){
  assert.equal(first.next,null);assert.equal(hasPendingInputBatch(session.state),true);assert.equal(executions.length,0);
  const pending=events.find(e=>e.type==='input.requested');assert.ok(pending);assert.equal(pending.data.requests[0].action.toolName,'offline_read');
  await invoke(undefined);assert.equal(round,1);assert.equal(executions.length,0);
  await invoke({inputResponses:[{requestId:pending.data.requests[0].requestId,optionId:outcome}]});
 }else{assert.equal(typeof first.next,'function');await invoke(undefined);}
 assert.equal(round,2);assert.equal(executions.length,outcome==='deny'?0:1);
 assert.equal(events.filter(e=>e.type==='actions.requested'&&e.data.actions.some(a=>a.toolName==='tool_search')).length,1);
 assert.equal(events.filter(e=>e.type==='action.result'&&e.data.result.toolName==='tool_search').length,1);
 const searchCall=providerParts[0].find(e=>e.type==='tool-call'&&e.toolName==='tool_search');assert.equal(searchCall.providerExecuted,true);
 const second=providerRequests[1].input;
 if(store){assert.ok(second.some(p=>p.type==='item_reference'&&p.id==='search_call_1'));assert.ok(second.some(p=>p.type==='item_reference'&&p.id==='search_output_1'));}
 else{assert.ok(second.some(p=>p.type==='tool_search_call'&&p.id==='search_call_1'&&p.execution==='server'));assert.deepEqual(second.find(p=>p.type==='tool_search_output').tools,[loaded]);}
 assert.equal(hasPendingInputBatch(session.state),false);assert.ok(events.some(e=>e.type==='message.completed'&&e.data.message==='Synthetic completed answer.'));
 checks.push({outcome,store,status:'passed',providerRounds:round,authoredExecutions:executions.length,searchRequested:1,searchResult:1,searchHistorySurvivesJsonCheckpoint:true});
}
for(const store of [false,true])for(const outcome of ['none','approve','deny'])await scenario(outcome,store);
async function plainDefault(env){
 for(const name of ['VERCEL_ENV','HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS','HOMA_PREVIEW_ASTRA_PRIORITY'])delete process.env[name];Object.assign(process.env,env);
 const build=createToolLoopHarness, Container=ContextContainer, storage=contextStorage, localKeys=keys;
 const ctx=new Container(),events=[],requests=[];
 const auth={authenticator:'offline',principalId:'fixture-parent',principalType:'user',attributes:{familyId:'fixture-family'}};
 ctx.set(localKeys.SessionKey,{sessionId:'fixed-session',auth:{current:auth,initiator:auth},turn:{id:'fixed-turn',sequence:0}});ctx.set(localKeys.AuthKey,auth);ctx.set(localKeys.InitiatorAuthKey,auth);
 const model=new GatewayClass(MODEL,{provider:'gateway',baseURL:'https://offline.invalid/gateway',headers:()=>({}),o11yHeaders:()=>({}),fetch:async(url,init)=>{
  requests.push(JSON.parse(init.body));return sse([{type:'stream-start',warnings:[]},{type:'text-start',id:'fixed-message'},{type:'text-delta',id:'fixed-message',delta:'Synthetic complete.'},{type:'text-end',id:'fixed-message'},{type:'finish',finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:0,noCache:0,cacheRead:0,cacheWrite:0},outputTokens:{total:0,text:0,reasoning:0}}}]);
 }});
 globalThis.AI_SDK_DEFAULT_PROVIDER={specificationVersion:'v4',languageModel(id){assert.equal(id,MODEL);return model;}};
 const session={agent:{system:'Identical synthetic system.',modelReference:{id:MODEL},reasoning:'medium',tools:[]},compaction:{recentWindowSize:8,threshold:1000000},continuationToken:'fixed-continuation',history:[],sessionId:'fixed-session'};
 const run=build({mode:'conversation',workflow:true,capabilities:{requestInput:true},tools:new Map([['offline_read',{name:'offline_read',description:'Same read.',inputSchema:jsonSchema(schema)}]]),resolveModel:async()=>MODEL,handleEvent:async e=>{events.push(e.type);if(e.type==='turn.started')ctx.set(localKeys.SessionKey,{...ctx.require(localKeys.SessionKey),turn:{id:e.data.turnId,sequence:e.data.sequence}});}});
 const result=await storage.run(ctx,()=>run(session,{message:'Identical synthetic input.'}));assert.equal(result.next,null);assert.equal(requests.length,1);
 return {requests,events,history:result.session.history};
}
const baselinePlain=await plainDefault({});
assert.equal(baselinePlain.requests[0].tools.some(tool=>tool.id==='openai.tool_search'),false);
assert.ok(baselinePlain.requests[0].tools.every(tool=>tool.providerOptions?.openai?.deferLoading!==true));
for(const env of [{},{VERCEL_ENV:'production',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'1'}]){
 const candidatePlain=await plainDefault(env);assert.equal(JSON.stringify(candidatePlain.requests),JSON.stringify(baselinePlain.requests));assert.deepEqual(candidatePlain.events,baselinePlain.events);assert.deepEqual(candidatePlain.history,baselinePlain.history);
 checks.push({name:env.VERCEL_ENV?'production equals disabled preview behavior':'default has no deferred tool metadata',status:'passed',requestBytesIdentical:true,eventTypesIdentical:true,historyIdentical:true});
}
for (const [name, environment, input] of [
 ['preview switch off', {VERCEL_ENV:'preview'}, {}],
 ['nonliteral switch', {VERCEL_ENV:'preview',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'true'}, {}],
 ['different resolved model', null, {model:'other/model'}],
 ['different configured model', null, {modelReference:{id:'other/model'}}],
 ['source-backed model', null, {modelReference:{id:MODEL,source:{}}}],
 ['mixed fallback', null, {modelReference:{id:MODEL,providerOptions:{gateway:{models:[MODEL,'other/model']}}}}],
 ['priority option', null, {modelReference:{id:MODEL,providerOptions:{gateway:{serviceTier:'priority'}}}}],
 ['speed option', null, {modelReference:{id:MODEL,providerOptions:{gateway:{speed:'fast'}}}}],
 ['priority switch', {VERCEL_ENV:'preview',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'1',HOMA_PREVIEW_ASTRA_PRIORITY:'1'}, {}],
 ['disabled search', null, {disabledProviderTools:new Set(['tool_search'])}],
]) {
 for(const key of ['VERCEL_ENV','HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS','HOMA_PREVIEW_ASTRA_PRIORITY']) delete process.env[key];
 Object.assign(process.env,environment??{VERCEL_ENV:'preview',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'1'});
 const tools={offline_read:{inputSchema:jsonSchema(schema)}};
 const before=JSON.stringify(tools), original=tools.offline_read;
 assert.equal(await applyPreviewDeferredTools(tools,{model:MODEL,modelReference:{id:MODEL},...input}),tools);
 assert.equal(tools.offline_read,original);assert.equal(JSON.stringify(tools),before);
 checks.push({name,status:'passed',noMutation:true});
}
// Separate regression for the naive spread-clone adapter's private WeakMap loss.
const identityCtx=new ContextContainer();identityCtx.set(keys.SessionKey,{sessionId:'offline',auth:{},turn:{id:'turn_0',sequence:0}});
const identity=await contextStorage.run(identityCtx,async()=>{
 const built=buildToolSet({tools:new Map([['offline_read',{name:'offline_read',description:'Read',inputSchema:jsonSchema(schema),approval:async()=>true}]])});
 const call={toolCall:{toolName:'offline_read',input:{value:'synthetic'}}};
 const before=await buildToolApproval(built)(call);
 const cloned={...built,offline_read:{...built.offline_read,providerOptions:{openai:{deferLoading:true}}}};
 const afterClone=await buildToolApproval(cloned)(call);
 built.offline_read.providerOptions={openai:{deferLoading:true}};
 const afterMutation=await buildToolApproval(built)(call);
 assert.equal(before,'user-approval');assert.equal(afterClone,undefined);assert.equal(afterMutation,'user-approval');
 return {original:before,naiveClone:afterClone??null,identityPreserving:afterMutation};
});
// Skill output strips frontmatter. Use compiled metadata plus the exact
// successful client call/result pair, never names mentioned in result prose.
const skillCatalog=[{name:'offline-skill',metadata:{'homa-tools':'offline_read, offline_missing'}}];
const skillCall={role:'assistant',content:[{type:'tool-call',toolCallId:'skill_1',toolName:'load_skill',input:{skill:'offline-skill'}}]};
const skillResult={role:'tool',content:[{type:'tool-result',toolCallId:'skill_1',toolName:'load_skill',output:{type:'text',value:'Use offline_read to verify the synthetic record.'}}]};
const parent={role:'user',content:'Read the synthetic record.'};
const skillMessages=[parent,skillCall,skillResult];
assert.deepEqual([...selectSkillLinkedToolNames(skillMessages,skillCatalog)],['offline_read','offline_missing']);
for(const [name,messages] of [
 ['user text is not activation',[{role:'user',content:'load_skill offline-skill offline_read'}]],
 ['uncompleted call',[parent,skillCall]],
 ['failed load',[parent,skillCall,{...skillResult,content:[{...skillResult.content[0],output:{type:'error-text',value:'Unavailable'}}]}]],
 ['mismatched result',[parent,skillCall,{...skillResult,content:[{...skillResult.content[0],toolCallId:'other'}]}]],
 ['provider-executed imitation',[parent,{...skillCall,content:[{...skillCall.content[0],providerExecuted:true}]},skillResult]],
 ['older turn',[...skillMessages,{role:'user',content:'Another request.'}]],
 ['unknown compiled skill',[parent,{...skillCall,content:[{...skillCall.content[0],input:{skill:'unknown'}}]},skillResult]],
 ['duplicate ambiguous call id',[parent,skillCall,skillCall,skillResult]],
 ['duplicate id after a completed result',[parent,skillCall,skillResult,skillCall]],
 ['result before call',[parent,skillResult,skillCall]],
]) {
 assert.equal(selectSkillLinkedToolNames(messages,skillCatalog).size,0,name);
 checks.push({name:'skill-linked: '+name,status:'passed'});
}
process.env.VERCEL_ENV='preview';process.env.HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS='1';process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS='1';
delete process.env.HOMA_PREVIEW_ASTRA_PRIORITY;
const linkedContext=new ContextContainer();
linkedContext.set(keys.SessionKey,{sessionId:'linked-fixture',auth:{},turn:{id:'turn_0',sequence:0}});
linkedContext.set(BundleKey,{resolvedAgent:{skills:skillCatalog}});
await contextStorage.run(linkedContext,async()=>{
 const built=buildToolSet({tools:new Map([
  ['offline_read',{name:'offline_read',description:'Existing approved read.',inputSchema:jsonSchema(schema),approval:async()=>true}],
  ['offline_other',{name:'offline_other',description:'Other existing tool.',inputSchema:jsonSchema(schema)}],
 ])});
 const original=built.offline_read;
 await applyPreviewDeferredTools(built,{model:MODEL,modelReference:{id:MODEL},messages:JSON.parse(JSON.stringify(skillMessages))});
 assert.equal(built.offline_read,original);assert.equal(built.offline_read.providerOptions.openai.deferLoading,false);
 assert.equal(built.offline_other.providerOptions.openai.deferLoading,true);assert.equal(built.offline_missing,undefined);
 assert.equal(await buildToolApproval(built)({toolCall:{toolName:'offline_read',input:{value:'synthetic'}}}),'user-approval');
 assert.equal(built.tool_search.id,'openai.tool_search');
 checks.push({name:'skill-linked: checkpoint history selects existing tool without granting missing tools or bypassing approval',status:'passed'});
 for(const flag of [undefined,'0','true']){
  if(flag===undefined)delete process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS;else process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS=flag;
  const tools={offline_read:{inputSchema:jsonSchema(schema)}};
  await applyPreviewDeferredTools(tools,{model:MODEL,modelReference:{id:MODEL},messages:skillMessages});
  assert.equal(tools.offline_read.providerOptions.openai.deferLoading,true);
 }
 process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS='1';
 for(const env of ['production','development']){
  process.env.VERCEL_ENV=env;
  const tools={offline_read:{inputSchema:jsonSchema(schema)}};
  const original=tools.offline_read;
  await applyPreviewDeferredTools(tools,{model:MODEL,modelReference:{id:MODEL},messages:skillMessages});
  assert.equal(tools.offline_read,original);assert.equal(tools.offline_read.providerOptions,undefined);assert.equal(tools.tool_search,undefined);
  checks.push({name:'skill-linked: '+env+' stays unchanged with both switches enabled',status:'passed'});
 }
});
delete process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS;
const ordinaryDeferred=await plainDefault({VERCEL_ENV:'preview',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'1'});
const ordinaryLinked=await plainDefault({VERCEL_ENV:'preview',HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS:'1',HOMA_PREVIEW_SKILL_LINKED_TOOLS:'1'});
assert.deepEqual(ordinaryLinked.requests,ordinaryDeferred.requests);
assert.deepEqual(ordinaryLinked.events,ordinaryDeferred.events);
assert.deepEqual(ordinaryLinked.history,ordinaryDeferred.history);
checks.push({name:'skill-linked: ordinary first-call request bytes and response events unchanged',status:'passed'});
delete process.env.HOMA_PREVIEW_SKILL_LINKED_TOOLS;
delete globalThis.AI_SDK_DEFAULT_PROVIDER;
assert.deepEqual(globalThis.__startupNetworkAttempts,[]);
const report={checks,approvalIdentity:identity,networkAttempts:globalThis.__startupNetworkAttempts,realModelCalls:0,isolate,limits:['Canned local OpenAI Responses events, not remote Gateway behavior.','No actual Workflow service checkpoint or replay; session JSON roundtrip only.','No Homa hooks or database work invoked.','Actual candidate preview gate enabled only inside this network-disabled test process; no deployed app configuration changed.']};
console.log(JSON.stringify(report));
