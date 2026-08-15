/**
 * Telnyx provisioning for Homa's voice + text experiment (founder decision
 * 2026-07-07, build-log). Idempotent: every step looks up existing
 * resources by name first, so re-running never buys or registers twice.
 * Stops cleanly at the two human gates (account funding, OTP PIN).
 *
 * What it provisions, in order:
 *   1. Balance check. The dollar figures recorded in the 2026-07-07 build
 *      notes are historical estimates; verify current Telnyx pricing before
 *      any paid order or registration.
 *   2. One US local number with SMS + voice (prefers area code 202).
 *   3. Messaging profile pointed at the eve webhook
 *      (https://thankshoma.com/eve/v1/chat/telnyx) + number assignment.
 *   4. Sole Proprietor 10DLC brand (no EIN needed; identity fields come
 *      from TELNYX_SP_* in apps/web/.env.local, PIN goes to the founder's
 *      mobile). Verify with:  pnpm telnyx:provision --verify-otp 123456
 *   5. Sole Proprietor campaign + phone number assignment.
 *   6. "Homa voice (experiment)" AI assistant attached to the number for
 *      calls only (messaging stays with the eve channel).
 *
 * Usage:
 *   pnpm telnyx:provision                  walk all steps, skip done ones
 *   pnpm telnyx:provision --verify-otp N   submit the brand OTP PIN
 *   pnpm telnyx:provision --status         report resource state; if the named
 *                                         assistant exists, also sync its
 *                                         instructions and tools by POST
 *
 * Env: apps/web/.env.local (TELNYX_API_KEY required; TELNYX_SP_* for the
 * brand step). Exit codes: 0 = done or cleanly waiting on a human gate,
 * 1 = API failure, 2 = missing env.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  BRAND_DISPLAY_NAME,
  MESSAGING_PROFILE_NAME,
  REPO_ROOT,
  TelnyxHttpError,
  VOICE_ASSISTANT_NAME,
  WEBHOOK_URL,
  GENERAL_INSIGHT_GROUP_NAME,
  GENERAL_INSIGHT_NAME,
  findBrand,
  findCampaign,
  findInsightGroup,
  findInsightTemplate,
  findMessagingProfile,
  findVoiceAssistant,
  listOf,
  listOwnedNumbers,
  logHoursToolConfig,
  readSoleProprietorIdentity,
  rememberToolConfig,
  requireApiKey,
  sendEmailToolConfig,
  sendSignupLinkToolConfig,
  tx,
  type AssistantRow,
  type BrandRow,
  type InsightGroupRow,
  type InsightTemplateRow,
  type MessagingProfileRow,
  type PhoneNumberRow,
} from "./telnyx-shared.mts";

const PREFERRED_AREA_CODE = "202";
/** Ordering a number is a paid action; skip it under this balance. */
const MIN_BALANCE_FOR_NUMBER_USD = 5;
/** Brand $4 + campaign vetting $15, with a little headroom. */
const MIN_BALANCE_FOR_10DLC_USD = 20;

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const otpFlagIndex = args.indexOf("--verify-otp");
const otpPin = otpFlagIndex >= 0 ? args[otpFlagIndex + 1] : undefined;

requireApiKey();

function log(step: string, message: string): void {
  console.log(`[${step}] ${message}`);
}

async function checkBalance(): Promise<number> {
  const payload = await tx<{ data: { balance: string; currency: string } }>(
    "GET",
    "/balance",
  );
  const balance = Number.parseFloat(payload.data.balance);
  log("balance", `$${payload.data.balance} ${payload.data.currency}`);
  return balance;
}

