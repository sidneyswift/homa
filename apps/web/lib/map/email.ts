import { reportEmailPreview, reportEmailSubject } from "@homa/core";

import { emailHash } from "../email/hash";
import { mintUnsubscribeToken } from "../email/unsubscribe-token";
import { normalizeRfcMessageId } from "../conversation-continuity/rfc-message-id";
import { escapeHtml } from "../html-escape";
import type { TaskDeliveryVersion } from "../tasks/delivery-version";
import { validateResearchBriefFormat } from "../tasks/research-brief-format";
import { mapDb, type DbJson } from "./db";

/**
 * Transactional email for the map flow, sent through Resend's REST API
 * (M1-08 minimal). Every send here is something the parent explicitly asked
 * for: her child's report, a resume link, one single reminder, or the
 * promised "his checklist is ready" note. No sequences exist by design.
 */

const FROM = "Homa <hello@mail.thankshoma.com>";

/** Replies land in the agent (gateway GW-8, live 2026-07-09 9:2x pm):
 * mail.thankshoma.com has Resend inbound MX now, and every address at
 * that domain routes to the email adapter (agent/channels/email.ts).
 * A reply from a family's registered address becomes a real agent turn;
 * "stop" opts out of evening check-ins; unknown senders are dropped
 * (the site's contact paths remain the human channel). */
const REPLY_TO = "homa@mail.thankshoma.com";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://thankshoma.com";
}

/** The map-flow email kinds the email_sends ledger accepts. This union is
 * the validation for email_sends.kind (free text in the schema, the
 * model_usage posture): a new kind is added here, never in a migration.
 * Task emails (journal, brief, custom) are absent on purpose; the
 * dispatch channel already owns their receipts in conversation_deliveries
 * and one send must never count twice. */
export type EmailLedgerKind =
  | "report_link"
  | "resume_link"
  | "reminder_24h"
  | "retest"
  | "band_ready"
  | "family_invite"
  | "admin_digest"
  // The onboarding drip (funnel work 2026-07-20). DARK until the copy
  // clears review and compliance lands (lib/drip/flag.ts). The ledger
  // kinds exist now so the founder preview and the dark sweep both record.
  | "drip_setup_nudge"
  | "drip_report_unviewed"
  | "drip_add_kid"
  | "drip_loop_back";

interface EmailLedger {
  kind: EmailLedgerKind;
  familyId?: string | null;
  /** Written to email_sends.meta. The drip records WHY this family was
   * picked, in the founder's words, so /admin/drip can answer "why did she
   * get this?" without re-deriving an audience that has since changed. */
  meta?: Record<string, unknown>;
}

interface SendArgs {
  to: string;
  subject: string;
  preview: string;
  heading: string;
  bodyLines: string[];
  cta?: { label: string; url: string };
  footerNote: string;
  replyTo?: string;
  /** The line under the card. Defaults to the signed-up-family framing,
   * which is FALSE for a brand-new invitee; the invite email overrides. */
  outerNote?: string;
  /** When set, the submission outcome is recorded in public.email_sends
   * (founder console, MJ-14). Best-effort: the ledger never breaks the
   * send it is recording. */
  ledger?: EmailLedger;
  /** Extra SMTP headers, e.g. List-Unsubscribe for proactive mail. */
  headers?: Record<string, string>;
}

export type HomaEmailSubmission =
  | {
      status: "submitted";
      /** Resend's POST receipt, used for provider webhooks. */
      providerSubmissionId: string;
      /** Fetches the RFC Message-ID only after the caller made acceptance
       * durable. Failures and timeout return null without changing acceptance. */
      retrieveProviderMessageId(): Promise<string | null>;
    }
  | { status: "rejected" }
  | { status: "unknown" };

export function classifyResendHttpFailure(
  status: number,
): "rejected" | "unknown" {
  return status === 408 || status === 429 || status >= 500
    ? "unknown"
    : "rejected";
}

/** The email_sends error string for a refused Resend POST. A bare
 * "HTTP 422" made the 2026-07-18 founder-console alerts undiagnosable
 * without replaying the send; Resend's body names the offending field. */
