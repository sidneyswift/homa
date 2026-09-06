import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { familyPlanState } from "../../../lib/billing/wall";
import { filingDeadlines } from "../../../lib/compliance/deadlines";
import { mayGenerateLetter } from "../../../lib/compliance/filing-method";
import { FILING_METHODS_BY_STATE } from "../../../lib/compliance/filing-methods.data";
import { composeStatePack, verifiedMonthYear } from "../../../lib/compliance/pack";
import { emitMapEvent } from "../../../lib/map/events";
import { getStateRequirementsDetail } from "../../../lib/map/state-requirements";
import { toBinderMaterials, scopedToViewContext } from "../../../lib/materials/binder";
import {
  findInProgressMaterialsCaller,
  findMaterialsCaller,
} from "../../../lib/materials/library";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { listWorkingPlansForBinder } from "../../../lib/working-plans";
import { PageColumn } from "../../../components/dashboard/page-column";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { BinderView } from "./binder-view";
import { InProgressShelf } from "./in-progress-shelf";
import { StateFilingCard } from "./state-filing-card";
import { StatePackCard } from "./state-pack-card";
import { WorkingPlanShelf } from "./working-plan-shelf";

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

export default async function BinderPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
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

  // Everything she started and never kept (gh#197). A failure to load
  // this must never take the binder down with it: the finals are the
  // page's job, this shelf is the recovery.
  const inProgress = await findInProgressMaterialsCaller(
    supabase,
    family.id,
    MAX_FINAL_MATERIALS,
  ).catch(() => []);
  const inProgressMaterials = scopedToViewContext(
    toBinderMaterials(inProgress, children),
    viewContext,
  );
  const workingPlans = await listWorkingPlansForBinder(family.id).catch(() => []);
  const timeZone = effectiveTimeZone(family.time_zone);

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
      entry: source === "report" ? "report" : "binder",
    });
  }

  // The filing card (gh#421). Distinct from the pack: the pack explains
  // what the state asks for, this is the document that answers it. Shown
  // only where the state actually asks for something, and only where the
  // reviewed table says which shape that something takes.
  const filingMethod = stateDetail
    ? FILING_METHODS_BY_STATE[stateDetail.stateCode]
    : undefined;
  const filingTodayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const filingDue = stateDetail
    ? filingDeadlines({
        stateCode: stateDetail.stateCode,
        schoolYearStartIso: family.school_year_start_on,
        todayIso: filingTodayIso,
      })
    : null;
  // familyPlanState already degrades to "regular" when billing has a bad
  // day, which is the safe direction here: paid-only filing stays hidden
  // instead of offering a button that would 402.
  const planTier = packReady
    ? (await familyPlanState(family.id)).tier
    : "regular";
  const filingKind: "letter" | "worksheet" | "not_required" | null = packReady
    ? filingMethod?.method === "not_required"
      ? "not_required"
      : mayGenerateLetter(filingMethod, filingTodayIso)
        ? "letter"
        : "worksheet"
    : null;

  return (
    <PageColumn>
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-[var(--homa-ink)]">For the whole family</p>
        {packReady ? (
          <StatePackCard
            stateName={stateDetail.stateName}
            verifiedMonthYear={verifiedMonthYear(stateDetail.sourceLastVerified)}
            expectedPages={expectedPages}
          />
        ) : null}
        {filingKind && stateDetail && (planTier === "plus" || planTier === "elite") ? (
          <div className="mt-4">
            <StateFilingCard
              stateName={stateDetail.stateName}
              entitled
              kind={filingKind}
              dueLabel={
                filingDue?.ok && filingDue.deadlines[0]
                  ? new Intl.DateTimeFormat("en-US", {
                      timeZone: "UTC",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }).format(new Date(`${filingDue.deadlines[0].dueOn}T12:00:00Z`))
                  : null
              }
              needsSchoolYearStart={
                filingDue?.ok === false &&
                filingDue.reason === "needs_school_year_start"
              }
            />
          </div>
        ) : null}
        {packReady ? null : (
          <QuietFrame tone="paper" as="section" className="p-6">
            <h2 className="font-display text-xl font-semibold text-[color:var(--homa-ink)]">
              Your state pack
            </h2>
            <p className="mt-2 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_74%,var(--homa-canvas))]">
              I do not have your state&apos;s pack ready yet.
              {family.us_state ? null : (
                <>
                  {" "}
                  Add your state in settings and it will be waiting here.
                </>
              )}
            </p>
          </QuietFrame>
        )}
      </div>
      <WorkingPlanShelf plans={workingPlans} timeZone={timeZone} />
      <InProgressShelf materials={inProgressMaterials} scopeChildName={focusChild?.name ?? null} />
      <BinderView
        materials={binderMaterials}
        scopeChildName={focusChild?.name ?? null}
        timeZone={timeZone}
        now={new Date()}
      />
    </PageColumn>
  );
}
