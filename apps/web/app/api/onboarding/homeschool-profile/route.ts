import { HOMESCHOOL_STYLES } from "@homa/core";
import { z } from "zod";

import { saveFamilyContext } from "../../../../lib/map/store";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";

/**
 * POST /api/onboarding/homeschool-profile
 * The homeschool-profile card's own write, so filling it in costs no
 * model turn, the same pattern as /api/onboarding/basics.
 *
 * Merges through the exact same path save_homeschool_profile already
 * uses in conversation (saveFamilyContext's context jsonb patch), so a
 * style picked here and one mentioned later in passing land in one bag
 * rather than two shapes. An empty array still counts as a real answer:
 * it means she saw the chips and picked none, which the conversational
 * tool has no way to express (it only ever writes what she volunteered).
 *
 * The family comes from the resume cookie or the session, never the
 * body (tenancy law).
 */

const homeschoolProfileSchema = z.object({
  styles: z.array(z.enum(HOMESCHOOL_STYLES)).max(HOMESCHOOL_STYLES.length),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-homeschool-profile:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const parsed = homeschoolProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    await saveFamilyContext(family.id, { styles: parsed.data.styles });
    return Response.json({ ok: true, savedFields: ["styles"] });
  } catch (error) {
    console.error(
      "onboarding/homeschool-profile failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
