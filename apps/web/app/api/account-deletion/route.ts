import { NextResponse } from "next/server";

import {
  deletionConfirmationFor,
  requestAccountDeletion,
} from "../../../lib/account-deletion";
import { requireFamilyWithActorFromRequest } from "../../../lib/map/session";
import { mapDb } from "../../../lib/map/db";

/**
 * The only family-deletion entry point. Its family and member identity are
 * derived from the verified browser or mobile bearer session, never from the
 * body. The typed family name is therefore a deliberate confirmation, not an
 * identifier a caller can swap for another family's data.
 */
export async function POST(request: Request): Promise<Response> {
  const actor = await requireFamilyWithActorFromRequest(request);
  if (!actor?.memberUserId) {
    return NextResponse.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { confirmation?: unknown } | null;
  const result = await requestAccountDeletion({
    familyId: actor.family.id,
    userId: actor.memberUserId,
    confirmation: body?.confirmation,
  });
  return NextResponse.json({ ok: result.state !== "rejected", ...result }, {
    status: result.state === "rejected" ? 400 : 200,
  });
}

/** Mobile uses this to render the same exact confirmation phrase. It is
 * authenticated rather than accepting an arbitrary family name from a URL. */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireFamilyWithActorFromRequest(request);
  if (!actor?.memberUserId) {
    return NextResponse.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const sql = mapDb();
  const rows = await sql<Array<{ name: string }>>`
    select name from public.families where id = ${actor.family.id}
  `;
  const family = rows[0];
  if (!family) return NextResponse.json({ ok: false, reason: "no-family" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    confirmation: deletionConfirmationFor(family.name),
  });
}
