import { rateLimited } from "./map/ratelimit";
import { sendHomaSms } from "./voice/telnyx-api";

const SMS_PROGRESS_WINDOW_MS = 3 * 60 * 1000;
const SMS_PROGRESS_SEND_TIMEOUT_MS = 5_000;
const DEFAULT_SMS_PROGRESS_TEXT =
  "I’m on it. This may take a moment, and I’ll text you when it’s ready.";

export interface SmsProgressDependencies {
  isRateLimited: (key: string, limit: number, windowMs: number) => boolean;
  createTimeoutSignal: (timeoutMs: number) => AbortSignal;
  sendSms: (
    phoneNumber: string,
    text: string,
    signal: AbortSignal,
  ) => Promise<boolean>;
}

const defaultDependencies: SmsProgressDependencies = {
  isRateLimited: rateLimited,
  createTimeoutSignal: AbortSignal.timeout,
  sendSms: (phoneNumber, text, signal) =>
    sendHomaSms(phoneNumber, text, undefined, signal),
};

/**
 * Sends at most one best-effort progress text in the shared SMS window.
 * The authenticated channel supplies the destination, never model input.
 */
export async function sendSmsProgressTextOnce(
  options: {
    familyId: string | null;
    phoneNumber: string;
    text?: string;
  },
  dependencies: SmsProgressDependencies = defaultDependencies,
): Promise<boolean> {
  const key = `sms-progress:${options.familyId ?? "unlinked"}:${options.phoneNumber}`;
  if (dependencies.isRateLimited(key, 1, SMS_PROGRESS_WINDOW_MS)) return false;

  try {
    const signal = dependencies.createTimeoutSignal(
      SMS_PROGRESS_SEND_TIMEOUT_MS,
    );
    return await dependencies.sendSms(
      options.phoneNumber,
      options.text ?? DEFAULT_SMS_PROGRESS_TEXT,
      signal,
    );
  } catch (error) {
    console.error(
      "sms progress text failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}
