import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as {
  build(options: unknown): Promise<{ outputFiles: Array<{ text: string }> }>;
};

test("making route checks the authenticated adult's consent before child reads or AI jobs", async () => {
  const childId = "00000000-0000-4000-8000-000000000101";
  let access: { family: { id: string }; aiProcessingConsented: boolean } | null = null;
  let unavailable = false;
  let reads = 0;
  let jobs = 0;
  let kicks = 0;
  let modelCalls = 0;
  let childExists = true;
  let existingJob = false;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.__mobileConsentFixture = {
    MOBILE_ONBOARDING_INTENTS: ["all"],
    generateObject: async () => { modelCalls++; return { object: { line: "Dinosaurs, noted. A page for the kitchen table." } }; },
    agentJobsEnabled: () => true,
    rateLimited: () => false,
    clientIp: () => "fixture",
    requireFamilyFromBearer: async () => access?.family ?? null,
    requireFamilyWithAiConsentFromBearer: async () => {
      if (unavailable) throw new Error("unavailable");
      return access;
    },
    mapDb: () => async (_sql: TemplateStringsArray, ...values: unknown[]) => {
      reads++;
      assert.deepEqual(values, [childId, "family-fixture"]);
      return childExists ? [{ id: childId, name: "Maya", birth_month: null, profile: null }] : [];
    },
    startJob: async (input: { familyId: string; childId: string }) => {
      jobs++;
      assert.equal(input.familyId, "family-fixture");
      assert.equal(input.childId, childId);
      return { ok: true, jobId: "job-fixture", alreadyExisted: existingJob };
    },
    kickAgentJobsRunner: async () => { kicks++; },
    getJobStatus: async () => ({ ok: false }),
  };
  try {
    const buildRoute = (routeName: string) => esbuild.build({
      entryPoints: [fileURLToPath(new URL(`../app/api/mobile/onboarding/${routeName}/route.ts`, import.meta.url))],
      bundle: true, write: false, platform: "node", format: "esm",
      plugins: [{ name: "offline-consent-boundaries", setup(build: {
        onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => unknown): void;
        onLoad(options: { filter: RegExp; namespace: string }, callback: () => unknown): void;
      }) {
        build.onResolve({ filter: /^ai$|^@homa\/core$|lib\/(jobs\/(flag|kick|store)|map\/(db|ratelimit|session))$/ }, args => ({ path: args.path, namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const {generateObject,MOBILE_ONBOARDING_INTENTS,agentJobsEnabled,rateLimited,clientIp,requireFamilyFromBearer,requireFamilyWithAiConsentFromBearer,mapDb,startJob,kickAgentJobsRunner,getJobStatus}=globalThis.__mobileConsentFixture;", loader: "js" }));
      } }],
    });
    const built = await buildRoute("making");
    const route = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`) as { POST(request: Request): Promise<Response> };
    const send = () => route.POST(new Request("https://example.test/making", { method: "POST", body: JSON.stringify({ childId, aiProcessingConsented: true, familyId: "attacker" }) }));
    assert.equal((await send()).status, 401);
    access = { family: { id: "family-fixture" }, aiProcessingConsented: false };
    assert.equal((await send()).status, 403);
    unavailable = true;
    assert.equal((await send()).status, 503);
    assert.equal(reads, 0);
    assert.equal(jobs, 0);
    assert.equal(kicks, 0);
    unavailable = false;
    access.aiProcessingConsented = true;
    childExists = false;
    assert.equal((await send()).status, 404);
    assert.equal(jobs, 0);
    childExists = true;
    assert.equal((await send()).status, 200);
    assert.equal(jobs, 1);
    assert.equal(kicks, 1);
    existingJob = true;
    assert.equal((await send()).status, 200);
    assert.equal(kicks, 1);
    const reactionBuild = await buildRoute("react");
    const reaction = await import(`data:text/javascript;base64,${Buffer.from(reactionBuild.outputFiles[0].text).toString("base64")}`) as { POST(request: Request): Promise<Response> };
    const react = () => reaction.POST(new Request("https://example.test/react", { method: "POST", body: JSON.stringify({ kind: "love", childName: "Maya", love: "dinosaurs" }) }));
    access = null;
    assert.equal((await react()).status, 401);
    access = { family: { id: "family-fixture" }, aiProcessingConsented: false };
    assert.equal((await react()).status, 403);
    unavailable = true;
    assert.equal((await react()).status, 503);
    assert.equal(modelCalls, 0);
    unavailable = false;
    access.aiProcessingConsented = true;
    assert.equal((await react()).status, 200);
    assert.equal(modelCalls, 1);
  } finally {
    delete globals.__mobileConsentFixture;
  }
});
