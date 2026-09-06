import {
  buildHoursRecordPreview,
  getHoursExportRecord,
  hoursRecordRevision,
  HoursRecordChildNotFound,
  renderHoursCsv,
  renderRecordedDaysCsv,
} from "../../../../lib/hours-export";
import { deriveRecordedLearningDays, parseHoursRecordRequest } from "../../../../lib/hours-record-scope";
import { requireFamilyWithActorFromRequest } from "../../../../lib/map/session";

interface HoursExportDependencies {
  resolveActor: typeof requireFamilyWithActorFromRequest;
  getRecord: typeof getHoursExportRecord;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

function refused(reason: string, status: number) {
  return Response.json({ ok: false, reason }, { status, headers: NO_STORE });
}

export function createHoursExportGet(dependencies: HoursExportDependencies) {
  return async function get(request: Request): Promise<Response> {
    const actor = await dependencies.resolveActor(request);
    if (!actor?.memberUserId) {
      return refused("no-session", 401);
    }
    const parsed = parseHoursRecordRequest(new URL(request.url).searchParams);
    if (!parsed) return refused("invalid-scope", 400);
    const { scope, format, revision } = parsed;
    let record;
    try {
      record = await dependencies.getRecord(actor.family.id, scope);
    } catch (error) {
      if (error instanceof HoursRecordChildNotFound) return refused("child-not-found", 404);
      console.error("Hours export could not read the complete scoped record.");
      return refused("record-unavailable", 503);
    }
    const currentRevision = hoursRecordRevision(record, scope);
    if (revision !== null && revision !== currentRevision) return refused("record-changed-refresh-preview", 409);
    if (format === "preview") {
      return Response.json({ ok: true, ...buildHoursRecordPreview(record, scope) }, { headers: NO_STORE });
    }
    const csv = format === "days"
      ? renderRecordedDaysCsv(deriveRecordedLearningDays(record.rows, record.children, scope))
      : renderHoursCsv(record.rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${format === "days" ? "homa-recorded-learning-days" : "homa-school-hours"}.csv"`,
        ...NO_STORE,
      },
    });
  };
}

export const GET = createHoursExportGet({
  resolveActor: requireFamilyWithActorFromRequest,
  getRecord: getHoursExportRecord,
});
