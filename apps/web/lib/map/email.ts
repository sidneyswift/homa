import { reportEmailPreview, reportEmailSubject } from "@homa/core";

import { mapDb } from "./db";

/**
 * Transactional email for the map flow, sent through Resend's REST API
 * (M1-08 minimal). Every send here is something the parent explicitly asked
 * for: her child's report, a resume link, one single reminder, or the
 * promised "his checklist is ready" note. No sequences exist by design.
 */

const FROM = "Homa <hello@mail.thankshoma.com>";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://thankshoma.com";
}

interface SendArgs {
  to: string;
  subject: string;
  preview: string;
  heading: string;
  bodyLines: string[];
  cta?: { label: string; url: string };
  footerNote: string;
}

async function send(args: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("map email: RESEND_API_KEY not set, skipping send");
    return false;
  }

  const paragraphs = args.bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#332E29;">${line}</p>`,
    )
    .join("");
  const cta = args.cta
    ? `<a href="${args.cta.url}" style="display:inline-block;background:#E7602F;color:#ffffff;border-radius:999px;padding:12px 26px;font-weight:700;font-size:16px;text-decoration:none;margin:6px 0 14px;">${args.cta.label}</a>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;background:#FBF7F0;padding:24px 12px;font-family:'Hanken Grotesk',-apple-system,'Segoe UI',sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;">${args.preview}</span>
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:22px;padding:32px 30px;border:1px solid #E7DDCE;">
    <div style="font-weight:600;font-size:20px;color:#E7602F;margin-bottom:18px;">homa</div>
    <h1 style="font-size:24px;line-height:1.2;color:#221E1A;margin:0 0 16px;">${args.heading}</h1>
    ${paragraphs}
    ${cta}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8A7D6C;">${args.footerNote}</p>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.6;color:#8A7D6C;text-align:center;">
    You asked for this email at thankshoma.com. Reply and a real person answers.
    We only email you your children's progress reports and your invite.
  </p>
</body></html>`;

  const text = [args.heading, "", ...args.bodyLines.map(stripTags), args.cta ? `${args.cta.label}: ${args.cta.url}` : "", "", stripTags(args.footerNote)].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [args.to], subject: args.subject, html, text }),
    });
    if (!response.ok) {
      console.error(`map email: send failed HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("map email: send failed:", error);
    return false;
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

export async function sendReportEmail(to: string, childName: string, reportToken: string): Promise<boolean> {
  const url = `${siteUrl()}/onboarding/r/${reportToken}`;
  return send({
    to,
    subject: reportEmailSubject(childName),
    preview: reportEmailPreview(),
    heading: `${childName}'s progress report is ready`,
    bodyLines: [
      `${childName}'s progress report is ready: what you've seen, checked against national benchmarks for their age.`,
      "It opens with strengths, because that's the truest place to start.",
    ],
    cta: { label: `Open ${childName}'s report`, url },
    footerNote: "This link is yours to keep. Want it gone instead? Reply 'delete' and we'll remove your family's answers.",
  });
}

export async function sendResumeEmail(to: string, resumeToken: string): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  return send({
    to,
    subject: "Pick up where you left off",
    preview: "Your answers are saved. This link picks up on any device.",
    heading: "Everything you told me is saved",
    bodyLines: ["Tap below to pick up exactly where you stopped, on any device."],
    cta: { label: "Continue the questionnaire", url },
    footerNote: "Didn't ask for this? Ignore it. Nothing changes without you.",
  });
}

export async function sendReminderEmail(
  to: string,
  childName: string | null,
  resumeToken: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  const who = childName ?? "your child";
  return send({
    to,
    subject: childName ? `${childName}'s progress report is a few taps away` : "Your child's progress report is a few taps away",
    preview: "Your answers are saved. A few minutes finishes the report.",
    heading: `${who}'s progress report is almost ready`,
    bodyLines: [
      "Your answers are saved. A few more taps and the report is done.",
      "No rush. The link works whenever you are.",
    ],
    cta: { label: "Finish the questionnaire", url },
    footerNote: "This is the only reminder we'll send.",
  });
}

export async function sendRetestEmail(
  to: string,
  childName: string,
  subjectName: string,
  resumeToken: string,
  deepDiveParam: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}&dd=${encodeURIComponent(deepDiveParam)}`;
  return send({
    to,
    subject: `Retest week: see what moved in ${childName}'s ${subjectName.toLowerCase()}`,
    preview: "Four weeks of work deserve a fresh number.",
    heading: `It's retest week for ${childName}`,
    bodyLines: [
      `Four weeks ago you started ${childName}'s ${subjectName.toLowerCase()} plan. Now the fun part: a two-minute re-check to see what moved.`,
      "Answer from what you've seen lately and the report updates itself.",
    ],
    cta: { label: `Retest ${childName}'s ${subjectName.toLowerCase()}`, url },
    footerNote: "A slower month is normal too. The numbers are a map, never a grade.",
  });
}

/**
 * The "send an email" tool's send path (chat/SMS eve tool + the voice
 * webhook tool, build-log 2026-07-08). Agent-composed, not a fixed
 * template: the model supplies subject and body text; the wrapper HTML
 * shell, footer, and unsubscribe framing stay code-controlled exactly
 * like every other Homa email, so the model never emits raw HTML.
 * Callers MUST run brand-law validation (BANNED_WORDS/EM_DASH) on
 * subject/bodyLines before calling this; it is not repeated here so
 * both call sites share one gate helper instead of drifting.
 */
export async function sendAgentComposedEmail(
  to: string,
  subject: string,
  bodyLines: string[],
): Promise<boolean> {
  return send({
    to,
    subject,
    preview: bodyLines[0]?.slice(0, 120) ?? subject,
    heading: subject,
    bodyLines,
    footerNote: "Homa sent this because you asked, or it followed naturally from a conversation.",
  });
}

/** The family's own registered email, for the agent-composed send path
 * only. Server-only (mapDb): the voice webhook has no caller session. */
export async function getFamilyEmail(familyId: string): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ email: string | null }[]>`
    select email from public.families where id = ${familyId}
  `;
  return rows[0]?.email ?? null;
}

export async function sendBandReadyEmail(
  to: string,
  childName: string,
  resumeToken: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  return send({
    to,
    subject: `${childName}'s questionnaire is ready`,
    preview: "The questionnaire for their age just shipped, as promised.",
    heading: `As promised: ${childName}'s questionnaire is ready`,
    bodyLines: [
      `When you signed up, ${childName}'s questionnaire wasn't ready yet, and I promised to tell you the moment it was. It is.`,
      "About five minutes, from what you've seen them do.",
    ],
    cta: { label: `Start ${childName}'s questionnaire`, url },
    footerNote: "Everything you shared is already saved.",
  });
}
