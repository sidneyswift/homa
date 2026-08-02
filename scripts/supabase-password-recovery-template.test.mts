import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOVERY_EMAIL_SUBJECT,
  RECOVERY_REDIRECT_URL,
  parseAuthConfigResponse,
  recoveryTemplateUpdate,
  supabaseProjectRef,
  withRecoveryRedirect,
} from "./supabase-password-recovery-template.mts";

test("the hosted Auth update contains only the two recovery template fields", () => {
  assert.deepEqual(recoveryTemplateUpdate("<p>Reset</p>"), {
    mailer_subjects_recovery: RECOVERY_EMAIL_SUBJECT,
    mailer_templates_recovery_content: "<p>Reset</p>",
  });
});

test("adds the recovery redirect without dropping or duplicating existing URLs", () => {
  assert.equal(withRecoveryRedirect(undefined), RECOVERY_REDIRECT_URL);
  assert.equal(
    withRecoveryRedirect("http://localhost:3000/**, https://example.com/callback"),
    `http://localhost:3000/**,https://example.com/callback,${RECOVERY_REDIRECT_URL}`,
  );
  assert.equal(
    withRecoveryRedirect(`http://localhost:3000/**,${RECOVERY_REDIRECT_URL}`),
    `http://localhost:3000/**,${RECOVERY_REDIRECT_URL}`,
  );
});

test("derives a Supabase project ref only from an HTTPS project URL", () => {
  assert.equal(
    supabaseProjectRef("https://kzplntcdtsvdowntvlza.supabase.co"),
    "kzplntcdtsvdowntvlza",
  );
  assert.equal(supabaseProjectRef("http://kzplntcdtsvdowntvlza.supabase.co"), null);
  assert.equal(supabaseProjectRef("https://supabase.co"), null);
  assert.equal(supabaseProjectRef("not a URL"), null);
});

test("accepts empty successful PATCH responses and rejects failed requests", async () => {
  assert.deepEqual(await parseAuthConfigResponse(new Response(null, { status: 204 })), {});
  await assert.rejects(
    parseAuthConfigResponse(new Response("denied", { status: 403 })),
    /HTTP 403/u,
  );
});
