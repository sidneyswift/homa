import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";

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

const UPDATED = "July 7, 2026";

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
          only what we need, children never use Homa, and one email deletes everything.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we collect, and why</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>
            <b>Waitlist:</b> your email, plus optional name, state, and kids&apos; ages. Used to
            send your invite and plan who we can serve well.
          </li>
          <li>
            <b>Your child&apos;s progress report:</b> each child&apos;s first name (a nickname is fine), their birthday, your questionnaire answers, and any optional extras you share (interests,
            homeschool style, curriculums). Used to build the report you asked for, and, when your invite opens, to start Homa off already knowing your
            family. Your child never uses Homa and is never asked anything.
          </li>
          <li>
            <b>Product analytics:</b> anonymous usage events (which step was reached). Never
            names, never emails.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Who processes data for us</h2>
        <p className="mt-3 text-body">
          Four companies process data for us. This is the complete list:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li><b>Supabase</b> (database hosting, US East): stores everything above.</li>
          <li><b>Vercel</b> (web hosting): serves the site and runs our code.</li>
          <li><b>Resend</b> (email): delivers the emails you asked for.</li>
          <li>
            <b>Anthropic</b>, via Vercel AI Gateway (writes the words of your report, and powers
            chatting with Homa once your invite opens).
          </li>
        </ul>
        <p className="mt-3 text-body">
          Here is exactly how AI touches your report: every number in it is computed by plain
          arithmetic that a person reviewed, never by AI. Homa, an AI, writes the sentences of
          the report around those numbers, from your answers. We contractually disallow your
          data being used to train models, and every sentence passes our safety rules before
          you see it.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we never do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>We never sell your data or share it with advertisers.</li>
          <li>We never use your family&apos;s data to train AI models.</li>
          <li>We never email you beyond your children&apos;s progress reports and your invite, unless you ask.</li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Delete anytime</h2>
        <p className="mt-3 text-body">
          Email <a className="text-brand underline-offset-2 hover:underline" href="mailto:hello@mail.thankshoma.com?subject=Please%20delete%20my%20family%27s%20data">hello@mail.thankshoma.com</a>{" "}
          with the address you signed up with and we delete your family&apos;s records, including
          questionnaire answers and reports. A real person confirms within a few days.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Questions</h2>
        <p className="mt-3 text-body">
          Reply to any email from us, or write to the address above. A person answers, not a bot.
        </p>
      </main>
    </div>
  );
}
