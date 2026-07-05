import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getLeadByResumeToken } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";

/**
 * GET /api/map/resume-link?t=TOKEN
 * The click target of every emailed resume/reminder/band-ready link: sets
 * the resume cookie on THIS device and forwards into the flow. Unknown or
 * rotated tokens land on /map cleanly, where the email-first screen offers
 * a fresh link (never an error page for a stale email).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const destination = new URL("/map", request.nextUrl.origin);

  if (token) {
    const lead = await getLeadByResumeToken(token);
    if (lead) {
      const cookieStore = await cookies();
      cookieStore.set(MAP_RESUME_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
      destination.searchParams.set("resumed", "1");
    }
  }

  return NextResponse.redirect(destination);
}
