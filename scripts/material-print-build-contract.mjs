#!/usr/bin/env node
// Execute the real compiled print GET and native PDF worker from only its NFT files.
// Auth/data and the single synthetic Blob read are fixture seams. No server or credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const rel = relative(root, file); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); };
const routeRelative = 'apps/web/.next/server/app/api/materials/[id]/print/pdf/route.js';

if (process.argv[2] === '--child') {
  const root = resolve(process.argv[3]);
  assert.ok(inside(root, script));
  const require = createRequire(import.meta.url);
  const Module = require('node:module');
  const nativeLoad = Module._load;
  const nativeWorker = require('node:worker_threads').Worker;
  const id = '11111111-1111-4111-8111-111111111111';
  const familyId = '22222222-2222-4222-8222-222222222222';
  const blobUrl = `https://fixture.public.blob.vercel-storage.com/families/${familyId}/materials/synthetic.pdf`;
  const db = Object.freeze({ fixtureOnly: true });
  const active = { id, title: 'Synthetic three-page worksheet', status: 'final', revisesId: null, pageCount: 3, pageRoles: ['child', 'answer_key', 'parent_guide'] };
  const material = { id, title: active.title, status: 'final', kind: 'worksheet', source: 'html', skill: null, subject: null, curriculum: null, theme: null, characters: [], childId: null, previewUrl: 'https://fixture.invalid/unused.jpg', pdfUrl: blobUrl, createdAt: '2026-09-06T00:00:00Z', pageCount: 3, pagePreviewUrls: null, sources: [] };
  const counts = { auth: 0, material: 0, active: 0, fetch: 0 };
  const seams = new Set();
  const loaded = new Set();
  const workers = [];
  const workerExits = [];
  const wrapped = new WeakMap();
  let pdfBytes;
  let fault = false;
  let signedIn = true;
  let foreign = false;
  let stale = false;
  const auth = async () => { counts.auth++; return signedIn ? { familyId, userId: '33333333-3333-4333-8333-333333333333', supabase: db } : null; };
  const checkRead = (caller, family, selected) => { assert.equal(caller, db); assert.equal(family, familyId); assert.equal(selected, id); };
  const replacements = {
    resolveApiFamily: auth,
    getMaterialCaller: async (...args) => { checkRead(...args); counts.material++; return { ...material, pdfUrl: foreign ? blobUrl.replace(familyId, 'foreign') : blobUrl }; },
    resolveActiveMaterialCaller: async (...args) => { checkRead(...args); counts.active++; return stale ? null : { ...active, pageRoles: [...active.pageRoles] }; },
  };
  function replaceSeams(exports) {
    if (!exports || (typeof exports !== 'object' && typeof exports !== 'function')) return exports;
    if (wrapped.has(exports)) return wrapped.get(exports);
    const names = Object.keys(replacements).filter((name) => typeof exports[name] === 'function');
    if (!names.length) return exports;
    const replacement = { ...exports };
    for (const name of names) { replacement[name] = replacements[name]; seams.add(name); }
    wrapped.set(exports, replacement);
    return replacement;
  }
  class ObservedWorker extends nativeWorker {
    constructor(source, options) {
      assert.equal(options.eval, true);
      assert.equal(typeof options.workerData.pdfLibPath, 'string');
      assert.ok(isAbsolute(options.workerData.pdfLibPath));
      assert.ok(inside(root, realpathSync(options.workerData.pdfLibPath)));
      assert.ok(options.workerData.bytes instanceof Uint8Array);
      assert.equal(options.resourceLimits.maxOldGenerationSizeMb, 256);
      assert.equal(options.resourceLimits.stackSizeMb, 4);
      const receipt = { pdfLibPath: relative(root, options.workerData.pdfLibPath), inputBytes: options.workerData.bytes.length, injectedNumericFault: fault, exited: false };
      workers.push(receipt);
      super(source, fault ? { ...options, workerData: { ...options.workerData, pdfLibPath: 546091 } } : options);
      workerExits.push(new Promise((resolve) => this.once('exit', () => { receipt.exited = true; resolve(); })));
    }
  }
  Module._load = function(request, parent, isMain) {
    const exports = nativeLoad.call(this, request, parent, isMain);
    if (request === 'node:worker_threads' || request === 'worker_threads') return { ...exports, Worker: ObservedWorker };
    if (!isBuiltin(request)) {
      const file = Module._resolveFilename(request, parent, isMain);
      if (isAbsolute(file)) loaded.add(relative(root, file));
      if (file.includes(`${sep}.next${sep}server${sep}chunks${sep}`) && Array.isArray(exports)) {
        // Turbopack's chunk registration array contains IDs and module factories.
        for (let index = 0; index < exports.length; index++) if (typeof exports[index] === 'function' && !exports[index].fixtureWrapped) {
          const factory = exports[index];
          const wrappedFactory = function(context, ...rest) {
            const proxy = new Proxy(context, { get(target, key, receiver) {
              if (key === 'i') return (moduleId) => replaceSeams(target.i(moduleId));
              return Reflect.get(target, key, receiver);
            } });
            return factory(proxy, ...rest);
          };
          wrappedFactory.fixtureWrapped = true;
          exports[index] = wrappedFactory;
        }
      }
    }
    return exports;
  };
  globalThis.fetch = async (target, options) => {
    assert.equal(String(target), blobUrl);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(!options.signal.aborted);
    counts.fetch++;
    return new Response(Uint8Array.from(pdfBytes), { headers: { 'Content-Length': String(pdfBytes.length), 'Content-Type': 'application/pdf' } });
  };
  assert.equal(Object.values(require.cache).filter((entry) => entry?.exports?.PDFDocument).length, 0, 'fixture must not preload pdf-lib');
  const compiled = require(join(root, routeRelative));
  const GET = compiled.routeModule?.userland?.GET;
  assert.equal(typeof GET, 'function', 'real compiled UserlandGET must exist');
  assert.deepEqual([...seams].sort(), Object.keys(replacements).sort());
  const libraries = Object.values(require.cache).filter((entry) => entry?.exports?.PDFDocument && entry.exports.PDFName && entry.exports.PDFArray);
  assert.equal(libraries.length, 1, 'compiled route itself must load one native pdf-lib');
  const library = libraries[0].exports;
  const { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } = library;
  const pdf = await PDFDocument.create();
  for (const text of ['CHILD_ONLY', 'ANSWER_KEY_SECRET', 'PARENT_GUIDE']) pdf.addPage([612, 792]).drawText(text, { x: 40, y: 700, size: 24 });
  pdfBytes = await pdf.save({ useObjectStreams: false });
  async function pageStreams(bytes) {
    const document = await PDFDocument.load(bytes);
    return document.getPages().map((page) => {
      const streams = page.node.Contents(); assert.ok(streams instanceof PDFArray);
      return streams.asArray().map((ref) => { const stream = document.context.lookup(ref); assert.ok(stream instanceof PDFRawStream); return Buffer.from(decodePDFRawStream(stream).decode()).toString('ascii'); }).join('\n');
    });
  }
  const originalStreams = await pageStreams(pdfBytes);
  async function invoke(includeAnswerKey = false) {
    const params = new URLSearchParams({ pageCount: '3', pages: includeAnswerKey ? '0,1,2' : '0,2', copies: '2', includeAnswerKey: String(includeAnswerKey), answerKeyExcluded: String(!includeAnswerKey) });
    return GET(new Request(`https://fixture.invalid/api/materials/${id}/print/pdf?${params}`, { signal: AbortSignal.timeout(12000) }), { params: Promise.resolve({ id }) });
  }
  const cases = [];
  for (const include of [false, true]) {
    const before = { ...counts };
    const response = await invoke(include);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition'), /inline; filename="homa-selected-pages.pdf"/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual(await pageStreams(bytes), include ? originalStreams : [originalStreams[0], originalStreams[2]]);
    const document = await PDFDocument.load(bytes);
    assert.deepEqual(document.getPages().map((page) => page.getSize()), Array.from({ length: include ? 3 : 2 }, () => ({ width: 612, height: 792 })));
    assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value - before[key]])), { auth: 1, material: 2, active: 2, fetch: 1 });
    cases.push({ case: include ? 'all-original-pages' : 'answer-key-excluded', status: response.status, pages: document.getPageCount(), bytes: bytes.length, sha256: sha(bytes), exactOriginalPageStreams: true });
  }
  fault = true;
  const broken = await invoke();
  assert.equal(broken.status, 422);
  assert.equal((await broken.json()).ready, false);
  cases.push({ case: 'numeric-worker-path-fault-injection', status: 422, note: 'Intentional injection of the observed old compiled numeric value, not execution of a preserved old build.' });
  fault = false;
  for (const state of ['signed-out', 'foreign-blob', 'stale-selection']) {
    signedIn = state !== 'signed-out'; foreign = state === 'foreign-blob'; stale = state === 'stale-selection';
    const beforeFetch = counts.fetch; const beforeWorkers = workers.length;
    const response = await invoke(); assert.equal(response.status, signedIn ? 409 : 401);
    assert.equal((await response.json()).ready, false);
    assert.equal(counts.fetch, beforeFetch); assert.equal(workers.length, beforeWorkers);
    cases.push({ case: state, status: response.status, fetches: 0, workers: 0 });
  }
  // The implementation requests termination; prove each native worker actually exits.
  let exitTimer;
  try {
    await Promise.race([Promise.all(workerExits), new Promise((_resolve, reject) => {
      exitTimer = setTimeout(() => reject(new Error('Native print worker did not exit within five seconds')), 5000);
    })]);
  } finally { clearTimeout(exitTimer); }
  assert.ok(workers.every((worker) => worker.exited));
  assert.equal(workers.length, 3);
  assert.equal(existsSync(join(root, 'apps/web/node_modules/pdf-lib')), false);
  assert.ok([...loaded].some((file) => file.includes('/pdf-lib@')));
  assert.ok(workers.every((worker) => worker.pdfLibPath === relative(root, libraries[0].filename)));
  console.log(JSON.stringify({ passed: true, compiledGet: true, nativeWorkers: workers, fixtureSeams: [...seams].sort(), originalAppPackageLinkAbsent: true, loadFence: 'All native file resolution confined to relocated NFT tree, including inherited worker preload', loadedFileCount: loaded.size, cases }));
} else {
  assert.equal(process.argv.length, 2, 'Run with no arguments after the Next production build.');
  const source = resolve(dirname(script), '..');
  const route = join(source, routeRelative);
  const nft = `${route}.nft.json`;
  assert.ok(existsSync(route) && existsSync(nft), 'A completed Next build is required.');
  const files = JSON.parse(readFileSync(nft, 'utf8')).files;
  assert.ok(Array.isArray(files) && files.length > 0 && files.length <= 20000);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'homa-print-build-')));
  let totalBytes = 0;
  try {
    const entries = [...new Set([route, nft, ...files.map((file) => resolve(dirname(nft), file))])];
    for (const file of entries) {
      assert.ok(inside(source, file), 'NFT path must stay in the monorepo');
      assert.ok(!relative(source, file).split(sep).some((part) => /^\.env(?:\.|$)/.test(part) || /\.(?:key|crt)$/.test(part)), 'No secret-bearing file in trace');
      const stat = lstatSync(file);
      const destination = join(root, relative(source, file));
      mkdirSync(dirname(destination), { recursive: true });
      if (stat.isSymbolicLink()) {
        const target = resolve(dirname(file), readlinkSync(file));
        assert.ok(inside(source, target), 'NFT symlink must remain within monorepo');
        symlinkSync(relative(dirname(destination), join(root, relative(source, target))), destination);
      } else {
        assert.ok(stat.isFile());
        totalBytes += stat.size; assert.ok(totalBytes <= 256 * 1024 * 1024);
        copyFileSync(file, destination);
      }
    }
    for (const file of entries) assert.ok(inside(root, realpathSync(join(root, relative(source, file)))), 'Every traced symlink must resolve inside the copy');
    const guard = join(root, 'native-fixture-guard.cjs');
    writeFileSync(guard, `const Module=require('node:module');const path=require('node:path');const fs=require('node:fs');const root=${JSON.stringify(root)};const resolve=Module._resolveFilename;Module._resolveFilename=function(...args){const result=resolve.apply(this,args);if(path.isAbsolute(result)){const real=fs.realpathSync(result);const rel=path.relative(root,real);if(rel==='..'||rel.startsWith('../')||path.isAbsolute(rel))throw new Error('Fixture forbids external native file: '+real);}return result;};const deny=()=>{throw new Error('Fixture forbids network');};for(const name of ['node:http','node:https']){const m=require(name);m.request=deny;m.get=deny;}require('node:net').Socket.prototype.connect=deny;require('node:tls').connect=deny;require('node:dgram').createSocket=deny;const dns=require('node:dns');dns.lookup=deny;dns.resolve=deny;globalThis.fetch=deny;Module.syncBuiltinESMExports();\n`);
    const childScript = join(root, 'contract-runner.mjs'); copyFileSync(script, childScript);
    const result = spawnSync(process.execPath, ['--require', guard, childScript, '--child', root], { cwd: join(root, 'apps/web'), env: { PATH: dirname(process.execPath), NODE_ENV: 'production', TZ: 'UTC' }, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stdout || ''); process.stderr.write(result.stderr || ''); throw result.error ?? new Error(`Compiled print contract child exited ${result.status}`); }
    const receipt = JSON.parse(result.stdout.trim());
    console.log(JSON.stringify({ ...receipt, traceFileCount: entries.length, traceBytes: totalBytes, traceSha256: sha(readFileSync(nft)), routeSha256: sha(readFileSync(route)), printSourceSha256: sha(readFileSync(join(source, 'apps/web/lib/materials/print-pdf.ts'))), scriptSha256: sha(readFileSync(script)), environment: 'Only PATH, NODE_ENV and TZ; no app env files or credentials', cleanup: 'Owned relocation removed in finally' }, null, 2));
  } finally { rmSync(root, { recursive: true, force: true }); }
}
