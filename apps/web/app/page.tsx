import type { Metadata } from "next";

import { WaitlistForm } from "../components/waitlist-form";

/**
 * Landing page (BUILD.md Deliverable 0). WIREFRAME: band structure is real
 * (hero variant B, how-it-works, paperwork, trust, waitlist), copy is
 * deliberately minimal; the binding copy kit (journeys/07 §5) lands with
 * the design pass. Hard constraints still hold: no pricing, no fabricated
 * proof, no gated data claims, no em dashes, sentence case.
 */

export const metadata: Metadata = {
  title: "HOMA · the homeschool assistant that shows you it's working",
  description:
    "HOMA learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
};

const HOW_IT_WORKS = [
  "A gentle checklist for you, never a test for your child",
  "Printable materials aimed at exactly what's growing",
  "The before and after, next to the work you did",
] as const;

const TRUST_POINTS = [
  "Your child never uses it: no login, no chat, no screen for them",
  "Paper first: worksheets you print, hold, and approve",
  "Your email is only used to send your invite",
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-wide">HOMA</p>
        <h1 className="mt-6 text-4xl font-bold leading-tight">
          Know exactly where your child stands. Without ever testing them.
        </h1>
        <p className="mt-4 text-lg text-neutral-700">
          HOMA maps each child, makes practice for exactly what&apos;s
          growing, and shows you the numbers move.
        </p>
        <a
          href="#waitlist"
          className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-3 font-semibold text-white"
        >
          Join the waitlist
        </a>
      </header>

      <section aria-label="How it works" className="mt-16">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 space-y-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="rounded-lg border border-neutral-300 p-4">
              <span className="text-sm text-neutral-500">{index + 1} · </span>
              {step}
            </li>
          ))}
        </ol>
        {/* Design pass: real worksheet sample renders here. No stock, no fakes. */}
        <div className="mt-6 rounded-lg border border-dashed border-neutral-400 p-8 text-center text-sm text-neutral-500">
          worksheet sample · added with the design pass
        </div>
      </section>

      <section aria-label="The paperwork" className="mt-16">
        <h2 className="text-2xl font-bold">The paperwork does itself</h2>
        <p className="mt-3 text-neutral-700">
          Talk about your day. HOMA logs the hours and keeps your state&apos;s
          records ready.
        </p>
      </section>

      <section aria-label="Trust" className="mt-16">
        <h2 className="text-2xl font-bold">Built to be trusted</h2>
        <ul className="mt-6 space-y-3">
          {TRUST_POINTS.map((point) => (
            <li key={point} className="rounded-lg border border-neutral-300 p-4">
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section id="waitlist" aria-label="Waitlist" className="mt-16">
        <h2 className="text-2xl font-bold">Founding families</h2>
        <p className="mt-3 text-neutral-700">
          We invite families a few at a time. Your invite comes by email.
        </p>
        <div className="mt-6">
          <WaitlistForm source="organic" />
        </div>
      </section>

      <footer className="mt-16 border-t border-neutral-300 pt-8 text-sm text-neutral-600">
        <p>Built by a homeschool family.</p>
        <p className="mt-2 font-medium text-neutral-800">
          You&apos;ve got this. HOMA&apos;s got the rest.
        </p>
      </footer>
    </main>
  );
}
