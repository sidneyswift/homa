# Astra context cleanup

Source: approved audit in Codex task 01a095c3-309f-7971-bd0d-69dd86e56947. Tracking: gh#1167, includes gh#1067.

## 2026-09-12: implementation boundaries

Preserve founder laws, voice examples, authenticated state, deterministic validation, material approval, and the no-silent-turn guard. Move workflow prose without changing its meaning before considering behavioral simplifications. Keep onboarding automatic preloading; select guidance from existing authenticated records without extra database reads or model calls. Comparative evaluations determine whether the smaller prompts are ready to ship.

## 2026-09-12: discovery

The recipe orphan check requires every reference name in SKILL.md, preventing a useful nested index. Replace this with reachability through shipped references while retaining recipe-table validation everywhere it occurs.

The unused detached checkout is reused for codex/gh-1167-astra-context. Its former commit 084fed7155a9b8d4e59bb239e7c7df0f724dcdca remains on claude/mobile-ios-system-design-243bf1; no prior work was removed.

## Reviewed changes and measurements

The materials, planner, onboarding and inquiry roots now route to supporting references. The 19 newly extracted fleet references preserve their original procedures; one retired brand-style term is updated to pass the current brand contract; the 69 recipe files are unchanged. Voice examples, material approval, tenant boundaries and durable state remain authoritative. Background promises now require a confirmed durable job or schedule receipt.

| Authored file | Before bytes | After bytes |
| --- | ---: | ---: |
| Main agent instructions | 24,432 | 21,644 |
| Materials root | 54,988 | 3,064 |
| Planner root | 19,164 | 3,412 |
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

During the Astra evaluations, unchanged progress tool code rejected unrelated fields supplied by the provider. gh#1169 records the suspected live failure. A compiled-schema probe showed Astra supplying stand-in values for unused fields; removing only undefined entries was insufficient. The transport now permits null for optional fields and instructs the model to use it for unused fields. The boundary removes only declared absent/null fields before the unchanged strict command validator. Supplied unrelated values, unknown fields, malformed IDs and missing required fields still fail. Thirty boundary tests pass. Live verification remains required before closing the incident.

The complete material suite passes 546 tests and the complete onboarding suite passes 188 tests. Relocated contract tests require the root to point at the exact supporting reference before checking its original quality assertions. Admin package inspection includes supporting guidance for tool mappings and coverage while continuing to display the root separately.

## Integration validation

The concurrent chat-preparation change (#1168, main 549c40be) is integrated. Independent reads stay parallel; onboarding receives the authenticated attributes and selects guidance inside the existing read. A failed onboarding read supplies full stage guidance only for onboarding-mode sessions. The progress suite passes 588 tests after integration.

The exploratory 89-case Eve run exhausted the local Node heap before producing a final verdict report. It is not counted as passing. Smaller focused batches on the combined revision replace that unverifiable run.

The first bounded Eve batch passed 7 of 8 routing checks. Its failure was the old onboarding negative asserting that no skill could load; the actual selected skill was progress-next-move, with no onboarding restart. The check now rejects onboarding specifically and setup cards. The batch also confirmed that a routing-only pass could hide a failed progress effect. A new full-catalog case validates the actual provider arguments against the strict action parser; the generic eval channel can still refuse execution. The saved-behavior case separately requires durable local evidence and now passes with the isolated launch.

The isolated 23-case batch passed 18 cases, including saved progress evidence, material creation, planner workflows, Library, lessons and state records. Five failures were traced to: the generic eval channel refusing enabled progress writes; two Hours category cases incorrectly requiring a time-total read; the material-adjacent negative incorrectly forbidding all skills; and explore_child_map receiving provider-filled unrelated query fields. The routing assertions now enforce their actual intent. The explorer transport explicitly permits null unused fields and retains strict per-query and tenant checks. Four actual-tool/canonical-reader tests pass, including rejection before any read for supplied unrelated fields and unknown identity. The repaired cases are rerun separately.

The dotenv reload behavior is the existing gh#1143, already owned by another lane. The verification launch temporarily preserves the worktree environment file and supplies only model OIDC plus local fixture flags; the original file is restored afterward.
