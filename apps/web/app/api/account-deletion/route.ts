import { NextResponse } from "next/server";

const PAUSED_RESPONSE = {
  ok: false,
  state: "rejected",
  reason: "temporarily-unavailable",
  message:
    "Account deletion is temporarily unavailable while Homa repairs the final deletion step. Your account and family data have not changed. Billing continues unless you cancel it separately. Email hello@thankshoma.com to request deletion now.",
} as const;

function pausedResponse(): Response {
  return NextResponse.json(PAUSED_RESPONSE, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Current and installed clients must fail before session, body, provider, or
 * database work. The database migration separately fences legacy RPC calls. */
export async function POST(): Promise<Response> {
  return pausedResponse();
}

/** Mobile uses GET before rendering its confirmation form, so GET is fenced
 * too rather than allowing an old client to present an action that cannot run. */
export async function GET(): Promise<Response> {
  return pausedResponse();
}
