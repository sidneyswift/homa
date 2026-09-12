# Astra context cleanup

Source: approved audit in Codex task 01a095c3-309f-7971-bd0d-69dd86e56947. Tracking: gh#1167, includes gh#1067.

## 2026-09-12: implementation boundaries

Preserve founder laws, voice examples, authenticated state, deterministic validation, material approval, and the no-silent-turn guard. Move workflow prose without changing its meaning before considering behavioral simplifications. Keep onboarding automatic preloading; select guidance from existing authenticated records without extra database reads or model calls. Comparative evaluations determine whether the smaller prompts are ready to ship.

## 2026-09-12: discovery

The recipe orphan check requires every reference name in SKILL.md, preventing a useful nested index. Replace this with reachability through shipped references while retaining recipe-table validation everywhere it occurs.

The unused detached checkout is reused for codex/gh-1167-astra-context. Its former commit 084fed7155a9b8d4e59bb239e7c7df0f724dcdca remains on claude/mobile-ios-system-design-243bf1; no prior work was removed.

## Reviewed changes and measurements

The materials, planner, onboarding and inquiry roots now route to supporting references. All 19 newly extracted fleet references preserve their original procedure text; the 69 recipe files are unchanged. Voice examples, material approval, tenant boundaries and durable state remain authoritative. Background promises now require a confirmed durable job or schedule receipt.

| Authored file | Before bytes | After bytes |
| --- | ---: | ---: |
| Main agent instructions | 24,432 | 21,639 |
| Materials root | 54,988 | 3,064 |
| Planner root | 19,164 | 3,399 |
| Onboarding root | 27,817 | 9,566 |
| Reflective inquiry root | 19,457 | 1,552 |

Onboarding selects current and adjacent guidance from records already fetched for the authenticated family. Missing state includes all stage guidance. The shared root is still preloaded automatically, preserving the no-silent-turn behavior. No new query or model call selects a stage.

The skill guard now checks reference reachability through nested indexes, rejects orphan cycles, and validates recipe tables in supporting files. Separate root and description budgets catch growth in commonly loaded text rather than treating a package storage limit as a prompt budget.

## Controlled Astra comparison

Baseline: e92ef338664239ec226334ed564589b95d62dc57. Model: openai/gpt-6-astra, medium reasoning. One baseline and one candidate sample per scenario, using synthetic tool effects and reduced schemas. Input tokens below include repeated model steps. These samples do not establish production latency or a statistical reliability improvement.

| Scenario | Baseline input tokens | Candidate input tokens | Baseline / candidate steps | Result |
| --- | ---: | ---: | --- | --- |
| Reopen saved material | 67,717 | 34,298 | 4 / 5 | Both pass |
| Confirmed finite background job | 27,340 | 23,079 | 3 / 3 | Both pass |
| Rewrite quoted instructions without acting | 7,540 | 6,120 | 1 / 1 | Both pass |

Reproduce with `node --import tsx apps/web/evals/context-cleanup/compare.mts --baseline <commit> --output <private-result.json>` with a valid model identity. `pnpm report:agent-context` reports authored bytes by journey and explicitly excludes tool schemas, other dynamic blocks, history and provider overhead.

## Validation boundaries

Typecheck, lint (four existing warnings), the agent deployment build, stream-duration check, fleet package and reference checks, context budgets, instruction split, onboarding mode and stage tests, and no-silent-turn guard pass. Model routing and behavior are evaluated separately against the real Eve harness and disposable local data.

The frozen July documentation reconciliation check fails on unchanged main for extensive existing registry drift. The new references also lack entries in that immutable historical baseline. This change does not rewrite the baseline or weaken its guard; documentation reconciliation is not claimed clean.

During the broad Astra evaluation, unchanged progress tool code rejected declared optional keys retained as undefined by the provider. gh#1169 records the suspected live failure and narrow repair: normalize only absent declared fields before the existing strict command validator. Thirty progress boundary tests pass, including supplied unrelated fields, unknown identity, malformed IDs and missing required fields. Live verification remains required before closing the incident.
