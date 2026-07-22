/**
 * Refresh VERCEL_OIDC_TOKEN in place, and touch nothing else.
 *
 * `vercel env pull` is the obvious way to do this and it is a trap. It
 * rewrites .env.local wholesale from the Vercel `development`
 * environment, which on this project carries five variables. The local
 * file carries fifty-two, including the Supabase URL and database
 * password that nothing runs without. Running the pull to refresh a
 * twelve-hour token therefore takes the whole dev server down, which is
 * exactly what happened while writing this: every route started
 * returning 500 with "Your project's URL and Key are required".
 *
 * So this pulls into a scratch file, lifts the one value out, and writes
 * that single line back. Everything else in .env.local is left byte for
 * byte alone, and the file is only rewritten once a token has actually
 * been read, so a failed pull cannot truncate it.
 *
 * Usage: pnpm dev:token
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY = "VERCEL_OIDC_TOKEN";
const WEB_DIR = join("apps", "web");
const TARGET = join(WEB_DIR, ".env.local");
/**
 * The pull runs inside apps/web, and writes beside the file it is
 * feeding, because the CLI resolves the project from its own cwd and
 * refuses a path outside it. In a git worktree the repo root is NOT
 * linked (the link lives wherever `vercel link` was last run), so
 * running this from the root fails with a bare "not_linked" and no clue
 * which directory it meant.
 */
const SCRATCH = join(WEB_DIR, ".env.oidc-scratch");

/** The value of one key in a dotenv file, or null. */
export function readEnvValue(contents, key) {
  let found = null;
  for (const line of contents.split("\n")) {
    const match = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, "u").exec(line);
    if (!match) continue;
    const value = match[1].trim().replace(/^["']|["']$/gu, "");
    if (value.length > 0) found = value;
  }
  return found;
}

/**
 * The file with exactly one line changed.
 *
 * Appends when the key is absent, so a file that never had the token
 * gains it rather than silently staying broken.
 */
export function replaceEnvValue(contents, key, value) {
  const lines = contents.split("\n");
  let replaced = false;
  const next = lines.map((line) => {
    if (!new RegExp(`^\\s*${key}\\s*=`, "u").test(line)) return line;
    replaced = true;
    return `${key}=${value}`;
  });
  if (!replaced) {
    while (next.length > 0 && next[next.length - 1].trim() === "") next.pop();
    next.push(`${key}=${value}`, "");
  }
  return next.join("\n");
}

function main() {
  if (!existsSync(TARGET)) {
    console.error(`\n  ${TARGET} does not exist. Nothing to refresh.\n`);
    process.exit(1);
  }

  try {
    execFileSync(
      "npx",
      ["--yes", "vercel", "env", "pull", ".env.oidc-scratch", "--yes"],
      { cwd: WEB_DIR, stdio: ["ignore", "pipe", "pipe"] },
    );

    if (!existsSync(SCRATCH)) {
      console.error(
        `\n  The pull produced no file. Is ${WEB_DIR} linked to the Vercel\n` +
          "  project? A git worktree does not inherit the link.\n\n" +
          `    cd ${WEB_DIR} && npx vercel link --yes\n`,
      );
      process.exit(1);
    }
    const token = readEnvValue(readFileSync(SCRATCH, "utf8"), KEY);
    if (!token) {
      console.error(`\n  The pull returned no ${KEY}. Nothing was changed.\n`);
      process.exit(1);
    }

    const before = readFileSync(TARGET, "utf8");
    writeFileSync(TARGET, replaceEnvValue(before, KEY, token));
    console.log(`\n  ${KEY} refreshed in ${TARGET}. Nothing else was touched.\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n  Could not refresh the token: ${message}\n`);
    process.exit(1);
  } finally {
    // Always, including on the failure paths above: a scratch file left
    // in apps/web is a second .env for Next to find.
    rmSync(SCRATCH, { force: true });
  }
}

if (process.argv[1]?.endsWith("refresh-oidc-token.mjs")) main();
