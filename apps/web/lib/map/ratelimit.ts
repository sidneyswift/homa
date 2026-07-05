/**
 * Small per-instance rate limiter for the public map routes. Serverless
 * instances each keep their own window, so this is a coarse abuse damper,
 * not an exact global limit; the honeypot, zod caps, and deny-all RLS do
 * the real security work.
 */

const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  if (windows.size > 10_000) windows.clear();
  return entry.count > limit;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
