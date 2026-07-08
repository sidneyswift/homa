import { mapResumeRequestSchema } from "@homa/core";

import { sendResumeEmail } from "../../../../lib/map/email";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { getFamilyByEmail, mintLinkToken } from "../../../../lib/map/store";

/**
 * POST /api/map/resume
 * "Email me a link": mints a fresh resume token for a known email and mails
 * it. The response never reveals whether the email exists (no enumeration);
 * the answer is always "if we know you, the email is on its way."
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`resume:${clientIp(request)}`, 6)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapResumeRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    const family = await getFamilyByEmail(parsed.data.email);
    if (family) {
      const token = await mintLinkToken(family.id);
      await sendResumeEmail(parsed.data.email, token);
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("map/resume failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: true });
  }
}
