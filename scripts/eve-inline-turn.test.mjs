#!/usr/bin/env node
/** Installed Eve preview-inline regression. Actual local Workflow engine, no network or providers. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { constants, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = join(repo, 'scripts/fixtures/eve-inline-turn');
const expected = JSON.parse(readFileSync(join(fixture, 'provenance.json')));
const installed = realpathSync(join(repo, 'apps/web/node_modules/eve'));
const root = mkdtempSync(join(tmpdir(), 'homa-eve-inline-test-'));
const baseline = join(root, 'node_modules/eve');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const checks = [], cases = {};
const tag = 'ci';
const node = process.execPath;
const check = (name, fn) => { fn(); checks.push(name); };
const env = { PATH: dirname(node) + ':/usr/bin:/bin' };
function processFixture(file, args = []) {
    const result = spawnSync(node, ['--experimental-test-module-mocks', join(fixture, file), root, ...args], { encoding: 'utf8', env, timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, `${file}: ${result.stderr.slice(-5000)} ${result.stdout.slice(-1000)}`);
}
function run(arm, scenario, phase = 'start', suffix = '', expectedExit = 0) {
    const fullTag = tag + suffix;
    const proc = spawnSync(node, ['--experimental-test-module-mocks', join(fixture, 'runtime.mjs'), root, arm, scenario, phase, fullTag], { encoding: 'utf8', env, timeout: 30000, maxBuffer: 1024 * 1024 });
    const folder = join(root, 'runs', `${arm}-${scenario}-${fullTag}`);
    assert.equal(proc.status, expectedExit, `${arm} ${scenario} ${phase}: ${proc.stderr.slice(-3000)}`);
    if (expectedExit !== 0)
        return { folder };
    const result = JSON.parse(readFileSync(join(folder, `result-${phase}.json`)));
    const ops = readFileSync(join(folder, 'operations.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(result.networkAttempts.length, 0);
    assert.equal(result.steps.every(x => x.name.startsWith('step//eve@0.19.0//')), true);
    cases[`${arm}-${scenario}${suffix}`] = result;
    return { result, ops, folder };
}
await test('installed inline trial preserves durable replay, authorization, protocol, deployment and declarations', { timeout: 180000 }, async (t) => {
    try {
        assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'))).version, expected.sourceVersion);
        for (const f of expected.files)
            assert.equal(sha(readFileSync(join(installed, f.relative))), f.afterSha256, f.relative);
        for (const f of expected.protectedFiles)
            assert.equal(sha(readFileSync(join(installed, f.relative))), f.sha256, f.relative);
        const sections = readFileSync(join(repo, 'patches/eve@0.19.0.patch'), 'utf8').split(/(?=^diff --git )/m).filter(x => x.trim());
        for (const old of expected.originalPatchSections)
            assert.equal(sha(sections.find(x => x.startsWith(old.header + '\n'))), old.sha256, old.header);
        const changed = new Set(expected.files.map(x => x.relative));
        const reverse = sections.filter(x => changed.has(x.split('\n')[0].split(' b/')[1])).join('');
        assert.equal(reverse.split(/^diff --git /m).length - 1, expected.files.length);
        mkdirSync(baseline, { recursive: true });
        cpSync(join(installed, 'package.json'), join(baseline, 'package.json'));
        cpSync(join(installed, 'dist'), join(baseline, 'dist'), { recursive: true, mode: constants.COPYFILE_FICLONE });
        symlinkSync(dirname(installed), join(baseline, 'node_modules'), 'dir');
        const reverted = spawnSync('patch', ['-R', '-p1'], { cwd: baseline, input: reverse, encoding: 'utf8', env });
        assert.equal(reverted.status, 0, reverted.stderr);
        for (const f of expected.files)
            if (f.beforeSha256 !== null)
                assert.equal(sha(readFileSync(join(baseline, f.relative))), f.beforeSha256, f.relative);
        writeFileSync(join(root, 'provenance.json'), JSON.stringify({ ...expected, candidate: installed, installed: baseline, repo }));
        const normalized = (x) => JSON.parse(JSON.stringify(x).replaceAll(/aitxt-[A-Za-z0-9_-]+/g, 'aitxt_GENERATED'));
        const events = (x) => normalized(x.ops.filter(x => x.type === 'event'));
        const prompts = (x) => normalized(x.ops.filter(x => x.type === 'model').map(x => x.prompt));
        const observations = {};
        for (const scenario of ['ordinary', 'skill', 'failure', 'abort']) {
            const baseline = run('baseline', scenario), candidate = run('candidate', scenario);
            observations[scenario] = { baseline, candidate };
            check(`${scenario}: identical model prompts`, () => assert.deepEqual(prompts(candidate), prompts(baseline)));
            if (scenario !== 'failure' && scenario !== 'abort')
                check(`${scenario}: identical protocol events, sequence, step and principal`, () => assert.deepEqual(events(candidate), events(baseline)));
            check(`${scenario}: model invocation count unchanged`, () => assert.equal(candidate.result.modelCallsTotal, baseline.result.modelCallsTotal));
            check(`${scenario}: no extra tool or skill effects`, () => { assert.equal(candidate.result.skillReads, baseline.result.skillReads); assert.equal(candidate.result.toolEffects, baseline.result.toolEffects); });
            if (scenario === 'ordinary')
                check('ordinary: zero child runs versus one', () => { assert.equal(candidate.result.childRuns, 0); assert.equal(baseline.result.childRuns, 1); });
            if (scenario === 'skill') {
                check('skill: one real skill load and two model rounds', () => { assert.equal(candidate.result.modelCallsTotal, 2); assert.equal(candidate.result.skillReads, 1); });
                check('skill: encrypted child handoff carries v2 checkpoint and actual stream', () => { assert.deepEqual(candidate.ops.filter(x => x.type === 'dispatch-input').map(x => [x.wireVersion, x.hasCheckpoint, x.checkpointAction, x.hasParentWritable]), [[2, true, 'continue', true]]); assert.equal(candidate.result.childRuns, 1); });
            }
            if (scenario === 'failure')
                check('failure: existing failed-turn park without child or repeated model', () => { assert.equal(candidate.result.status, 'running'); assert.equal(candidate.result.modelCallsTotal, 1); assert.equal(candidate.result.childRuns, 0); assert.equal(candidate.ops.filter(x => x.type === 'event' && x.event === 'turn.failed' && x.data.code === 'MODEL_CALL_FAILED').length, 1); });
            if (scenario === 'abort')
                check('Run.cancel: cancelled parent, no additional model or tool effects', () => { assert.equal(candidate.result.status, 'cancelled'); assert.equal(baseline.result.status, 'cancelled'); assert.equal(candidate.result.modelCallsTotal, 1); assert.equal(candidate.result.toolEffects, 0); });
        }
        for (const choice of ['approve', 'deny']) {
            const pair = {};
            for (const arm of ['baseline', 'candidate']) {
                const initial = run(arm, 'approval', 'start', '-' + choice);
                check(`${arm} ${choice}: initial approval parks with no effect`, () => { assert.equal(initial.result.modelCallsTotal, 1); assert.equal(initial.result.toolEffects, 0); assert.equal(initial.ops.filter(x => x.type === 'event' && x.event === 'input.requested').length, 1); });
                pair[arm] = run(arm, 'approval', choice, '-' + choice);
            }
            check(`${choice}: unchanged model history and protocol boundaries`, () => { assert.deepEqual(prompts(pair.candidate), prompts(pair.baseline)); assert.deepEqual(events(pair.candidate), events(pair.baseline)); });
            check(`${choice}: different responder continuation keeps legacy v1 wire`, () => { const dispatched = pair.candidate.ops.filter(x => x.type === 'dispatch-input'); assert.ok(dispatched.length > 0); assert.ok(dispatched.every(x => x.wireVersion === 1 && !x.hasCheckpoint)); });
            check(`${choice}: effect count respects user choice`, () => assert.equal(pair.candidate.result.toolEffects, choice === 'approve' ? 1 : 0));
            check(`${choice}: responder and original initiator retained`, () => { const later = pair.candidate.ops.filter(x => x.type === 'event' && x.data?.sequence === 1); assert.ok(later.length > 0); assert.ok(later.every(x => x.principal === 'responder' && x.initiator === 'initiator')); if (choice === 'approve')
                assert.deepEqual(pair.candidate.ops.find(x => x.type === 'tool-effect'), { type: 'tool-effect', name: 'offline_review', principal: 'responder', initiator: 'initiator' }); });
            check(`${choice}: followup message arrives once at next turn`, () => assert.equal(pair.candidate.ops.filter(x => x.type === 'event' && x.event === 'message.received' && x.data.message === 'Keep the fictional plan short.').length, 1));
        }
        for (const scenario of ['missing', 'mismatch', 'empty']) {
            const current = run('candidate', scenario);
            check(`${scenario}: safe child fallback or empty guard`, () => { assert.equal(current.result.modelCallsTotal, scenario === 'empty' ? 0 : 1); assert.equal(current.result.childRuns, scenario === 'empty' ? 0 : 1); assert.ok(current.ops.filter(x => x.type === 'dispatch-input').every(x => x.wireVersion === 1 && !x.hasCheckpoint)); });
            if (scenario === 'mismatch')
                check('mismatch: guarded parent step finishes before any model invocation', () => { const completed = current.ops.findIndex(x => x.type === 'durable-event' && x.stepName === 'turnStep' && x.event === 'step_completed' && x.runId === current.result.runId); const model = current.ops.findIndex(x => x.type === 'model'); assert.ok(completed >= 0 && model > completed); assert.equal(current.ops.slice(0, completed).some(x => ['model', 'skill-read', 'tool-effect'].includes(x.type)), false); });
        }
        const crashed = run('candidate', 'skill', 'crash-after-step', '-crash', 73);
        const crashOps = readFileSync(join(crashed.folder, 'operations.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
        check('crash: first durable step persisted before any child dispatch', () => { assert.equal(crashOps.filter(x => x.type === 'model').length, 1); assert.equal(crashOps.filter(x => x.type === 'skill-read').length, 1); assert.equal(crashOps.filter(x => x.type === 'dispatch-input').length, 0); assert.equal(crashOps.at(-1).event, 'step_completed'); assert.equal(crashOps.at(-1).stepName, 'turnStep'); });
        const replayed = run('candidate', 'skill', 'replay', '-crash');
        check('fresh process replay: saved step reused with no repeat of model, skill or hooks', () => { assert.equal(replayed.result.modelCallsTotal, 2); assert.equal(replayed.result.skillReads, 1); assert.deepEqual(events(replayed), events(observations.skill.candidate)); assert.deepEqual(prompts(replayed), prompts(observations.skill.candidate)); assert.equal(replayed.result.childRuns, 1); });
        const deferredCases = {};
        for (const scenario of ['ordinary', 'deferred-search']) {
            const baseline = run('baseline', scenario, 'start', '-deferred');
            const candidate = run('candidate', scenario, 'start', '-deferred');
            deferredCases[scenario] = candidate;
            check(`${scenario} with deferred tools: identical prompts and protocol through durable handoff`, () => { assert.deepEqual(prompts(candidate), prompts(baseline)); assert.deepEqual(events(candidate), events(baseline)); });
            check(`${scenario} with deferred tools: every model round retains enabled search`, () => { for (const current of [baseline, candidate]) assert.equal(current.ops.filter(x => x.type === 'deferred-tools-verified').length, current.result.modelCallsTotal); });
            if (scenario === 'ordinary')
                check('combined ordinary: one model call and no child dispatch', () => { assert.equal(candidate.result.modelCallsTotal, 1); assert.equal(candidate.result.childRuns, 0); });
            else
                check('combined search: one real SDK search conversion and authored effect with checkpoint', () => { assert.equal(candidate.ops.filter(x => x.type === 'search-wire').length, 1); assert.equal(candidate.result.toolEffects, 1); assert.equal(candidate.result.modelCallsTotal, 2); assert.deepEqual(candidate.ops.filter(x => x.type === 'dispatch-input').map(x => [x.wireVersion, x.hasCheckpoint]), [[2, true]]); });
        }
        for (const choice of ['approve', 'deny']) {
            const pair = {};
            for (const arm of ['baseline', 'candidate']) {
                const initial = run(arm, 'approval', 'start', '-deferred-' + choice);
                check(`${arm} combined ${choice}: discovered tool parks without an effect`, () => { assert.equal(initial.result.toolEffects, 0); assert.equal(initial.ops.filter(x => x.type === 'search-wire').length, 1); });
                pair[arm] = run(arm, 'approval', choice, '-deferred-' + choice);
            }
            const resumed = pair.candidate;
            check(`combined ${choice}: resumed search history preserves consent and initiator`, () => {
                // This fixture also submits a follow-up message with the choice.
                // Compare both accepted turns with the existing child runner.
                assert.equal(resumed.result.modelCallsTotal, pair.baseline.result.modelCallsTotal);
                assert.deepEqual(prompts(resumed), prompts(pair.baseline));
                assert.deepEqual(events(resumed), events(pair.baseline));
                assert.equal(resumed.result.toolEffects, choice === 'approve' ? 1 : 0);
                assert.equal(resumed.ops.filter(x => x.type === 'search-wire').length, 1);
                assert.equal(resumed.ops.filter(x => x.type === 'event' && x.event === 'message.received' && x.data.message === 'Keep the fictional plan short.').length, 1);
                const later = resumed.ops.filter(x => x.type === 'event' && x.data?.sequence === 1);
                assert.ok(later.length > 0);
                assert.ok(later.every(x => x.principal === 'responder' && x.initiator === 'initiator'));
            });
        }
        const deferredCrash = run('candidate', 'deferred-search', 'crash-after-step', '-deferred-crash', 73);
        const deferredCrashOps = readFileSync(join(deferredCrash.folder, 'operations.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
        check('combined crash: search and tool persisted before child dispatch', () => { assert.equal(deferredCrashOps.filter(x => x.type === 'search-wire').length, 1); assert.equal(deferredCrashOps.filter(x => x.type === 'tool-effect').length, 1); assert.equal(deferredCrashOps.filter(x => x.type === 'dispatch-input').length, 0); });
        const deferredReplay = run('candidate', 'deferred-search', 'replay', '-deferred-crash');
        check('combined fresh-process replay: no repeated search or tool effect', () => {
            assert.equal(deferredReplay.result.modelCallsTotal, 2); assert.equal(deferredReplay.result.toolEffects, 1);
            assert.equal(deferredReplay.ops.filter(x => x.type === 'search-wire').length, 1);
            assert.deepEqual(events(deferredReplay), events(deferredCases['deferred-search']));
            assert.deepEqual(prompts(deferredReplay), prompts(deferredCases['deferred-search']));
        });
        const linkedBaseline = run('baseline', 'skill-linked', 'start', '-deferred-linked');
        const linkedCandidate = run('candidate', 'skill-linked', 'start', '-deferred-linked');
        check('skill-linked: completed skill activates its existing tool across the actual child checkpoint', () => {
            assert.deepEqual(prompts(linkedCandidate), prompts(linkedBaseline));
            assert.deepEqual(events(linkedCandidate), events(linkedBaseline));
            assert.deepEqual(linkedCandidate.ops.filter(x => x.type === 'skill-linked-verified').map(x => x.eager), [false, true, true]);
            assert.equal(linkedCandidate.result.skillReads, 1); assert.equal(linkedCandidate.result.toolEffects, 1);
            assert.equal(linkedCandidate.result.modelCallsTotal, 3);
        });
        run('candidate', 'skill-linked', 'crash-after-step', '-deferred-linked-crash', 73);
        const linkedReplay = run('candidate', 'skill-linked', 'replay', '-deferred-linked-crash');
        check('skill-linked: fresh process reconstructs the hint without another skill load or duplicate effect', () => {
            assert.deepEqual(prompts(linkedReplay), prompts(linkedCandidate));
            assert.deepEqual(events(linkedReplay), events(linkedCandidate));
            assert.deepEqual(linkedReplay.ops.filter(x => x.type === 'skill-linked-verified').map(x => x.eager), [false, true, true]);
            assert.equal(linkedReplay.result.skillReads, 1); assert.equal(linkedReplay.result.toolEffects, 1);
        });
        processFixture('contracts.mjs');
        const contracts = JSON.parse(readFileSync(join(root, 'trust-contract-results.json')));
        processFixture('declarations.mjs');
        t.diagnostic(`${checks.length} durable assertions, ${contracts.passed} routing/channel assertions, strict declaration check passed.`);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
