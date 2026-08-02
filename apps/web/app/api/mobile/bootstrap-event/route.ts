import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import {
  mobileBootstrapEventSchema,
} from "../../../../lib/mobile-bootstrap-events";

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`mobile-bootstrap:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const parsed = mobileBootstrapEventSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const { kind, stage } = parsed.data;
  if (kind === "attempted") {
    await emitMapEvent("mobile.bootstrap_attempted", { stage });
  } else if (kind === "failed") {
    const { reason } = parsed.data;
    await emitMapEvent("mobile.bootstrap_failed", { stage, reason });
  } else {
    const { reason } = parsed.data;
    await emitMapEvent("mobile.bootstrap_recovered", { stage, reason });
  }
  return Response.json({ ok: true });
}
