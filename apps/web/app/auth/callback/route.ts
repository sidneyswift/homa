import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * OAuth (and email-link) code-exchange callback. Google redirects here with
 * a `?code=...`; we exchange it for a session (the @supabase/ssr browser
 * client stashed the PKCE verifier in a cookie the server can read), the
 * exchange writes the auth cookies, then we send the user on to /app.
 *
 * The redirectTo pointing here must be on Supabase's redirect allow list
 * (dashboard → Authentication → URL Configuration).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/app";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) next = "/app";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=oauth`);
}
