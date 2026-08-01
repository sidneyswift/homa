/**
 * Shared pieces of the Telnyx provisioning pipeline. Auth, the thin REST
 * helper, and idempotent lookups (find-by-name so re-runs never duplicate
 * paid resources). Used by scripts/telnyx-provision.mts; see that header
 * for the full step order and runbook.
 */

import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { normalizeUsPhoneE164 } from "../packages/core/src/phone";

export const REPO_ROOT = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

try {
  loadEnvFile(path.join(REPO_ROOT, "apps/web/.env.local"));
} catch {
  // Fine when the vars arrive via the environment.
}

const API_BASE = "https://api.telnyx.com/v2";

/** Resource names double as idempotency keys: steps look these up first. */
export const MESSAGING_PROFILE_NAME = "Homa SMS (eve channel)";
export const BRAND_DISPLAY_NAME = "Homa";
export const VOICE_ASSISTANT_NAME = "Homa voice (experiment)";
export const WEBHOOK_URL = "https://thankshoma.com/eve/v1/chat/telnyx";
export const CURRICULUM_ASSISTANT_NAME = "Homa curriculum call";
export const GENERAL_INSIGHT_NAME = "General call summary";
export const GENERAL_INSIGHT_GROUP_NAME = "General calls";
export const CURRICULUM_INSIGHT_NAME = "Curriculum call extraction";
export const CURRICULUM_INSIGHT_GROUP_NAME = "Curriculum calls";

export function requireApiKey(): string {
  const key = process.env.TELNYX_API_KEY;
  if (!key) {
    console.error("TELNYX_API_KEY is not set (apps/web/.env.local)");
    process.exit(2);
  }
  return key;
}

export class TelnyxHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    method: string,
    urlPath: string,
  ) {
    super(`${method} ${urlPath} failed: HTTP ${status}\n${body}`);
    this.name = "TelnyxHttpError";
  }
}

/** Minimal REST helper: bearer auth, JSON in/out, loud typed failure. */
export async function tx<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  urlPath: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new TelnyxHttpError(response.status, text, method, urlPath);
  }
  return (text.length > 0 ? JSON.parse(text) : {}) as T;
}

/** Telnyx wraps most list responses as {data} and 10DLC ones as {records}. */
export function listOf<T>(payload: unknown): T[] {
  const container = payload as { data?: T[]; records?: T[] };
  return container.data ?? container.records ?? [];
}

export interface PhoneNumberRow {
  id: string;
  phone_number: string;
  status: string;
  connection_id?: string | null;
  messaging_profile_id?: string | null;
}

export async function listOwnedNumbers(): Promise<PhoneNumberRow[]> {
  const payload = await tx("GET", "/phone_numbers?page[size]=50");
  return listOf<PhoneNumberRow>(payload);
}

export interface MessagingProfileRow {
  id: string;
  name: string;
  webhook_url?: string | null;
}

export async function findMessagingProfile(): Promise<MessagingProfileRow | undefined> {
  const payload = await tx("GET", "/messaging_profiles?page[size]=50");
  return listOf<MessagingProfileRow>(payload).find(
    (profile) => profile.name === MESSAGING_PROFILE_NAME,
  );
}

export interface BrandRow {
  brandId: string;
  displayName: string;
  entityType: string;
  identityStatus?: string;
}

export async function findBrand(): Promise<BrandRow | undefined> {
  const payload = await tx("GET", "/10dlc/brand?page=1&recordsPerPage=50");
  return listOf<BrandRow>(payload).find(
    (brand) =>
      brand.displayName === BRAND_DISPLAY_NAME &&
      brand.entityType === "SOLE_PROPRIETOR",
  );
}

export interface CampaignRow {
  campaignId: string;
  usecase: string;
  status?: string | null;
  /** TCR review state: PENDING → APPROVED, or FAILED with failureReasons. */
  submissionStatus?: string | null;
  failureReasons?: unknown;
}

/** Returns the brand's live campaign; dead submissions are not a match. */
export async function findCampaign(brandId: string): Promise<CampaignRow | undefined> {
  const payload = await tx(
    "GET",
    `/10dlc/campaign?brandId=${encodeURIComponent(brandId)}&page=1&recordsPerPage=10`,
  );
  return listOf<CampaignRow>(payload).find(
    (campaign) => !/FAILED|REJECTED/i.test(campaign.submissionStatus ?? ""),
  );
}

