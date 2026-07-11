import { buildHomaVcard } from "../../lib/contact-card";

/**
 * GET /homa.vcf: Homa's contact card. Telnyx fetches this URL when the
 * card rides an outbound MMS (lib/contact-card.ts), and it doubles as a
 * plain download link. A route handler instead of a public/ file so the
 * content type is exactly text/vcard, the type Telnyx's MMS allowlist
 * names (static .vcf serving can fall back to the older text/x-vcard).
 */
export async function GET(): Promise<Response> {
  return new Response(buildHomaVcard(), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'inline; filename="homa.vcf"',
      // The card changes only on deploy; let CDNs hold it for a day.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
