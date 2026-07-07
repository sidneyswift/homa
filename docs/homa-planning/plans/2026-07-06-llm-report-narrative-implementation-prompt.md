# Implementation prompt: the LLM-written progress report (narrative layer)

Date: 2026-07-06. Rulings behind this prompt:
`2026-07-06-llm-report-depth-options.md` (Q&A inline) and the build-log entry
"D8 overturned" (same date). This prompt is self-contained; you should not
need to ask the founder anything except at the two STOP points marked below.

## Mission

Replace every parent-facing sentence in the progress report, the subject
drawers, and the four-week plan pages with prose written per-report by the
model, while every number, position, age, badge, chart, citation, and
movement fact stays computed by the existing deterministic code. Store every
generation in the database, versioned. Gate every piece at runtime. The
existing template sentences become the permanent fallback skeleton, rendered
only when a call hard-fails or a piece is rejected. Quality over speed: the
report waits behind an honest writing beat with NO time cap (founder ruling,
2026-07-06: "let the agent do its thing").

## Read first, in order

1. `AGENTS.md` (repo laws: voice, no em dashes anywhere, tenant isolation)
2. `packages/core/src/map/sentences.ts` (the template layer you are demoting
   to fallback; its header comment describes the vocabulary rulings that
   still bind: "progress report" never "map", "subject" never "domain",
   yellow/green/blue in copy)
3. `packages/core/src/map/scoring.ts` and `content.ts` (the facts layer:
   positions, monthsAhead, statements, typicalMonths, sources, activities)
4. `apps/web/app/onboarding/r/[token]/report-view.tsx` and `page.tsx`
5. `apps/web/lib/map/store.ts` (createReport, history snapshots,
   getOrBuildPlan, getReportByToken)
6. `apps/web/app/api/map/score/route.ts` (where generation hooks in)
7. `apps/web/lib/map/email.ts` (sendReportEmail moves to after generation)
8. `apps/web/agent/instructions.md` (the binding Homa voice block; the
   report writer mirrors it) and `apps/web/agent/agent.ts` (the model id)
9. `scripts/map-check.mts` (copy laws to extract and reuse; fixture kids)
10. `apps/web/app/onboarding/sample/page.tsx` (must keep zero model calls)
11. `apps/web/app/privacy/page.tsx` and `apps/web/app/onboarding/method/page.tsx`
    (shipped copy this PR must change; see section 10)

## Binding constraints (violating any of these is a failed build)

- The model NEVER computes or invents a number, age, position, badge, or
  benchmark. It writes around facts handed to it. Any generated piece
  containing a number or age claim not present in its facts payload is
  rejected by the gate.
- Voice laws in every generated word: sentence case, reassure before
  inform, offers never commands, no em dash ever, never "behind", never
  compare siblings, no medical or developmental diagnoses, no deficit words
  (the BANNED regex), no negative numbers, temporal never causal.
- Tenant isolation: leadId/childId resolution patterns in `store.ts` are
  unchanged; new queries follow them; `pnpm check:isolation` stays green.
- `/onboarding/sample` never makes a live model call (committed fixture).
- The scorer and everything in `packages/core/src/map/scoring.ts` is
  untouched.
- Never read or write `homa-macmini/`, `homa-research/`, `homa-template/`.
- Imports at top of file, no inline imports. Prefer small single-purpose
  modules over one giant file.

## Architecture

### 1. Shared copy laws (extraction, no behavior change)

Move the `BANNED` regex and `EM_DASH` check from `scripts/map-check.mts`
into `packages/core/src/map/copy-laws.ts`, exported; the script imports
them. The runtime gate imports the same constants, so the build-time and
runtime law can never drift.

### 2. Narrative shape and versions

`packages/core/src/map/narrative.ts` (types only, pure):

```ts
export interface ReportNarrative {
  /** The note from Homa at the top. */
  note: string;
  /** One line per subject, keyed by domainId (scored + exposure + not_mapped). */
  subjects: Record<string, string>;
  /** The new whole-picture section: cross-subject story, interests woven in,
   * one thing worth doing this month. */
  synthesis: string;
  /** Per-subject drawer explainer, keyed by domainId, scored subjects only. */
  drawers: Record<string, string>;
}

export interface PlanNarrative {
  intro: string;
  /** One framing line per week, index 0 to 3. */
  weeks: string[];
  closing: string;
}
```

