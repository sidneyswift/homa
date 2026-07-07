/**
 * Shared pieces of the Telnyx provisioning pipeline. Auth, the thin REST
 * helper, and idempotent lookups (find-by-name so re-runs never duplicate
 * paid resources). Used by scripts/telnyx-provision.mts; see that header
 * for the full step order and runbook.
 */

import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

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
}

export async function findVoiceAssistant(): Promise<AssistantRow | undefined> {
  const payload = await tx("GET", "/ai/assistants");
  return listOf<AssistantRow>(payload).find(
    (assistant) => assistant.name === VOICE_ASSISTANT_NAME,
  );
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

/** Accepts human-typed US numbers ("954-990-3497", "(954) 990 3497") and
 *  returns +E.164; anything already +prefixed passes through. */
function normalizeUsPhone(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/gu, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

export function readSoleProprietorIdentity(): SoleProprietorIdentity {
  const fields = {
    firstName: process.env.TELNYX_SP_FIRST_NAME,
    lastName: process.env.TELNYX_SP_LAST_NAME,
    email: process.env.TELNYX_SP_EMAIL,
    mobilePhone: normalizeUsPhone(process.env.TELNYX_SP_MOBILE),
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
