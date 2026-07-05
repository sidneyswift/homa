import { Logo } from "../components/brand/Logo";
import { WaitlistForm } from "../components/waitlist-form";

/**
 * Landing page (BUILD.md Deliverable 0). Copy is final, sourced verbatim from
 * `journeys/07-positioning-messaging.md` §5 (hero variant B: the fear,
 * answered; pillar A/B/C one-liners for the three bands; trust points from
 * objections O1/O3 + build-log #1's vetted privacy claim). Visual system is
 * homa-design v2 (docs/homa-design/), applied via the token pass in
 * globals.css pending the formal packages/design workspace package (M1-17).
 * Hard constraints still hold: no pricing, no fabricated proof (the worksheet
 * sample stays an empty slot until a real artifact exists), no gated data
 * claims (no "never trains AI" until the DPAs are executed).
 */

const HOW_IT_WORKS = [
  "A gentle checklist for you, never a test for your child",
  "Printable materials aimed at exactly what's growing",
  "The before and after, next to the work you did",
] as const;

const TRUST_POINTS = [
  "Your child never uses it: no login, no chat, no screen for them",
  "Paper first: worksheets you print, hold, and approve",
  "We'll publish our full privacy policy before the first family joins",
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
      <header>
        <Logo size={30} />
        <h1 className="mt-8 font-display text-4xl font-semibold leading-tight text-strong sm:text-5xl">
          Know exactly where your child stands. Without ever testing them.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-body">
          A gentle checklist for you, never an exam for them. HOMA maps each
          child, makes practice for exactly what&apos;s growing, and shows you
          the numbers move.
        </p>
        <a
          href="#waitlist"
          className="mt-7 inline-block rounded-pill bg-brand px-7 py-3.5 font-sans text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
        >
          Join the waitlist
        </a>
      </header>

      <section aria-label="How it works" className="mt-20">
        <h2 className="font-display text-2xl font-semibold text-strong">
          How it works
        </h2>
        <ol className="mt-6 space-y-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-brand-soft font-display text-sm font-semibold text-brand">
                {index + 1}
              </span>
              <span className="pt-1 text-body">{step}</span>
            </li>
          ))}
        </ol>
        {/* Design pass: real worksheet sample renders here. No stock, no fakes (ruling C2). */}
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-subtle">
          worksheet sample &middot; added when a real generated artifact exists
        </div>
      </section>

      <section
        aria-label="Records and hours"
        className="mt-14 rounded-lg bg-sage/10 p-7 sm:p-8"
      >
        <h2 className="font-display text-2xl font-semibold text-strong">
          The paperwork does itself
        </h2>
        <p className="mt-3 max-w-xl text-body">
          Talk about your day. HOMA logs the hours and keeps your
          state&apos;s records ready.
        </p>
      </section>

      <section aria-label="Trust and privacy" className="mt-14">
        <h2 className="font-display text-2xl font-semibold text-strong">
          Built to be trusted
        </h2>
        <ul className="mt-6 space-y-3">
          {TRUST_POINTS.map((point) => (
            <li
              key={point}
              className="rounded-lg border-l-4 border-sage bg-card p-5 text-body shadow-sm"
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section id="waitlist" aria-label="Waitlist" className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-strong">
          Founding families
        </h2>
        <p className="mt-3 text-body">
          We invite families a few at a time. Your invite comes by email.
        </p>
        <div className="mt-6">
          <WaitlistForm source="organic" />
        </div>
      </section>

      <footer className="mt-16 border-t border-border-subtle pt-8 text-sm text-muted">
        <p>Built by a homeschool family.</p>
        <p className="mt-2 font-display text-base font-medium text-strong">
          You&apos;ve got this. HOMA&apos;s got the rest.
        </p>
      </footer>
    </main>
  );
}
