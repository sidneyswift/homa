import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type postgres from "postgres";
import type { DbJson } from "./db";
import ts from "typescript";
import { MAP_BANK_VERSION, MAP_SCORER_VERSION, getMapSubject } from "@homa/core";
import { canonicalComparisonAnswers } from "../child-progress/comparison";
import { comparisonFixture } from "../child-progress/comparison-fixture";
import { buildSavedReportComparisons } from "../child-progress/report-comparison";
import { CHILD_PROGRESS_PROJECTION_VERSION } from "../child-progress/view-schema";
import { profileInterestList, profileFocusList, profileHelpList, uniqueStrings } from "./profile-context";
/** Evaluate the actual declaration without importing its model/provider boundaries.
 * The SQL is unchanged and executes against the caller's disposable cluster. */
function extract(source: string, name: string, endMarker: string, deps: Record<string, unknown>) {
    const start = source.indexOf(`export async function ${name}(`);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${name}: source declaration exists`);
    const code = ts.transpileModule(source.slice(start, end).replace("export async function", "async function"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return new Function(...Object.keys(deps), `${code}; return ${name};`)(...Object.values(deps));
}
/** Uses only the caller-owned local database; never discovers credentials. */
export async function assertReportNarrativePostgres(sql: postgres.Sql): Promise<void> {
    const source = await readFile(new URL("./narrative-store.ts", import.meta.url), "utf8");
    const runner = await readFile(new URL("./narrative-runner.ts", import.meta.url), "utf8");
    const family = randomUUID(), child = randomUUID(), foreign = randomUUID();
    const T1 = "2026-09-06T18:00:00.000001Z", T2 = "2026-09-06T18:00:00.000002Z";
    const view = comparisonFixture([{ itemId: "gross_motor.catches-ball", observedAt: "2025-09-06T12:00:00Z", derivation: "inferred" }]);
    view.childId = child;
    const claim = (revision = T1) => ({ status: "writing", promptVersion: "fixture", model: "fixture-no-model", startedAt: new Date().toISOString(), generationId: randomUUID(), reportGeneratedAt: revision });
    const checks: string[] = [];
    const check = (name: string, actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected, name); checks.push(name); };
    await sql `insert into public.families (id, sandbox) values (${family}, true)`;
    await sql `insert into public.children (id, family_id, name, birth_month) values (${child}, ${family}, ${view.childName}, ${view.birthDate})`;
    const reset = async () => { await sql `delete from child_reports where child_id=${child}`; await sql `insert into child_reports(child_id,scores,bank_version,generated_at) values (${child},${sql.json(view.scores as unknown as DbJson)},${MAP_BANK_VERSION},${T1}::text::timestamptz)`; };
    const revision2 = async () => sql `update child_reports set generated_at=${T2}::text::timestamptz,narrative=null,narrative_meta=null where child_id=${child}`;
    const row = async () => { const [r] = await sql `select narrative,narrative_meta,to_char(generated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') revision from child_reports where child_id=${child}`; return r; };
    const deps = { mapDb: () => sql };
    const loadStore = (s: string) => ({ claim: extract(s, 'claimReportNarrative', '\nexport async function storeReportNarrative(', deps), store: extract(s, 'storeReportNarrative', '\n/** Status for the report page', deps) });
    const after = loadStore(source);
    let a;
    await reset();
    a = claim();
    check('matching claim acquired', await after.claim(family, child, a), true);
    await revision2();
    check('microsecond revision change denies stale publish', await after.store(family, child, { note: 'obsolete' }, { ...a, status: 'ready' }, a), false);
    check('stale success leaves T2 untouched', (await row()).narrative_meta, null);
    check('old source cannot acquire after rescore', await after.claim(family, child, a), false);
    await reset();
    a = claim();
    check('foreign family cannot claim', await after.claim(foreign, child, a), false);
    await after.claim(family, child, a);
    check('foreign family cannot publish', await after.store(foreign, child, { note: 'foreign' }, { ...a, status: 'ready' }, a), false);
    check('different generation cannot publish', await after.store(family, child, { note: 'foreign claim' }, { ...a, status: 'ready' }, claim()), false);
    check('owned matching claim publishes', await after.store(family, child, { note: 'T1 correct' }, { ...a, status: 'ready' }, a), true);
    check('ready record is not reopened', await after.claim(family, child, claim()), false);
    check('duplicate publication is rejected', await after.store(family, child, { note: 'duplicate' }, { ...a, status: 'ready' }, a), false);
    await reset();
    a = claim();
    a.startedAt = '2000-01-01T00:00:00Z';
    await after.claim(family, child, a);
    const newer = claim();
    check('stale in-progress generation can be reclaimed', await after.claim(family, child, newer), true);
    check('reclaimed old generation cannot publish error', await after.store(family, child, null, { ...a, status: 'failed' }, a), false);
    check('replacement claim remains owned', (await row()).narrative_meta.generationId, newer.generationId);
    check('owned failure persists truthful terminal state', await after.store(family, child, null, { ...newer, status: 'failed', failReason: 'fixture' }, newer), true);
    check('failed terminal attempt is not automatically reopened', await after.claim(family, child, claim()), false);
    for (const scenario of ['ready', 'gate-failed', 'generation-error', 'rescore-success', 'rescore-error', 'replacement-success', 'replacement-error', 'preclaim-rescore']) {
        await reset();
        const events: {
            name: string;
            payload: unknown;
        }[] = [];
        let generationCalls = 0;
        let owned: {
            generationId: string;
        } | undefined;
        const d = {
            getReportNarrativeSource: async () => ({ familyId: family, childId: child, childName: 'Maya', siblingNames: [], reportGeneratedAt: T1 }),
            writingMeta: () => ({ status: 'writing', promptVersion: 'fixture', model: 'fixture-no-model', startedAt: new Date().toISOString() }), randomUUID,
            claimReportNarrative: async (...args: [
                string,
                string,
                {
                    generationId: string;
                }
            ]) => { owned = args[2]; if (scenario === 'preclaim-rescore')
                await revision2(); return after.claim(...args); },
            buildReportFacts: () => ({ subjects: [] }), allowedNumbersFrom: () => [], genderedPronounsAllowedFrom: () => false,
            generateReportNarrative: async () => {
                generationCalls++;
                if (scenario.startsWith('rescore'))
                    await revision2();
                if (scenario.startsWith('replacement')) {
                    await sql `update child_reports set narrative_meta=jsonb_set(narrative_meta,'{startedAt}','"2000-01-01T00:00:00Z"') where child_id=${child}`;
                    await after.claim(family, child, claim());
                }
                if (scenario.endsWith('error'))
                    throw new Error('fixture generation error');
                return { value: { note: 'owned generation' }, durationMs: 1, tokensIn: 1, tokensOut: 1 };
            },
            validateNarrative: () => ({ failed: scenario === 'gate-failed', rejectedPieces: [], rejected: [] }), storeReportNarrative: after.store,
            emitMapEvent: async (name: string, payload: unknown) => events.push({ name, payload }), console: { error() { } },
        };
        const runNarrative = extract(runner, 'runReportNarrative', '\nexport async function runPlanNarrative(', d);
        await runNarrative(child, family);
        const current = await row(), lost = scenario.startsWith('rescore') || scenario.startsWith('replacement') || scenario === 'preclaim-rescore';
        check(`${scenario}: truthful events`, events.length, lost ? 0 : 1);
        check(`${scenario}: expected model dispatch count`, generationCalls, scenario === 'preclaim-rescore' ? 0 : 1);
        if (!lost)
            check(`${scenario}: current terminal state`, current.narrative_meta.status, scenario === 'ready' ? 'ready' : 'failed');
        else if (scenario.startsWith('replacement')) {
            check(`${scenario}: replacement remains writing`, current.narrative_meta.status, 'writing');
            assert.notEqual(current.narrative_meta.generationId, owned!.generationId);
        }
        else
            check(`${scenario}: new revision remains untouched`, current.narrative_meta, null);
    }
    await sql `update children set name=${view.childName},birth_month=${view.birthDate} where id=${child}`;
    await reset();
    await sql `update child_reports set scores=${sql.json(view.scores as unknown as DbJson)},bank_version=${MAP_BANK_VERSION},scorer_version=${MAP_SCORER_VERSION},scored_birth_date=${view.birthDate},scored_age_months=48,generated_at=${view.projectedAt}::text::timestamptz where child_id=${child}`;
    await sql `insert into child_progress_live (child_id,family_id,projection,bank_version,projection_version,projection_date,projected_at,source_revision) values (${child},${family},${sql.json(view as unknown as DbJson)},${MAP_BANK_VERSION},${CHILD_PROGRESS_PROJECTION_VERSION},'2026-09-06',${view.projectedAt}::text::timestamptz,0)`;
    await sql `insert into child_answers(child_id,question_id,answer) values (${child},'gross_motor.skips','easily')`;
    let sourceReads = 0, mutate = false;
    const sourceSql = async (parts: TemplateStringsArray, ...values: string[]) => {
        const text = parts.join('?'), rows = await sql(parts, ...values);
        if (text.includes('compatibility_answers')) {
            sourceReads++;
            if (mutate) {
                mutate = false;
                await sql `update child_answers set answer='not_yet' where child_id=${child}`;
            }
        }
        return rows;
    };
    const getSource = extract(source, 'getReportNarrativeSource', '\n/**\n * Claims one generation run.', {
        mapDb: () => sourceSql, buildSavedReportComparisons: buildSavedReportComparisons,
        profileInterestList: profileInterestList, profileFocusList, profileHelpList, uniqueStrings, getMapSubject: getMapSubject, MONTH_PLAN_SUBJECT: 'month',
    });
    let read = await getSource(child, family);
    check('actual narrative source uses full exact canonical answers', read.answers, canonicalComparisonAnswers(view));
    check('actual narrative source preserves exact report revision', read.reportGeneratedAt, '2026-09-06T18:00:00.000000Z');
    check('source rejects another family', await getSource(child, foreign), null);
    await sql `delete from child_progress_live where child_id=${child}`;
    mutate = true;
    read = await getSource(child, family);
    check('legacy source compatibility answer is from initial statement snapshot', read.answers, [{ itemId: 'gross_motor.skips', answer: 'easily' }]);
    check('only expected bounded source reads occurred', sourceReads, 3);
    const previousId = randomUUID(), acceptedId = randomUUID(), futureId = randomUUID();
    await sql `update child_reports set history=${sql.json([{ scores: view.scores, generated_at: "2026-09-05T18:00:00Z" }] as unknown as DbJson)} where child_id=${child}`;
    await sql `insert into child_progress_evidence
    (id, family_id, child_id, item_id, answer, derivation, source, idempotency_key, observed_at, created_at, superseded_at, supersedes_id)
    values
    (${previousId}, ${family}, ${child}, 'gross_motor.catches-ball', 'not_yet', 'direct', 'check_in', ${randomUUID()},
      '2026-09-04T12:00:00Z', '2026-09-04T12:00:00Z', '2026-09-06T12:00:00Z', null),
    (${acceptedId}, ${family}, ${child}, 'gross_motor.catches-ball', 'easily', 'direct', 'check_in', ${randomUUID()},
      '2026-09-06T12:00:00Z', '2026-09-06T12:00:00Z', '2026-09-07T12:00:00Z', ${previousId}),
    (${futureId}, ${family}, ${child}, 'gross_motor.catches-ball', 'not_yet', 'direct', 'check_in', ${randomUUID()},
      '2026-09-07T12:00:00Z', '2026-09-07T12:00:00Z', null, ${acceptedId})`;
    read = await getSource(child, family);
    check("changed-answer source reconstructs supersession at the saved report date", read.changedSinceLastScoring, [{ itemId: "gross_motor.catches-ball", answer: "easily", previousAnswer: "not_yet", source: "check_in" }]);
    console.log(`PASS  report-narrative-e2e ${checks.length} revision/claim/source checks`);
}
