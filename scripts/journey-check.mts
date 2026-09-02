#!/usr/bin/env node --experimental-strip-types
/**
 * The journey map asserts itself (mobile onboarding + paywall v2 spec,
 * Outcome 9; system-model.md move 7, gh#1045).
 *
 * The economic machine (the family onboarding record, its one flip, and
 * the billing gate that reads it) earned every rule here through a
 * measured failure: a silent flip that took a five-file trace to
 * re-derive, a phantom gate input nothing read, a fully built walk
 * component no code path rendered, and a UI with zero stable names that
 * cost dozens of screenshot round trips to drive. This guard makes each
 * of those a CI failure instead of an archaeology session.
 *
 * Deterministic source checks, no network:
 *   1. One completion path: completeOnboarding is called only inside
 *      lib/onboarding/store.ts, and nothing else writes state "done".
 *   2. The flip narrates itself: resolveOnboardingCompletion emits
 *      onboarding.completed AFTER the completing write.
 *   3. The resolver's callers stay the two the spec §1 verified
 *      (createReport and the /onboarding page render); a third is a
 *      deliberate spec change, not a drive-by.
 *   4. No phantom gate inputs: second_create_tapped is analytics only
 *      and never read by billing/gate code.
 *   5. The gate's open derives from its reason (gateOpenForReason), so
 *      the boolean and its explanation cannot disagree.
 *   6. No dead walk components: every component exported from
 *      apps/mobile/src/features/onboarding is rendered somewhere else
 *      (scar: MakingShow shipped fully built and never mounted).
 *   7. The walk stays name-addressable: every walk screen carries a
 *      testID, and the named driver controls keep their stable ids.
 *
 * Usage: node --experimental-strip-types scripts/journey-check.mts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const problems: string[] = [];

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

/** Line and block comments out, so prose about a function is never
 *  mistaken for a call to it (first run: state.ts's history note about
 *  completeOnboarding tripped the caller check). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

function walkFiles(relativeDir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(path.join(repoRoot, dir))) {
      const relative = path.join(dir, entry);
      const stats = statSync(path.join(repoRoot, relative));
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        visit(relative);
        continue;
      }
      if (extensions.some((extension) => entry.endsWith(extension))) out.push(relative);
    }
  };
  visit(relativeDir);
  return out;
}

// 1. One completion path.
{
  const allowedCallers = new Set(["apps/web/lib/onboarding/store.ts"]);
  const files = walkFiles("apps/web", [".ts", ".tsx"]).filter(
    (file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
  );
  // The eval sandbox seeder writes a fixture family's record wholesale;
  // that is scaffolding for a disposable database, not a product flip.
  const allowedDoneWriters = new Set([
    "apps/web/lib/onboarding/store.ts",
    "apps/web/lib/onboarding/state.ts",
    "apps/web/lib/family-context-eval-fixture.ts",
  ]);
  for (const file of files) {
    const source = stripComments(read(file));
    if (/\bcompleteOnboarding\(/u.test(source) && !allowedCallers.has(file)) {
      problems.push(
        `${file}: calls completeOnboarding directly. The flip must go through resolveOnboardingCompletion so its cause is narrated (spec Outcome 5).`,
      );
    }
    if (/state:\s*"done"/u.test(source) && !allowedDoneWriters.has(file)) {
      problems.push(
        `${file}: writes onboarding state "done" outside the one write path (lib/onboarding/store.ts).`,
      );
    }
  }
}

// 2. The flip narrates itself, after the write.
{
  const store = read("apps/web/lib/onboarding/store.ts");
  const resolver = store.slice(store.indexOf("export async function resolveOnboardingCompletion"));
  const writeAt = resolver.indexOf("await completeOnboarding(familyId);");
  const emitAt = resolver.indexOf('emitMapEvent("onboarding.completed"');
  if (writeAt === -1) {
    problems.push(
      "lib/onboarding/store.ts: resolveOnboardingCompletion no longer performs the completing write this guard understands; update the guard WITH the mechanism change.",
    );
  } else if (emitAt === -1) {
    problems.push(
      "lib/onboarding/store.ts: the flip went silent again. resolveOnboardingCompletion must emit onboarding.completed with its cause (spec Outcome 5).",
    );
  } else if (emitAt < writeAt) {
    problems.push(
      "lib/onboarding/store.ts: onboarding.completed is emitted before the completing write; the trail must never claim a flip the record does not show.",
    );
  }
}

// 3. The resolver's callers stay the verified two.
{
  const expected = new Set([
    "apps/web/app/onboarding/page.tsx",
    "apps/web/lib/map/store.ts",
  ]);
  const files = walkFiles("apps/web", [".ts", ".tsx"]).filter(
    (file) =>
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.tsx") &&
      file !== "apps/web/lib/onboarding/store.ts",
  );
  const callers = files.filter((file) => /\bresolveOnboardingCompletion\(/u.test(read(file)));
  for (const caller of callers) {
    if (!expected.has(caller)) {
      problems.push(
        `${caller}: new resolveOnboardingCompletion caller. If deliberate, update the spec §1 inventory and this guard together.`,
      );
    }
  }
  for (const file of expected) {
    if (!callers.includes(file)) {
      problems.push(
        `${file}: no longer calls resolveOnboardingCompletion; the completion boundary moved without updating the map (spec §1).`,
      );
    }
  }
}

// 4. second_create_tapped stays analytics-only.
{
  const gateRoots = [
    "apps/web/lib/billing",
    "apps/web/app/api/billing",
    "apps/mobile/src/features/billing",
  ];
  for (const root of gateRoots) {
    for (const file of walkFiles(root, [".ts", ".tsx"])) {
      if (/second_create_tapped/u.test(read(file))) {
        problems.push(
          `${file}: reads second_create_tapped inside gate code. That field is funnel analytics; the wall's trigger is the onboarding record (spec §1.2).`,
        );
      }
    }
  }
  const billingGate = "apps/mobile/src/components/billing-gate.tsx";
  if (/second_create_tapped/u.test(read(billingGate))) {
    problems.push(`${billingGate}: reads second_create_tapped inside gate code.`);
  }
}

// 5. open derives from the reason.
{
  const route = read("apps/web/app/api/billing/gate/route.ts");
  if (!/open:\s*gateOpenForReason\(reason\)/u.test(route)) {
    problems.push(
      "app/api/billing/gate/route.ts: `open` no longer derives from gateOpenForReason(reason); the boolean and its explanation can now disagree (spec Outcome 6).",
    );
  }
}

// 6. No dead walk components.
{
  const componentDir = "apps/mobile/src/features/onboarding";
  const mobileFiles = walkFiles("apps/mobile/src", [".ts", ".tsx"]);
  const sources = new Map(mobileFiles.map((file) => [file, read(file)]));
  for (const file of walkFiles(componentDir, [".tsx"])) {
    const source = sources.get(file) ?? read(file);
    const names = [...source.matchAll(/^export (?:function|const) ([A-Z][A-Za-z0-9_]*)/gmu)]
      .map((match) => match[1])
      // A SCREAMING_SNAKE_CASE export is a constant, not a component; only
      // a name with a lowercase letter is a live-component candidate here
      // (caught 2026-09-01: the old regex stopped at the first underscore,
      // truncating DEFAULT_CHARACTER_SIZE to "DEFAULT" and reporting a
      // genuinely-wired constant as a dead component).
      .filter((name) => /[a-z]/u.test(name));
    for (const name of names) {
      const usedElsewhere = mobileFiles.some(
        (other) => other !== file && new RegExp(`\\b${name}\\b`, "u").test(sources.get(other) ?? ""),
      );
      // A component can also be alive as a building block of another
      // export in its own module (WalkScene renders WalkSheet): any
      // occurrence beyond the export line itself counts, comments off.
      const ownOccurrences = [
        ...stripComments(source).matchAll(new RegExp(`\\b${name}\\b`, "gu")),
      ].length;
      if (!usedElsewhere && ownOccurrences <= 1) {
        problems.push(
          `${file}: exported component ${name} is rendered nowhere. Wire it in or delete it; git is the archive (scar: MakingShow).`,
        );
      }
    }
  }
}

// 7. The walk stays name-addressable.
{
  const screenDir = "apps/mobile/src/app/(onboarding)";
  for (const entry of readdirSync(path.join(repoRoot, screenDir))) {
    if (!entry.endsWith(".tsx") || entry === "_layout.tsx") continue;
    const source = read(path.join(screenDir, entry));
    if (!/testID=/u.test(source)) {
      problems.push(
        `${path.join(screenDir, entry)}: no testID on any control; the walk must stay drivable by name (spec Outcome 7).`,
      );
    }
  }
  const REQUIRED_IDS = [
    "hello.letsGo",
    "intent.continue",
    "kids.thatsEveryone",
    "you.continue",
    "making.seeIt",
    "making.keepExploring",
    "reveal.print",
    "paywall.subscribe",
    "paywall.noThanks",
    "decline.seePage",
    "next.door.",
    "checklist.close",
    "checklist.done",
    "checklist.answer.",
  ];
  const haystack = walkFiles("apps/mobile/src", [".tsx"])
    .map((file) => read(file))
    .join("\n");
  for (const id of REQUIRED_IDS) {
    if (!haystack.includes(id)) {
      problems.push(
        `driver id "${id}" is gone from apps/mobile/src; renames must update scripts/journey-check.mts in the same change.`,
      );
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL  ${problem}`);
  process.exit(1);
}
console.log("PASS  journey machine map matches the territory (7 checks)");
