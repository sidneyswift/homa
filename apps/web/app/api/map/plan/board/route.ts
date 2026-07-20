import { getPlansForChildren, getReportsForChildren } from "../../../../../lib/dashboard";
import { getMyChildren, getMyFamily } from "../../../../../lib/family";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { effectiveTimeZone } from "../../../../../lib/time-zone";
import type { PlanBoardPayload } from "../../../../../lib/plan-board";

/**
 * GET /api/map/plan/board
 * The week board's data for the chat's planner canvas: the same
 * children, report tokens, and plans the /app/planner page assembles
 * server-side, shaped for a client fetch. Signed-in sessions only (the
 * chat lives behind /app auth), and every row read runs under the
 * caller's RLS context, so the response can only ever carry the
 * caller's own family.
 */

export async function GET(request: Request): Promise<Response> {
  if (rateLimited(`plan-board:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await getMyFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  try {
    const children = await getMyChildren(family.id);
    const childIds = children.map((child) => child.id);
    const [reports, plans] = await Promise.all([
      getReportsForChildren(childIds),
      getPlansForChildren(childIds),
    ]);
    const board: PlanBoardPayload = {
      timeZone: effectiveTimeZone(family.time_zone),
      kids: children.map((child) => ({
        id: child.id,
        name: child.name,
        birthMonth: child.birth_month,
        avatarUrl: child.avatar_url,
        reportToken: reports.get(child.id)?.token ?? null,
      })),
      plans,
    };
    return Response.json({ ok: true, board });
  } catch (error) {
    console.error(
      "map/plan/board failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
