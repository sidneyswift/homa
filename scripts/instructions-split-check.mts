/**
 * Guard on the phone-persona split in apps/web/agent/instructions.md.
 *
 * scripts/telnyx-provision.mts builds the PHONE assistant's persona from
 * everything above the FIRST occurrence of the split heading, then strips
 * exactly one HTML comment block (a non-global regex). This structural
 * check protects the split; check:agent-prompts separately rejects all
 * comments in the generated chat, report, and curriculum prompts:
 *
 * 1. The split heading occurs exactly once in instructions.md.
 * 2. "## Have opinions" (the persona's last section) precedes it.
 * 3. The slice above the split contains at most one HTML comment block,
 *    because the provision script's comment strip is non-global and a
 *    second block would leak verbatim into the deployed phone persona.
 * 4. The same heading literal appears in scripts/telnyx-provision.mts,
 *    so renaming it in one place fails here with a pointer to the other.
 * 5. The Voice (binding) section exists in instructions.md and both of
 *    generated writer prompts (report-writer.md, curriculum-writer.md).
 *    check:agent-prompts verifies their shared boundaries and source parity.
 *
 * Usage: tsx scripts/instructions-split-check.mts
 * Unit tests: scripts/instructions-split-check.test.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SPLIT_HEADING = "## What you know each turn";
export const PERSONA_TAIL_HEADING = "## Have opinions";
export const VOICE_HEADING = "## Voice (binding)";
export const PHONE_RULES_HEADING =
  "## Phone call rules (binding: these beat every rule above)";
// Mirrors telnyx-provision.mts exactly: non-global on purpose, so this
// check sees the persona slice the way the provision script does.
const COMMENT_STRIP = /<!--[\s\S]*?-->/u;

export interface SplitCheckInputs {
  instructions: string;
  telnyxSource: string;
  reportWriter: string;
  curriculumWriter: string;
  /** apps/web/agent/phone-rules.md, the phone call rules the provision
   * script appends between the persona and the call boundary. */
  phoneRules: string;
}

export function checkInstructionsSplit(inputs: SplitCheckInputs): string[] {
  const problems: string[] = [];
  const {
    instructions,
    telnyxSource,
    reportWriter,
    curriculumWriter,
    phoneRules,
  } = inputs;

  // The phone call rules carry founder rulings from 2026-07-08 (the
  // tennis-match rule, the bounded greeting) and lived as a TypeScript array
  // literal inside the provision script until 2026-07-28, which meant a
  // prompt change could not ship without editing a CLI script. They are a
  // file now, so guard the three ways that can silently break: the file goes
  // missing or empty, its binding heading is renamed, or the script stops
  // reading it and the rules vanish from what a parent hears.
  const rulesBody = phoneRules.replace(COMMENT_STRIP, "").trim();
  if (rulesBody.length === 0) {
    problems.push(
      "apps/web/agent/phone-rules.md is empty once its comment is stripped. "
        + "The phone assistant would be provisioned with no call rules at all.",
    );
  }
  if (!rulesBody.startsWith(PHONE_RULES_HEADING)) {
    problems.push(
      `apps/web/agent/phone-rules.md must open with "${PHONE_RULES_HEADING}". `
        + "That heading is what tells the model these rules outrank the persona above them.",
    );
  }
  if (!telnyxSource.includes("apps/web/agent/phone-rules.md")) {
    problems.push(
      "telnyx-provision.mts no longer reads apps/web/agent/phone-rules.md, "
        + "so the phone call rules are not in the provisioned prompt.",
    );
  }

  const occurrences = instructions.split(SPLIT_HEADING).length - 1;
  if (occurrences !== 1) {
    problems.push(
      `instructions.md must contain the split heading exactly once, found ${occurrences}. `
        + "telnyx-provision.mts splits on the FIRST occurrence; a duplicate silently truncates the phone persona.",
    );
  }

  const splitIndex = instructions.indexOf(SPLIT_HEADING);
  const tailIndex = instructions.indexOf(PERSONA_TAIL_HEADING);
  if (tailIndex === -1) {
    problems.push(
      `instructions.md is missing "${PERSONA_TAIL_HEADING}", the persona's final section.`,
    );
  } else if (splitIndex !== -1 && tailIndex > splitIndex) {
    problems.push(
      `"${PERSONA_TAIL_HEADING}" must precede the split heading; the phone persona ends at the split.`,
    );
  }

  if (splitIndex !== -1) {
    const personaSlice = instructions.slice(0, splitIndex);
    const afterOneStrip = personaSlice.replace(COMMENT_STRIP, "");
    if (afterOneStrip.includes("<!--")) {
      problems.push(
        "The persona slice above the split heading has more than one HTML comment block. "
          + "telnyx-provision.mts strips only the first; the rest would ship verbatim in the phone persona.",
      );
    }
  }

  if (!telnyxSource.includes(SPLIT_HEADING)) {
    problems.push(
      "scripts/telnyx-provision.mts no longer contains the split heading literal this check asserts. "
        + "If the heading was renamed, update SPLIT_HEADING here and the provision script together.",
    );
  }

  const mirrors: Array<[string, string]> = [
    ["apps/web/agent/instructions.md", instructions],
    ["apps/web/agent/report-writer.md", reportWriter],
    ["apps/web/agent/curriculum-writer.md", curriculumWriter],
  ];
  for (const [name, text] of mirrors) {
    if (!text.includes(VOICE_HEADING)) {
      problems.push(`${name} is missing its "${VOICE_HEADING}" section.`);
    }
  }

  return problems;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return entry !== undefined
    && path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const read = (relative: string): string =>
    readFileSync(path.join(repoRoot, relative), "utf8");
  const problems = checkInstructionsSplit({
    instructions: read("apps/web/agent/instructions.md"),
    telnyxSource: read("scripts/telnyx-provision.mts"),
    reportWriter: read("apps/web/agent/report-writer.md"),
    curriculumWriter: read("apps/web/agent/curriculum-writer.md"),
    phoneRules: read("apps/web/agent/phone-rules.md"),
  });
  for (const problem of problems) console.error(`FAIL  ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log("PASS  instructions split and voice-mirror invariants hold");
}
