/** Preview experiment for gh#1171. Identity comes from the server's claims. */
export function chatOpenWarmupEnabled(input: {
  environment: string | undefined;
  flag: string | undefined;
  fixtureUserId: string | undefined;
  userId: string;
  hasFamily: boolean;
}): boolean {
  return input.environment === "preview"
    && input.flag === "1"
    && input.hasFamily
    && input.userId !== "anonymous"
    && Boolean(input.fixtureUserId)
    && input.fixtureUserId === input.userId;
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
