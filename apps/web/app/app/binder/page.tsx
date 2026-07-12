import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { toBinderMaterials, scopedToViewContext } from "../../../lib/materials/binder";
import { findMaterialsCaller } from "../../../lib/materials/library";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { PageColumn } from "../../../components/dashboard/page-column";
import { BinderView } from "./binder-view";

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

  return (
    <PageColumn>
      <BinderView
        materials={binderMaterials}
        scopeChildName={focusChild?.name ?? null}
        timeZone={effectiveTimeZone(family.time_zone)}
      />
    </PageColumn>
  );
}
