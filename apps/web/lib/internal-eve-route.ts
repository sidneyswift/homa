/** Shared fail-closed boundary for server-triggered Eve routes. */
export function internalEveRouteAuthorizationFailure(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET,
): Response | null {
  if (!secret) {
    return Response.json({ ok: false }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return null;
}

/** Accepts HTTPS origins, plus local HTTP during development only. */
export function resolveInternalEveOrigin(input: {
  value: string | undefined;
  nodeEnv: string | undefined;
}): string | null {
  const value = input.value?.trim();
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }
  if (parsed.protocol === "https:") return parsed.origin;

  const localHttp =
    parsed.protocol === "http:" &&
    input.nodeEnv !== "production" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  return localHttp ? parsed.origin : null;
}
