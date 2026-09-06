import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { it } from "node:test";

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild") as {
  build(options: unknown): Promise<{outputFiles: Array<{text: string}>}>;
};

it("the production status action reads one receipt/sitting snapshot across a retry commit", async () => {
  const previousFlag = process.env.HOMA_LIVE_PROGRESS_ENABLED;
  process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
  const action = {requestId: "11111111-1111-4111-8111-111111111111", childId: "22222222-2222-4222-8222-222222222222", subjectId: "math"};
  const record = {id: "33333333-3333-4333-8333-333333333333", familyId: "family", childId: action.childId, childName: "Maya",
    purpose: "subject_deep_dive", scope: {subjectIds: ["math"]}, state: "active", revision: 1,
    currentItemId: "math.counts-to-5", currentDeliveryId: null, ownerMemberUserId: "adult", recipientMemberUserId: "adult",
    ownerDisplayName: null, recipientDisplayName: null, episodeId: "episode", pendingRuntimeSessionId: "runtime", pendingTurnId: "turn",
    pauseReason: null, openedAt: "2026-09-06T12:00:00Z", updatedAt: "2026-09-06T12:00:00Z", pausedAt: null, stoppedAt: null, completedAt: null};
  const receipt = {child_id: action.childId, subject_id: action.subjectId, result: {status: "existing", prompt: null, checkIn: record},
    issued_check_in_id: record.id, issued_revision: 1, delivered_at: null,
    current: {id: record.id, state: "active", revision: 1, current_delivery_id: null, active_member_user_id: "adult", prompt_recipient_member_user_id: "adult"}};
  const queries: string[] = [];
  let commitRetry = true;
  const supabase = {auth: {getUser: async () => ({data: {user: {id: "adult"}}})}, from(table: string) {
    const query = {select() {return query;}, eq() {return query;}, abortSignal() {return query;}, async maybeSingle() {
      queries.push(table);
      if (table === "children") return {data: {id: action.childId}, error: null};
      assert.equal(table, "progress_check_in_start_request_status", "a separate sitting query would tear the status read");
      const snapshot = structuredClone(receipt);
      if (commitRetry) { commitRetry = false; receipt.issued_revision = 2; receipt.current.revision = 2; }
      return {data: snapshot, error: null};
    }};
    return query;
  }};
  (globalThis as unknown as Record<string, unknown>).__assessmentStatusFixture = {
    getMyFamily: async () => ({id: "family"}), createSupabaseServerClient: async () => supabase,
    cookies: async () => {throw new Error("Status cannot clear the recovery pointer");},
  };
  try {
    const built = await esbuild.build({entryPoints: [fileURLToPath(new URL("../../app/app/assessment-actions.ts", import.meta.url))],
      bundle: true, write: false, platform: "node", format: "esm", plugins: [{name: "authenticated-status-boundaries", setup(build: {
        onResolve(options: {filter: RegExp}, callback: (args: {path: string}) => unknown): void;
        onLoad(options: {filter: RegExp; namespace: string}, callback: () => unknown): void;
      }) {
        build.onResolve({filter: /^next\/headers$|\/lib\/family$|\/lib\/supabase\/server$/}, args => ({path: args.path, namespace: "fixture"}));
        build.onLoad({filter: /.*/, namespace: "fixture"}, () => ({contents: "export const {getMyFamily,createSupabaseServerClient,cookies}=globalThis.__assessmentStatusFixture;", loader: "js"}));
      }}]});
    const production = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
    assert.deepEqual(await production.selectedAssessmentStatus(action), {status: "accepted", checkInId: record.id, revision: 1});
    assert.deepEqual(await production.selectedAssessmentStatus(action), {status: "accepted", checkInId: record.id, revision: 2});
    assert.deepEqual(queries, ["children", "progress_check_in_start_request_status", "children", "progress_check_in_start_request_status"]);
    receipt.current.revision = 3;
    assert.deepEqual(await production.selectedAssessmentStatus(action), {status: "unavailable"}, "unexplained active unbound mismatch must preserve recovery intent");
    receipt.issued_revision = 3;
    assert.deepEqual(await production.selectedAssessmentStatus(action), {status: "accepted", checkInId: record.id, revision: 3});
  } finally {
    delete (globalThis as unknown as Record<string, unknown>).__assessmentStatusFixture;
    if (previousFlag === undefined) delete process.env.HOMA_LIVE_PROGRESS_ENABLED; else process.env.HOMA_LIVE_PROGRESS_ENABLED = previousFlag;
  }
});
