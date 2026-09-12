import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mock } from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
for (const name of Object.keys(process.env))
    assert.ok(['PATH', '__CF_USER_TEXT_ENCODING'].includes(name));
const artifact = process.argv[2];
const provenance = JSON.parse(readFileSync(join(artifact, 'provenance.json')));
const [arm = 'candidate', scenario = 'ordinary', phase = 'start', tag = 'default'] = process.argv.slice(3);
assert.ok(['candidate', 'baseline'].includes(arm));
assert.ok(['ordinary', 'skill', 'approval', 'failure', 'mismatch', 'missing', 'empty', 'abort'].includes(scenario));
assert.ok(['start', 'crash-after-step', 'replay', 'approve', 'deny'].includes(phase));
const packageRoot = arm === 'candidate' ? provenance.candidate : provenance.installed;
const src = join(packageRoot, 'dist/src');
const data = join(artifact, 'runs', `${arm}-${scenario}-${tag}`);
mkdirSync(data, { recursive: true });
const operationsPath = join(data, 'operations.jsonl');
const log = (event) => appendFileSync(operationsPath, JSON.stringify(event) + '\n');
const previousOperations = () => existsSync(operationsPath) ? readFileSync(operationsPath, 'utf8').trim().split('\n').filter(Boolean).map(x => JSON.parse(x)) : [];
const operations = previousOperations();
let modelCalls = operations.filter(x => x.type === 'model').length;
let emitted = operations.filter(x => x.type === 'event').length;
const networkAttempts = [];
const block = () => { networkAttempts.push('blocked'); throw Error('Network prohibited in durable harness'); };
globalThis.fetch = block;
for (const target of [net, tls, http, https, dns])
    for (const key of ['connect', 'createConnection', 'request', 'get', 'lookup', 'resolve'])
        if (typeof target[key] === 'function')
            target[key] = block;
