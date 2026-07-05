import type { Metadata } from "next";

import { Logo } from "../../components/brand/Logo";
import { WaitlistForm } from "../../components/waitlist-form";

/**
 * /waitlist: the direct-to-form page. Copy final per journeys/07 §5 (the
 * founding-families framing BUILD.md's hard constraints require); design
 * matches the landing page's homa-design v2 pass.
 */

export const metadata: Metadata = {
  title: "Join the waitlist",
  robots: { index: false },
};

export default function WaitlistPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <header>
        <Logo size={28} />
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-strong">
          Join the founding families
        </h1>
        <p className="mt-3 text-body">
          We invite families a few at a time. Your invite comes by email.
        </p>
      </header>

      <div className="mt-8">
        <WaitlistForm source="organic" />
      </div>
    </main>
  );
}
