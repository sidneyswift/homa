import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { globSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath,
  "Usage: node scripts/eve-candidate-continuity-check.mjs <candidate-package> <receipt.json>");
assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Use Node 24 or later");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.join(root, "apps/web");
const candidate = path.resolve(packageDirectory);
const metadata = JSON.parse(await readFile(path.join(candidate, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.equal(metadata.version, "0.54.3", "Review this runner before using another candidate");
const legacyMetadata = JSON.parse(await readFile(path.join(web, "node_modules/eve-legacy-protocol/package.json"), "utf8"));
assert.equal(legacyMetadata.name, "eve");
assert.equal(legacyMetadata.version, "0.19.0", "Legacy token tests must keep their reviewed SDK");
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const words = [...manifest.scripts["check:continuity"].matchAll(/"([^"\n]*)"|([^\s"]+)/g)]
  .map(match => match[1] ?? match[2]);
assert.deepEqual(words.slice(0, 2), ["tsx", "--test"]);
const files = [];
for (const pattern of words.slice(2)) {
  assert.match(pattern, /^(?:apps\/web|scripts)\/[\w./*-]+\.test\.m?ts$/);
  assert.ok(!pattern.includes(".."));
  const matched = globSync(pattern, { cwd: root });
  assert.ok(matched.length > 0, `No tests matched ${pattern}`);
  files.push(...matched);
}
const paths = { "@/*": [path.join(web, "*")] };
for (const [key, value] of Object.entries(metadata.exports)) {
  const target = typeof value === "string" ? value : value.import ?? value.default;
  if (typeof target === "string") paths[key === "." ? "eve" : `eve/${key.slice(2)}`] = [path.resolve(candidate, target)];
}
const temporary = await mkdtemp(path.join(tmpdir(), "eve-candidate-continuity-"));
const execute = promisify(execFile);
try {
  const config = path.join(temporary, "tsconfig.json");
  await writeFile(config, JSON.stringify({ extends: path.join(web, "tsconfig.json"), compilerOptions: { paths } }));
  const proof = path.join(temporary, "selection.mts");
  await writeFile(proof, [
    'import assert from "node:assert/strict";',
    'import { Client } from "eve/client";',
    'const client = new Client({ host: "https://synthetic.invalid" });',
    'assert.ok("sessions" in client);',
    'assert.equal("session" in client, false);',
  ].join("\n"));
  const env = { ...process.env, TSX_TSCONFIG_PATH: config };
  await execute(process.execPath, ["--import", "tsx", proof], { cwd: root, env, timeout: 20_000 });
  let output;
  let error;
  try {
    output = await execute(process.execPath, ["--import", "tsx", "--test", "--test-reporter=tap", ...files],
      { cwd: root, env, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
  } catch (caught) { output = caught; error = caught; }
  const log = `${output.stdout ?? ""}${output.stderr ?? ""}`;
  await writeFile(`${receiptPath}.log`, log);
  const count = (name) => Number(log.match(new RegExp(`^# ${name} (\\d+)$`, "m"))?.[1] ?? NaN);
  const receipt = {
    checkedAt: new Date().toISOString(), candidateVersion: metadata.version,
    tests: count("tests"), passed: count("pass"), failed: count("fail"), skipped: count("skipped"),
    testFiles: files.length, legacyVersion: legacyMetadata.version, candidateHandleClientSelected: true,
    success: !error && count("tests") > 0 && count("fail") === 0 && count("skipped") === 0,
    limitations: "Runtime module substitution with installed Homa dependencies. No full candidate installation, build, parked-session proof, or hosted latency measurement.",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  assert.ok(receipt.success, `Candidate continuity failed; inspect ${receiptPath}.log`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