export interface AssistantRow {
  id: string;
  name: string;
  telephony_settings?: { default_texml_app_id?: string | null };
  /** Present once a call-ended Insight Group is bound. Absent on an
   * assistant provisioned before that step existed, which is exactly the
   * state the general line was in until 2026-07-28 (#171). */
  insight_settings?: { insight_group_id?: string | null };
}

export async function findVoiceAssistant(): Promise<AssistantRow | undefined> {
  const payload = await tx("GET", "/ai/assistants");
  return listOf<AssistantRow>(payload).find(
    (assistant) => assistant.name === VOICE_ASSISTANT_NAME,
  );
}

export async function findAssistantByName(name: string): Promise<AssistantRow | undefined> {
  const payload = await tx("GET", "/ai/assistants");
  return listOf<AssistantRow>(payload).find((assistant) => assistant.name === name);
}

export interface InsightTemplateRow {
  id: string;
  name: string;
  instructions: string;
  webhook?: string;
}

export async function findInsightTemplate(name: string): Promise<InsightTemplateRow | undefined> {
  const payload = await tx("GET", "/ai/conversations/insights");
  return listOf<InsightTemplateRow>(payload).find((insight) => insight.name === name);
}

export interface InsightGroupRow {
  id: string;
  name: string;
  webhook?: string;
  insights?: InsightTemplateRow[];
}

export async function findInsightGroup(name: string): Promise<InsightGroupRow | undefined> {
  const payload = await tx("GET", "/ai/conversations/insight-groups");
  return listOf<InsightGroupRow>(payload).find((group) => group.name === name);
}

/** Founder identity fields for the sole-prop brand, from .env.local only. */
export interface SoleProprietorIdentity {
  firstName: string;
  lastName: string;
  email: string;
  /** US/CA mobile that receives the one-time PIN, E.164. */
  mobilePhone: string;
  street: string;
  city: string;
  /** Two-letter state code. */
  state: string;
  postalCode: string;
}

/** Accepts human-typed US texting numbers and returns canonical +1 E.164. */
export function normalizeTelnyxUsPhone(raw: string | undefined): string | null {
  return raw ? normalizeUsPhoneE164(raw) : null;
}

/**
 * The "send an email" live tool (build-log 2026-07-08), shared verbatim
 * by both voice assistants (general inbound + curriculum call).
 * family_id/child_id are templated straight from each call's own
 * dynamic variables into the URL (never model-supplied); only subject
 * and body are parameters the model actually fills in.
 */
export function sendEmailToolConfig(webhookSecret: string): unknown {
  return {
    type: "webhook",
    webhook: {
      name: "send_email",
      description:
        "Send a real email to this family's own address on file. Use only " +
        "when the parent asks for something in writing, or a written " +
        "summary is clearly the useful next step. Do not overuse.",
      url:
        `https://thankshoma.com/api/voice/tools/send-email?key=${webhookSecret}` +
        `&family_id={{family_id}}&child_id={{child_id}}`,
      method: "POST",
      async: false,
      body_parameters: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "A short, warm email subject line.",
          },
          body: {
            type: "string",
            description:
              "The email body as plain text, 2 to 4 short sentences, in Homa's voice.",
          },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
  };
}

/**
 * The "remember" live tool (agentic ladder item 6, founder direction
 * 2026-07-09), shared by both voice assistants. Same posture as
 * send_email: family_id/child_id are templated from the call's own
 * dynamic variables into the URL, so the model only ever supplies the
 * fact itself. The route funnels every write through the one guarded
 * server path (apps/web/lib/learning/save-memory.ts).
 */
export function rememberToolConfig(webhookSecret: string): unknown {
  return {
    type: "webhook",
    webhook: {
      name: "remember",
      description:
        "Save one durable fact about this family so future conversations " +
        "remember it. Use the moment something worth keeping comes up: " +
        "family rhythm, a child's new interest, what works for teaching " +
        "them. One compact sentence per save. Not for task progress, " +
        "one-off logistics, or anything sensitive shared in distress.",
      url:
        `https://thankshoma.com/api/voice/tools/remember?key=${webhookSecret}` +
        `&family_id={{family_id}}&child_id={{child_id}}`,
      method: "POST",
      async: false,
      body_parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The fact, as one compact self-contained sentence under 300 characters.",
          },
          kind: {
            type: "string",
            enum: ["fact", "what_works"],
            description: "'what_works' only for teaching signal; otherwise 'fact'.",
          },
          child_name: {
            type: "string",
            description:
              "The child's first name exactly as the family context shows it, only when the fact is about one child.",
          },
        },
        required: ["content"],
        additionalProperties: false,
      },
    },
  };
}

