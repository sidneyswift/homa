/**
 * Small per-instance rate limiter for the public map routes. Serverless
 * instances each keep their own window, so this is a coarse abuse damper,
 * not an exact global limit; the honeypot, zod caps, and deny-all RLS do
 * the real security work.
 */

const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_WINDOWS = 10_000;

export function rateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt < now) {
    // Evict the oldest-inserted key when full instead of clearing the whole
    // map, so a busy instance never briefly drops abuse protection for every
    // route at once (2026-07-11 review, CR-60). Map preserves insertion order.
    if (windows.size >= MAX_WINDOWS) {
      const oldest = windows.keys().next().value;
      if (oldest !== undefined) windows.delete(oldest);
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
