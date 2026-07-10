import { normalizeUsPhoneE164 } from "@homa/core";

import { requireFamily } from "../../../../lib/map/session";
import { rateLimited } from "../../../../lib/map/ratelimit";
import { confirmPhoneClaim } from "../../../../lib/phone-claim";

/**
 * POST /api/phone-claim/confirm { phone, code }: verifies the texted
 * code and routes the number to the caller's own family (the lib owns
 * the fold-vs-move rules and the attempt caps).
 */
export async function POST(request: Request): Promise<Response> {
  const family = await requireFamily();
  if (!family) return Response.json({ ok: false, reason: "no-session" }, { status: 401 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`phone-claim-confirm:${forwarded}`, 20)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: { phone?: string; code?: string };
  try {
    body = (await request.json()) as { phone?: string; code?: string };
  } catch {
    return Response.json({ ok: false, reason: "bad-input" }, { status: 400 });
  }
  const phoneE164 = normalizeUsPhoneE164(body.phone ?? "");
  const code = (body.code ?? "").trim();
  if (!phoneE164 || !/^\d{6}$/.test(code)) {
    return Response.json({ ok: false, reason: "bad-input" }, { status: 400 });
  }

  try {
    const result = await confirmPhoneClaim(family.id, phoneE164, code);
    return Response.json(result);
  } catch (error) {
    console.error("phone-claim confirm failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, reason: "server" }, { status: 502 });
  }
}
