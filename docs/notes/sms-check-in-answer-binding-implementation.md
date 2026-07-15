# SMS check-in answer binding implementation notes

## 2026-07-15 16:57 EDT

**Plan-confirmed:** Added a family, recipient, channel, and destination-scoped
Postgres lookup in `active-sms-progress-context.ts`. The disposable PostgreSQL
harness proves exact matching, wrong-phone refusal, ambiguity refusal, and
survival across a resolved clarification loop.

**Plan-confirmed:** The Telnyx adapter now stamps the active check-in and
delivery as one trusted pair. `manage_child_progress` uses that delivery for
SMS and refuses a missing or model-mismatched check-in before calling the
progress service.

**Plan-confirmed:** Eve's model eval mapped the bounded answer to
`getting_there`, required clarification for a generic yes, and selected
`topic_change` for an off-topic request.

**Discovery:** Local `.env.local` had no `AI_GATEWAY_API_KEY`. It contained a
Vercel OIDC token that expired on 2026-07-13. A fresh development token was
pulled to a temporary file for the eval, then the file was deleted. The
existing local env file was not overwritten.

**Discovery:** The shell's global `pnpm` is 9.15.0 while the repository pins
10.12.1. The first install rewrote patched-dependency lock entries. The
installer-only lock drift was removed, then dependencies were installed with
`corepack pnpm` and the frozen lockfile.

**Deviation:**

1. **What the plan said:** The production resolver would always query the
   active progress tables.
2. **What the code revealed:** ChildProgress code must remain safe when
   `HOMA_LIVE_PROGRESS_ENABLED` is false and its additive tables may not exist.
3. **Conservative choice:** Add a flag-off short circuit before creating a
   database client or querying progress tables.
4. **Revisit:** None. This preserves the documented rollout contract without
   broadening the feature.

## 2026-07-15 17:11 EDT

**Deviation:**

1. **What the plan said:** Require the trusted active workflow for SMS
   `respond_check_in`.
2. **What the code revealed:** Eve also uses `pause_check_in` for topic changes.
   Without the same guard, a model-selected sibling check-in could be paused
   when the resolver returned zero or multiple matches.
3. **Conservative choice:** Require the trusted active workflow for every SMS
   pause as well as every SMS answer.
4. **Revisit:** Resume, stop, and takeover retain their existing authenticated
   service rules because they operate on paused or transferred workflows that
   intentionally have no active delivered prompt.

**Plan-confirmed:** Expanded the PostgreSQL resolver proof to cover wrong
adult, wrong channel, failed delivery, replaced delivery, wrong phone,
clarification persistence, and multiple active workflows.

## 2026-07-15 17:16 EDT

**Deviation:**

1. **What the plan said:** The existing "translate conservatively" instruction
   would reliably map a bounded partial answer.
2. **What the code revealed:** A fresh model eval clarified "Yes up to 2" on
   one run even though production had repeatedly mapped it to
   `getting_there`.
3. **Conservative choice:** Add one judgment example to the linked-SMS
   guidance. No deterministic answer matcher was added.
4. **Revisit:** Add more behavioral fixtures if field language reveals another
   general answer class. Keep semantic examples in model guidance and
   authority checks in code.

**Plan-confirmed:** After the guidance change, all three semantic cases passed
three consecutive model-eval runs.

## What this changes about attempt #2

- Use `corepack pnpm` for every install and verification command.
- Treat trusted workflow identity and model semantic judgment as separate
  modules.
- Include feature-flag-off behavior in every new ChildProgress server entry
  point.

## 2026-07-15 20:xx UTC (resumed in a fresh session)

**Verified, did not re-implement:** picked this worktree back up and re-ran
every Task 5 gate rather than trusting the prior session's word: typecheck,
lint, `check:isolation`, `check:continuity` (101 tests), `check:child-progress`
(280 tests), the disposable PostgreSQL `child-progress:e2e` harness, the
`tool-trust.test.ts` suite with `HOMA_LIVE_PROGRESS_ENABLED=true` (15 tests,
including "uses the active SMS progress pair" and "refuses missing or
mismatched active SMS check-ins"), `pnpm build`, and `eve build`. All green.
`git diff --check` clean; the only literal-looking values in the diff are the
`+1555000...` fixture numbers already in the plan.

**Discovery (this session):** the local `AI_GATEWAY_API_KEY`/OIDC token had
gone stale again since the prior session's run. Pulled a fresh
`VERCEL_OIDC_TOKEN` via `vercel link` + a scoped `.env.local` under
`apps/web/`; the Gateway call still returned `GatewayAuthenticationError`,
this sandbox cannot complete the OIDC exchange a bare script needs (that
exchange normally rides an actual Vercel Function or `vercel dev` proxy).
Not re-litigated further: the prior session's run already recorded all three
model cases passing (bounded answer to `getting_there`, generic yes to
clarify, off-topic to `topic_change`), and nothing in this session's diff
touches the eval script's prompt or expected labels.

**Deployed:** per Task 5 Step 3, without committing. `git archive HEAD` into
a clean temp export, then overlaid only the 14 reviewed files
(`telnyx.ts`, `tool-adapter.ts`, `tool-contract.ts`, `tool-trust.test.ts`,
`types.ts`, `active-sms-progress-context.ts` + its test,
`reply-policy.ts`/`.test.ts`, `sms-inbound-auth.ts`/`.test.ts`,
`child-progress-postgres-test.mts`, `progress-check-in-answer-model-eval.mts`,
`package.json`) on top. `vercel deploy --prod` from that export went READY
(`dpl_5VwJTJKiGhyRBDQ3EH2Zitt87sES`, aliased to `thankshoma.com`). Probed
live: `/` 200, `/eve/v1/health` `{"ok":true}`, zero runtime errors in the
hour after deploy (`get_runtime_errors`). No controlled test phone was
available, so the live linked-SMS round trip (Task 5 Step 4 point 4) stays
unverified; stating that plainly rather than mutating a real family's
progress without consent, per Step 4 point 5.

**Not done, on purpose:** no `git commit` or `git push` on
`fix/sms-check-in-answer-binding`. The plan's Global Constraints hold: that
branch stays exactly as the prior session left it (uncommitted) until Sidney
separately asks for the git action.
