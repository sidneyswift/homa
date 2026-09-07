import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import type { createClient as CreateClient } from '../apps/web/node_modules/@supabase/supabase-js';
import type Puppeteer from '../apps/web/node_modules/puppeteer-core';
import * as library from '../apps/web/lib/materials/library.ts';
import * as store from '../apps/web/lib/subject-lessons/store.ts';
import * as renderer from '../apps/web/lib/materials/render-page.ts';
import * as artifact from '../apps/web/lib/materials/artifact-store.ts';
import { restoreMaterialVersionCaller, restoreMaterialVersionPinned } from '../apps/web/lib/materials/restore-version.ts';
import { mapDb } from '../apps/web/lib/map/db.ts';
import { buildSubjectLessonAuth } from '../apps/web/lib/subject-lessons/dispatch-input.ts';
import { isEvalIsolationActive } from '../apps/web/lib/eval-isolation.ts';
import { ACTION_COSTS } from '../packages/core/src/index.ts';
// Run only through the disposable eval sandbox. The real tool execute handler,
// renderer, stores and RPCs run here; only auth transport, telemetry and model
// review are synthetic. This is not a hosted or model-judgment acceptance test.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRequire = createRequire(resolve(root, 'apps/web/package.json'));
const { createClient } = sourceRequire('@supabase/supabase-js') as {
    createClient: (...args: Parameters<typeof CreateClient>) => Parameters<typeof library.getMaterialCaller>[0];
};
const puppeteer = sourceRequire('puppeteer-core').default as typeof Puppeteer;
assert.ok(isEvalIsolationActive(process.env));
assert.ok(process.env.HOMA_EVAL_DATABASE_URL);
assert.equal(new URL(process.env.HOMA_EVAL_DATABASE_URL).hostname, '127.0.0.1');
assert.ok(process.env.HOMA_EVAL_BLOB_DIR);
assert.ok(!process.env.VERCEL && !process.env.SUPABASE_DB_PASSWORD && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN);
const out = process.env.HOMA_HANDWRITING_CONTRACT_OUTPUT ?? resolve(process.env.HOMA_EVAL_BLOB_DIR!, 'contract-evidence');
mkdirSync(out, { recursive: true });
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const u = new URL(request.url), owned = new URL(process.env.HOMA_EVAL_BLOB_URL!);
    assert.equal(u.origin, owned.origin, 'Only disposable artifact reads may use fetch');
    assert.ok(request.method === 'GET' || request.method === 'HEAD');
    return nativeFetch(request);
};
process.env.HOMA_SUBJECT_LESSONS_ENABLED = 'true';
const sql = mapDb(), familyId = randomUUID(), foreignFamily = randomUUID(), actor = randomUUID(), childId = randomUUID(), foreignChild = randomUUID();
const results: any[] = [], sdkCalls: any[] = [], network: string[] = [];
let renders = 0, uploads = 0, reviewPass = true;
const launch = puppeteer.launch.bind(puppeteer);
puppeteer.launch = async (...args: Parameters<typeof launch>) => { const browser = await launch(...args); const newPage = browser.newPage.bind(browser); browser.newPage = async () => { const page = await newPage(); await page.setOfflineMode(true); page.on('request', r => { if (!r.url().startsWith('data:') && r.url() !== 'about:blank')
    network.push(new URL(r.url()).protocol); }); return page; }; return browser; };