async function ensureNumber(): Promise<PhoneNumberRow | undefined> {
  const owned = await listOwnedNumbers();
  if (owned.length > 0) {
    log("number", `already own ${owned[0].phone_number} (${owned[0].status})`);
    return owned[0];
  }
  if (statusOnly) {
    log("number", "none owned");
    return undefined;
  }

  const search = async (areaCode?: string) =>
    listOf<{ phone_number: string }>(
      await tx(
        "GET",
        "/available_phone_numbers?filter[country_code]=US&filter[features][]=sms&filter[features][]=voice&filter[features][]=mms&filter[limit]=3" +
          (areaCode ? `&filter[national_destination_code]=${areaCode}` : ""),
      ),
    );

  let candidates = await search(PREFERRED_AREA_CODE);
  if (candidates.length === 0) {
    log("number", `nothing in ${PREFERRED_AREA_CODE}, searching any US local`);
    candidates = await search();
  }
  if (candidates.length === 0) {
    log("number", "no candidates returned; try again or pick in the portal");
    return undefined;
  }

  const chosen = candidates[0].phone_number;
  log("number", `ordering ${chosen}`);
  await tx("POST", "/number_orders", {
    phone_numbers: [{ phone_number: chosen }],
  });

  // Orders complete in seconds; poll briefly rather than webhooking.
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const numbers = await listOwnedNumbers();
    const match = numbers.find((row) => row.phone_number === chosen);
    if (match && match.status === "active") {
      log("number", `${chosen} is active`);
      return match;
    }
  }
  log("number", `${chosen} ordered; not active yet, re-run in a minute`);
  return undefined;
}

async function ensureMessagingProfile(): Promise<MessagingProfileRow | undefined> {
  const existing = await findMessagingProfile();
  if (existing) {
    log("profile", `already exists (${existing.id})`);
    return existing;
  }
  if (statusOnly) {
    log("profile", "not created yet");
    return undefined;
  }
  const payload = await tx<{ data: MessagingProfileRow }>(
    "POST",
    "/messaging_profiles",
    {
      name: MESSAGING_PROFILE_NAME,
      enabled: true,
      webhook_url: WEBHOOK_URL,
      webhook_api_version: "2",
      // Cohort one is US-only; outbound texts to anywhere else are a bug.
      whitelisted_destinations: ["US"],
    },
  );
  log("profile", `created ${payload.data.id} → ${WEBHOOK_URL}`);
  return payload.data;
}

async function assignNumberToProfile(
  number: PhoneNumberRow,
  profile: MessagingProfileRow,
): Promise<void> {
  if (number.messaging_profile_id === profile.id) {
    log("profile", `${number.phone_number} already assigned`);
    return;
  }
  if (statusOnly) return;
  await tx("PATCH", `/phone_numbers/${number.id}/messaging`, {
    messaging_profile_id: profile.id,
  });
  log("profile", `${number.phone_number} assigned to messaging profile`);
}

/** Trial accounts get HTTP 403 code 10038 on 10DLC endpoints. */
function isAccountLevelBlock(error: unknown): boolean {
  return (
    error instanceof TelnyxHttpError &&
    error.status === 403 &&
    error.body.includes("10038")
  );
}

/** The campaign registry provisioning step (10036) is a known, separate,
 * still-in-progress wait (build-log 2026-07-07 night); never let it
 * crash the rest of this script, which has nothing to do with it. */
function isCampaignStillProcessing(error: unknown): boolean {
  return error instanceof TelnyxHttpError && error.body.includes("10036");
}

async function ensureBrand(): Promise<BrandRow | undefined> {
  const existing = await findBrand();
  if (existing) {
    log(
      "brand",
      `already exists (${existing.brandId}, identity ${existing.identityStatus ?? "unknown"})`,
    );
    return existing;
  }
  if (statusOnly) {
    log("brand", "not registered yet");
    return undefined;
  }

  const identity = readSoleProprietorIdentity();
  await tx("POST", "/10dlc/brand", {
    entityType: "SOLE_PROPRIETOR",
    displayName: BRAND_DISPLAY_NAME,
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.email,
    phone: identity.mobilePhone,
    mobilePhone: identity.mobilePhone,
    street: identity.street,
    city: identity.city,
    state: identity.state,
    postalCode: identity.postalCode,
    country: "US",
    vertical: "EDUCATION",
  });
  // The create response's id fields differ from the list endpoint's;
  // re-fetch so every later call uses the canonical Telnyx brand UUID.
  const created = await findBrand();
  if (!created) {
    console.error("brand created but not found on re-fetch; re-run in a minute");
    process.exit(1);
  }
  log("brand", `created ${created.brandId}; requesting OTP PIN`);
  await triggerOtp(created.brandId);
  return created;
}

