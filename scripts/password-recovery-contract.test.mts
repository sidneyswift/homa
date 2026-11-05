import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  confirmPage: "apps/web/app/reset-password/confirm/page.tsx",
  confirmRoute: "apps/web/app/auth/confirm/route.ts",
  forgotForm: "apps/web/app/forgot-password/forgot-password-form.tsx",
  forgotPage: "apps/web/app/forgot-password/page.tsx",
  mobileEmailDoor: "apps/mobile/src/app/(auth)/email.tsx",
  mobileSignIn: "apps/mobile/src/app/(auth)/signin.tsx",
  mobileSignInCode: "apps/mobile/src/features/auth/sign-in-code.ts",
  recoveryTemplate: "supabase/templates/recovery.html",
  recoveryTemplateScript: "scripts/supabase-password-recovery-template.mts",
  resetForm: "apps/web/app/reset-password/reset-password-form.tsx",
  resetPage: "apps/web/app/reset-password/page.tsx",
  webSignIn: "apps/web/app/signin/signin-form.tsx",
} as const;

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

test("web sign-in reaches a request form that sends a recovery email", async () => {
  const [signIn, page, form] = await Promise.all([
    source(files.webSignIn),
    source(files.forgotPage),
    source(files.forgotForm),
  ]);

  assert.match(signIn, /href=["']\/forgot-password["']/u);
  assert.match(page, /ForgotPasswordForm/u);
  assert.match(form, /resetPasswordForEmail/u);
  assert.match(form, /passwordRecoveryRedirectUrl/u);
});

test("the email defers one-time token verification until a parent confirms", async () => {
  const [template, page, route] = await Promise.all([
    source(files.recoveryTemplate),
    source(files.confirmPage),
    source(files.confirmRoute),
  ]);

  assert.match(template, /\{\{ \.RedirectTo \}\}/u);
  assert.match(template, /\{\{ \.TokenHash \}\}/u);
  assert.doesNotMatch(template, /ConfirmationURL/u);
  assert.match(page, /method="post"/u);
  assert.match(page, /action="\/auth\/confirm"/u);
  assert.match(route, /export async function POST/u);
  assert.match(route, /verifyOtp/u);
  assert.match(route, /type: "recovery"/u);
  assert.match(route, /\/forgot-password\?error=expired/u);
});

test("hosted template deployment preserves and extends the redirect allow list", async () => {
  const script = await source(files.recoveryTemplateScript);

  assert.match(script, /method: "PATCH"/u);
  assert.match(script, /mailer_subjects_recovery/u);
  assert.match(script, /mailer_templates_recovery_content/u);
  assert.match(script, /uri_allow_list/u);
  assert.match(script, /withRecoveryRedirect/u);
  assert.match(script, /SUPABASE_ACCESS_TOKEN/u);
  assert.doesNotMatch(script, /config push/u);
});

test("the web reset form validates and writes the new password", async () => {
  const [page, form] = await Promise.all([
    source(files.resetPage),
    source(files.resetForm),
  ]);

  assert.match(page, /ResetPasswordForm/u);
  assert.match(form, /validatePasswordReset/u);
  assert.match(form, /updateUser\(\{ password \}\)/u);
});

/** October 5 founder ruling: optional existing-password login, with email
 * codes as recovery. The web reset flow remains unchanged. */
test("mobile keeps email-code recovery with optional password login", async () => {
  const [signIn, emailDoor] = await Promise.all([
    source(files.mobileSignIn),
    source(files.mobileEmailDoor),
  ]);

  for (const screen of [signIn, emailDoor]) {
    assert.doesNotMatch(screen, /resetPasswordForEmail/u);
    assert.doesNotMatch(screen, /passwordRecoveryRedirectUrl/u);
    assert.doesNotMatch(screen, /Send reset link/u);

  }
  assert.doesNotMatch(signIn, /secureTextEntry/u);
  assert.match(emailDoor, /secureTextEntry/u);
  assert.match(emailDoor, /Use an email code instead/u);
  assert.match(emailDoor, /supabase\.auth\.signInWithPassword/u);
});

test("mobile keeps one time codes available", async () => {
  const code = await source(files.mobileSignInCode);

  assert.match(code, /signInWithOtp/u);
  assert.match(code, /verifyOtp/u);
  // type "email" is the one Supabase accepts for an email OTP, verified
  // against production 2026-08-18. A wrong type fails only at runtime.
  assert.match(code, /type: "email"/u);
});
