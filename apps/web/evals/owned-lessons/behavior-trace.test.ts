import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const require = createRequire(import.meta.url);
const esbuild = require(require.resolve("esbuild", {paths: [require.resolve("tsx")]})) as {
  build(input: Record<string, unknown>): Promise<{outputFiles: {text: string}[]}>;
};

test("actual controlled eval preserves failed generation and pre-judge assertion traces without calling a model", async () => {
  const root = await mkdtemp(join(tmpdir(), "owned-lesson-trace-"));
  try {
    await mkdir(join(root, "agent/skills/materials-studio"), {recursive: true});
    await writeFile(join(root, "agent/instructions.md"), "Synthetic test instructions.");
    await writeFile(join(root, "agent/skills/materials-studio/SKILL.md"), "---\ndescription: Synthetic test skill.\n---\nNo real effects.");
    const stubs: Record<string, string> = {
      "eve/evals": "export const defineEval = value => value;",
      "ai": `export const tool = value => value; export const jsonSchema = value => value; export const stepCountIs = value => value;
        export async function generateText(options) {
          await options.tools.send_followup_email.execute({synthetic: true});
          if (fixture.mode === 'generation-failed') throw new Error('Synthetic aborted generation');
          return {text: 'No page was made.', steps: [{text: 'Earlier emitted text.'}, {text: 'No page was made.'}], usage: {inputTokens: 5, outputTokens: 3, totalTokens: 8}};
        }
        export async function generateObject() { fixture.judgeCalls++; throw new Error('Judge must not run'); }`,
      "agent/model": "export const HOMA_MODEL = 'synthetic-no-model';",
      "agent/tools/create_printable": "export const createPrintableInputSchema = {parse: value => value};",
      "lib/eval-isolation": "export const isEvalIsolationActive = () => true;",
      "lib/library/family-asset-provenance": "export async function resolveMaterialFamilySources() { throw new Error('No source access expected'); }",
      "hours-read/full-menu": `export async function fullHoursEvalMenu() { return ['load_skill','read_file','find_family_assets','get_family_asset','read_family_curriculum','get_children','create_printable','send_followup_email'].map(name => ({name, description: 'Synthetic trace test.', inputSchema: {type: 'object', properties: {}}})); }`,
    };
    const built = await esbuild.build({entryPoints: [fileURLToPath(new URL("./behavior.eval.ts", import.meta.url))], bundle: true,
      write: false, platform: "node", format: "cjs", packages: "external", plugins: [{name: "no-effect-trace-fixture", setup(build: {
        onResolve(options: {filter: RegExp}, callback: (args: {path: string}) => {path: string; namespace: string} | undefined): void;
        onLoad(options: {filter: RegExp; namespace: string}, callback: (args: {path: string}) => {contents: string; loader: string}): void;
      }) {
        build.onResolve({filter: /.*/}, args => {
          const name = Object.keys(stubs).find(name => args.path === name || args.path.endsWith("/" + name));
          return name ? {path: name, namespace: "fixture"} : undefined;
        });
        build.onLoad({filter: /.*/, namespace: "fixture"}, args => ({contents: stubs[args.path], loader: "js"}));
      }}]});
    for (const mode of ["generation-failed", "assertion-failed"] as const) {
      const fixture = {mode, judgeCalls: 0};
      const mod = {exports: {}};
      const runtime = {cwd: () => root, env: {VERCEL_OIDC_TOKEN: "synthetic-no-network", HOMA_OWNED_LESSON_CASE: "urgent-fresh"}};
      new Script(`(function(require,module,exports,fixture,process){${built.outputFiles[0].text}\n})`).runInThisContext()(require, mod, mod.exports, fixture, runtime);
      const evidenceContains = (mod.exports as {ownedLessonEvidenceContains(value:unknown, quote:string):boolean}).ownedLessonEvidenceContains;
      const candidate = {response: "No PDF was delivered.", proposedMaterials: [{input: {pages: [{html: '<p>Count "three".\nThen compare.</p>'}]}}]};
      assert.equal(evidenceContains(candidate, 'Count "three".\nThen compare.'), true);
      assert.equal(evidenceContains(candidate, 'Count \\"three\\".'), false);
      assert.equal(evidenceContains(candidate, "All answers were correct."), false);
      assert.equal(evidenceContains(candidate, ""), false);
      const run = (mod.exports as {default: {test(t: {skip(note: string): never; log(value: string): void}): Promise<void>}}).default;
      const logs: Record<string, unknown>[] = [];
      await assert.rejects(run.test({skip: note => {throw new Error(note);}, log: value => logs.push(JSON.parse(value))}),
        mode === "generation-failed" ? /Synthetic aborted generation/ : /unexpected tool requested/);
      assert.equal(fixture.judgeCalls, 0);
      assert.equal(logs.length, 1);
      assert.equal(logs[0].phase, mode === "generation-failed" ? "generation-failed" : "generated");
      const calls = logs[0].calls as {name: string; input: unknown; output: unknown}[];
      assert.equal(calls.length, 1);
      assert.equal(calls[0].name, "send_followup_email");
      assert.deepEqual(calls[0].input, {synthetic: true});
      assert.deepEqual(calls[0].output, {accepted: false, note: "Unavailable in this isolated draft evaluation."});
      if (mode === "assertion-failed") {
        assert.deepEqual(logs[0].usage, {inputTokens: 5, outputTokens: 3, totalTokens: 8});
        assert.equal(logs[0].response, "Earlier emitted text.\n\nNo page was made.");
      }
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
