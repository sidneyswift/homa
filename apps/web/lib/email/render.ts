import { colorTokens } from "@homa/design/contract";

import { escapeHtml } from "../html-escape";

/**
 * The email-safe Quiet authority palette. Email clients cannot load the web
 * token stylesheet, so these values are copied from the design contract at
 * render time rather than introducing a second color authority.
 */
const EMAIL_BRAND = {
  canvas: colorTokens.canvas,
  paper: colorTokens.paper,
  ink: colorTokens.ink,
  coral: colorTokens.visualCoral,
  brandText: colorTokens.brandText,
  action: colorTokens.midnightAction,
  boundary: colorTokens.controlBoundary,
} as const;

const SAFE_INTERFACE_FONT = "'DM Sans', 'Segoe UI', Arial, sans-serif";
const SAFE_DISPLAY_FONT = "'EB Garamond', Georgia, serif";

export interface EmailRenderArgs {
  preview: string;
  heading: string;
  bodyLines: string[];
  cta?: { label: string; url: string };
  footerNote: string;
  outerNote?: string;
}

export const DEFAULT_EMAIL_OUTER_NOTE =
  "You signed up for Homa at thankshoma.com. Reply to this email and Homa answers. We only email you about your own family's homeschool, never promotions. Every kind of email has an off switch.";

function renderBodyLines(bodyLines: readonly string[]): string {
  return bodyLines
    .map(
      (line) =>
        `<p class="email-body-copy" style="margin:0 0 14px;font-family:${SAFE_INTERFACE_FONT};font-size:16px;line-height:1.6;color:${EMAIL_BRAND.ink};">${escapeHtml(line)}</p>`,
    )
    .join("");
}

function renderCta(cta: EmailRenderArgs["cta"]): string {
  if (!cta) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 14px;">
  <tr>
    <td bgcolor="${EMAIL_BRAND.action}" style="border-radius:14px;background:${EMAIL_BRAND.action};">
      <a class="email-cta" href="${escapeHtml(cta.url)}" style="display:inline-block;border:1px solid ${EMAIL_BRAND.action};border-radius:14px;background:${EMAIL_BRAND.action};padding:12px 26px;font-family:${SAFE_INTERFACE_FONT};font-size:16px;line-height:1.25;font-weight:700;color:${EMAIL_BRAND.paper};text-decoration:none;">${escapeHtml(cta.label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Render the shared Homa email shell for every transactional and proactive
 * variant. This function owns markup and visual atoms only. Provider headers,
 * consent framing, delivery ledgers, and text fallbacks remain at the send
 * boundary in map/email.ts.
 */
export function renderHomaEmailHtml(args: EmailRenderArgs): string {
  const preview = escapeHtml(args.preview);
  const heading = escapeHtml(args.heading);
  const footerNote = escapeHtml(args.footerNote);
  const outerNote = escapeHtml(args.outerNote ?? DEFAULT_EMAIL_OUTER_NOTE);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${heading}</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-body { background:${EMAIL_BRAND.action} !important; }
      .email-card { background:${EMAIL_BRAND.canvas} !important; border-color:${EMAIL_BRAND.boundary} !important; }
      .email-heading, .email-body-copy, .email-footer-note { color:${EMAIL_BRAND.ink} !important; }
      .email-outer-note { color:${EMAIL_BRAND.paper} !important; }
      .email-cta { color:${EMAIL_BRAND.paper} !important; }
    }
    @media screen and (max-width:600px) {
      .email-gutter { padding-left:16px !important; padding-right:16px !important; }
      .email-card { padding:26px 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.canvas};">
  <span class="email-preheader" style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${preview}</span>
  <table role="presentation" class="email-body" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:0;background:${EMAIL_BRAND.canvas};font-family:${SAFE_INTERFACE_FONT};">
    <tr>
      <td class="email-gutter" align="center" style="padding:36px 12px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:560px;margin:0 auto;">
          <tr>
            <td style="padding:0 2px 14px;font-family:${SAFE_INTERFACE_FONT};font-size:19px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_BRAND.brandText};">
              Homa <span aria-hidden="true" style="color:${EMAIL_BRAND.coral};">·</span>
            </td>
          </tr>
          <tr>
            <td class="email-card" bgcolor="${EMAIL_BRAND.paper}" style="padding:32px 30px;background:${EMAIL_BRAND.paper};border:1px solid ${EMAIL_BRAND.boundary};border-radius:18px;">
              <div aria-hidden="true" style="height:4px;width:48px;margin:0 0 22px;background:${EMAIL_BRAND.coral};border-radius:4px;"></div>
              <h1 class="email-heading" style="margin:0 0 16px;font-family:${SAFE_DISPLAY_FONT};font-size:30px;line-height:1.12;font-weight:500;letter-spacing:-0.01em;color:${EMAIL_BRAND.ink};">${heading}</h1>
              ${renderBodyLines(args.bodyLines)}
              ${renderCta(args.cta)}
              <p class="email-footer-note" style="margin:16px 0 0;font-family:${SAFE_INTERFACE_FONT};font-size:13px;line-height:1.6;color:${EMAIL_BRAND.brandText};">${footerNote}</p>
            </td>
          </tr>
          <tr>
            <td class="email-outer-note" style="padding:14px 4px 0;font-family:${SAFE_INTERFACE_FONT};font-size:12px;line-height:1.6;text-align:center;color:${EMAIL_BRAND.brandText};">
              ${outerNote}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
