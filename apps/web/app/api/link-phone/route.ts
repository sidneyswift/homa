import { consumePhoneLinkRequest } from "../../../lib/phone-link";

/**
 * GET /api/link-phone?t=TOKEN: the click target of the "connect texting
 * to your Homa account" email (lib/phone-link.ts; unknowns pass U3).
 * Possession of the emailed token is the auth. Renders a tiny
 * confirmation page instead of redirecting into the app, because the
 * click often happens on a device with no session.
 */

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#FBF7F0;font-family:'Hanken Grotesk',-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <div style="max-width:420px;background:#fff;border:1px solid #E7DDCE;border-radius:22px;padding:32px 30px;text-align:center;">
    <div style="font-weight:600;font-size:20px;color:#E7602F;margin-bottom:14px;">homa</div>
    <h1 style="font-size:22px;color:#221E1A;margin:0 0 10px;">${title}</h1>
    <p style="font-size:16px;line-height:1.6;color:#332E29;margin:0;">${body}</p>
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