async function triggerOtp(brandId: string): Promise<void> {
  await tx("POST", `/10dlc/brand/${brandId}/smsOtp`, {
    pinSms:
      "Your Homa (Telnyx 10DLC) verification code is @OTP_PIN@. It expires in 24 hours.",
    successSms: "Homa's texting line is verified. Nothing else to do.",
  });
  log(
    "brand",
    "PIN texted to your mobile. Finish with: pnpm telnyx:provision --verify-otp <pin>",
  );
}

async function verifyOtp(brandId: string, pin: string): Promise<void> {
  await tx("PUT", `/10dlc/brand/${brandId}/smsOtp`, { otpPin: pin });
  log("brand", "OTP verified; brand should now be VERIFIED");
}

async function brandIdentityStatus(brandId: string): Promise<string> {
  const payload = await tx<{ identityStatus?: string }>(
    "GET",
    `/10dlc/brand/${brandId}`,
  );
  return payload.identityStatus ?? "UNKNOWN";
}

async function ensureCampaign(brand: BrandRow): Promise<string | undefined> {
  const existing = await findCampaign(brand.brandId);
  if (existing) {
    log(
      "campaign",
      `already exists (${existing.campaignId}, ${existing.status ?? "status unknown"})`,
    );
    return existing.campaignId;
  }
  if (statusOnly) {
    log("campaign", "not created yet");
    return undefined;
  }

  const payload = await tx<{ campaignId: string }>(
    "POST",
    "/10dlc/campaignBuilder",
    {
      brandId: brand.brandId,
      usecase: "SOLE_PROPRIETOR",
      // TCR requires at least one sub-usecase tag. These two describe
      // Homa's traffic honestly: conversational parent support plus the
      // reminders a parent explicitly asked for.
      subUsecases: ["CUSTOMER_CARE", "ACCOUNT_NOTIFICATION"],
      description:
        "Homa is an AI homeschool assistant. Parents who opted in text " +
        "questions about their homeschool day and receive replies, plus " +
        "occasional reminders they asked for.",
      messageFlow:
        "Parents opt in on the web app (thankshoma.com) by entering and " +
        "confirming their phone number, or by texting the Homa number " +
        "first. Every reply is conversational, in response to the parent.",
      // TCR attestation flags: HELP, opt-in, and STOP are supported
      // (Telnyx auto-responds to STOP/HELP at the platform level).
      subscriberHelp: true,
      subscriberOptin: true,
      subscriberOptout: true,
      helpKeywords: "HELP",
      optinKeywords: "START",
      optoutKeywords: "STOP",
      optinMessage:
        "You are subscribed to Homa texts. Reply HELP for help, STOP to " +
        "opt out.",
      helpMessage:
        "Homa: reply with any question about your homeschool day. " +
        "Support: hello@thankshoma.com. Reply STOP to opt out.",
      optoutMessage:
        "You are unsubscribed from Homa texts. No more messages will be " +
        "sent. Reply START to resubscribe.",
      sample1:
        "Yesterday you two counted to 9 together. Want a counting-to-10 " +
        "page for this morning?",
      sample2:
        "That sounds like a great reading day. I noted the two new sight " +
        "words for Maya's journal.",
      termsAndConditions: true,
    },
  );
  log("campaign", `created ${payload.campaignId}`);
  return payload.campaignId;
}

async function assignNumberToCampaign(
  number: PhoneNumberRow,
  campaignId: string,
): Promise<void> {
  const payload = await tx(
    "GET",
    `/10dlc/phone_number_campaigns?filter[telnyx_campaign_id]=${encodeURIComponent(campaignId)}&page=1&recordsPerPage=10`,
  );
  const assigned = listOf<{ phoneNumber: string }>(payload).some(
    (row) => row.phoneNumber === number.phone_number,
  );
  if (assigned) {
    log("campaign", `${number.phone_number} already assigned`);
    return;
  }
  if (statusOnly) return;
  await tx("POST", "/10dlc/phone_number_campaigns", {
    phoneNumber: number.phone_number,
    campaignId,
  });
  log("campaign", `${number.phone_number} assigned to campaign`);
}

