/** Only server configuration chooses where the worker secret goes. Request
 * Host/Origin and the public marketing URL never participate in this decision. */
export function conversationWorkerUrl(env: Record<string, string | undefined>): URL | null {
  const origin = env.VERCEL === "1"
    ? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null)
    : env.HOMA_CONVERSATION_WORKER_ORIGIN;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (env.VERCEL === "1" ? url.protocol !== "https:" : !loopback || url.protocol !== "http:")) return null;
    return new URL("/eve/v1/conversation-request/run-now", url);
  } catch { return null; }
}

/** Best-effort acceleration after acceptance. The durable scheduled pickup,
 * not this HTTP callback, owns eventual execution. Never log its credential. */
export async function kickConversationRequests(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (env.HOMA_CONVERSATION_REQUESTS !== "1" || !env.CRON_SECRET) return false;
  const url = conversationWorkerUrl(env);
  if (!url) return false;
  try {
    const response = await fetcher(url, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch { return false; }
}


/** The same configured deployment boundary, with enough time for the bounded
 * recorder window across the interval between scheduled sweeps. A scheduler retries from the committed source bookmark. */
export async function kickConversationRecording(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  if (env.HOMA_CONVERSATION_RECORDING !== "1" || env.HOMA_CONVERSATION_REQUESTS !== "1" || !env.CRON_SECRET) return false;
  const url = conversationWorkerUrl(env);
  if (!url) return false;
  url.pathname = "/eve/v1/conversation-request/record";
  try {
    return (await fetcher(url, { method: "POST", headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(140_000) })).ok;
  } catch { return false; }
}