export function resendFailureDetail(status: number, body: string): string {
  const detail = body.replace(/\s+/g, " ").trim().slice(0, 300);
  return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
}

export interface EmailSubmissionOptions {
  fetch?: typeof globalThis.fetch;
  rfcMessageIdTimeoutMs?: number;
}

async function retrieveResendRfcMessageId(
  apiId: string,
  apiKey: string,
  options: EmailSubmissionOptions = {},
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.rfcMessageIdTimeoutMs ?? 2_000,
  );
  try {
    const response = await (options.fetch ?? globalThis.fetch)(
      `https://api.resend.com/emails/${encodeURIComponent(apiId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error(
        `map email: RFC Message-ID retrieval failed HTTP ${response.status}`,
      );
      return null;
    }
    const payload = (await response.json()) as { message_id?: unknown };
    const messageId = normalizeRfcMessageId(payload.message_id);
    if (!messageId) {
      console.error("map email: RFC Message-ID unavailable after acceptance");
    }
    return messageId;
  } catch {
    console.error("map email: RFC Message-ID retrieval failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function retrieveResendRfcMessageIdForSubmission(
  providerSubmissionId: string,
  options: EmailSubmissionOptions = {},
): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return await retrieveResendRfcMessageId(
    providerSubmissionId,
    key,
    options,
  );
}

/**
 * recordEmailSend(ledger, to, submission, error): void
 * One email_sends row per submitted map-flow email. Best-effort by law:
 * the ledger must never break the send it is recording, so failures are
 * logged and swallowed (the emitMapEvent posture).
 */
async function recordEmailSend(
  ledger: EmailLedger,
  to: string,
  submission: HomaEmailSubmission,
  error?: string,
): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      insert into public.email_sends (family_id, kind, to_hash, status, provider_message_id, error, meta)
      values (
        ${ledger.familyId ?? null},
        ${ledger.kind},
        ${emailHash(to)},
        ${submission.status},
        ${submission.status === "submitted"
          ? submission.providerSubmissionId
          : null},
        ${error ?? null},
        ${sql.json((ledger.meta ?? {}) as unknown as DbJson)}
      )
    `;
  } catch (ledgerError) {
    console.error("email ledger write failed:", ledgerError);
  }
}

async function submit(
  args: SendArgs,
  options: EmailSubmissionOptions = {},
): Promise<HomaEmailSubmission> {
  const submission = await submitToResend(args, options);
  if (args.ledger) {
    await recordEmailSend(
      args.ledger,
      args.to,
      submission.result,
      submission.error,
    );
  }
  return submission.result;
}