async function loadVoiceInstructions(): Promise<string> {
  // The web agent's instructions are the source of truth for Homa's voice;
  // this port trims the web-only parts (tools, memory, worksheets) since
  // the hosted assistant has none of them. {{family_context}} resolves at
  // call time via the dynamic-variables webhook (/api/voice/context).
  // Three files, in binding order. The phone call rules (turn-taking, the
  // greeting bound, tool guidance) live in apps/web/agent/phone-rules.md;
  // they carry founder rulings from 2026-07-08 and lived as a TypeScript
  // array literal here until 2026-07-28, which meant a prompt change could
  // not ship without editing this script. The call-boundary rules (what a
  // call can and cannot do, the honest worksheet/binder response, the
  // honesty law) live in apps/web/agent/general-call-instructions.md
  // (voice-materials-bridge plan Phase 0) and are appended last so they
  // bind hardest.
  const instructionsPath = path.join(REPO_ROOT, "apps/web/agent/instructions.md");
  const boundaryPath = path.join(
    REPO_ROOT,
    "apps/web/agent/general-call-instructions.md",
  );
  const rulesPath = path.join(REPO_ROOT, "apps/web/agent/phone-rules.md");
  const full = await readFile(instructionsPath, "utf8");
  const boundary = await readFile(boundaryPath, "utf8");
  const rules = await readFile(rulesPath, "utf8");
  const voiceSection = full.split("## What you know each turn")[0];
  return [
    voiceSection.replace(/<!--[\s\S]*?-->/u, "").trim(),
    "",
    rules.replace(/<!--[\s\S]*?-->/u, "").trim(),
    "",
    boundary.replace(/<!--[\s\S]*?-->/u, "").trim(),
  ].join("\n");
}

/**
 * The general line's call-ended trigger (#171).
 *
 * The curriculum line has had one of these since it shipped; the general
 * line, the one real parents call, never got one, which is why a call's
 * content reached web chat only when the hourly cron next ran. The webhook
 * this group posts to does NOT trust the summary for anything load-bearing:
 * /api/voice/insights reads the conversation id. The call-start webhook
 * writes server-derived owner metadata to the conversation, and the
 * transcript importer verifies it before making the transcript visible.
 * The summary fields exist so the payload is legible in Telnyx's own
 * console, not because anything writes them.
 */
async function ensureGeneralInsight(): Promise<InsightTemplateRow | undefined> {
  const existing = await findInsightTemplate(GENERAL_INSIGHT_NAME);
  if (existing) {
    log("insight", `already exists (${existing.id})`);
    return existing;
  }
  if (statusOnly) {
    log("insight", "not created yet");
    return undefined;
  }
  const created = await tx<{ data: InsightTemplateRow }>(
    "POST",
    "/ai/conversations/insights",
    {
      name: GENERAL_INSIGHT_NAME,
      instructions: [
        "From this call between Homa and a homeschooling parent, extract:",
        "- call_summary: 2-3 sentences summarizing what the call was about",
        "- followups: anything the parent asked for that has not happened yet",
      ].join("\n"),
      json_schema: {
        type: "object",
        properties: {
          call_summary: { type: "string" },
          followups: { type: "array", items: { type: "string" } },
        },
        required: ["call_summary", "followups"],
        additionalProperties: false,
      },
    },
  ).then((payload) => ("data" in payload ? payload.data : (payload as InsightTemplateRow)));
  log("insight", `created ${created.id}`);
  return created;
}

async function ensureGeneralInsightGroup(
  insight: InsightTemplateRow,
  webhookSecret: string,
): Promise<InsightGroupRow | undefined> {
  const webhookUrl = `https://thankshoma.com/api/voice/insights?key=${webhookSecret}`;
  const existing = await findInsightGroup(GENERAL_INSIGHT_GROUP_NAME);
  if (existing) {
    log("group", `already exists (${existing.id})`);
    const assigned = (existing.insights ?? []).some((item) => item.id === insight.id);
    if (!assigned && !statusOnly) {
      await tx(
        "POST",
        `/ai/conversations/insight-groups/${existing.id}/insights/${insight.id}/assign`,
      );
      log("group", "insight assigned");
    }
    return existing;
  }
  if (statusOnly) {
    log("group", "not created yet");
    return undefined;
  }
  const created = await tx<{ data: InsightGroupRow }>(
    "POST",
    "/ai/conversations/insight-groups",
    { name: GENERAL_INSIGHT_GROUP_NAME, webhook: webhookUrl },
  ).then((payload) => ("data" in payload ? payload.data : (payload as InsightGroupRow)));
  log("group", `created ${created.id} → ${webhookUrl.replace(/key=.*/, "key=***")}`);
  await tx(
    "POST",
    `/ai/conversations/insight-groups/${created.id}/insights/${insight.id}/assign`,
  );
  log("group", "insight assigned");
  return created;
}

