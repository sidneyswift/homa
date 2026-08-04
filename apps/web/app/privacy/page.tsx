import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { SUBPROCESSORS } from "./subprocessors";

/**
 * /privacy: the one-page policy, written in plain language. Pulled forward
 * from launch gate 7 because the map flow holds more than emails (children's
 * first names, birthdays, and a parent's questionnaire answers). Every claim
 * here must stay true in code; update this page in the same PR as any change
 * to what is collected or who processes it.
 */

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Homa collects, where it lives, who processes it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "August 4, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-page">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-bold leading-tight text-strong">Privacy</h1>
        <p className="mt-2 text-sm text-subtle">Last updated {UPDATED}</p>

        <p className="mt-6 text-body">
          Built by a homeschool family, for homeschool families. The short version: we collect
          information to provide Homa to your family, children do not need accounts, and you can
          ask us to delete your account and the family records stored in Homa.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we collect, and why</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>
            <b>Account and contact details:</b> your name, email address, phone number when you
            choose text or calling, sign-in details, and billing status. We use them to secure
            your account, reach you in the ways you choose, and manage your membership.
          </li>
          <li>
            <b>Family details:</b> the names or nicknames, birthdays, interests, homeschool style,
            curriculum, schedule, and other details you choose to share. A mailing address is
            collected only when a feature needs one. We use this information to prepare the
            plans, reports, records, and materials you ask for.
          </li>
          <li>
            <b>Your work in Homa:</b> messages, questionnaire answers, lesson notes, teaching
            hours, plans, finished work, and files such as documents, photos, audio, or video
            that you choose to upload. We use them to provide the feature you selected and keep
            your family&apos;s work connected.
          </li>
          <li>
            <b>Service information:</b> product usage, device and browser details, delivery
            receipts, and error or security records. We use them to operate, protect, and improve
            Homa.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Who processes data for us</h2>
        <p className="mt-3 text-body">
          The provider depends on the feature you choose. These are the services that can
          process family data for Homa today:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          {SUBPROCESSORS.map(({ name, purpose }) => (
            <li key={name}>
              <b>{name}</b> {purpose}.
            </li>
          ))}
        </ul>
        <p className="mt-3 text-body">
          We send each provider only the information needed for its part of the service. Homa
          does not use your family&apos;s content to train AI models. For our main AI providers, we
          use paid APIs that do not train on prompts or responses by default. When another
          provider offers a no-training control, we enable it. Providers and features can change
          as Homa changes. When a change materially affects this policy, we update this page and
          its date.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we never do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>We never sell your data or share it with advertisers.</li>
          <li>We never use your family&apos;s data to train AI models.</li>
          <li>We do not give children accounts or ask them to talk to Homa.</li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Delete anytime</h2>
        <p className="mt-3 text-body">
          Email <a className="text-brand underline-offset-2 hover:underline" href="mailto:hello@mail.thankshoma.com?subject=Please%20delete%20my%20family%27s%20data">hello@mail.thankshoma.com</a>{" "}
          with the address you signed up with. We delete your account and family records stored in Homa,
          uploaded files, questionnaire answers, and reports, then confirm within a few days. We
          may retain limited payment, security, delivery, or backup records when the law requires
          it or until a provider&apos;s normal retention period ends.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Questions</h2>
        <p className="mt-3 text-body">
          Reply to any email from us, or write to the address above.
        </p>
      </main>
    </div>
  );
}
