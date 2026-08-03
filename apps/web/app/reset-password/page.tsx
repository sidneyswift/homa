import type { Metadata } from "next";

import { Logo } from "../../components/brand/Logo";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="quiet-auth-shell quiet-account-surface" data-brand-surface="reset-password">
      <Logo size={28} />
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-[var(--homa-ink)]">
        Choose a new password
      </h1>
      <p className="mt-2 text-[var(--homa-ink)]">Use at least 8 characters.</p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
