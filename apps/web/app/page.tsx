import Image from "next/image";
import { ArrowRight, ClipboardCheck, Mic, NotebookPen, ShieldCheck, TrendingUp } from "lucide-react";

import { Doodle } from "../components/marketing/Doodle";
import { SquiggleRule, Wave } from "../components/marketing/dividers";
import { Footer } from "../components/marketing/Footer";
import { HowItWorks, type HowItWorksStep } from "../components/marketing/HowItWorks";
import { Nav } from "../components/marketing/Nav";
import { WaitlistForm } from "../components/waitlist-form";

/**
 * Landing page (BUILD.md Deliverable 0). Copy is final, sourced verbatim from
 * `journeys/07-positioning-messaging.md` §5 (hero variant B: the fear,
 * answered; pillar A/B/C one-liners for the three bands; trust points from
 * objections O1/O3 + build-log #1's vetted privacy claim). Visual system is
 * homa-design v3 (docs/homa-design/), applied via the token pass in
 * globals.css pending the formal packages/design workspace package (M1-17).
 * Section layout follows the literal template at
 * docs/homa-design/templates/landing-page/LandingPage.dc.html (nav, hero,
 * wave, feature grid, wave, footer), minus anything
 * journeys/02-acquisition-activation.md §1 already flagged as non-compliant
 * for this cohort: no pricing tiers, no "Start free" trial CTA, no "Watch
 * demo" (no demo exists), and no family-count or testimonial claims (we have
 * ~1 family so far). The extra sections below (worksheet, records, trust,
 * waitlist) aren't in that minimal template but are Deliverable 0's actual
 * requirements per BUILD.md.
 * Hard constraints still hold: no pricing, no fabricated proof (the worksheet
 * sample stays an empty slot until a real artifact exists), no gated data
 * claims (no "never trains AI" until the DPAs are executed).
 */

/**
 * Titles and bodies are the exact copy kit sentence split at its own comma,
 * not new copy, so the "final, verbatim" claim above stays true.
 */
const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: ClipboardCheck,
    title: "A gentle checklist for you",
    body: "never a test for your child",
    tint: "var(--clay-100)",
    iconColor: "var(--clay-600)",
  },
  {
    icon: NotebookPen,
    title: "Printable materials",
    body: "aimed at exactly what's growing",
    tint: "var(--sage-100)",
    iconColor: "var(--sage-600)",
  },
  {
    icon: TrendingUp,
    title: "The before and after",
    body: "next to the work you did",
    tint: "var(--gold-100)",
    iconColor: "var(--gold-ink)",
  },
];

const TRUST_POINTS = [
  "Your child never uses it: no login, no chat, no screen for them",
  "Paper first: worksheets you print, hold, and approve",
  "We'll publish our full privacy policy before the first family joins",
] as const;

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden bg-page">
      <Nav />

      <section
        className="relative overflow-hidden px-6 py-16 sm:px-10 sm:py-18"
        style={{ background: "var(--band-sky)" }}
      >
        <Doodle
          name="star"
          size={34}
          color="var(--pop-cobalt)"
          rotate={-12}
          style={{ position: "absolute", top: 42, left: "4%" }}
        />
        <div className="mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-strong sm:text-5xl lg:text-6xl">
              Know exactly where your child stands. Without ever testing them.
            </h1>
            <p className="mt-4 max-w-md text-lg text-body">
              A gentle checklist for you, never an exam for them. Homa maps each
              child, makes practice for exactly what&apos;s growing, and shows you
              the numbers move.
            </p>
            <a
              href="#waitlist"
              className="mt-7 inline-flex items-center gap-2 rounded-pill bg-brand px-7 py-3.5 font-sans text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
            >
              Join the waitlist
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
          <div className="relative">
            <div
              className="overflow-hidden"
              style={{ borderRadius: "var(--blob-1)" }}
            >
              <Image
                src="/images/hero-family.png"
                alt="A mom and her son working through a workbook together at the kitchen table"
                width={760}
                height={520}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <Wave color="var(--band-sky)" />

      <section aria-label="How it works" id="how-it-works" className="mx-auto max-w-3xl px-6 py-12 sm:px-0">
        <h2 className="font-display text-2xl font-semibold text-strong">
          How it works
        </h2>
        <div className="mt-3 max-w-40">
          <SquiggleRule />
        </div>
        <div className="mt-8">
          <HowItWorks steps={HOW_IT_WORKS} />
        </div>
        {/* Design pass: real worksheet sample renders here. No stock, no fakes (ruling C2). */}
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-subtle">
          worksheet sample &middot; added when a real generated artifact exists
        </div>
      </section>

      <Wave color="var(--band-mint)" />

      <section
        aria-label="Records and hours"
        className="px-6 py-14 sm:px-10"
        style={{ background: "var(--band-mint)" }}
      >
        <div className="mx-auto flex max-w-3xl items-start gap-4">
          <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card">
            <Mic size={20} color="var(--sage-600)" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-strong">
              The paperwork does itself
            </h2>
            <p className="mt-3 max-w-xl text-body">
              Talk about your day. Homa logs the hours and keeps your
              state&apos;s records ready.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Trust and privacy" className="mx-auto max-w-3xl px-6 py-16 sm:px-0">
        <div className="flex items-center gap-3">
          <ShieldCheck size={22} color="var(--sage-600)" aria-hidden="true" />
          <h2 className="font-display text-2xl font-semibold text-strong">
            Built to be trusted
          </h2>
        </div>
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

      <section
        id="waitlist"
        aria-label="Waitlist"
        className="px-6 py-16 sm:px-10"
        style={{ background: "var(--band-sky)" }}
      >
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-2xl font-semibold text-strong">
            Founding families
          </h2>
          <p className="mt-3 text-body">
            We invite families a few at a time. Your invite comes by email.
          </p>
          <div className="mt-6">
            <WaitlistForm source="organic" />
          </div>
        </div>
      </section>

      <Wave color="var(--pop-navy)" flip />
      <Footer />
    </main>
  );
}
