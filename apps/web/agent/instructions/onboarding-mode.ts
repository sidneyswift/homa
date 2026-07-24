import { readFileSync } from "node:fs";
import path from "node:path";

import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  composeOnboardingModeMarkdown,
  type OnboardingModeAttributes,
} from "../../lib/onboarding/onboarding-mode";

/**
 * Chat-first onboarding, the routing layer's eve wiring
 * (plans/2026-07-21-chat-first-onboarding.md §2.2).
 *
 * The mode text, the routing predicate, and the reasons the skill body
 * is inlined here rather than behind load_skill all live in
 * lib/onboarding/onboarding-mode.ts, where plain node can import them
 * for the routing fixtures. This file owns getting SKILL.md to the
 * composer without the sandbox: eve's load_skill reads through the
 * sandbox session, and that provisioning cost is part of what the
 * preload removes.
 *
 * The read is a plain source-tree read, the same pattern
 * lib/map/narrative-generate.ts uses for report-writer.md. It covers
 * every runtime that has the source checked out (next dev, eve dev,
 * tsx). The deployed eve function bundle carries no source tree, so
 * there the composer falls back to the original load_skill line: same
 * behavior as before this change, never worse, and the error line below
 * makes the gap visible in runtime logs. Closing it for the deployed
 * bundle is a follow-up (single-source the body through defineSkill, or
 * an eve-side asset-import fix); eve 0.19's build rejects both the
 * static ?raw import (its extension resolver wins over the asset
 * plugin) and the dynamic one (authored modules must bundle to one
 * chunk).
 */

/** Candidate roots, because process.cwd() differs by runtime: apps/web
 *  under next dev and eve dev, the repo root under tsx. */
const SKILL_PATH_CANDIDATES = [
  ["agent", "skills", "onboarding", "SKILL.md"],
  ["apps", "web", "agent", "skills", "onboarding", "SKILL.md"],
];

let cachedRawSkill: string | null | undefined;

function rawOnboardingSkill(): string | null {
  if (cachedRawSkill !== undefined) return cachedRawSkill;
  for (const segments of SKILL_PATH_CANDIDATES) {
    try {
      cachedRawSkill = readFileSync(
        path.join(process.cwd(), ...segments),
        "utf8",
      );
      return cachedRawSkill;
    } catch {
      // Try the next root.
    }
  }
  console.error(
    "onboarding-mode: SKILL.md not reachable from this runtime; onboarding turns fall back to load_skill",
  );
  cachedRawSkill = null;
  return cachedRawSkill;
}

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const markdown = composeOnboardingModeMarkdown(
        ctx.session.auth.current?.attributes as OnboardingModeAttributes,
        rawOnboardingSkill(),
      );
      return markdown ? defineInstructions({ markdown }) : null;
    },
  },
});