async function ensureVoiceAssistant(
  number: PhoneNumberRow | undefined,
): Promise<AssistantRow | undefined> {
  let assistant = await findVoiceAssistant();
  if (!assistant && statusOnly) {
    log("voice", "assistant not created yet");
    return undefined;
  }
  const instructions = await loadVoiceInstructions();
  // Refuse to write rather than write an empty tool list. Every run of this
  // function POSTs { instructions, tools } to the live assistant (PR #88, so
  // a prompt edit can never drift), which means a shell missing this one
  // variable used to silently strip every tool off the phone line and leave
  // Homa answering calls unable to remember, log hours, or email. A command
  // that reads like "check the status" must not be able to do that. Exit 2 is
  // this script's missing-env code (see the header).
  const webhookSecret = process.env.TELNYX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "TELNYX_WEBHOOK_SECRET is not set in this shell, so the voice tools and\n" +
        "the dynamic-variables webhook cannot be built. Refusing to sync: writing\n" +
        "an empty tool list would strip every tool off the live phone assistant.\n" +
        "Load apps/web/.env.local (or export the variable) and re-run.",
    );
    process.exit(2);
  }
  const tools = [
    sendEmailToolConfig(webhookSecret),
    rememberToolConfig(webhookSecret),
    logHoursToolConfig(webhookSecret),
    sendSignupLinkToolConfig(webhookSecret),
  ];
  if (!assistant) {
    assistant = await tx<{ data?: AssistantRow } & AssistantRow>(
      "POST",
      "/ai/assistants",
      {
        name: VOICE_ASSISTANT_NAME,
        description:
          "Call-Homa experiment: answers Homa's phone number. Same voice " +
          "rules as the web agent; family context arrives via the " +
          "dynamic-variables webhook when the caller's number is linked.",
        instructions,
        // The model writes the greeting from the instructions, so a known
        // caller gets greeted by name.
        greeting: "<assistant-speaks-first-with-model-generated-message>",
        // Strongest keyless assistant model (founder vetoed Haiku
        // 2026-07-07; GPT-4o/5.x become available with an OpenAI key).
        model: "Qwen/Qwen3-235B-A22B",
        voice_settings: {
          // Telnyx Ultra "Callie - Encourager": warm, natural US English.
          voice: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
        },
        telephony_settings: { noise_suppression: "krisp" },
        enabled_features: ["telephony"],
        tools,
        dynamic_variables_webhook_url: `https://thankshoma.com/api/voice/context?key=${webhookSecret}`,
        dynamic_variables_webhook_timeout_ms: 5000,
        dynamic_variables: {
          caller_known: "false",
          parent_name: "",
          family_context: "",
          family_id: "",
          child_id: "",
        },
      },
    ).then((payload) => ("data" in payload && payload.data ? payload.data : payload));
    log("voice", `created assistant ${assistant.id}`);
  } else {
    await tx("POST", `/ai/assistants/${assistant.id}`, { instructions, tools });
    log("voice", `assistant already exists (${assistant.id}); instructions + tools synced`);
  }

  // The call-ended trigger (#171). Bound after the assistant exists and on
  // every run, the same posture as instructions and tools, so an assistant
  // that predates this step gains it on the next sync rather than needing a
  // one-off. Without it a finished call waits for the hourly cron and web
  // chat has never heard of it.
  const insight = await ensureGeneralInsight();
  if (insight) {
    const group = await ensureGeneralInsightGroup(insight, webhookSecret);
    if (group && assistant.insight_settings?.insight_group_id !== group.id) {
      if (statusOnly) {
        log("voice", `insight group ${group.id} not yet bound to the assistant`);
      } else {
        await tx("POST", `/ai/assistants/${assistant.id}`, {
          insight_settings: { insight_group_id: group.id },
        });
        log("voice", `insight group bound (${group.id}); calls now report at hangup`);
      }
    }
  }

  // Voice attachment: point the number's voice connection at the
  // assistant's auto-created TeXML app. Messaging stays on our profile.
  const texmlAppId = assistant.telephony_settings?.default_texml_app_id;
  if (!number || !texmlAppId) {
    if (!texmlAppId) log("voice", "no TeXML app on assistant yet; re-run shortly");
    return assistant;
  }
  if (number.connection_id === texmlAppId) {
    log("voice", `${number.phone_number} already routes calls to the assistant`);
    return assistant;
  }
  if (statusOnly) return assistant;
  await tx("PATCH", `/phone_numbers/${number.id}`, {
    connection_id: texmlAppId,
  });
  log("voice", `${number.phone_number} now routes calls to the assistant`);
  return assistant;
}