`REPORT_PROMPT_VERSION` constant (string, e.g. "2026.07.1") lives next to
the prompt file and bumps on ANY prompt or schema change. Fixtures record
it; check:map fails when fixtures lag the current version (forces
regenerate + re-review, see section 8).

### 3. Storage (migration + store changes)

Migration on `public.lead_reports`:
- `narrative jsonb` (null until generated)
- `narrative_meta jsonb` (null until first attempt), shape:
  `{ status: "writing" | "ready" | "failed", promptVersion, model,
     startedAt, generatedAt, durationMs, tokensIn, tokensOut,
     rejectedPieces: string[], failReason? }`

Migration on `public.lead_plans`: same two columns for the plan narrative.

History: in `createReport`, the snapshot pushed into `history` gains
`narrative` and `narrative_meta` from the row being archived (old entries
simply lack the keys). After the upsert, the new row's narrative fields
reset to null/`{status:"writing"}` so a rescore always rewrites the words
next to the new numbers (founder ruling: regenerate on every rescore).

Lead tables are deny-all RLS, server-only via `mapDb()`; keep that posture.
Run `pnpm check:isolation` after the migration.

### 4. Facts payload builder

`apps/web/lib/map/narrative-facts.ts`, server-only, pure assembly:

Input: the loaded report (scores, answers, history), child row (first name,
birth month, interests, help_with, context.whatsWorking), lead first name,
other kids' first names (for the sibling gate, NOT for the prompt), bank
content (statements, typicalMonths, activities, display names).