/**
 * The "log_hours" live tool (M3-05 slice, founder direction 2026-07-09):
 * a phone call is a capture moment for compliance hours. Same posture as
 * remember: family identity is templated, never model-chosen; the route
 * validates subject and range and refuses vague input with a
 * self-correction message the assistant reads back.
 */
export function logHoursToolConfig(webhookSecret: string): unknown {
  return {
    type: "webhook",
    webhook: {
      name: "log_hours",
      description:
        "Log a block of school time to the family's official hours record " +
        "the moment the parent mentions one ('we did 45 minutes of math'). " +
        "School time only: movies, errands, and waiting rooms never count. " +
        "When the duration is vague ('most of the morning'), ask one short " +
        "'about how long?' first, then log the answer.",
      url:
        `https://thankshoma.com/api/voice/tools/log-hours?key=${webhookSecret}` +
        `&family_id={{family_id}}&child_id={{child_id}}`,
      method: "POST",
      async: false,
      body_parameters: {
        type: "object",
        properties: {
          minutes: {
            type: "integer",
            description: "Length of the block in minutes, 1 to 600. Never a guess.",
          },
          subject: {
            type: "string",
            enum: [
              "reading", "math", "science", "social studies", "art",
              "music", "PE", "co-op", "life skills", "other",
            ],
          },
          child_name: {
            type: "string",
            description:
              "The child's first name exactly as the family context shows it. Leave off for family-wide time like co-op.",
          },
          note: {
            type: "string",
            description: "The parent's own words, e.g. 'about an hour of reading before lunch'.",
          },
        },
        required: ["minutes", "subject"],
        additionalProperties: false,
      },
    },
  };
}

/**
 * The unknown-caller way in (lead-funnel-plan LF-5): texts the signup
 * link to the caller's OWN number. {{telnyx_end_user_target}} is the
 * caller id Telnyx templates at call time; {{family_id}} templates in so
 * the route can refuse linked callers (they have nothing to sign up
 * for). The general assistant only; curriculum-line callers are always
 * linked families.
 */
export function sendSignupLinkToolConfig(webhookSecret: string): unknown {
  return {
    type: "webhook",
    webhook: {
      name: "send_signup_link",
      description:
        "Text the caller Homa's signup link (the free trial at " +
        "thankshoma.com/onboarding) to the number they are calling from. " +
        "Only for callers with no Homa account, only after they say yes " +
        "to the offer. Never call it twice in one conversation.",
      url:
        `https://thankshoma.com/api/voice/tools/send-signup-link?key=${webhookSecret}` +
        `&family_id={{family_id}}&caller={{telnyx_end_user_target}}`,
      method: "POST",
      async: false,
      body_parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  };
}

export function readSoleProprietorIdentity(): SoleProprietorIdentity {
  const fields = {
    firstName: process.env.TELNYX_SP_FIRST_NAME,
    lastName: process.env.TELNYX_SP_LAST_NAME,
    email: process.env.TELNYX_SP_EMAIL,
    mobilePhone: normalizeTelnyxUsPhone(process.env.TELNYX_SP_MOBILE),
    street: process.env.TELNYX_SP_STREET,
    city: process.env.TELNYX_SP_CITY,
    state: process.env.TELNYX_SP_STATE,
    postalCode: process.env.TELNYX_SP_POSTAL,
  };
  if (Object.values(fields).some((value) => !value)) {
    console.error(
      "Sole-prop brand registration needs ALL of these in apps/web/.env.local " +
        "(fill them in your editor, never paste into chat):\n  " +
        [
          "TELNYX_SP_FIRST_NAME",
          "TELNYX_SP_LAST_NAME",
          "TELNYX_SP_EMAIL",
          "TELNYX_SP_MOBILE  (E.164, receives the verification PIN)",
          "TELNYX_SP_STREET",
          "TELNYX_SP_CITY",
          "TELNYX_SP_STATE   (two letters)",
          "TELNYX_SP_POSTAL",
        ].join("\n  "),
    );
    process.exit(2);
  }
  return fields as SoleProprietorIdentity;
}
