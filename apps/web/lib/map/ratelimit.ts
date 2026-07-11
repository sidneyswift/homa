/**
 * Small per-instance rate limiter for the public map routes. Serverless
 * instances each keep their own window, so this is a coarse abuse damper,
 * not an exact global limit; the honeypot, zod caps, and deny-all RLS do
 * the real security work.
 */

const MAX_WINDOWS = 10_000;

const windows = new Map<string, { count: number; resetAt: number }>();

function rememberWindow(key: string, entry: { count: number; resetAt: number }): void {
  windows.delete(key);
  windows.set(key, entry);

  while (windows.size > MAX_WINDOWS) {
    const oldestKey = windows.keys().next().value;
    if (oldestKey === undefined) return;
    windows.delete(oldestKey);
  }
}

export function rateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    rememberWindow(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  rememberWindow(key, entry);
  return entry.count > limit;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
