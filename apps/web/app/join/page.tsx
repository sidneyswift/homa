import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "../../components/brand/Logo";
import {
  consumeFamilyInvite,
  previewFamilyInvite,
  type ConsumeInviteResult,
} from "../../lib/family-invites";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { SignInForm } from "../signin/signin-form";

/**
 * /join: where a co-parent invite link lands (multi-parent plan Phase 3).
 * Public route (proxy.ts gates /app only). Signed out, it shows who is
 * asking and the sign-in doors, with this URL as the next hop so the
 * round trip through Google comes straight back here. Signed in, it
 * consumes the token server-side: possession of the emailed link is the
 * proof (phone_link_requests posture), the caller's id comes from their
 * session, and joining is one family_members insert. A login that
 * already has its own family is refused, never auto-merged; combining
 * two real families stays a careful by-hand operation.
 */

export const metadata: Metadata = {
  title: "Join your family",
  robots: { index: false },
};

function deriveFirstName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const meta = user.user_metadata ?? {};
  for (const key of ["given_name", "full_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0];
    }
  }
  return null;
}

function Outcome({
  heading,
  body,
  cta = { href: "/", label: "See what Homa is" },
}: {
  heading: string;
  body: string;
  /** Dead-link visitors likely have no account, so the default door is
   * the public site; signed-in outcomes point at /app instead. */
  cta?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <Logo size={28} />
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-strong">
        {heading}
      </h1>
      <p className="mt-2 text-body">{body}</p>
      <Link
        href={cta.href}
        className="mt-8 inline-block rounded-pill border border-border bg-card px-6 py-3 text-base font-semibold text-strong transition-colors hover:border-brand"
      >
        {cta.label}
      </Link>
    </main>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!token) {
    return (
      <Outcome
        heading="This link is incomplete"
        body="Part of the invite link is missing. Open the link from the email again, or ask for a fresh invite."
      />
    );
  }

  if (!user) {
    const preview = await previewFamilyInvite(token);
    if (!preview) {
      return (
        <Outcome
          heading="This invite isn't active anymore"
          body="It may have expired or already been used. The link lasts 7 days. Ask for a fresh one."
        />
      );
    }
    const inviter = preview.inviterName ?? "A parent in your family";
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <Logo size={28} />
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-strong">
          You&apos;re invited
        </h1>
        <p className="mt-2 text-body">
          {inviter} invited you to share {preview.familyName}&apos;s Homa.
          You&apos;ll both see the same kids, conversations, and materials.
        </p>
        <p className="mt-2 text-body">
          Never used Homa? Tap Continue with Google. Your first sign-in
          creates your account inside your family. Already have a Homa login?
          Sign in with it below.
        </p>
        <div className="mt-8">
          <SignInForm
            next={`/join?t=${encodeURIComponent(token)}`}
            showOnboardingLink={false}
          />
        </div>
      </main>
    );
  }

  const result: ConsumeInviteResult = await consumeFamilyInvite(
    token,
    user.id,
    user.email,
    deriveFirstName(user),
  );

  switch (result.kind) {
    case "joined":
    case "already-member":
      redirect("/app");
      break;
    case "has-family":
      return (
        <Outcome
          heading="This login already has a family"
          body="You're signed in with an account that already has its own Homa family. Your invite link still works. Sign out, then open it again with the account you want to use. If you meant to combine two existing families, tell the parent who invited you. Combining is a careful step Homa's team does by hand."
          cta={{ href: "/app", label: "Go to your Homa" }}
        />
      );
    case "email-mismatch":
      return (
        <Outcome
          heading="Use the invited email"
          body="This invite was sent to a different email address. Sign out, then open the invite with the account that received it, or ask for a fresh invite."
          cta={{ href: "/", label: "Back to Homa" }}
        />
      );
    case "expired":
      return (
        <Outcome
          heading="This invite has expired"
          body="The link lasts 7 days. Ask for a fresh one and it'll work right away."
        />
      );
    case "invalid":
      return (
        <Outcome
          heading="This invite isn't active anymore"
          body="It may have expired or already been used. Ask for a fresh one."
        />
      );
    default: {
      const exhaustive: never = result;
      throw new Error(`unhandled invite outcome: ${String(exhaustive)}`);
    }
  }
}
