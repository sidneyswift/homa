import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

// The existing CI Planner/Hours disposable PostgreSQL harness calls this module.
// Real caller roles exercise grants plus RLS; the SDK projection uses loopback only.
export async function runHoursReceiptPrivacyContract({ sql, require, family, memberId, childId }) {
  const url = new URL(process.env.HOMA_EVAL_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/homa_eval');
  assert.equal(url.username, 'homa_eval');
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'POSTGRES_URL', 'HOMA_FAMILY_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN']) assert.ok(!process.env[key]);
  const [location] = await sql`select current_setting('data_directory') as directory`;
  assert.match(location.directory, /homa-eval-sandbox/);
  const checks = [];
  const pass = name => { checks.push(name); console.log('PASS ' + name); };
  const partner = randomUUID(), outsider = randomUUID();
  await sql`insert into auth.users(id,email) values(${partner},${partner + '@example.test'}),(${outsider},${outsider + '@example.test'})`;
  const [otherFamily] = await sql`insert into families(context) values('{}') returning id`;
  await sql`insert into family_members(family_id,user_id,role) values(${family},${partner},'parent'),(${otherFamily.id},${outsider},'parent')`;
  const actor = (user, work, role = 'authenticated') => sql.begin(async tx => {
    await tx`set local statement_timeout='15s'`;
    await tx`set local lock_timeout='5s'`;
    if (role === 'anon') await tx`set local role anon`;
    else await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${user ?? ''},true)`;
    return work(tx);
  });
  const source = randomUUID(), context = randomUUID();
  const sourceQuote = 'Synthetic private parent context. Reading took 19 minutes. This complete original quote is not the public Hours annotation.';
  const contextQuote = 'We read Make Way for Ducklings. Synthetic private discussion after the title.';
  const workContext = { sourceMessageId: context, sourceQuote: contextQuote, workTitle: 'Make Way for Ducklings' };
  const publicNote = 'Make Way for Ducklings · Reading';
  for (const [id, text, created] of [[context, contextQuote, '2026-09-06T10:00:00Z'], [source, sourceQuote, '2026-09-06T11:00:00Z']]) {
    await sql`insert into conversation_messages(id,family_id,member_user_id,session_id,sequence,channel,role,visibility,content,created_at)
      values(${id},${family},${partner},${randomUUID()},1,'web','user','family',${text},${created})`;
  }
  const [written] = await actor(partner, tx => tx`select record_hours_operation_v2(${source}::uuid,1,${sourceQuote},${childId}::uuid,'reading',19,null,${publicNote},null,null,${tx.json(workContext)}) as receipt`);
  assert.equal(written.receipt.inserted, true);
  const operationKey = 'log-hours:' + source + ':1';
  const [raw] = await sql`select source_quote,request,resolved_date::text from learning_write_operations where family_id=${family} and operation_key=${operationKey}`;
  assert.equal(raw.source_quote, sourceQuote);
  assert.deepEqual(raw.request.workContext, workContext);
  assert.equal((await actor(memberId, tx => tx`select id from conversation_messages where id in (${source},${context})`)).length, 0);
  for (const user of [memberId, partner]) {
    const [hours] = await actor(user, tx => tx`select note,minutes from hours_log where id=${written.receipt.entry.id}`);
    assert.deepEqual(hours, { note: publicNote, minutes: 19 });
    for (const column of ['id', 'source_message_id', 'source_quote', 'request', 'expected_hours_ids', 'outcome', 'created_at', '*']) {
      await assert.rejects(() => actor(user, tx => tx.unsafe(`select ${column} from public.learning_write_operations`)), { code: '42501' });
    }
    await assert.rejects(() => actor(user, tx => tx`select resolved_date from learning_write_operations where source_message_id=${source}`), { code: '42501' });
    await assert.rejects(() => actor(user, tx => tx`select resolved_date from learning_write_operations where request->>'source'='chat'`), { code: '42501' });
  }
  pass('Actual partner source RLS hides both messages; Hours stays shared while all private receipt columns and filter probes are denied');
  const metadata = tx => tx`select resolved_date::text from learning_write_operations where family_id=${family} and operation_key=${operationKey}`;
  assert.deepEqual(Array.from(await actor(memberId, metadata)), [{ resolved_date: raw.resolved_date }]);
  assert.deepEqual(Array.from(await actor(partner, metadata)), [{ resolved_date: raw.resolved_date }]);
  assert.equal((await actor(outsider, metadata)).length, 0);
  await assert.rejects(() => actor(null, metadata, 'anon'), { code: '42501' });
  const privileges = await sql`select has_table_privilege('authenticated','public.learning_write_operations','SELECT') as full_read,
    has_table_privilege('authenticated','public.learning_write_operations','INSERT,UPDATE,DELETE') as writes,
    has_any_column_privilege('anon','public.learning_write_operations','SELECT') as anon_read,
    has_function_privilege('authenticated','public.require_completed_learning_write_operation()','EXECUTE') as direct_invariant`;
  assert.deepEqual(privileges[0], { full_read: false, writes: false, anon_read: false, direct_invariant: false });
  for (const operation of [tx => tx`update learning_write_operations set resolved_date='2026-09-05' where operation_key=${operationKey}`,
    tx => tx`delete from learning_write_operations where operation_key=${operationKey}`,
    tx => tx`insert into learning_write_operations(family_id,operation_key,resolved_date) values(${family},'denied-write','2026-09-06')`]) {
    await assert.rejects(() => actor(memberId, operation), { code: '42501' });
  }
  const pendingId = randomUUID();
  await assert.rejects(() => sql.begin(async tx => {
    await tx`insert into learning_write_operations(id,family_id,operation_key,request,resolved_date)
      values(${pendingId},${family},${'incomplete:' + pendingId},'{}','2026-09-06')`;
  }), { code: '23514' });
  assert.equal((await sql`select id from learning_write_operations where id=${pendingId}`).length, 0);
  pass('Private deferred invariant still rejects and rolls back a receipt without an outcome');
  pass('Exact retry-date projection is family-scoped; foreign/anonymous reads and all caller writes remain denied');

  const token = 'synthetic-receipt-' + randomUUID();
  let requests = 0;
  const server = createServer(async (req, res) => {
    try {
      assert.equal(req.method, 'GET');
      assert.equal(req.headers.authorization, 'Bearer ' + token);
      assert.ok(++requests <= 1);
      const parsed = new URL(req.url, 'http://127.0.0.1');
      assert.equal(parsed.pathname, '/rest/v1/learning_write_operations');
      assert.equal(parsed.searchParams.get('select'), 'resolved_date');
      assert.equal(parsed.searchParams.get('family_id'), 'eq.' + family);
      assert.equal(parsed.searchParams.get('operation_key'), 'eq.' + operationKey);
      assert.equal([...parsed.searchParams].length, 3);
      const rows = await actor(memberId, metadata);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: error.code ?? 'LOCAL', message: 'Local receipt read refused' }));
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 15_000;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(origin, 'synthetic-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: 'Bearer ' + token }, fetch: (input, init) => {
        assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, origin);
        return fetch(input, init);
      } } });
    const { data, error } = await client.from('learning_write_operations').select('resolved_date')
      .eq('family_id', family).eq('operation_key', operationKey).maybeSingle().abortSignal(AbortSignal.timeout(18_000));
    assert.equal(error, null);
    assert.deepEqual(data, { resolved_date: raw.resolved_date });
    assert.equal(requests, 1);
    pass('Actual Supabase SDK Voice retry-date query succeeds with column grants and authenticated RLS');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  return { checks, requests };
}