const uuid = (x: string | null) => { assert.ok(x && /^[\da-f-]{36}$/.test(x)); return x; };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function member<T>(fn: (tx: any) => Promise<T>) { return sql.begin(async (tx) => { await tx `set local role authenticated`; await tx `select set_config('request.jwt.claim.sub',${actor},true)`; await tx `set local statement_timeout='5s'`; return fn(tx); }); }
const db = createClient('http://fixture.invalid', 'fixture-public-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer exact-fixture-caller' }, fetch: async (input: any, init: any) => {
            const u = new URL(String(input)), method = init?.method ?? 'GET';
            assert.equal(u.origin, 'http://fixture.invalid');
            assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer exact-fixture-caller');
            const single = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object');
            sdkCalls.push({ path: u.pathname, method });
            try {
                return await member(async (tx) => {
                    if (u.pathname === '/rest/v1/materials' && method === 'GET') {
                        const family = uuid(u.searchParams.get('family_id')?.replace(/^eq\./, '') ?? null), id = u.searchParams.get('id')?.replace(/^eq\./, '') ?? null;
                        if (id)
                            uuid(id);
                        const rows = await tx `select m.*,m.created_at::text as created_at,m.deleted_at::text as deleted_at,
   m.generation->'pageCount' as page_count,m.generation->'pagePreviewUrls' as page_preview_urls,
   m.generation->'familySources' as family_sources,m.generation->'handwritingRows' as handwriting_rows,
   m.generation->'handwritingRender' as handwriting_render
   from public.materials m where m.family_id=${family} and (${id}::uuid is null or m.id=${id}::uuid)
   order by m.created_at asc limit 3000`;
                        return response(single ? (rows[0] ?? null) : rows);
                    }
                    if (u.pathname === '/rest/v1/materials' && method === 'POST') {
                        const b = JSON.parse(init.body);
                        assert.equal(b.family_id, familyId);
                        assert.equal(b.child_id, childId);
                        assert.equal(b.channel, 'web');
                        assert.equal(b.subject_lesson_id, undefined);
                        const inserted = await tx `insert into public.materials(id,family_id,child_id,title,kind,skill,subject,curriculum,theme,characters,pdf_url,preview_url,html,source,revises,channel,source_offer_delivery_id,generation)
   values(${b.id},${b.family_id},${b.child_id},${b.title},${b.kind},${b.skill},${b.subject},${b.curriculum},${b.theme},${b.characters},${b.pdf_url},${b.preview_url},${b.html},${b.source},${b.revises},${b.channel},${b.source_offer_delivery_id},${tx.json(b.generation)}) returning id`;
                        return response(single ? inserted[0] : inserted, 201);
                    }
                    if (u.pathname === '/rest/v1/children' && method === 'GET') {
                        const family = uuid(u.searchParams.get('family_id')?.replace(/^eq\./, '') ?? null);
                        const ids = (u.searchParams.get('id') ?? '').replace(/^in\.(\(|\[)/, '').replace(/[\])]+$/, '').split(',').map(x => uuid(x.replaceAll('"', '')));
                        return response(await tx `select id,name from public.children where family_id=${family} and id=any(${ids}::uuid[])`);
                    }
                    if (u.pathname === '/rest/v1/rpc/finalize_family_material' && method === 'POST') {
                        const b = JSON.parse(init.body);
                        assert.equal(b.p_family_id, familyId);
                        return response(await tx `select * from public.finalize_family_material(${b.p_family_id},${b.p_material_id})`);
                    }
                    if (u.pathname === '/rest/v1/rpc/restore_family_material_version' && method === 'POST') {
                        const b = JSON.parse(init.body);
                        assert.equal(b.p_family_id, familyId);
                        const row = await tx `select public.restore_family_material_version(${b.p_family_id},${b.p_source_material_id},${b.p_expected_deleted_at}::text::timestamptz,${b.p_pdf_url},${b.p_preview_url},${tx.json(b.p_generation)}) as id`;
                        return response(row[0].id);
                    }
                    throw new Error('Unrecognized caller SDK request');
                });
            }
            catch (error: any) {
                return response({ code: error.code ?? 'fixture_error', message: error.message }, 400);
            }
        } } });
