import {
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import type {
  MobileBootstrapFailureReason,
  MobileBootstrapStage,
} from "@homa/core";

export const BOOTSTRAP_TIMEOUT_MS = 10_000;
const NETWORK_CHECK_TIMEOUT_MS = 1_000;

export class BootstrapFailure extends Error {
  constructor(
    readonly stage: MobileBootstrapStage,
    readonly reason: MobileBootstrapFailureReason,
  ) {
    super(`${stage} bootstrap ${reason}`);
    this.name = "BootstrapFailure";
  }
}

export type BootstrapResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: MobileBootstrapFailureReason };

export interface BootstrapNetworkState {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

interface BootstrapOptions {
  timeoutMs?: number;
  getNetworkState?: () => Promise<BootstrapNetworkState>;
}

function errorField(error: unknown, key: "code" | "name" | "status") {
  if (!error || typeof error !== "object" || !(key in error)) return undefined;
  return (error as Record<string, unknown>)[key];
}

export function classifyBootstrapFailure(
  error: unknown,
  networkState?: BootstrapNetworkState,
): MobileBootstrapFailureReason {
  if (error instanceof BootstrapFailure) return error.reason;

  if (
    networkState?.isConnected === false ||
    networkState?.isInternetReachable === false
  ) {
    return "offline";
  }

  const code = errorField(error, "code");
  if (
    isAuthSessionMissingError(error) ||
    errorField(error, "name") === "AuthSessionMissingError" ||
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "session_not_found"
  ) {
    return "expired_session";
  }

  const status = errorField(error, "status");
  if (
    (typeof status === "number" && status >= 500) ||
    (isAuthRetryableFetchError(error) && error.status > 0)
  ) {
    return "server_error";
  }

  return "unknown";
}

async function networkStateWithin(
  getNetworkState: () => Promise<BootstrapNetworkState>,
): Promise<BootstrapNetworkState | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getNetworkState(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), NETWORK_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runBootstrapStep<T>(
  stage: MobileBootstrapStage,
  work: () => Promise<T>,
  options: BootstrapOptions = {},
): Promise<BootstrapResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(work),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new BootstrapFailure(stage, "timeout")),
          options.timeoutMs ?? BOOTSTRAP_TIMEOUT_MS,
        );
      }),
    ]);
    return { ok: true, value };
  } catch (error) {
    const networkState =
      error instanceof BootstrapFailure
        ? undefined
        : await networkStateWithin(
            options.getNetworkState ?? (async () => ({})),
          );
    return {
      ok: false,
      reason: classifyBootstrapFailure(error, networkState),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
