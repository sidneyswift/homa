import type { Metadata } from "next";

import { WaitlistForm } from "../../components/waitlist-form";

/**
 * /waitlist: the direct-to-form page. WIREFRAME: minimal copy on purpose;
 * the full copy kit (journeys/07 §5) lands with the design pass.
 */

export const metadata: Metadata = {
  title: "HOMA · join the waitlist",
  description: "The homeschool assistant that shows you it's working.",
  robots: { index: false },
};

export default function WaitlistPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold tracking-wide">HOMA</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">
          Join the founding families
        </h1>
        <p className="mt-3 text-neutral-700">
          We invite families a few at a time. Your invite comes by email.
        </p>
      </header>

      <div className="mt-8">
        <WaitlistForm source="organic" />
      </div>
    </main>
  );
}