const trace: any[] = [];
const require = createRequire(resolve(root, 'apps/web/agent/tools/create_printable.ts'));
const ts = require('typescript');
function tool(sourcePath: string) {
    const overrides: Record<string, unknown> = {
        'eve/tools': { defineDynamic: (x: any) => x },
        '../../lib/agent-tool-deadline': { defineBoundedTool: (x: any) => x, TOOL_DEADLINE: { render: 120000 } },
        '../../lib/agent-db': { MissingFamilyContextError: class extends Error {
            }, resolveAgentAccess: async (attrs: any) => { assert.equal(attrs.familyId, familyId); return attrs.channel === 'web' ? { mode: 'caller', db, familyId } : { mode: 'pinned', familyId }; } },
        '../../lib/materials/review-artifact': { reviewArtifact: async () => { trace.push({ kind: 'scripted-review', pass: reviewPass }); return { pass: reviewPass, issues: reviewPass ? [] : ['Synthetic first-review failure'], advisoryIssues: [], checklistAdvisory: [], checklistUnconfirmed: [], reviewedPages: [1] }; } },
        '../../lib/materials/review-anchor': { loadReviewAnchor: async () => ({ anchor: null, skipped: 'fixture-no-provider' }) },
        '../../lib/materials/render-page': { ...renderer, renderPrintableHtml: async (...args: any[]) => { renders++; const result = await (renderer.renderPrintableHtml as any)(...args); assert.equal(result.handwriting?.status, 'verified'); assert.ok(result.pdf.length > 0 && result.pageJpegs.length); return result; } },
        '../../lib/materials/artifact-store': { ...artifact, uploadMaterialArtifacts: async (input: any) => { uploads++; const result = await artifact.uploadMaterialArtifacts(input); trace.push({ kind: 'local-upload', bytes: input.pdf.length, pages: input.pageJpegs.length }); return result; } },
        '../../lib/map/events': { emitMapEvent: async () => { } },
        '../../lib/sms-progress': { sendSmsProgressTextOnce: async () => { throw new Error('No SMS allowed'); } },
        '../../lib/voice/telnyx-api': { sendHomaSms: async () => { throw new Error('No outbound allowed'); } },
    };
    const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const mod = { exports: {} as any };
    vm.runInNewContext(compiled, { module: mod, exports: mod.exports, require: (id: string) => id in overrides ? overrides[id] : require(id), console, Buffer, URL, process, setTimeout, clearTimeout, AbortController, AbortSignal, __filename: sourcePath, __dirname: dirname(sourcePath) }, { filename: sourcePath });
    return async (input: any, attributes: any) => { const parsed = mod.exports.createPrintableInputSchema.parse(input); const ctx = { session: { id: 'synthetic-handwriting-session', turn: { id: 'synthetic-turn' }, auth: { current: { attributes } } } }; return mod.exports.default.events['step.started']({}, ctx).execute(parsed, ctx); };
}
const create = tool(resolve(root, 'apps/web/agent/tools/create_printable.ts'));
const body = '<h1 style="font:28px sans-serif;margin:0">Amalia practice</h1><!-- homa:handwriting name -->';
const base: any = { title: 'Synthetic Amalia practice', kind: 'worksheet', recipe: 'name-tracing-page', childId, childName: 'Amalia', subject: 'fine_motor', skill: 'Writes her name', html: body, handwritingRows: [{ id: 'name', text: 'Amalia', style: 'pale', capHeight: 128 }] };
const web = { channel: 'web', familyId, memberUserId: actor };
function revision(id: string, override: any = {}) { return { ...base, revisesId: id, handwritingRows: [{ ...base.handwritingRows[0], predecessor: { kind: 'guided', page: 1, rowId: 'name' } }], ...override }; }
async function raw(id: string) { return (await sql `select * from public.materials where id=${id}`)[0]; }
async function readLocalPdf(url: string) { const prefix = process.env.HOMA_EVAL_BLOB_URL! + '/'; assert.ok(url.startsWith(prefix)); return readFileSync(resolve(process.env.HOMA_EVAL_BLOB_DIR!, url.slice(prefix.length))); }
function record(name: string, extra: any = {}) { results.push({ name, passed: true, ...extra }); }
try {
    await sql `insert into auth.users(id,email) values(${actor},${actor + '@example.test'})`;
    await sql `insert into public.families(id,name) values(${familyId},'Handwriting synthetic'),(${foreignFamily},'Foreign synthetic')`;
    await sql `insert into public.family_members(family_id,user_id,role) values(${familyId},${actor},'parent')`;
    await sql `insert into public.children(id,family_id,name,birth_month) values(${childId},${familyId},'Amalia','2020-01-06'),(${foreignChild},${foreignFamily},'Foreign','2020-01-06')`;
    const first = await create(base, web);
    assert.equal(first.created, true, first.note);
    const firstId = first.material.id;
    const firstRow = await raw(firstId);
    assert.equal(firstRow.generation.handwritingRows.length, 1);
    assert.equal(firstRow.generation.handwritingRender.status, 'verified');
    const callerRead = await library.getMaterialCaller(db, familyId, firstId), pinnedRead = await library.getMaterialPinned(familyId, firstId);
    assert.ok(callerRead?.html && pinnedRead?.html);
    assert.deepEqual(callerRead.handwritingRows, firstRow.generation.handwritingRows);
    assert.deepEqual(pinnedRead.handwritingRender, firstRow.generation.handwritingRender);
    record('ordinary-caller-create-real-render-upload-insert-jsonb-reopen', { materialId: firstId });
    const second = await create(revision(firstId), web);
    assert.equal(second.created, true, second.note);
    const secondRow = await raw(second.material.id);
    assert.equal(secondRow.revises, firstId);
    assert.equal(secondRow.generation.handwritingSize.comparisons[0].after.cap, 128);
    record('ordinary-caller-revision-keeps-exact-row-bands-after-jsonb');
    const restore = await restoreMaterialVersionCaller({ db, familyId, materialId: second.material.id, sourceMaterialId: firstId });
    assert.equal(restore.restored, true, restore.note);
    if (!restore.restored)
        throw new Error('restore');
    const restoredRow = await raw(restore.material.id);
    assert.equal(restoredRow.html, firstRow.html);
    assert.equal(restoredRow.generation.handwritingRows[0].carriedFrom.materialId, firstId);
    assert.equal(restoredRow.generation.handwritingRender.status, 'verified');
    assert.ok((await library.getMaterialCaller(db, familyId, restore.material.id))?.html);
    writeFileSync(resolve(out, 'ordinary-restored.pdf'), await readLocalPdf(restore.material.pdfUrl));
    record('ordinary-caller-restore-real-rpc-render-source-preserved');
    const pinnedRestore = await restoreMaterialVersionPinned({ familyId, materialId: second.material.id, sourceMaterialId: firstId, channel: 'sms' });
    assert.equal(pinnedRestore.restored, true, pinnedRestore.note);
    record('ordinary-pinned-restore-real-row-write');
    // Wrong family never reads or revises a saved row, including pinned code.
    const foreignId = randomUUID();
    await sql `insert into public.materials(id,family_id,child_id,title,pdf_url,preview_url,html,generation) values(${foreignId},${foreignFamily},${foreignChild},'Foreign',${firstRow.pdf_url},${firstRow.preview_url},${firstRow.html},${sql.json(firstRow.generation)})`;
    assert.equal(await library.getMaterialCaller(db, familyId, foreignId), null);
    assert.equal(await library.getMaterialCaller(db, foreignFamily, foreignId), null, 'Real authenticated RLS rejects a foreign-family read even if the filter names that family');
    assert.equal(await library.getMaterialPinned(familyId, foreignId), null);
    const beforeForeign = renders;
    assert.equal((await create(revision(foreignId), web)).created, false);
    assert.equal(renders, beforeForeign);
    record('wrong-family-source-refused-before-render');
    const badRow = revision(firstId, { handwritingRows: [{ ...base.handwritingRows[0], predecessor: { kind: 'guided', page: 1, rowId: 'missing' } }] });
    const beforeBad = renders;
    assert.equal((await create(badRow, web)).created, false);
    assert.equal(renders, beforeBad);
    record('missing-predecessor-row-refused-before-render');
    const smaller = revision(firstId, { handwritingRows: [{ ...base.handwritingRows[0], capHeight: 112, predecessor: { kind: 'guided', page: 1, rowId: 'name' } }] });
    assert.equal((await create(smaller, web)).created, false);
    assert.equal(renders, beforeBad);
    record('smaller-guided-cap-refused-before-render');
    const legacyId = randomUUID();
    const legacySvg = '<svg viewBox="0 0 700 132" preserveAspectRatio="none"><line x1="0" y1="2" x2="700" y2="2" stroke="#777"/><line x1="0" y1="66" x2="700" y2="66" stroke="#777" stroke-dasharray="7,6"/><line x1="0" y1="130" x2="700" y2="130" stroke="#777"/><text x="16" y="129" font-family="Proof Fredoka" font-size="174" fill="#c9c2b8">Amalia</text></svg>';
    const legacyHtml = '<style>.row svg{display:block;width:100%;height:132px}</style><h1 style="font:28px sans-serif">Old font unavailable</h1><div class="row">' + legacySvg + '</div>';
    await sql `insert into public.materials(id,family_id,child_id,title,pdf_url,preview_url,html,generation) values(${legacyId},${familyId},${childId},'Legacy font missing',${firstRow.pdf_url},${firstRow.preview_url},${legacyHtml},${sql.json({ pageGeometry: firstRow.generation.pageGeometry })})`;
    const beforeMissingFont = uploads;
    const missingFont = await create({ ...base, revisesId: legacyId, html: legacyHtml.replace(legacySvg, '<!-- homa:handwriting name -->'), handwritingRows: [{ ...base.handwritingRows[0], predecessor: { kind: 'legacy-svg', page: 1, svgOrdinal: 1 } }] }, web);
    assert.equal(missingFont.created, false);
    assert.match(missingFont.note, /embedded old font/);
    assert.equal(uploads, beforeMissingFont);
    record('legacy-source-without-proven-font-refused-before-upload');
    const lessonId = randomUUID(), fingerprint = 'a'.repeat(64);
    await sql `insert into public.subject_lessons(id,child_id,subject_id,target_statement,source_report_generated_at,source_fingerprint,bank_version,content,build_status,attempt_count,idempotency_key) values(${lessonId},${childId},'fine_motor','Writes her name',now(),${fingerprint},'synthetic',${sql.json({ title: 'Write a name', materials: ['Paper'], steps: ['Look at the name', 'Trace the name', 'Try the name'], practice: 'Trace the name once.' })},'running',1,${fingerprint})`;
    const auth = buildSubjectLessonAuth({ lessonId, familyId, childId, childName: 'Amalia', subjectId: 'fine_motor', subjectName: 'Fine motor', targetItemId: null, targetStatement: 'Writes her name', startingLine: null, attempt: 1, hasContent: true, materialId: null, modelUsageSurface: ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface }).attributes;
    reviewPass = false;
    const failed = await create(base, auth);
    assert.equal(failed.created, true, failed.note);
    const failedId = failed.material.id;
    const hidden = await raw(failedId);
    assert.equal(hidden.subject_lesson_id, lessonId);
    assert.equal(hidden.generation.review.pass, false);
    assert.equal(hidden.status, 'draft');
    assert.equal(await library.getMaterialCaller(db, familyId, failedId), null);
    assert.equal(await library.getMaterialPinned(familyId, failedId), null);
    record('protected-first-draft-created-and-hidden-from-caller-and-generic-pinned');
    const beforeDenied = { renders, uploads };
    assert.equal((await create(revision(failedId), web)).created, false);
    assert.equal((await create(revision(failedId), { channel: 'sms', familyId })).created, false);
    assert.deepEqual({ renders, uploads }, beforeDenied);
    record('protected-source-caller-and-ordinary-pinned-create-refused-before-effect');
    const trusted = { familyId, lessonId, childId, childName: 'Amalia', subjectId: 'fine_motor', subjectName: 'Fine motor', targetStatement: 'Writes her name', attempt: 1 };
    assert.ok(await library.getSubjectLessonRevisionMaterialPinned(familyId, failedId, trusted));
    for (const delta of [{ familyId: foreignFamily }, { lessonId: randomUUID() }, { childId: foreignChild }, { attempt: 2 }, { subjectId: 'math' }, { targetStatement: 'Different target' }])
        assert.equal(await library.getSubjectLessonRevisionMaterialPinned(familyId, failedId, { ...trusted, ...delta }), null);
    assert.equal(await library.getSubjectLessonRevisionMaterialPinned(foreignFamily, failedId, { ...trusted, familyId: foreignFamily }), null);
    record('trusted-predecessor-validates-family-lesson-child-attempt-subject-target');
    reviewPass = true;
    const corrected = await create(revision(failedId), auth);
    assert.equal(corrected.created, true, corrected.note);
    const correctedId = corrected.material.id;
    const correctedRow = await raw(correctedId);
    assert.equal(correctedRow.revises, failedId);
    assert.equal(correctedRow.subject_lesson_id, lessonId);
    assert.equal(correctedRow.generation.handwritingRender.status, 'verified');
    assert.equal(await store.attachSubjectLessonMaterialPinned({ familyId, lessonId, attempt: 1, materialId: correctedId }), true);
    const finished = await store.finishSubjectLessonRun({ familyId, lessonId, attempt: 1, status: 'ready' });
    assert.equal(finished?.lesson.buildStatus, 'ready');
    assert.equal(finished?.transitioned, true);
    const beforeReplay = { renders, uploads }, countBefore = (await sql `select count(*)::int as n from public.materials where family_id=${familyId}`)[0].n;
    const replay = await create(revision(failedId), auth);
    assert.equal(replay.created, true, replay.note);
    assert.equal(replay.done, true);
    assert.equal(replay.material.id, correctedId);
    assert.deepEqual({ renders, uploads }, beforeReplay);
    assert.equal((await sql `select count(*)::int as n from public.materials where family_id=${familyId}`)[0].n, countBefore);
    record('protected-revision-save-attach-finish-and-completed-effect-replay', { materialId: correctedId, replayCreatesNoRowOrArtifact: true });
    const draftCleanup: string[] = [];
    const keep = await library.finalizeMaterialCaller(db, familyId, correctedId, async (urls) => { for (const url of urls) {
        assert.ok(url.startsWith(process.env.HOMA_EVAL_BLOB_URL! + '/'));
        const file=resolve(process.env.HOMA_EVAL_BLOB_DIR!,url.slice((process.env.HOMA_EVAL_BLOB_URL!+'/').length));
        assert.ok(file.startsWith(resolve(process.env.HOMA_EVAL_BLOB_DIR!)+'/'));
        unlinkSync(file);
        assert.equal(existsSync(file),false);
        draftCleanup.push(url);
    } });
    assert.equal(keep.finalized, true, keep.note);
    assert.equal(keep.transitioned, true);
    assert.equal((await raw(correctedId)).status, 'final');
    assert.equal((await raw(failedId)).status, 'superseded');
    assert.ok(await library.getMaterialCaller(db, familyId, correctedId));
    assert.ok(await library.getMaterialPinned(familyId, correctedId));
    assert.equal(await library.getMaterialCaller(db, familyId, failedId), null);
    assert.equal(await library.getMaterialPinned(familyId, failedId), null);
    const afterKeep = await create(revision(failedId), auth);
    assert.equal(afterKeep.created, true, afterKeep.note);
    assert.equal(afterKeep.done, true);
    assert.equal(afterKeep.material.id, correctedId);
    assert.deepEqual({ renders, uploads }, beforeReplay);
    assert.equal((await sql `select count(*)::int as n from public.materials where family_id=${familyId}`)[0].n, countBefore);
    record('protected-parent-keep-real-authenticated-rpc-reopens-final-and-replays-without-effect', { cleanupCallbackCalls: draftCleanup.length });
    // The new read is a current-attempt capability, not a general draft read.
    await sql `update public.subject_lessons set attempt_count=2,build_status='running' where id=${lessonId}`;
    assert.equal(await library.getSubjectLessonRevisionMaterialPinned(familyId, failedId, trusted), null);
    record('stale-authenticated-attempt-refused-after-attempt-advance');
    assert.equal(await library.getMaterialCaller(db, familyId, failedId), null);
    assert.equal(await library.getMaterialPinned(familyId, failedId), null);
    const refusedRestore = await restoreMaterialVersionPinned({ familyId, materialId: correctedId, sourceMaterialId: failedId, channel: 'sms' });
    assert.equal(refusedRestore.restored, false);
    record('protected-history-still-not-restorable-by-ordinary-path');
    writeFileSync(resolve(out, 'subject-lesson-corrected.pdf'), await readLocalPdf(correctedRow.pdf_url));
    assert.deepEqual(network, []);
    const receipt = { passed: true, results, toolRenders: renders, toolArtifactUploads: uploads, restoreRenders: 2, restoreArtifactUploads: 2, legacyInspectionRenders: 1, callerSdkRequests: sdkCalls, networkRequests: network, boundary: 'Actual create_printable execute/source readers, caller Supabase SDK with local PostgREST-shaped adapter executing authenticated-role RLS, real subject-lesson claim/insert/attach/replay and restore RPC, real Chromium/PDF and local artifact bytes. Authentication metadata and model review are synthetic; no model/provider/hosted claims.' };
    writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt, null, 2));
}
finally {
    globalThis.fetch = nativeFetch;
    await renderer.closePrintableRenderer();
    await sql.end({ timeout: 5 });
}
