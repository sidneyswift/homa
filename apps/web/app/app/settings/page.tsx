import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { formatUsPhone } from "@homa/core";

import { getAppData } from "../../../lib/app-data";
import { listPendingInvites } from "../../../lib/family-invites";
import { getFamilyPhones } from "../../../lib/family-phone";
import { getMyFamilyMembers } from "../../../lib/family";
import { getMyMemories } from "../../../lib/memories";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { MemoriesCard } from "../../../components/dashboard/memories-card";
import { PageColumn } from "../../../components/dashboard/page-column";
import { AddChildForm } from "./add-child-form";
import { AdultsCard } from "./adults-card";
import { TextingCard } from "./texting-card";
import { TimeZoneCard } from "./time-zone-card";

/**
 * /app/settings: the family's account basics (add a child, the texting
 * line, the time zone), moved off the dashboard 2026-07-09 (founder ask:
 * the dashboard is for the week, settings get their own page), plus the
 * what-Homa-remembers card (FR-9), which moved here when the card
 * dashboard retired for the in-app report (founder ask 2026-07-10).
 * Same setup gate as the rest of the /app pages (one onboarding for
 * every door); the frame renders in the /app layout. Auth is enforced
 * by proxy.ts; data access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default async function SettingsPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children } = data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [familyPhones, memories, members, pendingInvites] = await Promise.all([
    getFamilyPhones(family.id),
    getMyMemories(family.id),
    getMyFamilyMembers(family.id),
    listPendingInvites(family.id),
  ]);
  const childNames = new Map(children.map((child) => [child.id, child.name]));

  const inviteDateFormat = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  });

  // Homa's own number, shown on the texting card only once this
  // deployment has a live texting line configured.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  return (
    <PageColumn>
      <header>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
          {family.name}
        </p>
        <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
          Settings
        </h1>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <AddChildForm familyId={family.id} />
        <AdultsCard
          adults={members.map((member) => ({
            name: member.display_name ?? "Parent",
            isYou: member.user_id === user?.id,
          }))}
          pendingInvites={pendingInvites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            sentDisplay: `Sent ${inviteDateFormat.format(new Date(invite.created_at))}`,
          }))}
        />
        <TextingCard
          linkedPhones={familyPhones.map((phone) => ({
            e164: phone.phone_e164,
            display: formatUsPhone(phone.phone_e164),
          }))}
          homaNumberDisplay={homaNumber ? formatUsPhone(homaNumber) : null}
        />
        <TimeZoneCard currentTimeZone={family.time_zone} />
        {/* Visible only once something is saved: an empty memory list
            on day one reads as a gap, not a promise. */}
        {memories.length > 0 ? (
          <MemoriesCard memories={memories} childNames={childNames} />
        ) : null}
      </div>
    </PageColumn>
  );
}
