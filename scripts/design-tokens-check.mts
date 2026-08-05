/**
 * Design-token utility check. One job: every Tailwind colour utility that
 * reaches for a Homa token names a token that actually exists.
 *
 * Why this needs a guard at all: a colour utility whose token is undefined
 * fails silently and completely. Tailwind v4 only emits a rule for a class
 * it can resolve, so `bg-border-default` produces no CSS, `border-border-default`
 * falls back to `currentColor`, and nothing anywhere complains. It compiles,
 * it lints, it typechecks, it renders. The element is simply the wrong
 * colour, and a screenshot reads it as a design choice rather than a bug.
 *
 * Found the hard way on 2026-07-22: `border-border-default` had 31 uses
 * across the binder, material cards and the founder console, every one of
 * them drawing a near-black 1px edge where a quiet boundary was intended. A
 * nonexistent constructive text utility was doing the same thing to a bullet
 * on the lesson page.
 *
 * How it decides what to inspect. Validating every utility would drown in
 * stock Tailwind (`text-sm`, `border-dashed`, `bg-white`), so this checks
 * only utilities that reach into Homa's own colour vocabulary: a class
 * whose value starts with one of the token roots below. `border-dashed` is
 * ignored because "dashed" is not one of our roots; `border-border-default`
 * is caught because "border" is, and "border-default" is not a declared
 * token. That keeps the rule precise in both directions.
 *
 * Usage: pnpm check:design-tokens   (tsx scripts/design-tokens-check.mts)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const THEME_FILE = "apps/web/app/globals.css";

const ROOTS = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
];
const SKIP_DIRS = new Set(["node_modules", ".next", ".eve"]);

/** Utilities that take a colour. Shadow and ring also accept sizes, which
 *  is fine: a size never starts with one of our token roots. */
const COLOR_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "fill",
  "stroke",
  "outline",
  "divide",
  "placeholder",
  "accent",
  "caret",
  "decoration",
  "shadow",
  "from",
  "via",
  "to",
];

const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

/** The declared colour tokens, read from the @theme block that defines them. */
function readColorTokens(): Set<string> {
  const css = readFileSync(THEME_FILE, "utf8");
  const tokens = new Set<string>();
  for (const match of css.matchAll(/--color-([a-z0-9-]+)\s*:/gu)) {
    tokens.add(match[1]);
  }
  return tokens;
}

/**
 * The first segment of each token, which is what makes a class "ours".
 * `brand-hover` contributes `brand`, so `bg-brand-nope` is inspected and
 * rejected rather than waved through as somebody else's utility.
 */
function rootsOf(tokens: Set<string>): Set<string> {
  const roots = new Set<string>();
  for (const token of tokens) roots.add(token.split("-")[0]);
  return roots;
}

function* walkSourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walkSourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield path;
    }
  }
}

export interface TokenViolation {
  file: string;
  line: number;
  className: string;
  value: string;
}

/**
 * Pull the suspect classes out of one file's text.
 *
 * Exported so the unit test can drive it on strings rather than on the
 * repo, and so the rule itself is testable in both directions: a bad class
 * must be caught, and the stock utilities that live next to it must not be.
 */
export function findTokenViolations(
  source: string,
  tokens: Set<string>,
  roots: Set<string>,
  file = "<source>",
): TokenViolation[] {
  const found: TokenViolation[] = [];
  const lines = source.split("\n");
  const pattern = new RegExp(
    `\\b(${COLOR_PREFIXES.join("|")})-([a-z][a-z0-9-]*)(\\/[0-9]+)?\\b`,
    "gu",
  );
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(pattern)) {
      const [, prefix, value] = match;
      // A CSS custom property, not a utility: `bg-[var(--custom-inline-color)]`
      // contains utility-like text, and an arbitrary value
      // defines its own colour rather than resolving a token. The `--`
      // immediately before the match is what tells them apart.
      if (line.slice(0, match.index).endsWith("--")) continue;
      if (!roots.has(value.split("-")[0])) continue;
      if (tokens.has(value)) continue;
      found.push({
        file,
        line: index + 1,
        className: `${prefix}-${value}`,
        value,
      });
    }
  }
  return found;
}

function main(): void {
  const tokens = readColorTokens();
  const roots = rootsOf(tokens);

  report(
    "theme declares colour tokens",
    tokens.size > 0,
    `no --color-* found in ${THEME_FILE}`,
  );

  const violations: TokenViolation[] = [];
  for (const root of ROOTS) {
    for (const file of walkSourceFiles(root)) {
      violations.push(
        ...findTokenViolations(readFileSync(file, "utf8"), tokens, roots, file),
      );
    }
  }

  const byClass = new Map<string, TokenViolation[]>();
  for (const violation of violations) {
    const list = byClass.get(violation.className) ?? [];
    list.push(violation);
    byClass.set(violation.className, list);
  }

  for (const [className, uses] of [...byClass].sort()) {
    const where = uses
      .slice(0, 3)
      .map((use) => `${use.file}:${use.line}`)
      .join(", ");
    report(
      `"${className}" names a declared token`,
      false,
      `--color-${uses[0].value} is not declared in ${THEME_FILE}; ${uses.length} use(s): ${where}${uses.length > 3 ? ", ..." : ""}`,
    );
  }

  if (byClass.size === 0) {
    report(`every colour utility in ${ROOTS.length} roots names a real token`, true);
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} design-token check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll design-token checks passed.");
}

if (process.argv[1]?.endsWith("design-tokens-check.mts")) main();