net.Socket.prototype.connect = block;
syncBuiltinESMExports();
process.env.WORKFLOW_TARGET_WORLD = 'local';
process.env.WORKFLOW_LOCAL_DATA_DIR = join(data, 'world');
process.env.WORKFLOW_TURBO = '0';
process.env.VERCEL_DEPLOYMENT_ID = 'dpl_offline_candidate';
const web = join(provenance.repo, 'apps/web');
const { MockLanguageModelV4 } = await import(join(web, 'node_modules/ai/dist/test/index.js'));
const skillText = readFileSync(join(web, 'agent/skills/materials-studio/SKILL.md'), 'utf8');
const instructions = readFileSync(join(web, 'agent/instructions.md'), 'utf8');
const MODEL = 'openai/gpt-6-astra';
const usage = { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 6, text: 6, reasoning: 0 } };
const { FatalError } = await import(join(src, 'compiled/@workflow/errors/index.js'));
let activeRunId;
const model = new MockLanguageModelV4({ provider: 'offline.gateway', modelId: MODEL, doStream: async (options) => {
        const round = modelCalls++;
        assert.ok(round < 8, 'Unexpected repeated model invocation');
        log({ type: 'model', round, prompt: options.prompt, roles: options.prompt.map(x => x.role), userMessages: options.prompt.filter(x => x.role === 'user').map(x => x.content) });
        if (scenario === 'abort')
            await core.getRun(activeRunId).cancel();
        const parts = [{ type: 'stream-start', warnings: [] }];
        if (scenario === 'failure')
            parts.push({ type: 'error', error: new FatalError('Synthetic terminal stream failure') });
        else if (scenario === 'skill' && round === 0)
            parts.push({ type: 'tool-call', toolCallId: 'call_skill', toolName: 'load_skill', input: JSON.stringify({ skill: 'materials-studio' }) });
        else if (scenario === 'approval' && round === 0)
            parts.push({ type: 'tool-call', toolCallId: 'call_review', toolName: 'offline_review', input: JSON.stringify({ plan: 'A fictional lesson.' }) });
        else
            parts.push({ type: 'reasoning-start', id: 'r' }, { type: 'reasoning-delta', id: 'r', delta: 'Synthetic private reasoning.' }, { type: 'reasoning-end', id: 'r' }, { type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Use five blocks and a bowl for a short counting game.' }, { type: 'text-end', id: 't' });
        const tool = parts.some(x => x.type === 'tool-call');
        parts.push({ type: 'finish', finishReason: { unified: tool ? 'tool-calls' : 'stop', raw: tool ? 'tool-calls' : 'stop' }, usage });
        return { stream: new ReadableStream({ start(c) { for (const p of parts)
                    c.enqueue(p); c.close(); } }) };
    } });
globalThis.AI_SDK_DEFAULT_PROVIDER = { specificationVersion: 'v4', languageModel(id) { assert.equal(id, MODEL); return model; } };
let bundle;
mock.module(join(src, 'runtime/sessions/compiled-agent-cache.js'), { namedExports: { clearCompiledRuntimeAgentBundleCache() { }, getCompiledRuntimeAgentBundle: async () => bundle } });
mock.module(join(src, 'runtime/channels/registry.js'), { namedExports: { createRuntimeAdapterRegistry() { throw Error('Unused synthetic registry'); }, deserializeRuntimeAdapter: (_registry, value) => ({ kind: value.kind, state: value.state ?? {} }) } });
mock.module(join(src, 'execution/sandbox/ensure.js'), { namedExports: { ensureSandboxAccess: async () => ({
            get: async () => ({ readTextFile: async ({ path }) => { assert.equal(path, '/workspace/skills/materials-studio/SKILL.md'); log({ type: 'skill-read', path }); return skillText; } }),
            captureState: async () => null,
        }) } });
const { SKILL_TOOL_DEFINITION } = await import(join(src, 'runtime/framework-tools/skill.js'));
const { createRuntimeToolRegistry } = await import(join(src, 'runtime/tools/registry.js'));
const { buildCallbackContext } = await import(join(src, 'context/build-callback-context.js'));
const { loadContext } = await import(join(src, 'context/container.js'));
const keys = await import(join(src, 'context/keys.js'));
const review = { name: 'offline_review', sourceId: 'eve:offline-review', logicalPath: 'eve:offline-review', description: 'Review a fictional plan only after approval.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { plan: { type: 'string' } }, required: ['plan'] },
    approval: async (ctx) => !ctx.approvedTools.has('offline_review'),
    execute: async (input) => { const ctx = buildCallbackContext(); log({ type: 'tool-effect', name: 'offline_review', principal: ctx.session.auth.current.principalId, initiator: ctx.session.auth.initiator.principalId }); return { reviewed: true, plan: input.plan }; },
};
const registry = await createRuntimeToolRegistry({ tools: [SKILL_TOOL_DEFINITION, review] });
const turnAgent = { id: 'offline-homa', instructions: [instructions], model: { id: MODEL, contextWindowTokens: 1050000 }, reasoning: 'medium', tools: registry.preparedTools };
const node = { nodeId: 'root', turnAgent, toolRegistry: registry, agent: { config: { name: 'offline-homa' }, workflowEnabled: true, connections: [] } };
bundle = { nodeId: 'root', compiledArtifactsSource: { kind: 'offline-fixture' }, turnAgent, graph: { root: node }, resolvedAgent: { config: { name: 'offline-homa' }, dynamicInstructionsResolvers: [], dynamicSkillResolvers: [], dynamicToolResolvers: [] },
    hookRegistry: { streamEventsByType: new Map(), streamEventsWildcard: [{ handler: async (event) => {
                    emitted++;
                    const ctx = loadContext();
                    log({ type: 'event', event: event.type, data: event.data, principal: ctx.get(keys.AuthKey)?.principalId, initiator: ctx.get(keys.InitiatorAuthKey)?.principalId });
                } }] }, adapterRegistry: {}, moduleMap: {} };
const core = await import(join(src, 'compiled/@workflow/core/runtime.js'));
const { registerStepFunction } = await import(join(src, 'compiled/@workflow/core/private.js'));
const { createTurnWorkflowInput } = await import(join(src, 'execution/durable-session-migrations/turn-workflow.js'));
const { WorkflowBundleBuilder } = await import(join(src, 'internal/workflow-bundle/builder.js'));
const output = join(data, 'workflows.mjs');
const builder = new WorkflowBundleBuilder({ agentName: 'offline', appRoot: packageRoot, rootDir: packageRoot, compiledArtifactsBootstrapPath: join(src, 'execution/workflow-entry.js'), outDir: join(data, 'build'), watch: false });
const { manifest } = await builder.createWorkflowsBundle({ inputFiles: [join(src, 'execution/workflow-entry.js'), join(src, 'execution/turn-workflow.js')], outfile: output, bundleFinalOutput: false, format: 'esm' });
writeFileSync(join(data, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
process.env.WORKFLOW_QUEUE_NAMESPACE = JSON.parse(readFileSync(output, 'utf8').match(/namespace: ("[^"]+")/)[1]);
const stepNames = new Map();
for (const [path, entries] of Object.entries(manifest.steps ?? {})) {
    const module = await import(path.startsWith('/') ? path : join(packageRoot, path));
    for (const [name, { stepId }] of Object.entries(entries)) {
        stepNames.set(stepId, name);
        const actual = typeof module[name] === 'function' ? module[name] : async () => { throw Error(`Unused private step blocked: ${name}`); };
        registerStepFunction(stepId, name === 'dispatchTurnStep' ? async (input) => {
            const wire = createTurnWorkflowInput(input);
            log({ type: 'dispatch-input', wireVersion: wire.version, hasCheckpoint: wire.initialStep !== undefined, checkpointAction: wire.initialStep?.result?.action, acceptedDeploymentId: input.delivery?.acceptedDeploymentId, hasParentWritable: input.parentWritable instanceof WritableStream });
            return actual(input);
        } : actual);
    }
}
const local = await core.createWorld();
const pending = [], requestItems = new WeakMap();
let queued = 0, crashed = false;
const world = { ...local,
    getDeploymentId: async () => 'dpl_offline_candidate',
    resolveLatestDeploymentId: async () => 'dpl_offline_candidate',
    getEncryptionKeyForRun: async (run) => createHash('sha256').update('offline-only-seed:' + (typeof run === 'string' ? run : run.runId)).digest(),
    queue: async (topic, payload, options) => { const item = { topic, payload, options, messageId: randomUUID() }; pending.push(item); queued++; log({ type: 'queue', topic, runId: payload.runId, deploymentId: options?.deploymentId }); return { messageId: item.messageId }; },
    createQueueHandler: (prefix, callback) => async (request) => { const item = requestItems.get(request); assert.ok(item.topic.startsWith(prefix)); await callback(item.payload, { attempt: 1, queueName: item.topic, messageId: item.messageId, requestId: 'offline-request' }); return new Response('{}'); },
    events: { ...local.events, create: async (runId, event, ...rest) => {
            const result = await local.events.create(runId, event, ...rest);
            const stepName = event.eventType.startsWith('step_') ? stepNames.get((await local.steps.get(runId, event.correlationId, { resolveData: 'none' })).stepName) : undefined;
            log({ type: 'durable-event', runId, event: event.eventType, stepName });
            if (event.eventType === 'hook_created' && !pending.some(item => item.payload.runId === runId)) {
                const owner = await local.runs.get(runId, { resolveData: 'none' });
                pending.push({ topic: `__${process.env.WORKFLOW_QUEUE_NAMESPACE}_wkf_workflow_${owner.workflowName}`, payload: { runId }, messageId: randomUUID() });
                log({ type: 'offline-replay-wake', runId, reason: 'Exercise replay after durable hook registration' });
            }
            if (phase === 'crash-after-step' && !crashed && event.eventType === 'step_completed' && stepName === 'turnStep') {
                crashed = true;
                writeFileSync(join(data, 'crash.json'), JSON.stringify({ runId, event: 'turnStep step_completed persisted', phase }));
                process.exit(73);
            }
            return result;
        } },
};
core.setWorld(world);
const { POST } = await import(output);
const runFile = join(data, 'run.json');
let run;
if (phase === 'replay' || phase === 'approve' || phase === 'deny') {
    const saved = JSON.parse(readFileSync(runFile));
    run = core.getRun(saved.runId);
    if (phase === 'replay')
        await world.queue(`${process.env.WORKFLOW_QUEUE_NAMESPACE ? `__${process.env.WORKFLOW_QUEUE_NAMESPACE}_` : '__'}wkf_workflow_${saved.workflowId}`, { runId: saved.runId });
    else {
        const request = previousOperations().find(x => x.type === 'event' && x.event === 'input.requested').data.requests[0];
        // A different authenticated responder is outside the preview allowlist and supplies no inline hint.
        await core.resumeHook(saved.continuationToken, { kind: 'deliver', auth: { authenticator: 'offline', principalId: 'responder', principalType: 'user' }, payloads: [{ inputResponses: [{ requestId: request.requestId, optionId: phase }], message: 'Keep the fictional plan short.' }] });
    }
}
else {
    const workflowId = Object.values(manifest.workflows).flatMap(x => Object.entries(x)).find(([name]) => name === 'workflowEntry')[1].workflowId;
    const continuationToken = `offline:${randomUUID()}`;
    const principal = { authenticator: 'offline', principalId: 'initiator', principalType: 'user' };
    const args = { input: scenario === 'empty' ? {} : { message: 'Use a fictional counting plan.', context: ['Synthetic parent-provided context.'] }, serializedContext: { 'eve.bundle': { source: { kind: 'offline-fixture' }, nodeId: 'root' }, 'eve.channel': { kind: 'offline', state: {} }, 'eve.continuationToken': continuationToken, 'eve.mode': 'conversation', 'eve.capabilities': { requestInput: true }, 'eve.auth': principal, 'eve.initiatorAuth': principal } };
    if (arm === 'candidate' && scenario !== 'missing')
        args.acceptedDeploymentId = scenario === 'mismatch' ? 'dpl_another' : 'dpl_offline_candidate';
    run = await core.start({ workflowId }, [args]);
    writeFileSync(runFile, JSON.stringify({ runId: run.runId, workflowId, continuationToken }));
}
activeRunId = run.runId;
for (let i = 0; i < 80; i++) {
    const item = pending.shift();
    if (!item)
        break;
    const request = new Request('https://offline.invalid/workflow', { method: 'POST', body: '{}' });
    requestItems.set(request, item);
    await POST(request);
}
assert.equal(networkAttempts.length, 0);
const current = await world.runs.get(run.runId, { resolveData: 'none' });
const steps = await world.steps.list({ runId: run.runId, resolveData: 'none' });
const all = previousOperations();
const result = { arm, scenario, phase, status: current.status, runId: run.runId, queuedThisProcess: queued, modelCallsTotal: all.filter(x => x.type === 'model').length, skillReads: all.filter(x => x.type === 'skill-read').length, toolEffects: all.filter(x => x.type === 'tool-effect').length, childQueues: all.filter(x => x.type === 'queue' && x.topic.endsWith('workflow//eve//turnWorkflow')).length, childRuns: new Set(all.filter(x => x.type === 'queue' && x.topic.endsWith('workflow//eve//turnWorkflow')).map(x => x.runId)).size, steps: steps.data.map(x => ({ name: x.stepName, status: x.status })), networkAttempts };
writeFileSync(join(data, `result-${phase}.json`), JSON.stringify(result, null, 2) + '\n');
await local.close();
console.log(JSON.stringify(result));
