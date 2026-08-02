import { parsePasswordRecoveryConfirmation } from "@homa/core";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase/server";

function redirectOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  return process.env.NODE_ENV !== "development" && forwardedHost
    ? `https://${forwardedHost}`
    : origin;
}

export async function POST(request: Request) {
  const origin = redirectOrigin(request);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`, 303);
  }

  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const confirmation = parsePasswordRecoveryConfirmation(
    typeof tokenHash === "string" ? tokenHash : null,
    typeof type === "string" ? type : null,
  );
  if (!confirmation) {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`, 303);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: confirmation.tokenHash,
    type: "recovery",
  });

  return NextResponse.redirect(
    error ? `${origin}/forgot-password?error=expired` : `${origin}/reset-password`,
    303,
  );
}
