// Slow, opt-in host proof: EVE_NATIVE_HOST_RESTART=1 node --test scripts/eve-native-host-restart.test.mjs
// Exercises disk-backed workflow checkpoints and actual channel HTTP delivery.
// Does not certify HTTP event streaming, production hosting, or mid-step effects.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = process.env.EVE_NATIVE_HOST_RESTART === "1";
const expectedFinal = 'Finished both questions: [{"optionId":"yes","status":"answered"},{"optionId":"no","status":"answered"}]';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function poll(label, inspect, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await inspect();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function files(directory) {
  try { return await readdir(directory); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

async function savedEvents(directory) {
  const chunks = join(directory, "streams", "chunks");
  const events = [];
  for (const name of (await files(chunks)).filter(name => name.includes("_user-chnk_") && name.endsWith(".bin")).sort()) {
    const bytes = await readFile(join(chunks, name));
    if (bytes[0] === 1) continue; // Local world's end-of-stream marker.
    assert.equal(bytes[0], 0, "Unknown local stream framing");
    let offset = 1;
    while (offset < bytes.length) {
      const length = bytes.readUInt32BE(offset);
      offset += 4;
      const value = bytes.subarray(offset, offset + length);
      assert.equal(value.length, length, "Incomplete persisted stream frame");
      offset += length;
      assert.equal(value.subarray(0, 4).toString(), "devl", "Unexpected installed stream serialization");
      const encoded = JSON.parse(value.subarray(4).toString());
      assert.deepEqual(encoded[0], ["Uint8Array", 1]);
      for (const line of Buffer.from(encoded[1], "base64").toString().split("\n").filter(Boolean)) events.push(JSON.parse(line));
    }
  }
  return events;
}

async function completedTurns(directory) {
  const steps = join(directory, "steps");
  const records = await Promise.all((await files(steps)).filter(name => name.endsWith(".json")).map(async name => JSON.parse(await readFile(join(steps, name), "utf8"))));
  return records.filter(step => step.stepName.endsWith("//turnStep") && step.status === "completed");
}

// Known failure, gh#1259: main's sandbox no-expiry template key (#1238,
// #1241) stops the restarted host from replaying the answer. The
// conversation rebuild this covers ships switched off; fix it and remove
// this skip before the rebuild or its env flags are turned on. Founder go
// to land #1215 past it, 2026-11-05.
const KNOWN_FAILURE = "gh#1259: replay after a hard restart fails with the sandbox no-expiry key";

test("native answer receipt survives hard host restart without consuming the next question", {
  skip: (!enabled && "Set EVE_NATIVE_HOST_RESTART=1 to run the isolated slow host regression") || KNOWN_FAILURE,
  timeout: 300_000,
}, async context => {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Eve requires Node 24 or newer");
  const port = await freePort();
  const directory = await mkdtemp(join(tmpdir(), "homa-native-host-regression-"));
  const data = join(directory, ".workflow-data");
  const origin = `http://127.0.0.1:${port}`;
  let child;
  let logs = "";
  const append = chunk => { logs = (logs + chunk.toString()).slice(-100_000); };
  const stop = async () => {
    if (!child) return;
    const owned = child;
    child = undefined;
    const exited = owned.exitCode !== null || owned.signalCode !== null
      ? Promise.resolve()
      : new Promise(resolve => owned.once("exit", resolve));
    if (owned.pid === undefined) return;
    try { process.kill(-owned.pid, "SIGKILL"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
    await Promise.race([exited, delay(5_000, undefined, { ref: false }).then(() => { throw new Error("Owned host did not exit"); })]);
  };
  const onAbort = () => {
    if (child?.pid === undefined) return;
    try { process.kill(-child.pid, "SIGKILL"); }
    catch (error) { if (error.code !== "ESRCH") append(error); }
  };
  context.signal.addEventListener("abort", onAbort, { once: true });
  const assertAlive = () => {
    context.signal.throwIfAborted();
    if (child?.exitCode !== null || child?.signalCode !== null) throw new Error("Fixture host exited unexpectedly");
  };
  const start = async () => {
    const env = {
      // Explicit allowlist, never inherit credentials or repository env files.
      HOME: process.env.HOME,
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
      TMPDIR: directory,
      NODE_ENV: "development",
      CI: "1",
      NO_COLOR: "1",
      WORKFLOW_TARGET_WORLD: "local",
      WORKFLOW_LOCAL_DATA_DIR: data,
      WORKFLOW_LOCAL_BASE_URL: origin,
    };
    const startOffset = logs.length;
    child = spawn(process.execPath, [join(directory, "host.mjs")], {
      cwd: directory, env, detached: true, stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", append);
    await poll("host startup", () => {
      assertAlive();
      return logs.slice(startOffset).includes("PROBE_HOST_READY");
    }, 90_000);
  };
  const post = async payload => {
    assertAlive();
    const response = await fetch(`${origin}/message`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "recovery-probe-1", ...(payload ? { payload } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const settledQuestion = async number => poll(`question ${number} and completed checkpoint`, async () => {
    assertAlive();
    const events = await savedEvents(data);
    const question = events.findLast(event => event.type === "input.requested" && event.data.requests.some(request => request.requestId === `question-${number}`));
    if (!question || !events.some(event => event.type === "session.waiting" && event.meta.at >= question.meta.at)) return;
    const turns = await completedTurns(data);
    if (!turns.some(turn => turn.completedAt >= question.meta.at)) return;
    return { question, turns, events };
  });
  try {
    await cp(join(root, "scripts/fixtures/eve-native-host"), directory, { recursive: true });
    await symlink(join(root, "apps/web/node_modules"), join(directory, "node_modules"), "dir");
    const hostModule = pathToFileURL(join(root, "apps/web/node_modules/eve/dist/src/internal/nitro/host/start-development-server.js")).href;
    await writeFile(join(directory, "host.mjs"), `import { createDevelopmentServer } from ${JSON.stringify(hostModule)};\nconst server = createDevelopmentServer(process.cwd(), { host: "127.0.0.1", port: ${port}, existing: "reject" });\nawait server.start();\nconsole.log("PROBE_HOST_READY");\n`);
    await start();
    const initial = await post();
    await settledQuestion(1);
    const answer1 = { idempotencyKey: "answer-1", inputResponses: [{ requestId: "question-1", optionId: "yes" }] };
    assert.equal((await post(answer1)).sessionId, initial.sessionId);
    const before = await settledQuestion(2);
    await stop();
    await start();
    assert.equal((await post(answer1)).sessionId, initial.sessionId);
    await poll("replayed answer dropped and checkpointed", async () => {
      assertAlive();
      return logs.includes("PROBE_DUPLICATE_DROPPED answer-1") && (await completedTurns(data)).length > before.turns.length;
    });
    const replayed = await savedEvents(data);
    assert.equal(replayed.filter(event => event.type === "input.requested").length, 2);
    assert.equal(replayed.filter(event => event.type === "message.completed").length, 0, "Replay must leave question 2 pending");
    assert.equal((logs.match(/PROBE_ANSWER_ACCEPTED answer-1/g) ?? []).length, 1);
    await post({ idempotencyKey: "answer-2", inputResponses: [{ requestId: "question-2", optionId: "no" }] });
    await poll("final exact answers committed once", async () => {
      assertAlive();
      const events = await savedEvents(data);
      const completed = events.filter(event => event.type === "message.completed");
      if (!completed.length) return;
      assert.deepEqual(completed.map(event => event.data.message), [expectedFinal]);
      return (await completedTurns(data)).some(turn => turn.completedAt >= completed[0].meta.at);
    });
    assert.equal((logs.match(/PROBE_ANSWER_ACCEPTED answer-2/g) ?? []).length, 1);
  } catch (error) {
    throw new Error(`${error.message}\nFixture host output:\n${logs.slice(-12_000)}`, { cause: error });
  } finally {
    context.signal.removeEventListener("abort", onAbort);
    try { await stop(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
});
