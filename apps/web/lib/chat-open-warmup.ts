/** Preview experiment for gh#1171. Identity comes from the server's claims. */
export function chatOpenWarmupEnabled(input: {
  environment: string | undefined;
  flag: string | undefined;
  fixtureUserId: string | undefined;
  userId: string;
  hasFamily: boolean;
  diagnostics?: string;
}, log: (message: string) => void = console.info): boolean {
  const enabled = input.environment === "preview"
    && input.flag === "1"
    && input.hasFamily
    && input.userId !== "anonymous"
    && Boolean(input.fixtureUserId)
    && input.fixtureUserId === input.userId;

  if (input.environment === "preview" && input.diagnostics === "1") {
    try {
      log(`[chat-open-warmup-gate] ${JSON.stringify({
        environmentIsPreview: input.environment === "preview",
        flagIsOne: input.flag === "1",
        hasFamily: Boolean(input.hasFamily),
        userIsNotAnonymous: input.userId !== "anonymous",
        fixtureIdPresent: Boolean(input.fixtureUserId),
        userMatchesFixtureId: input.fixtureUserId === input.userId,
        enabled,
      })}`);
    } catch {
      // Optional diagnostics must not change the page or the warmup decision.
    }
  }

  return enabled;
}

/** Loads the existing Eve admission function, without dispatching a turn. */
export function startChatOpenWarmup(fetchHealth: typeof fetch = fetch) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10_000);
  const done = Promise.resolve().then(async () => {
    // React's setup/cleanup/setup check must not send the canceled attempt.
    if (controller.signal.aborted) return false;
    const response = await fetchHealth("/eve/v1/health", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    await response.body?.cancel();
    return response.ok;
  }).catch(() => false).finally(() => clearTimeout(deadline));

  return { done, cancel: () => controller.abort() };
}
