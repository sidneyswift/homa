import { colorTokens } from "@homa/design/contract";
import { consumePhoneLinkRequest } from "../../../lib/phone-link";
import { escapeHtml } from "../../../lib/html-escape";

/**
 * GET /api/link-phone?t=TOKEN: the click target of the "connect texting
 * to your Homa account" email (lib/phone-link.ts; unknowns pass U3).
 * GET is deliberately side-effect free: mail scanners and prefetchers
 * hit links before the parent does. Possession of the emailed token is
 * the auth, but the single-use mutation happens only after the parent
 * presses the POST confirmation button. The tiny page lives here instead
 * of redirecting into the app, because the click often happens on a
 * device with no session.
 */

function page(title: string, body: string, token?: string): Response {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const form = token
    ? `<form method="post" action="/api/link-phone" style="margin-top:20px;">
        <input type="hidden" name="t" value="${escapeHtml(token)}">
        <button type="submit" style="border:0;border-radius:12px;background:${colorTokens.midnightAction};color:${colorTokens.paper};font-weight:700;font-size:15px;padding:12px 20px;cursor:pointer;">Connect texting</button>
      </form>`
    : "";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle}</title></head>
<body style="margin:0;background:${colorTokens.canvas};font-family:'DM Sans',-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <div style="max-width:420px;background:${colorTokens.paper};border:1px solid ${colorTokens.controlBoundary};border-radius:18px;padding:32px 30px;text-align:center;">
    <div style="font-weight:700;font-size:20px;color:${colorTokens.visualCoral};margin-bottom:14px;">Homa</div>
    <h1 style="font-family:'EB Garamond',Georgia,serif;font-size:28px;color:${colorTokens.ink};margin:0 0 10px;">${safeTitle}</h1>
    <p style="font-size:16px;line-height:1.6;color:${colorTokens.ink};margin:0;">${safeBody}</p>
    ${form}
  </div>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!token) {
    return page("That link is incomplete", "Open the link from the email again, or ask Homa by text for a fresh one.");
  }

  return page(
    "Connect texting to Homa",
    "This connects the phone number from your text signup to the Homa account that received the email.",
    token,
  );
}

export async function POST(request: Request): Promise<Response> {
  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("t") ?? "");
  } catch {
    return page("That link didn't work", "Open the link from the email again, or ask Homa by text for a fresh one.");
  }
  if (!token) {
    return page("That link is incomplete", "Open the link from the email again, or ask Homa by text for a fresh one.");
  }

  try {
    const result = await consumePhoneLinkRequest(token);
    if (result.ok) {
      return page(
        "Texting is connected",
        "That phone number now reaches your family's Homa. Text her anytime; she'll know exactly who you are.",
      );
    }
    if (result.reason === "expired") {
      return page("That link expired", "Text Homa your email again and she'll send a fresh one.");
    }
    if (result.reason === "phone-owned-elsewhere") {
      return page(
        "That number is taken",
        "This phone number is already connected to a different Homa family. If that seems wrong, reply to any Homa email and a person will sort it out.",
      );
    }
    return page("That link didn't work", "Open the link from the email again, or ask Homa by text for a fresh one.");
  } catch (error) {
    console.error("link-phone failed:", error instanceof Error ? error.message : "unknown");
    return page("Something went sideways", "Nothing changed. Try the link once more in a minute.");
  }
}