Output: a JSON-serializable facts object containing, per subject:
displayName, position, monthsAhead, badge label, strongest observed
statement, frontier statement, each asked question with the parent's answer
and its typicalMonths, the growing activity raw material; plus child first
name, age label and months, parent first name, interests, helpWith,
whatsWorking notes, observation count, and movement facts computed by code
from history as literal strings (for example "math moved up 4 months since
Jun 6"). Also emit `allowedNumbers`: every number and age string that
appears anywhere in the facts (months, "4y 2m" style labels, counts), for
the gate. NO last names, no email, no state, no ids in the payload.

### 5. Generation

`apps/web/lib/map/narrative-generate.ts`, server-only:

- Model id: extract `export const HOMA_MODEL = "anthropic/claude-sonnet-5"`
  into `apps/web/agent/model.ts`; `agent.ts` and this module both import it
  (one-line swap later, per ruling).
- Call: AI SDK (`ai` is already a dependency) `generateObject` with a zod
  schema matching `ReportNarrative`, through the Vercel AI Gateway model
  string. Set `providerOptions.gateway.disallowPromptTraining = true` (free,
  keeps the privacy page's "never used to train" line contractual). Generous
  `maxOutputTokens` (8000). No timeout, no retry cap beyond one internal
  retry on transport error. Temperature default.
- System prompt: `apps/web/agent/report-writer.md`, a versioned markdown
  file. It mirrors the binding Voice block of `agent/instructions.md` (add a
  header comment in BOTH files naming each other as hand-kept mirrors, same
  convention the repo uses for design tokens). Beyond voice, it must
  instruct: write from the facts only; never restate the same opener across
  subjects (the original complaint); interpretation across subjects is
  wanted ("rhyming and letter names are the same pre-reading story");
  strengths first; growing subjects always land on the named next step and
  read as a starting line, never a verdict; exposure subjects (coding,
  second language) are about what the family does, never age norms; numbers
  only if they appear in the facts; length budgets per piece (card lines
  about one to two sentences, note about 3 to 4, synthesis about 120 to 180
  words, drawers about 2 to 3 sentences).
- Credentials: deployed, the gateway authenticates via the Vercel project
  (eve chat already works in prod). Locally, `AI_GATEWAY_API_KEY` in
  `apps/web/.env.local` (add the key NAME to `.env.example` with a comment;
  never commit a value).

Plan generation: same module exports `generatePlanNarrative(planFacts)`
with the `PlanNarrative` schema. Facts: the deterministic plan
(targets, weekly focuses, activity texts from `buildFourWeekPlan`), child
first name, age, interests, style. The deterministic plan stays stored
unchanged as the fact record; the model writes the page's prose around it.

### 6. Runtime gate

`packages/core/src/map/narrative-gate.ts`, pure, unit-testable:

`validateNarrative(narrative, { allowedNumbers, siblingNames, childName })`
returns per-piece verdicts. Reject a piece when it contains:
- a BANNED word or an em dash (imported from copy-laws.ts)
- a negative number
- any digit sequence or age-like token ("4y", "18 months", "by 5") not in
  `allowedNumbers`
- a sibling's name (any other kid on the lead)
- diagnosis-adjacent phrasing not already in BANNED: "on the spectrum",
  "ADHD", "dyslexi", "autis" (case-insensitive substrings)
- length over the per-piece cap (tune caps in code review; start at
  note 800 chars, card line 340, synthesis 1400, drawer 500, plan intro 700,
  plan week 300, plan closing 400)
- an empty or missing required piece

A rejected piece renders its template fallback (`domainLine`, `homaNote`,
existing plan copy) and is listed in `narrative_meta.rejectedPieces`. If
`note`, `synthesis`, or more than 4 subject lines reject, treat the whole
generation as failed (status "failed", full template render): a report that
is half-fallback reads worse than a clean template report.

### 7. Flow wiring

Score route (`app/api/map/score/route.ts`):
1. `createReport` as today; respond `{ ok, token }` immediately.
2. Kick generation in the background with `after()` from `next/server`:
   build facts, mark `narrative_meta.status = "writing"` with `startedAt`,
   generate, gate, store `narrative` + meta (`status: "ready"` or
   `"failed"`), THEN send the report email (first scoring only, existing
   `reportAlreadyEmailed` guard). Email failure still never blocks anything.
   Set `export const maxDuration = 300` on the route so the background work
   is not killed early.
3. Rescores follow the same path (email guard already prevents re-sends).

Report page:
- Server loads the row. If `narrative_meta.status === "ready"`, render
  narrative pieces in place of template sentences (per piece: narrative
  unless that piece was rejected). If `"failed"` or the feature flag is
  off, render templates exactly as today. If `"writing"`, render the
  writing beat.
- Writing beat: a client component on the report page (the permanent URL,
  so refresh and the emailed link are both safe). Honest rotating status
  lines ("Reading your 21 observations", "Looking across all 16 subjects",
  "Writing Maya's report"), the existing reduced-motion patterns, NO
  countdown, NO cap. Poll a tiny status endpoint
  (`GET /api/map/narrative-status?token=...`, token-scoped like the report
  page itself) every 2.5s until status leaves "writing", then refresh the
  server component.
- Self-healing: the status endpoint, when it finds status "writing" with
  `startedAt` older than 10 minutes, or narrative null with meta null on a
  flag-on report, kicks a fresh background generation (guarded so only one
  runs). A crashed function therefore costs one wait, never a stuck report.

Plan page (`/onboarding/r/[token]/plan/[domainId]`): same pattern with its
own beat ("Homa is building the four-week plan") and `lead_plans.narrative`.
`getOrBuildPlan` rebuilds regenerate the plan narrative too.

### 8. Sample fixture, red-team fixture, and check:map

`scripts/map-narrative-fixtures.mts` (run locally, needs the gateway key):
- Generates through the REAL pipeline for two kids: Maya (the sample page's
  answer set) and the struggling kid (map-check golden kid 4: every base
  answer not_yet at 50 months).
- Writes `apps/web/app/onboarding/sample/narrative.fixture.ts` (typed
  export, prompt version stamped) and
  `scripts/fixtures/red-team-narrative.json`.
- Prints both narratives to stdout for the read-aloud.

Sample page imports the fixture and renders it exactly as the live page
renders a ready narrative. It never calls the model.

Extend `scripts/map-check.mts` (CI, no network):
- Run `validateNarrative` over BOTH fixtures; any rejection fails.
- Fail if either fixture's stamped prompt version does not equal
  `REPORT_PROMPT_VERSION` (forces regenerate + founder re-read on every
  prompt change).

### 9. Flag and events

- `REPORT_NARRATIVE_ENABLED` (server env): off = today's behavior
  everywhere except the sample page (fixture renders regardless, it is
  reviewed content). Add to `.env.example` with a comment. Default off in
  prod until the founder flips it after STOP 2.
- Events via `emitMapEvent`: `map.narrative_generated` {lead_id, child_id,
  duration_ms, tokens_in, tokens_out, rejected_pieces} and
  `map.narrative_fallback` {lead_id, child_id, reason}.

### 10. Shipped copy this PR must change (founder-accepted consequence)

- `apps/web/app/privacy/page.tsx`: bump `UPDATED`. Processor list gains one
  entry: "Anthropic, via Vercel AI Gateway (writes the words of your
  report)". Replace the "No AI provider receives your questionnaire
  answers" paragraph with plain-language honesty in this direction: the
  numbers in the report are computed by plain arithmetic that a person
  reviewed, never by AI; Homa (an AI) writes the sentences of the report
  from your answers; we contractually disallow your data being used to
  train models. Keep "We never use your family's data to train AI models"
  (made contractual by `disallowPromptTraining`). Note: the processor list
  also silently covered chat already; this entry fixes that gap too.
- `apps/web/app/onboarding/method/page.tsx`: replace the "No AI reads or
  scores your answers... same answers always produce the same report" item
  with: the scoring is plain arithmetic, reviewed by a person, and the same
  answers always produce the same numbers; Homa writes the words around
  those numbers and every sentence is checked against our safety rules
  (never "behind", never a diagnosis, never a number that is not in your
  answers) before you see it.
- The FAQ line "your child never sees the questionnaire and never talks to
  an AI" stays; it remains true.
- No em dash in any new copy. Sentence case. Founder reads both pages in PR.

## Work order and stop points

1. Copy-laws extraction, narrative types, gate + unit tests, facts builder,
   report-writer.md prompt, generation module, fixtures script.
   **STOP 1: run the fixtures script locally and paste BOTH generated
   narratives (Maya and the struggling kid) verbatim to the founder for the
   read-aloud. Do not proceed until the founder approves the tone. Iterate
   the prompt here, bumping REPORT_PROMPT_VERSION each pass.**
2. Migration + store changes + check:isolation green.
3. Score route background generation, status endpoint, writing beat,
   email-after-generation, rescore regeneration, fallback paths.
4. Plan narrative + plan page beat.
5. check:map extension + sample page fixture wiring.
6. Privacy + method copy, flag, events.
   **STOP 2: full live walkthrough as a struggling 10-year-old (the
   established e2e pattern: base checklist, deep dive walking down,
   rescore, plan build), screenshots of report + beat + plan, fixture
   diffs, all checks green. Founder flips REPORT_NARRATIVE_ENABLED after
   their read-aloud. Clean up test leads by lead id, per the standing
   lesson in the build log.**

Verify at every step: `pnpm typecheck`, `pnpm build`, `pnpm check:map`,
`pnpm check:isolation`. Live e2e before STOP 2. Grep your own new copy and
prompt file for em dashes and banned words before every commit.

## Non-goals (do not build)

- Token-by-token streaming of the narrative into the page (the beat plus
  one swap is v1; streaming is a later polish).
- Generated depth in the report email (stays the two-line pointer; the
  email now simply sends after generation).
- Chat on the report page, photo personalization, location suggestions.
- Any change to scoring, positions, movement math, or the chart.
- Model-computed numbers of any kind.

## Cost and latency budget (for context, not enforcement)

One report generation at full depth: roughly 4k tokens in, 2.5k to 3.5k out;
about $0.03 to $0.05 on claude-sonnet-5 intro pricing, ~35 to 70 seconds.
Plan generation: ~$0.01 to $0.02. A 200-report conference day: about $10.
No cap is enforced by ruling; if p95 generation grows past ~90s, raise it
with the founder before optimizing scope (kill criteria live in the options
doc).
