# Morning Research Brief Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every morning research SMS/email use the founder-approved
topic, finding, application, and executable CTA format.

**Architecture:** The agent skill remains the generated-copy producer. A
small pure validator makes the format contract deterministic for unit tests
and the live model eval. The dispatcher reiterates the exact delivery
contract, while task storage and delivery remain unchanged.

**Tech Stack:** TypeScript, Node test runner, Eve skills/schedules, AI SDK
model eval, existing Homa copy gates.

> Git commits are deliberately omitted. This repository requires explicit
> founder authorization before any commit.

---

## File structure

- Create `apps/web/lib/tasks/research-brief-format.ts`: pure parser and
  validator for the approved text shape.
- Create `apps/web/lib/tasks/research-brief-format.test.ts`: deterministic
  positive and negative fixtures.
- Modify `apps/web/agent/skills/research-brief/SKILL.md`: binding output
  contract and CTA capability rules.
- Modify `apps/web/agent/schedules/dispatch.ts`: exact format reminder at the
  point where the morning run starts.
- Create `scripts/research-brief-format-eval.mts`: live model check using the
  real skill and representative family context.
- Modify `package.json`: add `check:research-brief` and
  `eval:research-brief`.
- Modify `.github/workflows/ci.yml`: run deterministic format checks.
- Modify `docs/homa-planning/build-log.md`: record the founder ruling and
  verification.

## Task 1: Lock the format as a pure contract

**Files:**
- Create: `apps/web/lib/tasks/research-brief-format.test.ts`
- Create: `apps/web/lib/tasks/research-brief-format.ts`

- [ ] **Step 1: Write the failing format tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateResearchBriefFormat } from "./research-brief-format";

const VALID = `🔬 Last night I researched phonics

What I learned: Connected phonation helps early readers hold sounds together while blending. Adding each sound as the word grows works especially well for stop sounds.

Why it's interesting: Story is already reading Bob Books and is ready to make blending smoother. This changes how you model the same words, not what he needs to learn next.

Want me to make Story a connected-phonation word strip?`;

