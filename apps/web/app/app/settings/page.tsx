import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ageInMonths, ageLabel, formatUsPhone } from "@homa/core";

import { getAppData } from "../../../lib/app-data";
import { familyHasBillingRelationship } from "../../../lib/billing/portal";
import { familyPlanState } from "../../../lib/billing/wall";
import { getFamilyMemberEmails } from "../../../lib/family-profile";
import { listPendingInvites } from "../../../lib/family-invites";
import { getFamilyPhones } from "../../../lib/family-phone";
import { getMyFamilyHomeschool, getMyFamilyMembers } from "../../../lib/family";
import { getMyMemories } from "../../../lib/memories";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { signOutAction } from "../../signin/actions";
import { MemoriesCard } from "../../../components/dashboard/memories-card";
import { PageColumn } from "../../../components/dashboard/page-column";
import { Icon } from "../../../components/design/Icon";
import { FamilyDetailsSection } from "./family-details-section";
import { HomeschoolSection } from "./homeschool-section";
import { PlanSection } from "./plan-section";
import { KidsSection } from "./kids-section";
import { ParentsSection } from "./parents-section";
import { DeleteFamilyDataCard } from "./delete-family-data-card";

/**
 * /app/settings: the family's account page. Consolidated 2026-07-12
 * (founder direction: "why separate cards, combine them") into ONE
 * family card with sections, kids (editable, with the profile the agent
 * reads), parents (photos, emails, own cell numbers, the main-account
 * tag from migration #72's ruling), how you homeschool (onboarding's
 * context answers, now visible and editable), and details (name,
 * address; the time zone fills itself from device and address), plus
 * the what-Homa-remembers card (FR-9, Homa's own notebook). Same setup
 * gate as the rest of /app; auth by proxy.ts; data access by RLS
 * regardless.
 */

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

// Short month keeps the row's second line from wrapping on phones
// (2026-07-12 UX read, round two).
const BIRTHDAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Born Mar 14, 2019" from the children row's ISO date. */
function birthdayDisplay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : `Born ${BIRTHDAY_FORMAT.format(parsed)}`;
}

