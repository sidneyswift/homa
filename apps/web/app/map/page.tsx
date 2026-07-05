import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../components/brand/Logo";
import { MapFlow } from "./map-flow";

/**
 * /map: the child's map flow (lead magnet v2, replaces the plain waitlist).
 * Email first, then kids, then a five-minute observable checklist per child,
 * then the report. Every answer auto-saves server-side; the httpOnly resume
 * cookie restores the flow on return visits.
 */

export const metadata: Metadata = {
  title: "Meet your child's map",
  description:
    "Answer a five-minute checklist about what you've seen your child do. Homa maps it against national benchmarks and sends you their map, free.",
};

export default function MapPage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 pt-6">
        <Link href="/" aria-label="Homa home" className="inline-flex">
          <Logo size={26} />
        </Link>
        <span className="text-sm text-subtle">a checklist for you, never a test for them</span>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <MapFlow />
      </main>
      <footer className="mx-auto w-full max-w-xl px-6 pb-8 text-sm text-subtle">
        <p>
          We only email you your children&apos;s maps and your founding-family invite. Delete
          anytime. <Link className="text-brand underline" href="/map/method">How the map is made</Link>
          {" \u00b7 "}
          <Link className="text-brand underline" href="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
