import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";

/**
 * /terms: the one-page terms of service, written in plain language like
 * /privacy. Created because Google's OAuth consent-screen branding requires
 * a public terms URL. Deliberately omits an entity name and a governing-law
 * clause: the LLC filing is deferred until Stripe activation (see
 * docs/homa-planning/build-log.md); revisit both when the entity exists.
 * Every claim here must stay true in code, same rule as /privacy.
 */

export const metadata: Metadata = {
  title: "Terms",
  description: "The plain-language terms for using Homa: what the service is, who it is for, and what we each promise.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "August 4, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">Terms of service</h1>
        <p className="mt-2 text-sm text-subtle">Last updated {UPDATED}</p>

        <p className="mt-6 text-body">
          These terms are short and in plain language because we would rather you actually read
          them. Using thankshoma.com, or signing in to Homa, means you agree to them.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What Homa provides</h2>
        <p className="mt-3 text-body">
          Homa is early, and we would rather tell you that plainly than pretend otherwise. Today
          the service can include progress reports, weekly plans, practice pages, teaching-hour
          records, family files, and the Homa assistant. The exact features available to you are
          the ones shown in your account and membership offer.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Memberships and your 7 free days</h2>
        <p className="mt-3 text-body">
          Starting a trial requires a payment method. We do not charge it during your 7 free days.
          The price, billing period, included services, and our promise to email you before the
          first charge are shown before you choose a membership. Unless you cancel before the trial
          ends, the membership renews at the price and interval you selected. You can stop the next
          renewal from your settings. Stripe processes web purchases and Apple processes App Store
          purchases, so their payment terms also apply to the purchase they handle.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Homa is for parents</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>You must be 18 or older and the parent or legal guardian of the children you tell Homa about.</li>
          <li>Children do not hold accounts or use the Homa assistant. Accounts, reports, and conversations belong to the grown-ups; the materials Homa makes are for your family.</li>
          <li>Your sign-in is yours: please keep it to yourself, and reach out right away if you think someone else has used it.</li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Homa is not a test, a doctor, or a lawyer</h2>
        <p className="mt-3 text-body">
          You know your child best, and nothing here changes that. Progress reports and plans are
          built from your own observations; they are not a test, not a medical or developmental
          evaluation, and not advice. The Homa assistant is an AI: it is careful, but it can be
          wrong, and its words are suggestions to weigh, not instructions to follow. None of it
          replaces a doctor, a therapist, an evaluator, or your own judgment, and it is your
          responsibility to meet your state&apos;s homeschool requirements. When something worries
          you, a professional who knows your child is the right next step.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Your content, our content</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>
            What you share stays yours. You give us permission to use it for one purpose only:
            running Homa for your family. What we collect and who processes it lives in the{" "}
            <Link href="/privacy" className="text-brand underline-offset-2 hover:underline">privacy policy</Link>,
            and you can request deletion of your account and family records stored in Homa with one email.
          </li>
          <li>
            The site, reports, and plans we make are for your family&apos;s personal use. Please
            don&apos;t resell them, republish them wholesale, or scrape the site.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Please use Homa kindly</h2>
        <p className="mt-3 text-body">
          Don&apos;t try to break the service, probe other families&apos; data, or use Homa for
          anything unlawful or harmful. You can stop using Homa anytime and ask us to delete
          your account and family records stored in Homa. If an account breaks these terms we may
          suspend it, and if we ever do, we will tell you why.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">The service will change</h2>
        <p className="mt-3 text-body">
          Homa is being built in the open, so features will change, improve, and occasionally
          pause. We may also update these terms; when a change matters, this page gets a new date
          and account holders get an email before it takes effect.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">The honest legal part</h2>
        <p className="mt-3 text-body">
          Homa is provided as is, without warranties of any kind. To the fullest extent the law
          allows, we are not liable for indirect or consequential damages, and our total liability
          is capped at what you have paid us in the twelve months before the claim. If a court
          finds part of these terms unenforceable, the rest still applies.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Questions</h2>
        <p className="mt-3 text-body">
          Write to <a className="text-brand underline-offset-2 hover:underline" href="mailto:hello@mail.thankshoma.com?subject=Question%20about%20the%20terms">hello@mail.thankshoma.com</a>.
        </p>
      </main>
    </div>
  );
}
