import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

import { measureChatPreparation } from "./observability/chat-preparation";

/** Eve's routeAuth forwards this response without admitting a fallback caller. */
export class EveAuthServiceUnavailableError extends Error {
  readonly response: Response;

  constructor() {
    const message = "Chat access could not be checked. Please try again.";
    super(message);
    this.name = "EveAuthServiceUnavailableError";
    this.response = Response.json(
      { ok: false, code: "auth_service_unavailable", error: message },
      {
        status: 503,
        headers: { "cache-control": "no-store", "retry-after": "1" },
      },
    );
  }
}

function isTemporaryAuthFailure(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (!isAuthError(error)) return false;
  const status = error.status;
  return status === 0 || status === 408 || status === 429 ||
    (typeof status === "number" && status >= 500 && status < 600);
}

/** Classify the SDK's resolved Auth failures without retrying or trusting a JWT locally. */
export async function readEveAuthentication<T extends { error: unknown }>(
  read: () => PromiseLike<T>,
  stage?: "authenticate" | "binding_authenticate",
): Promise<T> {
  const authenticate = async () => {
    let result: T;
    try {
      result = await read();
    } catch (error) {
      if (isTemporaryAuthFailure(error)) throw new EveAuthServiceUnavailableError();
      throw error;
    }
    // GH #1184: getUser resolves Auth 504s as { user: null, error }.
    // Returning null here mislabeled an outage as an expired login.
    if (isTemporaryAuthFailure(result.error)) throw new EveAuthServiceUnavailableError();
    return result;
  };
  return stage ? await measureChatPreparation(stage, authenticate) : await authenticate();
}
