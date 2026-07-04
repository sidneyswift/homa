import type { Metadata } from "next";

import { WaitlistForm } from "../../components/waitlist-form";

/**
 * /waitlist: the direct-to-form page (BUILD.md Deliverable 0). The one link
 * to share anywhere: Alessa says "thankshoma.com" or texts
 * thankshoma.com/waitlist, and either way the mom is one screen from
 * captured. Minimal payload, form first, works on bad convention-center
 * wifi. Channel attribution rides on utm params when a link carries them.
 *
 * WIREFRAME: styling is placeholder for the design pass; copy is binding
 * (journeys/07 §5 conference one-liner, founding-families framing).
 */

export const metadata: Metadata = {
  title: "HOMA · join the founding families",
  description:
    "HOMA shows you exactly where each child stands, no tests, then makes the materials to help them grow, and proves it worked.",
  robots: { index: false },
};

export default function WaitlistPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold tracking-wide">HOMA</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">
          Exactly where each child stands, no tests. Then the materials to
          help them grow, and proof it worked.
        </h1>
        <p className="mt-3 text-neutral-700">
          We&apos;re inviting founding families a few at a time. Leave your
          email and your invite comes to you, nothing to remember later.
        </p>
      </header>

      <div className="mt-8">
        <WaitlistForm source="organic" />
      </div>

      <section className="mt-10 space-y-3 text-sm text-neutral-600">
        <p>
          Homa is for you. Your child never talks to an AI, never logs in,
          never needs a screen. They get a printed page and your voice.
        </p>
        <p>You&apos;ve got this. HOMA&apos;s got the rest.</p>
      </section>
    </main>
  );
}