async function submitToResend(
  args: SendArgs,
  options: EmailSubmissionOptions = {},
): Promise<{
  result: HomaEmailSubmission;
  error?: string;
}> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("map email: RESEND_API_KEY not set, skipping send");
    return { result: { status: "rejected" }, error: "RESEND_API_KEY not set" };
  }

  const paragraphs = args.bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#332E29;">${escapeHtml(line)}</p>`,
    )
    .join("");
  const cta = args.cta
    ? `<a href="${escapeHtml(args.cta.url)}" style="display:inline-block;background:#E7602F;color:#ffffff;border-radius:999px;padding:12px 26px;font-weight:700;font-size:16px;text-decoration:none;margin:6px 0 14px;">${escapeHtml(args.cta.label)}</a>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;background:#FBF7F0;padding:24px 12px;font-family:'Hanken Grotesk',-apple-system,'Segoe UI',sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;">${escapeHtml(args.preview)}</span>
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:22px;padding:32px 30px;border:1px solid #E7DDCE;">
    <div style="font-weight:600;font-size:20px;color:#E7602F;margin-bottom:18px;">homa</div>
    <h1 style="font-size:24px;line-height:1.2;color:#221E1A;margin:0 0 16px;">${escapeHtml(args.heading)}</h1>
    ${paragraphs}
    ${cta}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8A7D6C;">${escapeHtml(args.footerNote)}</p>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.6;color:#8A7D6C;text-align:center;">
    ${escapeHtml(args.outerNote ?? "You signed up for Homa at thankshoma.com. Reply to this email and Homa answers. We only email you about your own family's homeschool, never promotions. Every kind of email has an off switch.")}
  </p>
</body></html>`;

  const text = [args.heading, "", ...args.bodyLines.map(stripTags), args.cta ? `${args.cta.label}: ${args.cta.url}` : "", "", stripTags(args.footerNote)].join("\n");

  try {
    const response = await (options.fetch ?? globalThis.fetch)(
      "https://api.resend.com/emails",
      {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        reply_to: [args.replyTo ?? REPLY_TO],
        subject: args.subject,
        html,
        text,
        ...(args.headers && Object.keys(args.headers).length > 0
          ? { headers: args.headers }
          : {}),
      }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = resendFailureDetail(response.status, body);
      console.error(`map email: send failed ${detail}`);
      return {
        result: { status: classifyResendHttpFailure(response.status) },
        error: detail,
      };
    }
    const payload = (await response.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || !payload.id) {
      return {
        result: { status: "unknown" },
        error: "no id in Resend response",
      };
    }
    return {
      result: {
        status: "submitted",
        providerSubmissionId: payload.id,
        retrieveProviderMessageId: async () =>
          await retrieveResendRfcMessageId(payload.id as string, key, options),
      },
    };
  } catch (error) {
    console.error("map email: send failed:", error);
    return {
      result: { status: "unknown" },
      error: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

async function send(args: SendArgs): Promise<boolean> {
  return (await submit(args)).status === "submitted";
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

/**
 * The co-parent invite (multi-parent plan Phase 3): the ONE email Homa
 * ever sends to someone who never signed up, so nothing in it may claim
 * they asked for it. Copy gated 2026-07-11 (reader pass findings: say
 * what a person with no account does, never advertise mid-invite, and
 * the shared footers' "you signed up / you asked" framing is false here,
 * hence the overrides).
 */
export async function sendFamilyInviteEmail(
  to: string,
  inviterName: string,
  familyName: string,
  joinUrl: string,
  familyId?: string,
): Promise<boolean> {
  return send({
    ledger: { kind: "family_invite", familyId },
    to,
    subject: `${inviterName} invited you to your family's Homa`,
    preview: `This invite adds you to ${familyName}'s Homa.`,
    heading: `${inviterName} invited you`,
    bodyLines: [
      `${inviterName} uses Homa, a homeschool companion, for ${familyName}. This invite adds you to the same Homa: the same kids, the same conversations, the same materials.`,
      "Never used Homa? That's expected. Tap the button, then choose Continue with Google. Your first sign-in creates your account inside your family.",
      "The link works for 7 days. If you weren't expecting this, you can ignore it and nothing changes.",
    ],
    cta: { label: "Join your family on Homa", url: joinUrl },
    footerNote: `${inviterName} asked Homa to send this one email. It won't email you again unless you join.`,
    outerNote: `Sent from ${inviterName}'s Homa account at thankshoma.com.`,
  });
}

/** The report-link email's submission, with the full three-way outcome:
 * the exactly-once wrapper (lib/map/report-email.ts) needs to tell a
 * definitive refusal from an unknown one to decide whether its claim is
 * released. Call it through sendReportEmailOnce, never directly, so the
 * one-email-per-child law stays in one place. */
export async function submitReportEmail(
  to: string,
  childName: string,
  reportToken: string,
  familyId?: string,
): Promise<HomaEmailSubmission> {
  const url = `${siteUrl()}/onboarding/r/${reportToken}`;
  return submit({
    ledger: { kind: "report_link", familyId },
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

export async function sendResumeEmail(
  to: string,
  resumeToken: string,
  familyId?: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  return send({
    ledger: { kind: "resume_link", familyId },
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
  familyId?: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  const who = childName ?? "your child";
  return send({
    ledger: { kind: "reminder_24h", familyId },
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
  familyId?: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}&dd=${encodeURIComponent(deepDiveParam)}`;
  return send({
    ledger: { kind: "retest", familyId },
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
function agentComposedEmailArgs(
  to: string,
  subject: string,
  bodyLines: string[],
  replyTo?: string,
): SendArgs {
  return {
    to,
    subject,
    preview: bodyLines[0]?.slice(0, 120) ?? subject,
    heading: subject,
    bodyLines,
    replyTo,
    footerNote: "Homa sent this because you asked, or it followed naturally from a conversation.",
  };
}

export async function sendAgentComposedEmail(
  to: string,
  subject: string,
  bodyLines: string[],
  replyTo?: string,
): Promise<boolean> {
  return send(agentComposedEmailArgs(to, subject, bodyLines, replyTo));
}

export async function submitAgentComposedEmail(
  to: string,
  subject: string,
  bodyLines: string[],
  replyTo?: string,
  options: EmailSubmissionOptions = {},
): Promise<HomaEmailSubmission> {
  return submit(
    agentComposedEmailArgs(to, subject, bodyLines, replyTo),
    options,
  );
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

/** The evening journal prompt's email shell (FR-6 seed; delivered by the
 * dispatch channel, gateway-plan GW-4). The founder-approved frame
 * (subject, preview, CTA, stop line) stays fixed; the body is the
 * agent's own composed prompt for THIS family. Copy history: reader +
 * editor gates and the founder read-aloud, 2026-07-09. */
function journalAgentEmailArgs(
  to: string,
  agentText: string,
  replyTo?: string,
): SendArgs | null {
  const url = `${siteUrl()}/app?draft=journal`;
  const bodyLines = agentText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (bodyLines.length === 0) return null;
  return {
    to,
    subject: "One thing from today?",
    preview: "One or two sentences is plenty.",
    heading: "How did today go?",
    bodyLines,
    replyTo,
    cta: { label: "Tell Homa about today", url },
    footerNote:
      "These evening check-ins are new. Reply 'stop' to this email and they stop.",
  };
}

export async function sendJournalAgentEmail(
  to: string,
  agentText: string,
  replyTo?: string,
): Promise<boolean> {
  const args = journalAgentEmailArgs(to, agentText, replyTo);
  return args ? send(args) : false;
}

export async function submitJournalAgentEmail(
  to: string,
  agentText: string,
  replyTo?: string,
): Promise<HomaEmailSubmission> {
  const args = journalAgentEmailArgs(to, agentText, replyTo);
  return args ? submit(args) : { status: "rejected" };
}

/** The morning research brief's email shell (HT-4, D-ht-2; delivered by
 * the dispatch channel when no texting line is linked). The fixed frame
 * (subject, preview, CTA to the tasks page, off-switch line) stays
 * code-controlled; the body is the agent's own composed brief for THIS
 * family, same posture as the journal shell. */
function researchBriefEmailArgs(
  to: string,
  agentText: string,
  replyTo?: string,
  deliveryVersion: TaskDeliveryVersion = "legacy",
): SendArgs | null {
  if (
    deliveryVersion === "research_brief_v2" &&
    !validateResearchBriefFormat(agentText).ok
  ) {
    return null;
  }
  const url = `${siteUrl()}/app/tasks`;
  const bodyLines = agentText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (bodyLines.length === 0) return null;
  return {
    to,
    subject: "What I looked into last night",
    preview: bodyLines[0]?.slice(0, 120) ?? "One small finding for your kids.",
    heading: "From last night's research",
    bodyLines,
    replyTo,
    cta: { label: "See Homa's tasks", url },
    footerNote:
      "Reply to this email and Homa answers. Morning briefs have an off switch on Homa's tasks.",
  };
}

export async function sendResearchBriefEmail(
  to: string,
  agentText: string,
  replyTo?: string,
  deliveryVersion: TaskDeliveryVersion = "legacy",
): Promise<boolean> {
  const args = researchBriefEmailArgs(
    to,
    agentText,
    replyTo,
    deliveryVersion,
  );
  return args ? send(args) : false;
}

export async function submitResearchBriefEmail(
  to: string,
  agentText: string,
  replyTo?: string,
  deliveryVersion: TaskDeliveryVersion = "legacy",
): Promise<HomaEmailSubmission> {
  const args = researchBriefEmailArgs(
    to,
    agentText,
    replyTo,
    deliveryVersion,
  );
  return args ? submit(args) : { status: "rejected" };
}

export async function sendBandReadyEmail(
  to: string,
  childName: string,
  resumeToken: string,
  familyId?: string,
): Promise<boolean> {
  const url = `${siteUrl()}/api/map/resume-link?t=${resumeToken}`;
  return send({
    ledger: { kind: "band_ready", familyId },
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

/**
 * The onboarding drip's shared standing promise (Appendix A1 of the funnel
 * plan): the revised "we email you about your family's homeschool" line
 * rides the drip emails ONLY. The other transactional emails keep their
 * current footer until this revision clears copy review, so nothing else
 * changes its promise in this pass. DRAFT copy: gate through
 * homa-copy-reviewer then homa-copy-editor, and wire the "stop" opt-out,
 * before dripEnabled() is ever true.
 */
const DRIP_OUTER_NOTE =
  "I email you about your family's homeschool: your child's progress report, a note when something is ready, and the occasional check-in. No marketing. Reply with the word stop to end any of them.";

/** List-Unsubscribe headers for a proactive email (RFC 2369 + RFC 8058
 * one-click). The mailto path always works (an inbound "unsubscribe" reply
 * opts out); the https one-click path is added only when
 * EMAIL_UNSUBSCRIBE_SECRET is set, so a missing secret degrades to
 * mailto-only rather than shipping a dead link. */
function unsubscribeHeaders(to: string): Record<string, string> {
  const mailto = `mailto:${REPLY_TO}?subject=unsubscribe`;
  const token = mintUnsubscribeToken(to);
  if (!token) return { "List-Unsubscribe": `<${mailto}>` };
  const httpsUrl = `${siteUrl()}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
  return {
    "List-Unsubscribe": `<${httpsUrl}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Nudge for a family that signed up but never reached a report: setup
 * unfinished, or no child added yet (Appendix A2). Resume link. */
export async function submitDripSetupNudge(
  to: string,
  firstName: string | null,
  resumeUrl: string,
  familyId?: string,
  reason?: string,
): Promise<HomaEmailSubmission> {
  const hi = firstName ? `Hi ${firstName}, ` : "Hi, ";
  return submit({
    ledger: { kind: "drip_setup_nudge", familyId, meta: reason ? { reason } : {} },
    headers: unsubscribeHeaders(to),
    to,
    subject: firstName
      ? `Pick up where you left off, ${firstName}`
      : "Pick up where you left off",
    preview: "A free report on your child, from a few quick questions.",
    heading: "Your setup is saved",
    bodyLines: [
      `${hi}you started setting up your family on Homa, and it is all here whenever you are ready.`,
      "Add your first child and answer a few questions about what you have seen them do. Homa builds a free report on where they are, written for their age, in about five minutes.",
    ],
    cta: { label: "Add your first child", url: resumeUrl },
    footerNote: "No rush. You can turn these reminders off anytime.",
    outerNote: DRIP_OUTER_NOTE,
  });
}

/** Nudge for a family whose report was emailed but never opened
 * (Appendix A3). The durable per-report token, never the single-slot
 * resume link, so it cannot collide with another email's link. */
export async function submitDripReportUnviewed(
  to: string,
  firstName: string | null,
  childName: string,
  reportUrl: string,
  familyId?: string,
  reason?: string,
): Promise<HomaEmailSubmission> {
  const hi = firstName ? `Hi ${firstName}, ` : "Hi, ";
  return submit({
    ledger: { kind: "drip_report_unviewed", familyId, meta: reason ? { reason } : {} },
    headers: unsubscribeHeaders(to),
    to,
    subject: `${childName}'s progress report is ready to open`,
    preview: `It starts with what ${childName} already does well.`,
    heading: `${childName}'s report is ready`,
    bodyLines: [
      `${hi}${childName}'s report is ready and waiting for you. Written in plain language, it opens with what ${childName} is already doing well, and gently points to what you might explore next.`,
    ],
    cta: { label: `Open ${childName}'s report`, url: reportUrl },
    footerNote:
      "If now isn't the time, it will be here whenever you are. You can turn these off anytime.",
    outerNote: DRIP_OUTER_NOTE,
  });
}

/**
 * The loop-back nudge: a family said yes to a plan and never told Homa how
 * it went. Aimed at the measured cliff in the activation ladder (5 of 36
 * families on 2026-07-20), because those replies are what tune everything
 * Homa makes next.
 *
 * Copy gated 2026-07-20 through homa-copy-reviewer then homa-copy-editor.
 * Reader calls that shaped it: say what Homa already did BEFORE asking for
 * anything, ask one narrow question instead of "what worked and what
 * didn't", and never reassure her that not doing it is "not a failure"
 * (that names a judgment she had not made). Editor calls: each fact once,
 * name the real artifacts, and the CTA is its own verb-first sentence.
 * There is no button on purpose: the reply IS the action, and a button
 * beside a reply instruction read as two competing doors.
 */
export async function submitDripLoopBack(
  to: string,
  childName: string,
  /** The plan named the way a parent would say it: "this month's plan" or
   * "the phonics plan". Built by the caller, because the whole-month plan
   * has no subject to look up. */
  planLabel: string,
  familyId?: string,
  reason?: string,
): Promise<HomaEmailSubmission> {
  return submit({
    ledger: { kind: "drip_loop_back", familyId, meta: reason ? { reason } : {} },
    headers: unsubscribeHeaders(to),
    to,
    subject: `Did ${childName} start ${planLabel}?`,
    preview: "Your answer shapes the next worksheet.",
    heading: `${childName}'s plan is saved`,
    bodyLines: [
      "You said yes to it, and I built all four weeks of activities.",
      `Did ${childName} start any of it yet? Either answer helps.`,
      "Your answer decides what I make next: the worksheets, the activities, the pace.",
      "Reply to this email with one line.",
    ],
    footerNote: "Want these to stop? Reply with the word stop.",
    outerNote: DRIP_OUTER_NOTE,
  });
}

/** Nudge for a one-kid family with evidence of more children (Appendix
 * A4). Never inferred: the sweep only sends this when a durable signal
 * proves more kids exist, so it can preview here but stays out of the
 * automated audience until that join lands. */
export async function submitDripAddKid(
  to: string,
  firstName: string | null,
  firstKid: string,
  addKidUrl: string,
  familyId?: string,
): Promise<HomaEmailSubmission> {
  const hi = firstName ? `Hi ${firstName}, ` : "Hi, ";
  return submit({
    ledger: { kind: "drip_add_kid", familyId },
    headers: unsubscribeHeaders(to),
    to,
    subject: firstName
      ? `Ready to add the next child, ${firstName}?`
      : "Ready to add the next child?",
    preview: "Adding another takes just a few minutes.",
    heading: "Add another child whenever you like",
    bodyLines: [
      `${hi}${firstKid}'s report is set. When you're ready, add another child and Homa builds theirs the same way, written for their own age.`,
    ],
    cta: { label: "Add another child", url: addKidUrl },
    footerNote: "One at a time is perfectly fine. Turn these off anytime.",
    outerNote: DRIP_OUTER_NOTE,
  });
}

/**
 * The founder digest (founder console, MJ-14): one internal email to the
 * founder's own address, sent by the hourly cron once per UTC day when
 * HOMA_ADMIN_DIGEST_EMAIL is set. Internal tooling, so the family-facing
 * footer framing is replaced; the shared shell and ledger stay.
 */
export async function sendAdminDigestEmail(
  to: string,
  subject: string,
  bodyLines: string[],
): Promise<boolean> {
  return send({
    ledger: { kind: "admin_digest" },
    to,
    subject,
    preview: bodyLines[0]?.slice(0, 120) ?? subject,
    heading: subject,
    bodyLines,
    cta: { label: "Open the founder console", url: `${siteUrl()}/admin` },
    footerNote: "Internal digest for the Homa founder console.",
    outerNote: "Sent by your own Homa deployment's hourly cron to its configured founder address.",
  });
}