describe("morning research brief format", () => {
  it("accepts the approved four-block shape", () => {
    assert.deepEqual(validateResearchBriefFormat(VALID), { ok: true });
  });

  it("rejects missing labels, extra sentences, links, and unavailable calendar promises", () => {
    const invalid = [
      VALID.replace("What I learned:", "Finding:"),
      VALID.replace(
        "Connected phonation helps early readers hold sounds together while blending.",
        "One. Two. Three.",
      ),
      `${VALID}\n\nSaved it to: https://thankshoma.com/app/tasks`,
      VALID.replace(
        "make Story a connected-phonation word strip",
        "add the lesson to your calendar",
      ),
    ];
    for (const value of invalid) {
      assert.equal(validateResearchBriefFormat(value).ok, false);
    }
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec tsx --test apps/web/lib/tasks/research-brief-format.test.ts
```

Expected: FAIL because `research-brief-format.ts` does not exist.

- [ ] **Step 3: Implement the minimal validator**

```ts
const MAX_CHARS = 1600;
const URL = /https?:\/\/|www\./iu;
const CALENDAR_PROMISE = /\b(?:add|put|schedule)\b.{0,30}\bcalendar\b/iu;

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

export type ResearchBriefValidation =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateResearchBriefFormat(
  text: string,
): ResearchBriefValidation {
  const errors: string[] = [];
  const blocks = text.trim().split(/\n\s*\n/u);
  if (blocks.length !== 4) errors.push("expected four blocks");
  if (!/^🔬 (?:Last night|This morning) I researched .+/u.test(blocks[0] ?? "")) {
    errors.push("headline");
  }
  const learned = (blocks[1] ?? "").replace(/^What I learned:\s*/u, "");
  const interesting = (blocks[2] ?? "").replace(
    /^Why it's interesting:\s*/u,
    "",
  );
  if (!(blocks[1] ?? "").startsWith("What I learned:")) {
    errors.push("learned label");
  }
  if (!(blocks[2] ?? "").startsWith("Why it's interesting:")) {
    errors.push("interesting label");
  }
  if (sentenceCount(learned) < 1 || sentenceCount(learned) > 2) {
    errors.push("learned sentence count");
  }
  if (sentenceCount(interesting) < 1 || sentenceCount(interesting) > 2) {
    errors.push("interesting sentence count");
  }
  const cta = blocks[3] ?? "";
  if (!/^Want me to .+\?$/u.test(cta)) errors.push("CTA");
  if ((cta.match(/\?/gu) ?? []).length !== 1) errors.push("one CTA");
  if (URL.test(text) || /Saved it to:/iu.test(text)) errors.push("saved link");
  if (CALENDAR_PROMISE.test(cta)) errors.push("calendar promise");
  if (text.length > MAX_CHARS) errors.push("length");
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run the same command. Expected: all format tests pass.

## Task 2: Rewrite the generated-copy producer

**Files:**
- Modify: `apps/web/agent/skills/research-brief/SKILL.md:40-64`

- [ ] **Step 1: Replace the freeform shape and SMS rules**

Replace “two beats, then maybe an offer” and the current no-header/no-emoji
format with:

```md
## Required output shape

Write exactly four blocks with one blank line between them:

🔬 Last night I researched {plain topic}

What I learned: {1 to 2 sentences about the research itself.}

Why it's interesting: {1 to 2 sentences connecting it to this child.}

Want me to {one specific action Homa can complete}?

- Use "This morning I researched" only when you performed the allowed top-up
  search during this run. Otherwise use "Last night".
- Keep the labels exactly as written. No markdown emphasis, bullets, preamble,
  sign-off, or second emoji.
- The topic is a parent-facing name, never an internal id.
- The CTA offers exactly one current capability: design a quick game/activity,
  create a printable, or set a reminder/task after collecting missing timing
  details.
- Never promise a calendar write. Never use a generic "want to know more?"
  CTA.
- Do not include "Saved it to" or any URL until the dedicated research-note
  route exists.
- Keep the complete message at or below 1,600 characters. Cut supporting
  detail before removing a required block.
```

- [ ] **Step 2: Preserve the existing evidence and safety rules**

Keep the one-angle selection, family personalization, citation honesty,
top-up privacy, no-comparison law, and no-medical-red-flags law unchanged.

- [ ] **Step 3: Scan the skill**

Run:

```bash
rg -n "No markdown|no headers|no links|no emoji|maybe an offer|Saved it to" \
  apps/web/agent/skills/research-brief/SKILL.md
```

Expected: no stale format instruction remains.

## Task 3: Reinforce the contract at dispatch

**Files:**
- Modify: `apps/web/agent/schedules/dispatch.ts:55-65`

- [ ] **Step 1: Update the morning brief instruction**

Change the final instruction block to:

```ts
"Follow the skill's exact four-block format: research headline, What I learned, Why it's interesting, and one executable Want me to CTA. Preserve the blank lines. Do not add a preamble, sign-off, saved-note line, or URL.",
`Compose this morning's brief to ${task.parentFirstName ?? "the parent"} about ${task.kidPhrase}.`,
"Your reply is delivered EXACTLY as written by text or email.",
```

- [ ] **Step 2: Typecheck**

Run:

```bash
pnpm --filter web typecheck
```

Expected: exit 0.

## Task 4: Add a live model-format eval

**Files:**
- Create: `scripts/research-brief-format-eval.mts`
- Modify: `package.json`

- [ ] **Step 1: Create the eval**

The script must:

1. load `apps/web/.env.local`;
2. read the real `research-brief/SKILL.md`;
3. call `generateText` with `HOMA_MODEL`, the skill, and a representative
   Story phonics fixture;
4. pass the output to `validateResearchBriefFormat`;
5. print the generated brief and exit 1 on validation failure;
6. use `providerOptions.gateway.disallowPromptTraining = true`.

```ts
const result = await generateText({
  model: HOMA_MODEL,
  system: skill,
  prompt: fixturePrompt,
  maxRetries: 1,
  providerOptions: {
    gateway: {
      disallowPromptTraining: true,
      tags: ["research_brief_format_eval"],
    },
  },
});

const validation = validateResearchBriefFormat(result.text);
console.log(result.text);
if (!validation.ok) {
  console.error(validation.errors);
  process.exit(1);
}
```

- [ ] **Step 2: Add scripts**

```json
{
  "check:research-brief": "tsx --test apps/web/lib/tasks/research-brief-format.test.ts",
  "eval:research-brief": "tsx scripts/research-brief-format-eval.mts"
}
```

- [ ] **Step 3: Run the live eval**

```bash
pnpm eval:research-brief
```

Expected: the output matches the four-block format and exits 0.

## Task 5: Put the deterministic contract in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the format check after continuity tests**

```yaml
- name: Morning research brief format
  run: pnpm check:research-brief
```

Do not run the paid live model eval in CI.

## Task 6: Run the Homa copy gates

**Files:**
- Modify if needed:
  `apps/web/agent/skills/research-brief/SKILL.md`

- [ ] **Step 1: Generate one real fixture**

Run `pnpm eval:research-brief` and retain the console output for review.

- [ ] **Step 2: Run `homa-copy-reviewer`**

Give the reader gate the exact generated SMS in reading order. Accept feedback
that improves first-read comprehension without removing the approved labels.

- [ ] **Step 3: Apply accepted reader feedback at the producer**

Edit the skill, never the one generated fixture.

- [ ] **Step 4: Re-run the live eval**

Expected: validator passes.

- [ ] **Step 5: Run `homa-copy-editor`**

Give the editor gate the post-reader generated SMS and the full Homa copy
rulebook. Apply all valid must-fix notes at the skill layer.

## Task 7: Full verification and decision log

**Files:**
- Modify: `docs/homa-planning/build-log.md`

- [ ] **Step 1: Run focused checks**

```bash
pnpm check:research-brief
pnpm eval:research-brief
pnpm check:continuity
```

- [ ] **Step 2: Run repository checks**

```bash
pnpm typecheck
NODE_OPTIONS=--max-old-space-size=8192 \
  pnpm --filter web exec eslint agent app components lib
pnpm check:events
pnpm check:map
pnpm build
TELNYX_API_KEY=test \
TELNYX_FROM_NUMBER=+10000000000 \
TELNYX_PUBLIC_KEY=test \
  pnpm --filter web exec eve build
```

Expected: every command exits 0. The Eve build may warn that sandbox prewarm
is unavailable locally; compilation must complete.

- [ ] **Step 3: Update the build log**

Record:

- founder approved the Mac Mini-style four-block format;
- both content sections are 1 to 2 sentences;
- the CTA is one executable current capability;
- the saved-note link is deferred until the dedicated filesystem/route;
- deterministic test count, model eval result, copy-gate result, and build
  verification.

## Self-review

- Spec coverage: every approved block, sentence limit, CTA constraint,
  no-link ruling, honest tense exception, delivery/storage behavior, and
  verification requirement maps to a task.
- Placeholder scan: no TODO/TBD instructions remain.
- Type consistency: `validateResearchBriefFormat` and
  `ResearchBriefValidation` use the same names in tests and eval.
- Scope: no filesystem route, calendar integration, research selection, or
  schedule change is included.
