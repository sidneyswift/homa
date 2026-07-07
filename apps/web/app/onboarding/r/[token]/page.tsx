import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "../../../../components/brand/Logo";
import { getReportByToken, hasFamilyContext } from "../../../../lib/map/store";
import { ReportView } from "./report-view";

/**
 * The live progress report at its permanent tokenized URL. Rendering lives
 * in ReportView (shared with the public sample at /onboarding/sample).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your child's progress report",
  robots: { index: false },
};

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await getReportByToken(token);

  if (!report) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-20">
        <Logo size={26} />
        <h1 className="mt-8 font-display text-2xl font-bold text-strong">
          This report link isn&apos;t active.
        </h1>
        <p className="mt-3 text-body">
          Want your own child&apos;s progress report? It takes about five minutes.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand hover:bg-brand-hover"
        >
          See where your child stands
        </Link>
      </main>
    );
  }

  // The relocated "About your homeschool" card shows until the family
  // context bag has anything in it (same one-shot rule the old extras
  // step used).
  const familyContextDone = await hasFamilyContext(report.leadId);

  return <ReportView data={report} askHomeschool={!familyContextDone} />;
}
