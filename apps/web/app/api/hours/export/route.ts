import {
  getHoursExportForFamily,
  renderHoursCsv,
  type HoursExportRow,
} from "../../../../lib/hours-export";
import { requireFamilyWithActorFromRequest } from "../../../../lib/map/session";

interface HoursExportDependencies {
  resolveActor: typeof requireFamilyWithActorFromRequest;
  getRows: (familyId: string) => Promise<HoursExportRow[]>;
}

export function createHoursExportGet(dependencies: HoursExportDependencies) {
  return async function get(request: Request): Promise<Response> {
    const actor = await dependencies.resolveActor(request);
    if (!actor?.memberUserId) {
      return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
    }
    const rows = await dependencies.getRows(actor.family.id);
    return new Response(renderHoursCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="homa-school-hours.csv"',
        "Cache-Control": "no-store",
      },
    });
  };
}

export const GET = createHoursExportGet({
  resolveActor: requireFamilyWithActorFromRequest,
  getRows: getHoursExportForFamily,
});
