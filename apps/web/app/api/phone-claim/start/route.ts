import { normalizeUsPhoneE164 } from "@homa/core";

import { requireFamily } from "../../../../lib/map/session";
import { rateLimited } from "../../../../lib/map/ratelimit";
import { startPhoneClaim } from "../../../../lib/phone-claim";

/**
 * POST /api/phone-claim/start { phone }: texts a verification code to
 * the number so the caller's OWN family (cookie or auth session, never
 * the body) can claim it. Serves both the onboarding family step and
 * the settings texting card when a number is "already linked".
 */
export async function POST(request: Request): Promise<Response> {
  const family = await requireFamily();
  if (!family) return Response.json({ ok: false, reason: "no-session" }, { status: 401 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`phone-claim-start:${forwarded}`, 10)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return Response.json({ ok: false, reason: "bad-phone" }, { status: 400 });
  }
  const phoneE164 = normalizeUsPhoneE164(body.phone ?? "");
  if (!phoneE164) return Response.json({ ok: false, reason: "bad-phone" }, { status: 400 });

  try {
    const result = await startPhoneClaim(family.id, phoneE164);
    return Response.json(result.ok ? { ok: true } : { ok: false, reason: result.reason });
  } catch (error) {
    console.error("phone-claim start failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, reason: "server" }, { status: 502 });
  }
}