async function fetchWebhookPublicKey(): Promise<string | undefined> {
  // The Ed25519 public key lives on the account (field name is "public").
  // If the endpoint ever goes away, the portal (Account Settings, Keys &
  // Credentials, Public Key) always shows it.
  try {
    const payload = await tx<{ data?: { public?: string } }>(
      "GET",
      "/public_key",
    );
    return payload.data?.public;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const balance = await checkBalance();

  let number: PhoneNumberRow | undefined;
  const owned = await listOwnedNumbers();
  if (owned.length === 0 && !statusOnly && balance < MIN_BALANCE_FOR_NUMBER_USD) {
    log(
      "number",
      `skipping order: balance under $${MIN_BALANCE_FOR_NUMBER_USD}. ` +
        "Add funds at portal.telnyx.com → Billing.",
    );
  } else {
    number = await ensureNumber();
  }

  const profile = await ensureMessagingProfile();
  if (number && profile) await assignNumberToProfile(number, profile);

  // 10DLC (brand → OTP → campaign → number assignment). Trial accounts
  // are blocked from these endpoints entirely; detect that and say so
  // instead of crashing.
  let brand: BrandRow | undefined;
  let campaignId: string | undefined;
  try {
    if (!statusOnly && balance < MIN_BALANCE_FOR_10DLC_USD) {
      log(
        "brand",
        `skipping 10DLC registration: balance under $${MIN_BALANCE_FOR_10DLC_USD} ` +
          "(brand $4 + campaign vetting $15).",
      );
    } else {
      brand = await ensureBrand();
      if (brand && otpPin) await verifyOtp(brand.brandId, otpPin);
      if (brand) {
        const identityStatus = await brandIdentityStatus(brand.brandId);
        if (identityStatus === "VERIFIED" || identityStatus === "SELF_DECLARED") {
          campaignId = await ensureCampaign(brand);
          if (number && campaignId) {
            await assignNumberToCampaign(number, campaignId);
          }
        } else {
          log(
            "brand",
            `identity is ${identityStatus}; texting unlocks after ` +
              "pnpm telnyx:provision --verify-otp <pin>",
          );
        }
      }
    }
  } catch (error) {
    if (isCampaignStillProcessing(error)) {
      log("campaign", "registry still provisioning the campaign; not an error, re-run later");
    } else if (isAccountLevelBlock(error)) {
      log(
        "brand",
        "10DLC endpoints are not enabled at this account level yet. Fix in " +
          "the portal: add funds (Billing → Add funds) and complete account " +
          "verification (telnyx.com/upgrade), then re-run this script.",
      );
    } else {
      throw error;
    }
  }

  const assistant = await ensureVoiceAssistant(number);

  const publicKey = await fetchWebhookPublicKey();
  console.log("\n=== Summary ===");
  console.log(`Number:            ${number?.phone_number ?? "(pending)"}`);
  console.log(`Messaging profile: ${profile?.id ?? "(pending)"}`);
  console.log(`Brand:             ${brand?.brandId ?? "(pending)"}`);
  console.log(`Campaign:          ${campaignId ?? "(pending)"}`);
  console.log(`Voice assistant:   ${assistant?.id ?? "(pending)"}`);
  console.log("\nEnv to set (apps/web/.env.local AND Vercel production):");
  console.log(`  TELNYX_FROM_NUMBER=${number?.phone_number ?? ""}`);
  console.log(`  TELNYX_MESSAGING_PROFILE_ID=${profile?.id ?? ""}`);
  console.log(
    `  TELNYX_PUBLIC_KEY=${publicKey ?? "(copy from portal.telnyx.com → Account Settings → Keys & Credentials → Public Key)"}`,
  );
  console.log("  TELNYX_SMS_ENABLED=true   (the flag that turns the channel on)");
}

await main();
