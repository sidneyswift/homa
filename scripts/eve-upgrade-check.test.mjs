import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { dependencyFiles } from "./eve-upgrade-install.mjs";
import { UPGRADE_QUESTION } from "./eve-upgrade-proof.mjs";

const execute = promisify(execFile);
const scripts = path.dirname(fileURLToPath(import.meta.url));
const fakeCorepack = `#!${process.execPath}
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
const root = process.env.SYNTHETIC_UPGRADE_ROOT;
const args = process.argv.slice(2);
const mode = process.env.SYNTHETIC_UPGRADE_MODE;
const manifest = JSON.parse(readFileSync(path.join(root, 'apps/web/package.json')));
if (args[0] !== 'pnpm') process.exit(8);
if (args[1] === 'install') {
  appendFileSync(path.join(root,'.synthetic-installs'), JSON.stringify({args, dependencies:manifest.dependencies})+'\\n');
  if (!args.includes('--frozen-lockfile') || mode === 'restore-drift') writeFileSync(path.join(root,'pnpm-lock.yaml'),'synthetic generated lock');
  if (mode === 'install-fail' && manifest.dependencies.eve === '0.54.3') process.exit(9);
  for (const name of ['eve','ai']) writeFileSync(path.join(root,'apps/web/node_modules',name,'package.json'),JSON.stringify({name,version:manifest.dependencies[name].replace(/^\\^/,'')}));
  process.exit(0);
}
if (args[1] !== 'exec' || args[2] !== 'eve' || args[3] !== 'dev') process.exit(7);
const port = Number(args[args.indexOf('--port')+1]);
if(mode==='interrupt' && manifest.dependencies.eve==='0.54.3') writeFileSync(path.join(root,'.synthetic-candidate-ready'),'ready');
const sessionFile = path.join(root,'.synthetic-session');
const baseline = JSON.parse(process.env.SYNTHETIC_UPGRADE_EVENTS);
createServer(async (request,response) => {
  response.setHeader('content-type','application/json');
  if(request.url === '/eve/v1/health') { if(mode==='interrupt' && manifest.dependencies.eve==='0.54.3') return; return response.end('{}'); }
  if(request.method === 'GET') {
    const state=JSON.parse(readFileSync(sessionFile));
    const events=state.probe ? [...baseline,
      {type:'turn.started',data:{turnId:'resumed-turn'}},
      {type:'message.completed',data:{turnId:'resumed-turn',message:state.probe,finishReason:'stop'}},
      {type:'turn.completed',data:{turnId:'resumed-turn'}},
      {type:'session.waiting',data:{wait:'next-user-message'}}] : baseline;
    return response.end(events.map(event=>JSON.stringify(event)).join('\\n')+'\\n');
  }
  let raw='';for await (const chunk of request) raw+=chunk;
  const body=JSON.parse(raw);
  appendFileSync(path.join(root,'.synthetic-posts'),request.url+'\\n');
  if(request.url === '/eve/v1/session') {
    writeFileSync(sessionFile,'{}'); response.statusCode=202;
    response.setHeader('x-eve-session-id','fixture-session');
    return response.end(JSON.stringify({ok:true,sessionId:'fixture-session',continuationToken:'fixture-token'}));
  }
  if('continuationToken' in body) { response.statusCode=400; return response.end('{}'); }
  writeFileSync(sessionFile,JSON.stringify({probe:body.inputResponses[0].text}));
  response.statusCode=202;
  response.end(JSON.stringify({sessionId:mode==='wrong-session'?'wrong-session':'fixture-session',deliveryId:'fixture-delivery'}));
}).listen(port,'127.0.0.1');
`;

