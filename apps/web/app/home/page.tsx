import type { Metadata } from "next";
import Link from "next/link";

import { formatUsPhone } from "@homa/core";

import { Logo } from "../../components/brand/Logo";
import { getCurriculaForChildren, getPendingCurriculumChildIds } from "../../lib/curriculum";
import { getFamilyPhone } from "../../lib/family-phone";
import { getMyChildren, getMyFamily } from "../../lib/family";
import { signOutAction } from "../signin/actions";
import { AddChildForm, CreateFamilyForm } from "./setup-forms";
import { TextingCard } from "./texting-card";

/**
 * /home: the signed-in landing (minimal walking-skeleton slice). One of three
 * states: no family yet (create one), family with no kids (add one), or
 * ready (kids listed, chat link live). Auth is enforced by proxy.ts; data
 * access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

function childAgeLabel(birthMonth: string): string {
  const birth = new Date(birthMonth);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const years = Math.floor(months / 12);
  return years < 2 ? `${months} months` : `${years} years old`;
}

export default async function HomePage() {
  const family = await getMyFamily();
  const children = family ? await getMyChildren(family.id) : [];
  const familyPhone = family ? await getFamilyPhone(family.id) : null;
  const childIds = children.map((child) => child.id);
  const curricula = await getCurriculaForChildren(childIds);
  const pendingCurriculumChildIds = await getPendingCurriculumChildIds(childIds);
  // The texting card only renders once this deployment has a live line.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        <Logo size={28} />
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
          >
            Sign out
          </button>
        </form>
      </header>

      {!family ? (
        <section className="mt-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            Welcome. Let&apos;s set up your family.
          </h1>
          <p className="mt-2 text-body">
            One quick step, then you can tell Homa about your kids.
          </p>
          <div className="mt-8">
            <CreateFamilyForm />
          </div>
        </section>
      ) : (
        <section className="mt-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            {family.name}
          </h1>

          {children.length > 0 ? (
            <>
              <ul className="mt-6 space-y-3">
                {children.map((child) => (
                  <li
                    key={child.id}
                    className="rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <p className="font-display text-lg font-semibold text-strong">
                      {child.name}
                      <span className="ml-2 font-sans text-sm font-normal text-muted">
                        {childAgeLabel(child.birth_month)}
                      </span>
                    </p>
                    {child.profile.interests?.length ? (
                      <p className="mt-1 text-sm text-body">
                        Into: {child.profile.interests.join(", ")}
                      </p>
                    ) : null}
                    {child.profile.focus ? (
                      <p className="mt-1 text-sm text-body">
                        Working on: {child.profile.focus}
                      </p>
                    ) : null}

                    {/* "Call Homa" curriculum feature (founder decision
                        2026-07-07): shows once a call has happened. */}
                    {curricula.has(child.id) ? (
                      <div className="mt-3 rounded-md border border-sage/30 bg-[var(--accent-sage-soft)] p-3">
                        <p className="text-sm font-semibold text-strong">
                          {curricula.get(child.id)?.curriculum.title}
                        </p>
                        <p className="mt-1 text-xs text-body">
                          {curricula.get(child.id)?.curriculum.overview}
                        </p>
                      </div>
                    ) : pendingCurriculumChildIds.has(child.id) ? (
                      <p className="mt-3 text-xs text-muted">
                        Homa is building {child.name}&apos;s curriculum from your call.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <Link
                href="/chat"
                className="mt-8 inline-block rounded-pill bg-brand px-7 py-3.5 font-sans text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
              >
                Talk to Homa
              </Link>
            </>
          ) : (
            <p className="mt-2 text-body">
              Tell Homa about a child to get your first personalized worksheet.
            </p>
          )}

          <div className="mt-10">
            <AddChildForm familyId={family.id} />
          </div>

          {homaNumber ? (
            <div className="mt-6">
              <TextingCard
                linkedPhoneDisplay={
                  familyPhone ? formatUsPhone(familyPhone.phone_e164) : null
                }
                homaNumberDisplay={formatUsPhone(homaNumber)}
              />
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
