/**
 * Reference integrity for the coding-layer context files (AGENTS.md,
 * BUILD.md, apps/web/AGENTS.md): every colon-bearing pnpm script the
 * docs name must exist in the package manifest it targets, and every
 * backticked token that looks like a concrete repo path must resolve.
 *
 * Scope is deliberately narrow so the check never pressures legitimate
 * prose. Scripts: only names containing ":" are validated (check:*,
 * eval:*, child-progress:e2e, ...), which sidesteps pnpm builtins like
 * install or dev. Paths: only backticked tokens containing "/" with no
 * glob characters or <placeholders>, with an allowlist for paths that
 * must NOT resolve in a checkout: the three prohibited directories
 * (untracked, and CI checkouts must not require them), the
 * packages/design forward reference (unlanded M1-17), and
 * node_modules/ (absent before install).
 *
 * Kept in its own module because docs-reconciliation-check.mjs runs
 * main() at import time; these pure functions are imported both from
 * there and from the unit tests.
 */

export const DOC_REFERENCE_FILES = [
  "AGENTS.md",
  "BUILD.md",
  "apps/web/AGENTS.md",
];

const PATH_ALLOWLIST_PREFIXES = [
  "homa-macmini/",
  "homa-research/",
  "homa-template/",
  "packages/design",
  "node_modules/",
  // Module specifiers the docs name as import paths, not repo files.
  "next/",
];

const PNPM_SCRIPT_PATTERN =
  /\bpnpm (?:--filter (\S+) (?:exec |run )?)?([a-z][a-z0-9._-]*:[a-z0-9._:-]+)/gu;

export function extractPnpmScriptRefs(text) {
  const refs = [];
  for (const match of text.matchAll(PNPM_SCRIPT_PATTERN)) {
    refs.push({ filter: match[1] ?? null, name: match[2] });
  }
  return refs;
}

export function extractPathRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/`([^`\n]+)`/gu)) {
    let token = match[1].trim();
    // A path has at least two segments; a lone "name/" is a convention
    // mention (a skill's references/ subdirectory), not a location.
    if (!/[^/]\/[^/]/u.test(token)) continue;
    if (/[*?[\]{}<>|]/u.test(token)) continue;
    if (/^[a-z]+:\/\//u.test(token)) continue;
    if (/\s/u.test(token)) continue;
    if (!/^[A-Za-z0-9._@/-]+(?:#[A-Za-z0-9._-]+)?(?::\d+)?$/u.test(token)) {
      continue;
    }
    token = token.replace(/#[A-Za-z0-9._-]+$/u, "").replace(/:\d+$/u, "");
    if (token.startsWith("/") || token.startsWith("./")) continue;
    refs.add(token);
  }
  return [...refs];
}

export function validateDocReferences(
  { docs, rootScripts, webScripts, pathExists },
  errors,
) {
  for (const { path: docPath, text } of docs) {
    for (const { filter, name } of extractPnpmScriptRefs(text)) {
      const scripts = filter === "web" ? webScripts : rootScripts;
      const where = filter === "web" ? "apps/web/package.json" : "package.json";
      if (!scripts.has(name)) {
        errors.push(
          `${docPath} names "pnpm ${filter ? `--filter ${filter} ` : ""}${name}" but ${where} has no such script`,
        );
      }
    }
    for (const token of extractPathRefs(text)) {
      const allowlisted = PATH_ALLOWLIST_PREFIXES.some((prefix) =>
        token === prefix || token === prefix.replace(/\/$/u, "")
        || token.startsWith(prefix),
      );
      if (allowlisted) continue;
      if (!pathExists(token)) {
        errors.push(
          `${docPath} references \`${token}\` which does not resolve in the repository`,
        );
      }
    }
  }
}
