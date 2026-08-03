import { colorTokens } from "@homa/design/contract";
import { suppressHash } from "../../../../lib/email/suppression";
import { verifyUnsubscribeToken } from "../../../../lib/email/unsubscribe-token";

/**
 * /api/email/unsubscribe  (drip compliance, funnel work 2026-07-20)
 *
 * GET renders a confirmation page and NEVER mutates: security scanners and
 * mail-client link prefetchers issue GETs, so a GET that unsubscribed would
 * opt people out by accident. The actual opt-out is POST only.
 *
 * POST suppresses the token's address for the 'drip' scope. It serves both
 * the confirmation page's button and RFC 8058 one-click (List-Unsubscribe
 * -Post: List-Unsubscribe=One-Click), which posts here with the token in
 * the query string. Idempotent: unsubscribing twice is a no-op upsert.
 *
 * The token is a signed address hash (lib/email/unsubscribe-token.ts), so
 * this route holds no raw address and needs no session.
 */

function tokenFrom(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title></head>
<body style="margin:0;background:${colorTokens.canvas};font-family:'DM Sans',-apple-system,'Segoe UI',sans-serif;padding:48px 16px;">
  <div style="max-width:460px;margin:0 auto;background:${colorTokens.paper};border:1px solid ${colorTokens.controlBoundary};border-radius:18px;padding:32px 30px;text-align:center;">
    <div style="font-weight:700;font-size:20px;color:${colorTokens.visualCoral};margin-bottom:18px;">Homa</div>
    ${body}
  </div>
</body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const token = tokenFrom(request);
  const hash = verifyUnsubscribeToken(token);
  if (!hash) {
    return page(
      "Link not valid",
      `<h1 style="font-family:'EB Garamond',Georgia,serif;font-size:28px;color:${colorTokens.ink};margin:0 0 12px;">This link isn't valid</h1>
       <p style="color:#5B5852;font-size:15px;line-height:1.6;margin:0;">It may have expired. You can reply "unsubscribe" to any Homa email and we'll take care of it.</p>`,
      400,
    );
  }
  const action = `/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
  return page(
    "Unsubscribe",
    `<h1 style="font-family:'EB Garamond',Georgia,serif;font-size:28px;color:${colorTokens.ink};margin:0 0 12px;">Turn off these reminders?</h1>
     <p style="color:#5B5852;font-size:15px;line-height:1.6;margin:0 0 20px;">You'll stop getting the reminders about finishing setup and opening your report. Emails you ask for, like a report, still come through.</p>
     <form method="post" action="${action}">
       <button type="submit" style="display:inline-block;background:${colorTokens.midnightAction};color:${colorTokens.paper};border:none;border-radius:12px;padding:12px 26px;font-weight:700;font-size:15px;cursor:pointer;">Turn off reminders</button>
     </form>`,
  );
}

export async function POST(request: Request): Promise<Response> {
  const hash = verifyUnsubscribeToken(tokenFrom(request));
  if (!hash) {
    return page(
      "Link not valid",
      `<p style="color:#5B5852;font-size:15px;line-height:1.6;margin:0;">This unsubscribe link isn't valid. Reply "unsubscribe" to any Homa email and we'll take care of it.</p>`,
      400,
    );
  }
  await suppressHash(hash, "drip", "unsubscribe");
  return page(
    "Unsubscribed",
    `<h1 style="font-family:'EB Garamond',Georgia,serif;font-size:28px;color:${colorTokens.ink};margin:0 0 12px;">Done</h1>
     <p style="color:#5B5852;font-size:15px;line-height:1.6;margin:0;">You won't get these reminders anymore. Anything you ask Homa for still reaches you.</p>`,
  );
}
