export function hasVoiceWebhookSecret(request: Request, url: URL): boolean {
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer === secret || url.searchParams.get("key") === secret;
}
