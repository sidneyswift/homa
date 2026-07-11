import { NextResponse, type NextRequest } from "next/server";

import { setMapResumeCookie } from "../../../../lib/map/resume-cookie";
import { getFamilyByResumeToken } from "../../../../lib/map/store";

/**
 * GET /api/map/resume-link?t=TOKEN
 * The click target of every emailed resume/reminder/band-ready link: sets
 * the resume cookie on THIS device and forwards into the flow. Unknown or
 * rotated tokens land on /onboarding cleanly, where the email-first screen
 * offers a fresh link (never an error page for a stale email).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const destination = new URL("/onboarding", request.nextUrl.origin);

  if (token) {
    const family = await getFamilyByResumeToken(token);
    if (family) {
      await setMapResumeCookie(token);
      destination.searchParams.set("resumed", "1");
      // Retest emails carry a deep-dive target ("childId.subjectId"); pass it
      // through so the flow opens straight on the subject's re-check.
      const deepDive = request.nextUrl.searchParams.get("dd");
      if (deepDive && /^[0-9a-f-]{36}\.[a-z_]+$/.test(deepDive)) {
        destination.searchParams.set("dd", deepDive);
      }
    }
  }

  return NextResponse.redirect(destination);
}
