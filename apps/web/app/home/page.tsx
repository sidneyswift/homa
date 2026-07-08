import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ageInMonths, formatUsPhone, isInScoredRange } from "@homa/core";

import { Logo } from "../../components/brand/Logo";
import { getCurriculaForChildren, getPendingCurriculumChildIds } from "../../lib/curriculum";
import { getFamilyPhone } from "../../lib/family-phone";
import { getChildIdsWithReports, getMyChildren, getMyFamily } from "../../lib/family";
import { signOutAction } from "../signin/actions";
import { AddChildForm } from "./setup-forms";
import { TextingCard } from "./texting-card";

/**
 * /home: the signed-in family dashboard. Setup itself lives in ONE place,
 * /onboarding (founder call 2026-07-08: one onboarding for every door),
 * so a signed-in visit with unfinished setup, no family, family card not
 * done, no kids, or no results yet while an in-range kid waits, redirects
 * there instead of duplicating those forms here. Auth is enforced by
 * proxy.ts; data access is enforced by RLS regardless.
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

  // Unfinished setup lives in /onboarding, the one flow (see module doc).
  if (!family || !family.profile_completed_at) redirect("/onboarding");
  const children = await getMyChildren(family.id);
  if (children.length === 0) redirect("/onboarding");

  const childIds = children.map((child) => child.id);
  const reportChildIds = await getChildIdsWithReports(childIds);
  const inRangeUnmapped = children.some(
    (child) => isInScoredRange(ageInMonths(child.birth_month)) && !reportChildIds.has(child.id),
  );
  // No results yet while an in-range kid waits: finish the questionnaire
  // first (the dashboard comes after results). A family whose kids are
  // all outside the scored range stays here; there is no report to wait
  // for.
  if (reportChildIds.size === 0 && inRangeUnmapped) redirect("/onboarding");

  const familyPhone = await getFamilyPhone(family.id);
  const curricula = await getCurriculaForChildren(childIds);
  const pendingCurriculumChildIds = await getPendingCurriculumChildIds(childIds);
  // Homa's own number, shown on the settings card only once this
  // deployment has a live texting line configured.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="flex items-center justify-between">
        {/* The wordmark is a home link everywhere (tester ask, evidence memo 2). */}
        <Link href="/home" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={28} />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          {family.parent_avatar_url ? (
            // Plain <img>: a remote Supabase storage URL; next/image
            // would need remotePatterns config for a tiny avatar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={family.parent_avatar_url}
              alt=""
              className="h-11 w-11 rounded-full border border-border object-cover"
            />
          ) : null}
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            {family.name}
          </h1>
        </div>

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

        <div className="mt-10">
          <AddChildForm familyId={family.id} />
        </div>

        {/* Settings: the phone number card is always available (it's
            account contact info, not gated behind the texting feature),
            Homa's own number and the texting-specific copy render only
            once this deployment has a live line configured. */}
        <div className="mt-10">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            Settings
          </h2>
          <div className="mt-4">
            <TextingCard
              linkedPhoneDisplay={
                familyPhone ? formatUsPhone(familyPhone.phone_e164) : null
              }
              homaNumberDisplay={homaNumber ? formatUsPhone(homaNumber) : null}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
