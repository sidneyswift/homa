import { installHoursPostgresFixture } from "./hours-postgres-fixture.mjs";
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/** Real reader source + real disposable PostgreSQL/RLS. The caller boundary
 * uses the actual Supabase SDK against a narrow read-only loopback adapter,
 * not a PostgREST binary or a real Supabase Auth service. Never a model call.
 * Imported by the existing CI Planner PostgreSQL harness; direct execution
 * is deliberately a no-op. The owning eval:sandbox removes the cluster. */
export async function runHoursSchoolYearReadContract(sql) {
  await installHoursPostgresFixture(sql);
  const endpoint = new URL(process.env.HOMA_EVAL_DATABASE_URL ?? 'https://missing.invalid');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert.equal(endpoint.hostname, '127.0.0.1');
  assert.equal(endpoint.pathname, '/homa_eval');
  assert.equal(decodeURIComponent(endpoint.username), 'homa_eval');
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== '1');
  const blobRoot = realpathSync(process.env.HOMA_EVAL_BLOB_DIR ?? '/missing-sandbox');
  assert.equal(path.basename(blobRoot), 'blob');
  assert.match(path.basename(path.dirname(blobRoot)), /^homa-eval-sandbox-/u);
  const [identity] = await sql`select current_database() as database, current_user as username,
    current_setting('data_directory') as directory`;
  assert.equal(identity.database, 'homa_eval');
  assert.equal(identity.username, 'homa_eval');
  assert.equal(realpathSync(identity.directory), path.join(path.dirname(blobRoot), 'data'));
  await sql`set statement_timeout = '10s'`;
  await sql`set lock_timeout = '2s'`;

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const require = createRequire(path.join(root, 'apps/web/package.json'));
  const ts = require('typescript');
  const { createClient } = require('@supabase/supabase-js');
  const userA = randomUUID(), userB = randomUUID();
  const familyA = randomUUID(), familyB = randomUUID();
  const childA = randomUUID(), childB = randomUUID();
  const tokens = new Map([[randomUUID(), userA], [randomUUID(), userB]]);
  const tokenA = [...tokens.keys()][0], tokenB = [...tokens.keys()][1];
  const today = '2026-09-10';
  const instant = '2026-09-10T04:30:00Z';
  const requests = [];
  const sourceHashes = {};
  const results = [];
  let policy = { cap: 3000, omitCount: false, failHours: false };
  let server;

  async function asCaller(user, work) {
    return sql.begin('isolation level repeatable read read only', async tx => {
      await tx`set local statement_timeout = '5s'`;
      await tx`set local lock_timeout = '1s'`;
      await tx`select set_config('request.jwt.claim.sub', ${user}, true)`;
      await tx`set local role authenticated`;
      const [role] = await tx`select current_user as role, auth.uid()::text as user`;
      assert.equal(role.role, 'authenticated');
      assert.equal(role.user, user);
      return work(tx);
    });
  }
  const fields = {
    families: new Set(['id', 'time_zone', 'school_year_start_on']),
    children: new Set(['id', 'name', 'family_id', 'created_at']),
    hours_log: new Set(['id', 'family_id', 'child_id', 'subject', 'custom_label', 'minutes', 'happened_on', 'source', 'note', 'created_at']),
  };
  async function serve(request, response) {
    try {
      if (request.method === 'POST' && request.url === '/rest/v1/rpc/read_hours_summary') {
        const user = tokens.get(request.headers.authorization?.replace(/^Bearer /u, ''));
        assert(user, "RPC requires this run's caller token");
        let body = ''; for await (const chunk of request) { body += chunk.toString(); assert(body.length < 4096); }
        const args = JSON.parse(body);
        assert.deepEqual(Object.keys(args).sort(), ['target_family_id','requested_period','target_child_id','include_shared','from_on','through_on','target_subject','entry_limit','reference_at'].sort());
        requests.push({ table: 'rpc/read_hours_summary', user });
        if (policy.failHours) { response.writeHead(503, { 'content-type': 'application/json' }); response.end(JSON.stringify({code:'XX000',message:'Synthetic summary read failure'})); return; }
        const rows = await asCaller(user, tx => tx`select public.read_hours_summary(
          ${args.target_family_id}::uuid, ${args.requested_period}::text, ${args.target_child_id}::uuid,
          ${args.include_shared}::boolean, ${args.from_on}::text, ${args.through_on}::text,
          ${args.target_subject}::text, ${args.entry_limit}::integer, ${args.reference_at}::timestamptz
        ) as record`);
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(rows[0].record)); return;
      }
      assert.equal(request.method, 'GET');
      assert((request.url?.length ?? 0) < 2048);
      const url = new URL(request.url, 'http://127.0.0.1');
      const table = url.pathname === '/rest/v1/families' ? 'families'
        : url.pathname === '/rest/v1/children' ? 'children'
        : url.pathname === '/rest/v1/hours_log' ? 'hours_log' : null;
      assert(table);
      const bearer = request.headers.authorization?.replace(/^Bearer /u, '');
      const user = tokens.get(bearer);
      assert(user, 'only this local run owns accepted caller tokens');
      const columns = (url.searchParams.get('select') ?? '').split(',');
      assert(columns.length > 0 && columns.every(column => fields[table].has(column)));
      const args = [];
      const predicates = [];
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit'].includes(key)) continue;
        assert(['id', 'family_id', 'happened_on'].includes(key) && fields[table].has(key));
        const at = value.indexOf('.');
        const operator = value.slice(0, at);
        assert(['eq', 'gte', 'lte'].includes(operator));
        args.push(value.slice(at + 1));
        predicates.push(`"${key}" ${{ eq: '=', gte: '>=', lte: '<=' }[operator]} $${args.length}`);
      }
      assert(predicates.length > 0, 'readers must issue a scope predicate');
      const order = (url.searchParams.get('order') ?? '').split(',').filter(Boolean).map(item => {
        const [column, direction, extra] = item.split('.');
        assert(fields[table].has(column) && ['asc', 'desc'].includes(direction) && extra === undefined);
        return `"${column}" ${direction}`;
      });
      const requested = Number(url.searchParams.get('limit') ?? 1);
      assert(Number.isSafeInteger(requested) && requested >= 1 && requested <= 3000);
      const limit = Math.min(requested, policy.cap);
      const wantsCount = request.headers.prefer?.split(',').some(value => value.trim() === 'count=exact') ?? false;
      requests.push({ table, user, wantsCount, requested, cap: policy.cap });
      if (table === 'hours_log' && policy.failHours) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ code: 'XX000', message: 'Synthetic Hours read failure', details: null, hint: null }));
        return;
      }
      const result = await asCaller(user, async tx => {
        const where = predicates.join(' and ');
        const [count] = await tx.unsafe(`select count(*)::int as count from public."${table}" where ${where}`, args);
        const selection = columns.map(column => ['happened_on', 'school_year_start_on'].includes(column)
          ? `"${column}"::text as "${column}"` : `"${column}"`).join(',');
        const data = await tx.unsafe(`select ${selection} from public."${table}" where ${where}${order.length ? ' order by ' + order.join(',') : ''} limit ${limit}`, args);
        return { data: [...data], count: count.count };
      });
      const headers = { 'content-type': 'application/json' };
      if (wantsCount && !policy.omitCount) {
        headers['content-range'] = `${result.data.length ? `0-${result.data.length - 1}` : '*'}/${result.count}`;
      }
      response.writeHead(200, headers);
      response.end(JSON.stringify(result.data));
    } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 'PGRST000', message: 'Local adapter refused the request' }));
    }
  }

  try {
    // All mutations below are new synthetic rows inside the attested disposable cluster.
    await sql`insert into auth.users (id, email) values
      (${userA}, ${`school-year-a-${userA}@homatest.invalid`}),
      (${userB}, ${`school-year-b-${userB}@homatest.invalid`})`;
    await sql`insert into public.families (id, name, us_state, time_zone, school_year_start_on,
      status, profile_completed_at, context, sandbox, billing_exempt) values
      (${familyA}, 'School year A', 'OH', 'America/New_York', '2020-09-10', 'claimed', now(), '{}', true, true),
      (${familyB}, 'School year B', 'OH', 'America/Los_Angeles', '2020-01-01', 'claimed', now(), '{}', true, true)`;
    await sql`insert into public.family_members (family_id, user_id, role) values
      (${familyA}, ${userA}, 'parent'), (${familyB}, ${userB}, 'parent')`;
    await sql`insert into public.children (id, family_id, name, birth_month) values
      (${childA}, ${familyA}, 'Avery', '2020-01-01'), (${childB}, ${familyB}, 'Blair', '2020-01-01')`;
    await sql`insert into homa_test_fixture.hours_log (family_id, child_id, subject, minutes, happened_on, source, note) values
      (${familyA}, ${childA}, 'spanish', 5, '2026-09-01', 'chat', 'Old synthetic record'),
      (${familyA}, ${childA}, 'spanish', 10, '2026-09-09', 'chat', 'Prior synthetic record'),
      (${familyA}, ${childA}, 'spanish', 20, '2026-09-10', 'chat', 'Today synthetic record'),
      (${familyA}, null, 'spanish', 3, '2026-09-10', 'chat', 'Shared synthetic record'),
      (${familyA}, ${childA}, 'spanish', 600, '2026-09-11', 'chat', 'Future synthetic record'),
      (${familyB}, ${childB}, 'spanish', 500, '2026-09-10', 'chat', 'Other family synthetic record')`;

    server = createServer((request, response) => { void serve(request, response); });
    server.requestTimeout = 7000;
    server.headersTimeout = 7000;
    server.keepAliveTimeout = 1000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const localFetch = (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.origin, origin);
      assert(request.method === 'GET' || (request.method === 'POST' && url.pathname === '/rest/v1/rpc/read_hours_summary'));
      assert(['/rest/v1/hours_log', '/rest/v1/families', '/rest/v1/children', '/rest/v1/rpc/read_hours_summary'].includes(url.pathname));
      return fetch(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(7000)]), redirect: 'error' });
    };
    const client = token => createClient(origin, 'local-fixture-key', {
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: localFetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let callerToken = tokenA;
    const noEffect = () => { throw new Error('Unrelated effect forbidden in Hours read proof'); };
    const stubs = {
      '@homa/core': { MAP_INTERESTS_CAP: 10 },
      '@supabase/supabase-js': { createClient: (_url, _key, options) => {
        assert.equal(_url, origin);
        return client(options.global.headers.Authorization.slice('Bearer '.length));
      } },
      'apps/web/lib/supabase/server': { createSupabaseServerClient: async () => client(callerToken) },
      'apps/web/lib/map/db': { mapDb: () => sql },
      'apps/web/lib/map/events': { emitMapEvent: noEffect },
      'apps/web/lib/learning/embeddings': { embedText: noEffect },
      'apps/web/lib/account-deletion-artifact-fence': { assertFamilyArtifactAccess: async id => {
        assert([familyA, familyB].includes(id));
        const [family] = await sql`select sandbox from public.families where id = ${id}`;
        assert.equal(family?.sandbox, true);
      } },
      'apps/web/lib/agent-tool-deadline': { defineBoundedTool: definition => definition, TOOL_DEADLINE: { fetch: 20000 } },
      'apps/web/lib/compliance/pack': { prefillBirthdate: noEffect },
    };
    const modules = new Map();
    const FixedDate = class extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return new Date(instant).getTime(); } };
    function load(relative) {
      if (modules.has(relative)) return modules.get(relative).exports;
      assert(relative.startsWith('apps/web/lib/') || relative === 'apps/web/agent/tools/find_hours.ts');
      const source = readFileSync(path.join(root, relative), 'utf8');
      sourceHashes[relative] = createHash('sha256').update(source).digest('hex');
      const module = { exports: {} };
      modules.set(relative, module);
      const code = ts.transpileModule(source, { fileName: relative, compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
      } }).outputText;
      function importModule(name) {
        const key = name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(relative), name)) : name;
        if (key in stubs) return stubs[key];
        if (!name.startsWith('.')) { assert(['zod', 'node:crypto'].includes(name)); return require(name); }
        return load(key.endsWith('.ts') ? key : key + '.ts');
      }
      vm.runInNewContext(code, { module, exports: module.exports, require: importModule,
        Date: FixedDate, Intl, Buffer, URL, URLSearchParams, AbortSignal, console, process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-fixture-key' } } }, { filename: relative });
      return module.exports;
    }
    const hours = load('apps/web/lib/hours.ts');
    const pinned = load('apps/web/lib/hours-summary-reader.ts');
    const pack = load('apps/web/lib/compliance/pack-store.ts');
    const recordExport = load('apps/web/lib/hours-export.ts');
    const tool = load('apps/web/agent/tools/find_hours.ts').default;
    const execute = (mode, period = 'school_year', options = {}) => tool.execute(tool.inputSchema.parse({ period, ...options }), {
      session: { auth: { current: { attributes: mode === 'caller'
        ? { familyId: familyA, supabaseAccessToken: tokenA }
        : { familyId: familyA, channel: 'sms' } } } },
    });
    const test = async (name, fn) => { await fn(); results.push(name); };

    await test('configured caller/pinned totals, actual family setting and future exclusion', async () => {
      for (const mode of ['caller', 'pinned']) {
        const result = await execute(mode);
        assert.equal(result.since, today);
        assert.equal(result.through, today);
        assert.equal(result.totalMinutes, 23);
        assert.equal(result.complete, true);
      }
      assert(requests.some(request => request.table === 'rpc/read_hours_summary'));
    });
    await test('real RLS refuses the other family while pinned reader retains exact family predicate', async () => {
      callerToken = tokenB;
      assert.equal((await hours.getHoursLogForFamily(familyA)).rows.length, 0);
      const own = await hours.getHoursLogForFamily(familyB);
      assert.equal(own.rows.length, 1); assert.equal(own.rows[0].minutes, 500);
      for (const source of ['email', 'dispatch']) {
        await sql`update public.hours_log set source=${source} where family_id=${familyB}`;
        assert.equal((await hours.getHoursLogForFamily(familyB)).rows[0].source, source);
        const archive = await recordExport.getHoursExportRecord(familyB);
        assert.equal(archive.rows[0].source, source);
        assert(recordExport.renderHoursCsv(archive.rows).includes(`,"${source}",`));
      }
      await sql`update public.hours_log set source='chat' where family_id=${familyB}`;
      callerToken = tokenA;
      const beforeTheirMidnight = await pinned.readHoursSummaryPinned(familyB, { period: 'all' }, new Date(instant));
      assert.equal(beforeTheirMidnight.entryCount, 0, 'September10 is still future-dated in this Los Angeles family');
      const other = await pinned.readHoursSummaryPinned(familyB, { period: 'all', through: today }, new Date(instant));
      assert.equal(other.entryCount, 1); assert.equal(other.totalMinutes, 500);
      const none = await asCaller(userB, tx => tx`select count(*)::int as count from public.hours_log where family_id = ${familyA}`);
      assert.equal(none[0].count, 0);
    });
    await test('Progress child plus shared window and exact pack upper bound', async () => {
      assert.deepEqual(JSON.parse(JSON.stringify(await hours.getHoursMinutesBySubjectForChild(familyA, childA, today, '2020-09-10'))), { spanish: 23 });
      const records = await pack.getStatePackRecords(familyA, today, today);
      assert.equal(records.truncated, false); assert.equal(records.entries.length, 2);
      assert.equal(records.entries.reduce((total, row) => total + row.minutes, 0), 23);
      const future = await hours.getHoursLogForFamilyBetween(familyA, '2026-09-11', '2026-09-11');
      assert.equal(future[0].minutes, 600);
    });
    await test('actual scoped archive read and chat agree on child, dates, shared time and recorded days', async () => {
      const scope = { childId: childA, from: today, through: today, includeShared: true };
      const record = await recordExport.getHoursExportRecord(familyA, scope);
      assert.equal(record.rows.length, 2);
      const preview = recordExport.buildHoursRecordPreview(record, scope);
      assert.equal(preview.totalMinutes, 23);
      assert.equal(preview.byChild[0].recordedDays, 1);
      assert.equal(preview.byChild[0].childId, childA);
      for (const mode of ['caller', 'pinned']) {
        const withShared = await execute(mode, 'all', { childId: childA, from: today, through: today });
        assert.equal(withShared.totalMinutes, preview.totalMinutes);
        assert.deepEqual(JSON.parse(JSON.stringify(withShared.byChild)), [{ childId: childA, minutes: 23 }]);
        assert.deepEqual(JSON.parse(JSON.stringify(withShared.byEntryScope)), [{ childId: childA, minutes: 20 }, { childId: null, minutes: 3 }]);
        assert.equal(withShared.recordedDaysByChild[0].recordedDays, 1);
        assert.equal(withShared.periodLabel, 'Selected dates');
        const withoutShared = await execute(mode, 'all', { childId: childA, from: today, through: today, includeShared: false });
        assert.equal(withoutShared.totalMinutes, 20);
        assert.deepEqual(JSON.parse(JSON.stringify(withoutShared.byChild)), [{ childId: childA, minutes: 20 }]);
        const family = await execute(mode, 'all', { from: today, through: today });
        assert.deepEqual(JSON.parse(JSON.stringify(family.byChild)), [{ childId: childA, minutes: 23 }]);
        const foreign = await execute(mode, 'all', { childId: childB });
        assert.equal(foreign.found, null); assert(!('totalMinutes' in foreign));
        const invalid = await execute(mode, 'all', { from: '2026-02-29' });
        assert.equal(invalid.complete, false); assert(!('totalMinutes' in invalid));
      }
      const noShared = await recordExport.getHoursExportRecord(familyA, { ...scope, includeShared: false });
      assert.equal(noShared.rows.length, 1); assert.equal(noShared.rows[0].minutes, 20);
      const full = await recordExport.getHoursExportRecord(familyA);
      assert.equal(full.rows.length, 5); assert.equal(full.rows.reduce((n, row) => n + row.minutes, 0), 638);
      await assert.rejects(recordExport.getHoursExportRecord(familyA, { ...scope, childId: childB }), /not in this family/u);
      const other = await recordExport.getHoursExportRecord(familyB);
      assert.equal(other.rows.length, 1); assert.equal(other.rows[0].childId, childB);
    });
    await test('family local midnight changes current anniversary consistently', async () => {
      await sql`update public.families set time_zone = 'America/Los_Angeles' where id = ${familyA}`;
      for (const mode of ['caller', 'pinned']) { const r = await execute(mode); assert.equal(r.since, '2025-09-10'); assert.equal(r.through, '2026-09-09'); assert.equal(r.totalMinutes, 15); }
      await sql`update public.families set time_zone = 'America/New_York', school_year_start_on = null where id = ${familyA}`;
      for (const mode of ['caller', 'pinned']) { const r = await execute(mode); assert.equal(r.period, 'all'); assert.equal(r.since, null); assert.equal(r.totalMinutes, 38); }
      await sql`update public.families set school_year_start_on = '2020-09-10' where id = ${familyA}`;
    });
    await test('rowset caps and missing counts refuse list totals while scalar summaries remain exact', async () => {
      policy.cap = 1;
      assert.equal((await hours.getHoursLogForFamily(familyA)).complete, false);
      assert.equal((await execute('caller')).complete, true);
      await assert.rejects(hours.getHoursMinutesBySubjectForChild(familyA, childA, today, '2020-09-10'), /incomplete/u);
      policy.cap = 3000; policy.omitCount = true;
      assert.equal((await hours.getHoursLogForFamily(familyA)).complete, false);
      assert.equal((await execute('caller')).totalMinutes, 23);
      policy.omitCount = false;
    });
    await test('actual HTTP read error and missing auth never claim zero', async () => {
      policy.failHours = true;
      await assert.rejects(hours.getHoursLogForFamily(familyA));
      const failed = await execute('caller'); assert.equal(failed.found, null); assert.equal(failed.complete, false); assert(!('totalMinutes' in failed));
      policy.failHours = false;
      const absent = await tool.execute(tool.inputSchema.parse({}), { session: { auth: {} } });
      assert.equal(absent.found, null); assert.equal(absent.complete, false);
    });
    await test('3001 rows yield complete chat and CSV records while capped Progress refuses a partial total', async () => {
      await sql`delete from public.hours_log where family_id = ${familyA}`;
      await sql`insert into homa_test_fixture.hours_log (family_id, child_id, subject, minutes, happened_on, source, note, custom_label)
        select ${familyA}, ${childA}, 'spanish', 1, '2026-09-10'::date, 'chat', 'Synthetic bounded row ' || i, 'Bounded row ' || i
        from generate_series(1, 3001) i`;
      const caller = await hours.getHoursLogForFamily(familyA); assert.equal(caller.rows.length, 3000); assert.equal(caller.complete, false);
      const serverRead = await pinned.readHoursSummaryPinned(familyA, { period: 'all' }, new Date(instant)); assert.equal(serverRead.entryCount, 3001); assert.equal(serverRead.totalMinutes, 3001); assert.equal(serverRead.entries.length, 20);
      const archive = await recordExport.getHoursExportRecord(familyA);
      assert.equal(archive.rows.length, 3001);
      assert.equal(recordExport.renderHoursCsv(archive.rows).trimEnd().split('\r\n').length, 3002);
      const preview = recordExport.buildHoursRecordPreview(archive, { childId: null, from: null, through: null, includeShared: true });
      assert.equal(preview.totalMinutes, 3001); assert.equal(preview.entryCount, 3001); assert.equal(preview.entries.length, 20);
      for (const mode of ['caller', 'pinned']) { const r = await execute(mode); assert.equal(r.found, 3001); assert.equal(r.totalMinutes, 3001); assert.equal(r.complete, true); }
      await assert.rejects(hours.getHoursMinutesBySubjectForChild(familyA, childA, today, '2020-09-10'), /incomplete/u);
      policy.cap = 1000; assert.equal((await hours.getHoursLogForFamily(familyA)).rows.length, 1000); assert.equal((await execute('caller')).totalMinutes, 3001); policy.cap = 3000;
    });
    await test('exact 3000 and true zero counts remain complete; pack cap-plus-one remains truthful', async () => {
      await sql`delete from public.hours_log where family_id = ${familyA} and note = 'Synthetic bounded row 3001'`;
      assert.equal((await hours.getHoursLogForFamily(familyA)).complete, true);
      assert.equal((await pinned.readHoursSummaryPinned(familyA, { period: 'all' }, new Date(instant))).entryCount, 3000);
      await sql`insert into homa_test_fixture.hours_log (family_id, child_id, subject, minutes, happened_on, source, note, custom_label)
        select ${familyA}, ${childA}, 'spanish', 1, '2026-09-10'::date, 'chat', 'Synthetic pack row ' || i, 'Pack row ' || i
        from generate_series(1, 7001) i`;
      const records = await pack.getStatePackRecords(familyA, today, today);
      assert.equal(records.entries.length, 10000); assert.equal(records.truncated, true);
      await sql`delete from public.hours_log where family_id = ${familyA}`;
      assert.equal((await hours.getHoursLogForFamily(familyA)).complete, true);
      assert.equal((await pinned.readHoursSummaryPinned(familyA, { period: 'all' }, new Date(instant))).entryCount, 0);
      for (const mode of ['caller', 'pinned']) { const r = await execute(mode); assert.equal(r.found, 0); assert.equal(r.totalMinutes, 0); assert.equal(r.complete, true); }
    });
    console.log(JSON.stringify({ suite: 'Hours school-year reader PostgreSQL contract', tests: results, sourceHashes,
      boundaries: 'Real PostgreSQL/RLS and actual reader source/Supabase SDK; synthetic session tokens and local read-only REST adapter. No actual PostgREST server, Next cookie runtime, model or production service.' }));
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log('Prepared contract only. No database connection or execution. The existing disposable Planner PostgreSQL harness invokes this function.');
}
