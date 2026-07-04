import { WaitlistForm } from "../components/waitlist-form";
import {
  WireframeMediaSlot,
  WireframeSlot,
} from "../components/wireframe-slot";

/**
 * Landing page (BUILD.md Deliverable 0). WIREFRAME: structure and behavior
 * only, no drafted copy (founder correction, 2026-07-04). Band order follows
 * the landing spec (journeys/02 §1 + MJ-09): hero, how it works, paperwork,
 * trust, waitlist. Voice-level copy renders as labeled slots; the binding
 * copy kit (journeys/07 §5) fills them during the design pass. Section
 * headings and form labels are neutral functional text. Hard constraints
 * still hold: no pricing, no fabricated proof, no gated data claims.
 */

const HOW_IT_WORKS_SLOTS = [
  { label: "step 1 copy", hint: "checklist for mom, never a test for the child" },
  { label: "step 2 copy", hint: "personalized printable materials" },
  { label: "step 3 copy", hint: "visible progress next to the work" },
] as const;

const TRUST_SLOTS = [
  { label: "trust point 1 copy", hint: "child never uses it" },
  { label: "trust point 2 copy", hint: "paper first" },
  { label: "trust point 3 copy", hint: "email use / privacy" },
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-wide">HOMA</p>
        <h1 className="mt-6 text-4xl font-bold leading-tight">
          <WireframeSlot
            label="hero headline"
            hint="3 variants to test · journeys/07 §5"
          />
        </h1>
        <p className="mt-4 text-lg text-neutral-700">
          <WireframeSlot label="hero subheadline" hint="journeys/07 §5" />
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
          {HOW_IT_WORKS_SLOTS.map((step, index) => (
            <li
              key={step.label}
              className="rounded-lg border border-neutral-300 p-4"
            >
              <span className="text-sm text-neutral-500">{index + 1} · </span>
              <WireframeSlot label={step.label} hint={step.hint} />
            </li>
          ))}
        </ol>
        {/* Design pass: real worksheet sample renders here. No stock, no fakes. */}
        <WireframeMediaSlot
          className="mt-6"
          label="worksheet sample"
          hint="real generated artifact only (ruling C2) · added with the design pass"
        />
      </section>

      <section aria-label="Records and hours" className="mt-16">
        <h2 className="text-2xl font-bold">Records and hours</h2>
        <p className="mt-3 text-neutral-700">
          <WireframeSlot
            label="paperwork band copy"
            hint="hours logging + state records · journeys/07 pillar C"
          />
        </p>
      </section>

      <section aria-label="Trust and privacy" className="mt-16">
        <h2 className="text-2xl font-bold">Trust and privacy</h2>
        <ul className="mt-6 space-y-3">
          {TRUST_SLOTS.map((point) => (
            <li
              key={point.label}
              className="rounded-lg border border-neutral-300 p-4"
            >
              <WireframeSlot label={point.label} hint={point.hint} />
            </li>
          ))}
        </ul>
      </section>

      <section id="waitlist" aria-label="Waitlist" className="mt-16">
        <h2 className="text-2xl font-bold">Join the waitlist</h2>
        <p className="mt-3 text-neutral-700">
          <WireframeSlot
            label="waitlist expectation copy"
            hint="founding-families framing, no pricing (T2)"
          />
        </p>
        <div className="mt-6">
          <WaitlistForm source="organic" />
        </div>
      </section>

      <footer className="mt-16 border-t border-neutral-300 pt-8 text-sm text-neutral-600">
        <p>
          <WireframeSlot
            label="brand promise line"
            hint="journeys/07 §5 taglines"
          />
        </p>
        <p className="mt-4 text-xs text-neutral-500">© 2026 HOMA</p>
      </footer>
    </main>
  );
}
