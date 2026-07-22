/**
 * Dev preflight: is the Vercel OIDC token still good?
 *
 * The agent reaches the AI Gateway with VERCEL_OIDC_TOKEN, which is a
 * short-lived JWT, roughly twelve hours. Nothing renews it while a dev
 * server is running, so the normal way to meet this is not at startup
 * where you would look for it: the server comes up fine, you work for a
 * while, and then every turn starts failing auth mid-stream.
 *
 * That is what happened on 2026-07-22. The token expired at 04:25, the
 * dev server kept serving pages, and chat-first onboarding failed on the
 * opening turn with the parent-facing "that last message didn't go
 * through". Nothing anywhere said "your local credential is stale", so
 * it read as a product bug and cost a chunk of a founder walk.
 *
 * So: check before the server starts, and say the remedy in the failure.
 * Also warn when the token will die DURING a plausible session, because
 * a startup check that only looks at this instant would have passed at
 * 04:20 and still left the same hole.
 *
 * Usage: runs automatically as `predev` in apps/web. Standalone:
 *   node scripts/dev-oidc-preflight.mjs
 * Skip it (offline, or you know what you are doing):
 *   HOMA_SKIP_OIDC_PREFLIGHT=1 pnpm --filter web dev
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Next reads these in ascending precedence; later wins. */
const ENV_FILES = [".env.local", ".env.development.local"];

/** Warn if the token dies within this much of starting work. */
const SESSION_HOURS = 3;

/**
 * Works from either cwd without being told which.
 *
 * As `predev` it runs inside apps/web; run by hand it is usually the
 * repo root. Detecting beats a flag, because a flag that only one of the
 * two callers passes is a flag that will be wrong half the time.
 */
const WEB_DIR = (() => {
  if (process.env.HOMA_WEB_DIR) return process.env.HOMA_WEB_DIR;
  if (existsSync("next.config.ts") || existsSync("next.config.mjs")) return ".";
  return join("apps", "web");
})();

/** Reads VERCEL_OIDC_TOKEN the way Next will, last file winning. */
function readToken() {
  let token = process.env.VERCEL_OIDC_TOKEN ?? null;
  let source = token ? "environment" : null;
  for (const file of ENV_FILES) {
    const path = join(WEB_DIR, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*VERCEL_OIDC_TOKEN\s*=\s*(.*)$/u.exec(line);
      if (!match) continue;
      const value = match[1].trim().replace(/^["']|["']$/gu, "");
      if (value.length > 0) {
        token = value;
        source = path;
      }
    }
  }
  return { token, source };
}

/**
 * The expiry, or null when the token is not a JWT we can read.
 *
 * Unreadable is not the same as expired: a shape this does not
 * understand is the script's problem, not the developer's, so it must
 * never block a dev server over it.
 */
export function tokenExpiry(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const decoded = JSON.parse(
      Buffer.from(padded, "base64url").toString("utf8"),
    );
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function verdict(expiresAt, now, sessionMs) {
  if (expiresAt === null) return "unreadable";
  if (expiresAt <= now) return "expired";
  if (expiresAt - now < sessionMs) return "expiring";
  return "ok";
}

const REMEDY = [
  "  Refresh it:",
  "",
  "    pnpm dev:token",
  "",
  "  That rewrites one line and nothing else. Do NOT reach for",
  "  `vercel env pull` or `eve link` here: they replace .env.local",
  "  wholesale from the Vercel development environment, which holds a",
  "  handful of variables against this file's fifty-odd, and they take",
  "  the Supabase URL and password with them.",
].join("\n");

function main() {
  if (process.env.HOMA_SKIP_OIDC_PREFLIGHT === "1") return;

  const { token, source } = readToken();
  if (!token) {
    // Not every dev task needs the agent. Say so and get out of the way.
    console.warn(
      "\n  No VERCEL_OIDC_TOKEN found. Pages will build; anything that calls\n" +
        "  the agent will fail at the gateway.\n\n" +
        REMEDY +
        "\n",
    );
    return;
  }

  const expiresAt = tokenExpiry(token);
  const now = Date.now();
  const state = verdict(expiresAt, now, SESSION_HOURS * 60 * 60 * 1000);
  if (state === "unreadable" || state === "ok") return;

  const at = new Date(expiresAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (state === "expiring") {
    const minutes = Math.round((expiresAt - now) / 60000);
    console.warn(
      `\n  Heads up: the Vercel OIDC token expires at ${at}, in about ` +
        `${minutes} minutes.\n  The agent will start failing mid-turn when it does.\n\n` +
        REMEDY +
        "\n",
    );
    return;
  }

  console.error(
    `\n  The Vercel OIDC token expired at ${at}.\n` +
      `  Read from ${source}.\n\n` +
      "  Starting now would give you a dev server that serves pages and\n" +
      "  fails every agent turn at the gateway, which looks like a bug in\n" +
      "  the product rather than a stale credential.\n\n" +
      REMEDY +
      "\n",
  );
  process.exit(1);
}

if (process.argv[1]?.endsWith("dev-oidc-preflight.mjs")) main();
