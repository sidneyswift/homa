import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <Logo size={28} />
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-strong">
        Reset your password
      </h1>
      <p className="mt-2 text-body">
        Enter the email you use for Homa. We&apos;ll send you a link to choose a new password.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm expired={error === "expired"} />
      </div>
      <p className="mt-4 text-center text-sm text-body">
        <Link href="/signin" className="font-semibold text-brand underline underline-offset-2">
          Return to sign in
        </Link>
      </p>
    </main>
  );
}