async function fixture(t, mode = "success") {
  const root = await mkdtemp(path.join(tmpdir(), "eve-upgrade-orchestration-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"));
  for (const file of ["eve-upgrade-check.mjs", "eve-upgrade-install.mjs", "eve-upgrade-proof.mjs"]) {
    await cp(path.join(scripts, file), path.join(root, "scripts", file));
  }
  for (const file of ["eve-empty-delivery-guard-check.mjs", "eve-stream-max-duration-check.mjs"]) {
    await writeFile(path.join(root, "scripts", file), 'console.log("Synthetic protection check");\n');
  }
  const manifest = { dependencies: { eve: "0.19.0", ai: "^7.0.14" }, devDependencies: { "eve-legacy-protocol": "npm:eve@0.19.0" } };
  await mkdir(path.join(root, "apps/web"), { recursive: true });
  await writeFile(path.join(root, "apps/web/package.json"), JSON.stringify(manifest, null, 4) + "\n\n");
  await writeFile(path.join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\npatchedDependencies:\n  eve@0.19.0: patches/eve@0.19.0.patch\n");
  await writeFile(path.join(root, "pnpm-lock.yaml"), "original lock bytes\n\n");
  await mkdir(path.join(root, "patches"));
  for (const version of ["0.19.0", "0.54.3"]) await writeFile(path.join(root, `patches/eve@${version}.patch`), "synthetic patch\n");
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    await mkdir(path.join(root, "apps/web/node_modules", name), { recursive: true });
    await writeFile(path.join(root, "apps/web/node_modules", name, "package.json"), JSON.stringify({ name, version: version.replace(/^\^/, "") }));
  }
  await mkdir(path.join(root, "bin"));
  await writeFile(path.join(root, "bin/corepack"), fakeCorepack, { mode: 0o755 });
  await writeFile(path.join(root, ".gitignore"), "node_modules/\n.synthetic*\n");
  for (const args of [["init", "-q"], ["add", "."], ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Synthetic test", "-c", "user.email=synthetic@example.invalid", "commit", "-qm", "fixture"]]) {
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
  }
  const initial = new Map(await Promise.all(dependencyFiles.map(async file => [file, await readFile(path.join(root, file))])));
  const port = await new Promise((resolve, reject) => {
    const socket = createServer();socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => { const value = socket.address().port; socket.close(() => resolve(value)); });
  });
  const events = [
    { type: "turn.started", data: { turnId: "original-turn" } },
    { type: "input.requested", data: { turnId: "original-turn", requests: [{
      requestId: "question-one", prompt: UPGRADE_QUESTION, allowFreeform: true,
      action: { kind: "tool-call", toolName: "ask_question", callId: "question-call", input: {} },
    }] } },
    { type: "turn.completed", data: { turnId: "original-turn" } },
    { type: "session.waiting", data: { wait: "next-user-message" } },
  ];
  const env = { ...process.env, PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
    HOMA_EVAL_FAMILY_FIXTURE: "1", SYNTHETIC_UPGRADE_ROOT: root, SYNTHETIC_UPGRADE_MODE: mode, SYNTHETIC_UPGRADE_EVENTS: JSON.stringify(events) };
  delete env.VERCEL; delete env.VERCEL_ENV; delete env.HOMA_EVAL_ALLOW_PROD_WRITES;
  if (mode === "missing-family") delete env.HOMA_EVAL_FAMILY_FIXTURE;
  if (mode === "hosted-family") env.VERCEL = "1";
  if (mode === "production-writes") env.HOMA_EVAL_ALLOW_PROD_WRITES = "1";
  async function run(preflight = false) {
    let result;
    const execution = execute(process.execPath, [path.join(root, "scripts/eve-upgrade-check.mjs"),
      "--to", "0.54.3", "--port", String(port), ...(preflight ? ["--preflight"] : [])], { cwd: root, env, timeout: 30_000 });
    execution.catch(() => {});
    if (mode === "interrupt") {
      const deadline = Date.now() + 10_000;
      let ready = false;
      while (Date.now() < deadline) {
        try { await readFile(path.join(root, ".synthetic-candidate-ready")); ready = true; break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.ok(ready, "Candidate server did not reach the interruption fixture");
      execution.child.kill("SIGINT");
    }
    try { result = { ...await execution, code: 0 }; }
    catch (error) { result = error; }
    const directory = result.stdout?.match(/Original dependency files and evidence: (.+)/)?.[1];
    if (directory) {
      t.after(() => rm(directory, { recursive: true, force: true }));
      result.receipt = JSON.parse(await readFile(path.join(directory, "receipt.json"), "utf8"));
    }
    return result;
  }
  return { root, initial, run };
}

async function assertRestored(f) {
  for (const [file, bytes] of f.initial) assert.ok((await readFile(path.join(f.root, file))).equals(bytes), file);
  for (const [name, version] of [["eve", "0.19.0"], ["ai", "7.0.14"]]) {
    assert.equal(JSON.parse(await readFile(path.join(f.root, "apps/web/node_modules", name, "package.json"))).version, version);
  }
}

test("preflight changes no dependency files and never invokes the installer", async t => {
  const f = await fixture(t);
  const result = await f.run(true);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).cleanCheckout, true);
  await assertRestored(f);
  await assert.rejects(readFile(path.join(f.root, ".synthetic-installs")), { code: "ENOENT" });
});

test("full orchestration accepts handle acknowledgements, proves a new turn, and restores exact state", async t => {
  const f = await fixture(t);
  const result = await f.run();
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.receipt.success, true);
  assert.equal(result.receipt.restored, true);
  assert.equal(Object.keys(result.receipt.checks).length, 4);
  await assertRestored(f);
  const installs = (await readFile(path.join(f.root, ".synthetic-installs"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(installs.map(item => [item.dependencies.eve, item.dependencies.ai]),
    [["0.19.0", "7.0.14"], ["0.54.3", "7.0.93"], ["0.19.0", "^7.0.14"]]);
  assert.ok(installs.at(-1).args.includes("--frozen-lockfile"));
  assert.equal((await readFile(path.join(f.root, ".synthetic-posts"), "utf8")).trim().split("\n").length, 2);
});

for (const mode of ["install-fail", "wrong-session"]) test(`${mode} fails the real runner and still restores dependencies`, async t => {
  const f = await fixture(t, mode);
  const result = await f.run();
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.receipt.success, false);
  assert.equal(result.receipt.restored, true);
  await assertRestored(f);
});

test("restoration drift cannot produce a successful upgrade receipt", async t => {
  const f = await fixture(t, "restore-drift");
  const result = await f.run();
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.receipt.success, false);
  assert.equal(result.receipt.restored, false);
  assert.match(result.receipt.restorationError, /restoration changed pnpm-lock/);
});


test("interruption stops the owned server and restores exact dependencies", async t => {
  const f = await fixture(t, "interrupt");
  const result = await f.run();
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.receipt.success, false);
  assert.equal(result.receipt.interrupted, true);
  assert.equal(result.receipt.restored, true);
  await assertRestored(f);
});

for (const mode of ["missing-family", "hosted-family", "production-writes"]) test(`${mode} rejects setup before installs or model requests`, async t => {
  const f = await fixture(t, mode);
  const preflight = await f.run(true);
  assert.equal(JSON.parse(preflight.stdout).familyFixtureReady, false);
  const result = await f.run();
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Enable the local fictional family/);
  await assertRestored(f);
  for (const name of [".synthetic-installs", ".synthetic-posts"]) {
    await assert.rejects(readFile(path.join(f.root, name)), { code: "ENOENT" });
  }
});