export function shouldOpenSignedInAdultPhoneEditor(
  edit: string | readonly string[] | undefined,
): boolean {
  return edit === "phone";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const { edit } = await searchParams;
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children } = data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [familyPhones, memoriesResult, members, pendingInvites, memberEmails, homeschool, hasBilling, plan] =
    await Promise.all([
      getFamilyPhones(family.id),
      getMyMemories(family.id),
      getMyFamilyMembers(family.id),
      listPendingInvites(family.id),
      getFamilyMemberEmails(family.id),
      getMyFamilyHomeschool(family.id),
      familyHasBillingRelationship(family.id),
      familyPlanState(family.id),
    ]);
  const childNames = new Map(children.map((child) => [child.id, child.name]));
  const memberIds = new Set(members.map((member) => member.user_id));
  // getMyFamilyMembers orders by created_at, so the first row is the
  // account owner (the same rule migration #72 routes task texts by).
  const primaryUserId = members[0]?.user_id ?? null;

  const inviteDateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  // Homa's own number, shown only once this deployment has a live
  // texting line configured.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  return (
    <PageColumn>
      <div className="quiet-account-surface mx-auto w-full max-w-[720px]" data-brand-surface="settings">
        <header>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--homa-muted-ink)]">
            {family.name}
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--homa-ink)]">
            Settings
          </h1>
        </header>

        <div className="mt-6 flex flex-col gap-4">
          <section className="quiet-frame quiet-frame--paper rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-6 shadow-sm" data-brand-layer="family-settings">
            <h2 className="font-display text-xl font-semibold text-[var(--homa-ink)]">Your family</h2>

            <KidsSection
              kids={children.map((child, index) => ({
                id: child.id,
                name: child.name,
                birthDate: child.birth_month,
                ageMonths: ageInMonths(child.birth_month),
                ageDisplay: ageLabel(ageInMonths(child.birth_month)),
                birthdayDisplay: birthdayDisplay(child.birth_month),
                interests: child.profile.interests ?? [],
                focus: child.profile.focus ?? null,
                notes: child.profile.notes ?? null,
                avatarUrl: child.avatar_url,
                index,
              }))}
              photoConsentGranted={Boolean(family.child_photo_consent_at)}
            />

            <ParentsSection
              adults={members.map((member) => ({
                userId: member.user_id,
                name: member.display_name ?? "Parent",
                isYou: member.user_id === user?.id,
                isPrimary: member.user_id === primaryUserId,
                avatarUrl:
                  member.avatar_url ??
                  // Legacy fallback: before migration #74's backfill, the one
                  // family-level photo belonged to the family's first adult.
                  (member.user_id === members[0]?.user_id ? family.parent_avatar_url : null),
                email: memberEmails.get(member.user_id) ?? null,
                phoneDisplay: (() => {
                  const phone = familyPhones.find(
                    (row) => row.member_user_id === member.user_id,
                  );
                  return phone ? formatUsPhone(phone.phone_e164) : null;
                })(),
              }))}
              pendingInvites={pendingInvites.map((invite) => ({
                id: invite.id,
                email: invite.email,
                sentDisplay: `Invite sent ${inviteDateFormat.format(new Date(invite.created_at))}`,
              }))}
              legacyPhones={familyPhones
                .filter(
                  (phone) => !phone.member_user_id || !memberIds.has(phone.member_user_id),
                )
                .map((phone) => ({
                  e164: phone.phone_e164,
                  display: formatUsPhone(phone.phone_e164),
                }))}
              homaNumberDisplay={homaNumber ? formatUsPhone(homaNumber) : null}
              homaNumberE164={homaNumber}
              openSignedInAdultPhoneEditor={shouldOpenSignedInAdultPhoneEditor(edit)}
            />

            <HomeschoolSection
              current={homeschool}
              schoolYearStartOn={family.school_year_start_on}
          filingParentName={family.filing_parent_name}
            />

            <PlanSection plan={plan} />

            <FamilyDetailsSection
              details={{
                name: family.name,
                addressLine: family.address_line ?? "",
                city: family.address_city ?? "",
                usState: family.us_state ?? "",
                zip: family.address_zip ?? "",
                timeZone: family.time_zone ?? "",
              }}
            />
          </section>

          {/* Visible only once something is saved: an empty memory list
              on day one reads as a gap, not a promise. */}
          {memoriesResult.loadError || memoriesResult.memories.length > 0 ? (
            <MemoriesCard
              memories={memoriesResult.memories}
              childNames={childNames}
              loadError={memoriesResult.loadError}
            />
          ) : null}

          <DeleteFamilyDataCard
            familyName={family.name}
            billingProvider={plan.billingProvider}
          />
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-[var(--homa-muted-ink)]">Signed in as {user?.email ?? "your account"}</p>
          <div className="flex flex-wrap items-center gap-3">
            {plan.billingProvider === "apple" ? (
              <a
                href="https://apps.apple.com/account/subscriptions"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-5 py-2 text-sm font-medium text-[var(--homa-ink)] transition-colors hover:border-[var(--homa-visual-coral)] hover:text-[var(--homa-ink)]"
              >
                <Icon name="plan" size={16} />
                Manage App Store subscription
              </a>
            ) : hasBilling ? (
              <a
                href="/api/billing/portal"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-5 py-2 text-sm font-medium text-[var(--homa-ink)] transition-colors hover:border-[var(--homa-visual-coral)] hover:text-[var(--homa-ink)]"
              >
                <Icon name="plan" size={16} />
                Manage billing
              </a>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-5 py-2 text-sm font-medium text-[var(--homa-ink)] transition-colors hover:border-[var(--homa-visual-coral)] hover:text-[var(--homa-ink)]"
              >
                <Icon name="logout" size={16} />
                Sign out
              </button>
            </form>
          </div>
        </footer>
      </div>
    </PageColumn>
  );
}
