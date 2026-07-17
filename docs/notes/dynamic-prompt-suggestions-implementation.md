# Dynamic prompt suggestions implementation notes

## 2026-07-15 20:13 EDT

**Discovery:** Implementation begins on `fix/sms-progress-answer-binding`, not
the earlier `main` snapshot. The checkout already contains substantial
uncommitted subject-lesson and reliability work, including edits to
`apps/web/.env.example`, `apps/web/lib/model-usage.ts`,
`packages/core/src/events.ts`, and `packages/core/src/events.test.ts`, which
this plan also needs to extend.

**Conservative choice:** Work in place because the user explicitly authorized
implementation in this checkout and the approved plan and design artifact are
untracked here. Make no commits, preserve every pre-existing hunk, and append
only the prompt-suggestion changes needed in shared files. Run focused diffs
and tests after each task so unrelated work is never silently replaced.

**Plan-confirmed:** The approved design and implementation plan are recorded at
`docs/homa-planning/plans/2026-07-15-dynamic-prompt-suggestions-directions.html`
and
`docs/superpowers/plans/2026-07-15-dynamic-webchat-prompt-suggestions.md`.

## 2026-07-15 20:24 EDT

**Plan-confirmed:** Task 1 landed the shared 1-to-2 suggestion contract,
deterministic eligibility policy, bounded transcript request, and validated
local restoration. The exact focused command passed 12 tests, and web
typecheck passed.

**Discovery:** The task review found two non-blocking test confidence gaps:
the schema tests do not independently exercise exact 4- and 20-character
boundaries, seven transcript messages, or a message over 6,000 characters.
The production schemas enforce all four limits.

**Conservative choice:** Keep Task 1 approved and carry these Minor coverage
gaps into the final quality pass. No product behavior is uncertain, and later
contract/eval tests can add the exact boundaries without changing interfaces.

## 2026-07-15 20:36 EDT

**Plan-confirmed:** Task 2 landed the founder-editable prompt, authenticated
no-store API route, family-context generation call, model usage attribution,
prompt tracing, optional model override, and deterministic fallback. Its three
focused tests, web typecheck, and focused lint passed. Independent review found
no Critical, Important, or Minor issues.

**Discovery:** The installed AI SDK marks `generateObject` deprecated, while
the current Homa generation modules and the approved plan still use it.

**Conservative choice:** Match the repository's existing generation pattern
for this feature. A broad AI SDK API migration is unrelated to prompt
suggestions and would increase risk on an already active branch.

## 2026-07-15 20:59 EDT

**Deviation**

1. **What the plan said:** Put the web-mode unit test beside the authored
   instruction at `agent/instructions/web-mode.test.ts`.
2. **What the code revealed:** Eve 0.19.0 compiles every TypeScript file under
   `agent/instructions/` as a production instruction module. The colocated
   test made `eve build` fail because it had no default instruction export.
3. **Conservative choice:** Move only the test to
   `lib/chat-suggestions/web-mode.test.ts`. Keep the production instruction in
   Eve's authored slot and import its pure helper from the test.
4. **Revisit:** A future Eve version may document test-file exclusions for
   authored slots. Until then, agent-module tests belong outside discovery
   directories.

**Deviation**

1. **What the plan said:** Stamp authenticated web sessions with
   `attributes.channel = "web"` so web-only instructions can detect them.
2. **What the code revealed:** The existing continuity web-delivery hook used
   any truthy channel as its non-web guard. An explicit web stamp therefore
   skipped canonical message persistence, progress binding, and reply loops.
3. **Conservative choice:** Centralize the hook's boundary as
   `channel === undefined || channel === "web"`. Legacy web sessions and the
   new explicit stamp proceed; every other channel still stands down.
4. **Revisit:** Audit future channel-sensitive hooks whenever a formerly
   implicit channel becomes explicit.

**Plan-confirmed:** Task 3 now passes 18 focused tests, 101 continuity tests,
the event guard, typechecks, focused lint, and Eve build. Independent re-review
found no remaining issues. Task 4 still owns both event emitters and removal of
their temporary staged entries.

## 2026-07-15 22:31 EDT

**Deviation**

1. **What the plan said:** Generate suggestions from every successful
   `onFinish` snapshot.
2. **What the code revealed:** A stream auto-stop can finish with a partial
   assistant snapshot while the durable run continues. Generating there could
   show stale options, and the recovered final reply initially bypassed
   suggestion generation entirely.
3. **Conservative choice:** Route normal finish and all recovery transitions
   through one exhaustive lifecycle policy. Auto-stopped partial snapshots
   start recovery without generation, recovery clears stale work and hides the
   rail, and only recovered final messages re-enter eligibility.
4. **Revisit:** Any future chat side effect attached to `onFinish` should use
   the same normal-finish versus durable-recovery distinction.

**Deviation**

1. **What the plan said:** Restore a saved suggestion set by matching its Eve
   assistant message id to the newest visible assistant reply.
2. **What the code revealed:** Postgres scrollback projects database rows as
   `hist:<database-id>`, so an Eve id such as `turn_1:assistant` cannot survive
   the server-history rendering seam.
3. **Conservative choice:** Add a versioned, deterministic fingerprint of the
   normalized visible assistant text. The local set restores when the newest
   live or server-projected reply matches by id or fingerprint. A newer
   different reply rejects the stale set. Fingerprints never enter analytics.
4. **Revisit:** If canonical conversation rows later retain runtime message
   identity, replace the text fingerprint with that server-owned identity.

**Plan-confirmed:** Task 4 now includes the stale-safe request client, 500ms
quiet threshold, refined segmented composer rail, local restoration, exact
sends, content-free shown/tapped events, turn correlation, queue and wall
handling, and durable-recovery behavior. Fresh verification passed 18 Task 1
tests, 4 Task 2 tests, 28 Task 4 tests, 39 chat UI tests, 101 continuity tests,
the event guard, web typecheck, focused lint, and Eve build. Independent
review found no remaining issues.
