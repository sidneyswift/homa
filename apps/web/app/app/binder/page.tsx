import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { composeStatePack, verifiedMonthYear } from "../../../lib/compliance/pack";
import { emitMapEvent } from "../../../lib/map/events";
import { getStateRequirementsDetail } from "../../../lib/map/state-requirements";
import { toBinderMaterials, scopedToViewContext } from "../../../lib/materials/binder";
import { findMaterialsCaller } from "../../../lib/materials/library";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { PageColumn } from "../../../components/dashboard/page-column";
import { BinderView } from "./binder-view";
import { StatePackCard } from "./state-pack-card";

/**
 * /app/binder (binder design directions, 2026-07-11): the family's
 * approved materials, browsable in one place. First release scope per
 * the doc's release ladder: finalized materials only, no separate
 * switcher because the sidebar's existing family/child view context
 * already narrows every other tab the same way. Auth is enforced by
 * proxy.ts; data access by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Binder",
  robots: { index: false },
};

// Comfortably above what one family accrues before search matters; a
// hard ceiling here is a stopgap, not a design (M2+ scope: pagination or
// a server-side search once a family's library outgrows one page).
const MAX_FINAL_MATERIALS = 300;

export default async function BinderPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children } = data;

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );

  const supabase = await createSupabaseServerClient();
  const materials = await findMaterialsCaller(supabase, family.id, {
    status: "final",
    limit: MAX_FINAL_MATERIALS,
  });
  const binderMaterials = scopedToViewContext(
    toBinderMaterials(materials, children),
    viewContext,
  );

  const focusChild =
    viewContext.kind === "child"
      ? children.find((child) => child.id === viewContext.childId) ?? null
      : null;

  // The state pack card (plans/2026-07-28-state-pack.md D6): render-time
  // join against the reviewed reference table, never a baked copy. A
  // missing state or row degrades to calm copy, never an error.
  const stateDetail = family.us_state
    ? await getStateRequirementsDetail(family.us_state).catch(() => null)
    : null;
  const packReady =
    stateDetail !== null && stateDetail.verificationStatus === "verified";
  const expectedPages = packReady
    ? composeStatePack({
        detail: stateDetail,
        family: {
          familyName: family.name,
          parentName: null,
          children: children.map((child) => ({
            name: child.name,
            birthdate: child.birth_month ?? null,
          })),
        },
        packId: "preview",
        generatedOn: "",
      }).pages.length
    : 0;
  if (packReady) {
    await emitMapEvent("compliance.ruleset_viewed", {
      family_id: family.id,
      state: stateDetail.stateCode,
      has_verified_date: Boolean(stateDetail.sourceLastVerified),
    });
  }

  return (
    <PageColumn>
      <div className="mb-6">
        {packReady ? (
          <StatePackCard
            stateName={stateDetail.stateName}
            verifiedMonthYear={verifiedMonthYear(stateDetail.sourceLastVerified)}
            expectedPages={expectedPages}
          />
        ) : (
          <section className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-strong">
              Your state pack
            </h2>
            <p className="mt-2 text-sm text-body">
              I do not have your state&apos;s pack ready yet.
              {family.us_state ? null : (
                <>
                  {" "}
                  Add your state in settings and it will be waiting here.
                </>
              )}
            </p>
          </section>
        )}
      </div>
      <BinderView
        materials={binderMaterials}
        scopeChildName={focusChild?.name ?? null}
        timeZone={effectiveTimeZone(family.time_zone)}
        now={new Date()}
      />
    </PageColumn>
  );
}
