import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { HOMA_VOICE_BRIDGE_HEADER } from "../web-message-modality";

const BRIDGE_AT_HEADER = "x-homa-voice-bridge-at";
const BRIDGE_MESSAGE_ID_HEADER = "x-homa-voice-bridge-message-id";
const BRIDGE_MESSAGE_HASH_HEADER = "x-homa-voice-bridge-message-sha256";
const BRIDGE_ACTIVE_OBJECT_HEADER = "x-homa-voice-active-object";
const BRIDGE_ACTIVE_OBJECT_HASH_HEADER = "x-homa-voice-active-object-sha256";
const BRIDGE_MAX_AGE_MS = 60_000;
const ACTIVE_OBJECT_CONTEXT_MAX = 4_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function messageHash(message: string): string {
  return createHash("sha256").update(message.trim().slice(0, 8_000)).digest("hex");
}

function activeObjectHash(context: string): string {
  return createHash("sha256").update(context).digest("hex");
}

function signature(input: {
  secret: string;
  accessToken: string;
  at: string;
  messageId: string;
  messageSha256: string;
  activeObjectSha256: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(
      [
        input.at,
        input.messageId,
        input.messageSha256,
        input.activeObjectSha256,
        input.accessToken,
      ].join("\n"),
    )
    .digest("hex");
}

function equalText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function voiceBridgeAuthHeaders(input: {
  accessToken: string;
  message: string;
  messageId: string;
  activeObjectContext?: string;
  secret?: string;
  now?: Date;
}): Readonly<Record<string, string>> {
  const secret = input.secret ?? process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required for the voice bridge");
  if (!UUID_PATTERN.test(input.messageId)) {
    throw new Error("voice bridge message id must be a UUID");
  }
  const at = String((input.now ?? new Date()).getTime());
  const messageSha256 = messageHash(input.message);
  const activeObjectContext = input.activeObjectContext?.trim().slice(0, ACTIVE_OBJECT_CONTEXT_MAX) ?? "";
  const activeObjectSha256 = activeObjectHash(activeObjectContext);
  const headers: Record<string, string> = {
    [HOMA_VOICE_BRIDGE_HEADER]: signature({
      secret,
      accessToken: input.accessToken,
      at,
      messageId: input.messageId,
      messageSha256,
      activeObjectSha256,
    }),
    [BRIDGE_AT_HEADER]: at,
    [BRIDGE_MESSAGE_ID_HEADER]: input.messageId,
    [BRIDGE_MESSAGE_HASH_HEADER]: messageSha256,
    [BRIDGE_ACTIVE_OBJECT_HASH_HEADER]: activeObjectSha256,
  };
  if (activeObjectContext.length > 0) {
    headers[BRIDGE_ACTIVE_OBJECT_HEADER] = Buffer.from(activeObjectContext).toString("base64url");
  }
  return headers;
}

export interface TrustedVoiceBridge {
  messageId: string;
  messageSha256: string;
  activeObjectContext?: string;
}

export function trustedVoiceBridgeRequest(
  request: Request,
  input: {
    accessToken: string;
    secret?: string;
    now?: Date;
  },
): TrustedVoiceBridge | null {
  const secret = input.secret ?? process.env.CRON_SECRET;
  const provided = request.headers.get(HOMA_VOICE_BRIDGE_HEADER);
  const at = request.headers.get(BRIDGE_AT_HEADER);
  const messageId = request.headers.get(BRIDGE_MESSAGE_ID_HEADER);
  const messageSha256 = request.headers.get(BRIDGE_MESSAGE_HASH_HEADER);
  const activeObjectEncoded = request.headers.get(BRIDGE_ACTIVE_OBJECT_HEADER);
  const activeObjectSha256 = request.headers.get(BRIDGE_ACTIVE_OBJECT_HASH_HEADER);
  if (!secret || !provided || !at || !messageId || !messageSha256 || !activeObjectSha256) return null;
  if (!UUID_PATTERN.test(messageId) || !/^[0-9a-f]{64}$/u.test(messageSha256)) {
    return null;
  }
  if (!/^[0-9a-f]{64}$/u.test(activeObjectSha256)) return null;
  let activeObjectContext = "";
  try {
    activeObjectContext = activeObjectEncoded
      ? Buffer.from(activeObjectEncoded, "base64url").toString("utf8")
      : "";
  } catch {
    return null;
  }
  if (
    activeObjectContext.length > ACTIVE_OBJECT_CONTEXT_MAX ||
    !equalText(activeObjectHash(activeObjectContext), activeObjectSha256)
  ) {
    return null;
  }
  const sentAt = Number(at);
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(sentAt) || sentAt > now + 5_000 || now - sentAt > BRIDGE_MAX_AGE_MS) {
    return null;
  }
  const expected = signature({
    secret,
    accessToken: input.accessToken,
    at,
    messageId,
    messageSha256,
    activeObjectSha256,
  });
  return equalText(provided, expected)
    ? {
        messageId,
        messageSha256,
        ...(activeObjectContext.length > 0 ? { activeObjectContext } : {}),
      }
    : null;
}

export function voiceBridgeMessageMatches(
  message: string,
  expectedSha256: string,
): boolean {
  return equalText(messageHash(message), expectedSha256);
}
