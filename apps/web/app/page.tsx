import type { Metadata } from "next";

import { WaitlistForm } from "../components/waitlist-form";

/**
 * Landing page (BUILD.md Deliverable 0). Copy is binding per
 * docs/homa-planning/journeys/07-positioning-messaging.md §5: hero variant B
 * (efficacy lead), founding-families waitlist framing, no pricing, no
 * fabricated social proof, sentence case, no em dashes.
 *
 * WIREFRAME: layout and styling are placeholders for the design pass.
 * The copy and the form behavior are the deliverable.
 */

export const metadata: Metadata = {
  title: "HOMA · the homeschool assistant that shows you it's working",
  description:
    "The calm homeschool assistant. HOMA learns each child, makes printable materials just for them, tracks hours for your state, and shows you it's working.",
};

const HOW_IT_WORKS = [
  {
    title: "A gentle checklist, for you",
    body: "You answer easy questions about your child: does he count to 40, what books did she reach for this week. A conversation with you, never an exam for them.",
  },
  {
    title: "A map, and materials to match",
    body: "HOMA maps where each child stands against real standards, then makes printable practice aimed at exactly what's growing, themed to what they already love.",
  },
  {
    title: "Proof, gently",
    body: "Weeks later, HOMA shows you the before and after, right next to the work you did together. You watch the numbers move.",
  },
] as const;

const TRUST_POINTS = [
  {
    title: "Your child never uses it",
    body: "Homa is for you. Your child never talks to an AI, never logs in, never needs a screen. They get a printed page and your voice.",
  },
  {
    title: "Paper first",
    body: "HOMA's favorite output is paper. Worksheets, activity cards, coloring pages: printed, held, and approved by you first.",
  },
  {
    title: "Your family's data belongs to you",
    body: "We'll publish our full privacy policy before the first family joins. Until then, one promise that already holds: we'll only use your email to send your invite.",
  },
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
          A gentle checklist for you, never an exam for them. HOMA maps each
          child, makes practice for exactly what&apos;s growing, and shows you
          the numbers move.
        </p>
        <p className="mt-4 text-neutral-700">
          You&apos;ve got this. HOMA&apos;s got the rest.
        </p>
        <a
          href="#waitlist"
          className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-3 font-semibold text-white"
        >
          Join the founding families waitlist
        </a>
      </header>

      <section aria-label="How it works" className="mt-16">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 space-y-6">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-neutral-300 p-5">
              <p className="text-sm text-neutral-500">step {index + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-neutral-700">{step.body}</p>
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
          Talk about your day and HOMA logs the hours by subject, for every
          child in the house. When reports are due, your records are already
          in order, with your state&apos;s rules linked to their source.
        </p>
      </section>

      <section aria-label="Trust" className="mt-16">
        <h2 className="text-2xl font-bold">Built to be trusted</h2>
        <div className="mt-6 space-y-6">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="rounded-lg border border-neutral-300 p-5">
              <h3 className="text-lg font-semibold">{point.title}</h3>
              <p className="mt-2 text-neutral-700">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="waitlist" aria-label="Waitlist" className="mt-16">
        <h2 className="text-2xl font-bold">Founding families</h2>
        <p className="mt-3 text-neutral-700">
          We&apos;re inviting a small group of founding families first, a few
          at a time, so every family gets real attention. Join the list and
          we&apos;ll invite you with real attention, not a drip campaign.
        </p>
        <div className="mt-6">
          <WaitlistForm source="organic" />
        </div>
      </section>

      <footer className="mt-16 border-t border-neutral-300 pt-8 text-sm text-neutral-600">
        <p>
          HOMA is built by a homeschool family. It printed worksheets every
          morning for months before it had a name.
        </p>
        <p className="mt-3 font-medium text-neutral-800">
          You&apos;ve got this. HOMA&apos;s got the rest.
        </p>
        <p className="mt-1">Homeschooling, made calm.</p>
      </footer>
    </main>
  );
}
