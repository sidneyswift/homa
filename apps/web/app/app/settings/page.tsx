import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { formatUsPhone } from "@homa/core";

import { getAppData } from "../../../lib/app-data";
import { getFamilyPhone } from "../../../lib/family-phone";
import { PageColumn } from "../../../components/dashboard/page-column";
import { TimeZoneSync } from "../../../components/dashboard/time-zone-sync";
import { AddChildForm } from "./add-child-form";
import { TextingCard } from "./texting-card";
import { TimeZoneCard } from "./time-zone-card";

/**
 * /app/settings: the family's account basics (add a child, the texting
 * line, the time zone), moved off the dashboard 2026-07-09 (founder ask:
 * the dashboard is for the week, settings get their own page). Same setup
 * gate as the rest of the /app pages (one onboarding for every door); the
 * frame renders in the /app layout. Auth is enforced by proxy.ts; data
 * access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default async function SettingsPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family } = data;

  const familyPhone = await getFamilyPhone(family.id);

  // Homa's own number, shown on the texting card only once this
  // deployment has a live texting line configured.
  const homaNumber =
    process.env.TELNYX_SMS_ENABLED === "true"
      ? (process.env.TELNYX_FROM_NUMBER ?? null)
      : null;

  return (
    <PageColumn>
      {/* Captures the device zone once, while the family row has none:
          this page is reachable straight from the report nav, so it
          cannot assume /home ran the capture first. */}
      {family.time_zone ? null : <TimeZoneSync />}
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
        <TextingCard
          linkedPhoneDisplay={familyPhone ? formatUsPhone(familyPhone.phone_e164) : null}
          homaNumberDisplay={homaNumber ? formatUsPhone(homaNumber) : null}
        />
        <TimeZoneCard currentTimeZone={family.time_zone} />
      </div>
    </PageColumn>
  );
}
