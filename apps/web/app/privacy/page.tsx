import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";

/**
 * /privacy: the one-page policy, written in plain language. Pulled forward
 * from launch gate 7 because the map flow holds more than emails (children's
 * first names, birth months, and a parent's checklist answers). Every claim
 * here must stay true in code; update this page in the same PR as any change
 * to what is collected or who processes it.
 */

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Homa collects, where it lives, who processes it, and how to delete it.",
};

const UPDATED = "July 5, 2026";

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
          Homa is built by a homeschool family, for homeschool families. The short version: we
          collect only what the product needs, children never use Homa, and you can have
          everything deleted with one email.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we collect, and why</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>
            <b>Waitlist:</b> your email, and optionally your first name, state, and kids&apos; age
            ranges. Used to send your founding-family invite and to plan who we can serve well.
          </li>
          <li>
            <b>Your child&apos;s map:</b> each child&apos;s first name, birth month and year (never
            a full birth date), interests you tap, and your checklist answers. Used to draw the map
            you asked for, and, when your invite opens, to start Homa off already knowing your
            family. Your child never uses Homa and is never asked anything.
          </li>
          <li>
            <b>Product analytics:</b> anonymous usage events (which step of a flow was reached).
            Event records never contain names or emails.
          </li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Who processes data for us</h2>
        <p className="mt-3 text-body">
          Three companies process data on our behalf, and this is the complete list today:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li><b>Supabase</b> (database hosting, US East): stores everything above.</li>
          <li><b>Vercel</b> (web hosting): serves the site and runs our code.</li>
          <li><b>Resend</b> (email): delivers the emails you asked for.</li>
        </ul>
        <p className="mt-3 text-body">
          No AI provider receives your map answers: the map is scored by plain, human-reviewed
          arithmetic. If that ever changes, this page changes first and says so plainly.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">What we never do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body">
          <li>We never sell your data or share it with advertisers.</li>
          <li>We never use your family&apos;s data to train AI models.</li>
          <li>We never email you beyond your children&apos;s maps and your invite, unless you ask.</li>
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Delete anytime</h2>
        <p className="mt-3 text-body">
          Email <a className="text-brand underline-offset-2 hover:underline" href="mailto:hello@mail.thankshoma.com?subject=Please%20delete%20my%20family%27s%20data">hello@mail.thankshoma.com</a>{" "}
          with the address you signed up with and we delete your family&apos;s records, including
          map answers and reports. A real person confirms within a few days.
        </p>

        <h2 className="mt-8 font-display text-xl font-semibold text-strong">Questions</h2>
        <p className="mt-3 text-body">
          Reply to any email from us, or write to the address above. A person answers, not a bot.
        </p>
      </main>
    </div>
  );
}
