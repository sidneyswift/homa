import { resolveApiFamily } from "../../../../lib/api-auth";
import { getStateRecordsSummary } from "../../../../lib/compliance/state-records";

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json(
      { ok: false, reason: "auth", note: "Sign in to see your state records." },
      { status: 401 },
    );
  }
  try {
    const summary = await getStateRecordsSummary(auth.familyId);
    if (!summary) {
      return Response.json(
        {
          ok: false,
          reason: "no-state-records",
          note: "Add your state in Settings so Homa can use the reviewed rules for your pack.",
        },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error(
      "state records summary failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "read", note: "Your state records could not load. Try again." },
      { status: 502 },
    );
  }
}
