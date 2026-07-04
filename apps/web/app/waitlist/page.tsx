import type { Metadata } from "next";

import { WaitlistForm } from "../../components/waitlist-form";
import { WireframeSlot } from "../../components/wireframe-slot";

/**
 * /waitlist: the direct-to-form page. WIREFRAME: structure only, no drafted
 * copy (founder correction, 2026-07-04); the copy kit (journeys/07 §5) fills
 * the slots during the design pass.
 */

export const metadata: Metadata = {
  title: "Join the waitlist",
  robots: { index: false },
};

export default function WaitlistPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold tracking-wide">HOMA</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">
          Join the waitlist
        </h1>
        <p className="mt-3 text-neutral-700">
          <WireframeSlot
            label="waitlist expectation copy"
            hint="founding-families framing · journeys/07 §5"
          />
        </p>
      </header>

      <div className="mt-8">
        <WaitlistForm source="organic" />
      </div>
    </main>
  );
}
