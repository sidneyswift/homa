# Acknowledgment-first app comparison, #1171

## 2026-09-16 · Plan-confirmed

Apply the previously tested one-bullet prompt change to the verified production base 2e67c7f13a0e67b3b8d726c6615180dc94db71ce. Preserve the old experiment branch and reuse its clean checkout on codex/gh-1171-ack-first-app. Only prompt source and generated output change application behavior. Existing Eve, Workflows, full tool set, saving, authentication, and Astra medium stay in place.

One candidate preview, at most one repair build, 12 measured browser sends plus two excluded warmups. Compare simple definitions and explicit child-profile reads. Alternate arm order. Separate first visible opening from substantive result. Use disposable synthetic families and preserve failed attempts. No production promotion. Stop at the cap and record the recommendation.

## 2026-09-16 · Discovery

The primary checkout is ahead of the currently deployed source. Using the verified production source makes the candidate-versus-production contrast a prompt-only comparison, while production versus preview hosting remains a limitation. The earlier model-only test used two inert tool schemas; this app test must exercise real tool execution and the full runtime.

## 2026-09-16 · Verified comparison and stop decision

Completed September 16, 2026 America/New_York (September 17 UTC). Twelve measured sends, plus two excluded warmups. Astra medium, existing Eve and Vercel Workflows, full tools. Only the web-chat prompt bullet changed.

| Average seconds from Send | Current instructions | New instruction |
| --- | ---: | ---: |
| First visible words, all measured sends | 10.98 | 7.85 |
| Definition answer begins, three per version | 10.22 | 6.60 |
| Lookup opening or answer begins, three per version | 11.73 | 9.10 |
| Lookup actual result begins | 11.73 | 13.46 |

The new version opened with a brief, specific intention on all three lookups. The current version remained silent until its result on all three. Definitions began with the answer directly on both versions. All six actual get_children calls completed successfully. All fourteen questions and final answers, including warmups, matched the saved records. Usage recorded openai/gpt-6-astra throughout; source settings retain medium.

The new version was faster to first words in every measured pair, but only one of its six measured turns began under five seconds, versus zero of six baseline turns. Its lookup results began about 1.73 seconds later on average. This supports an earlier-opening behavior improvement, not a reliable five-second promise or proof that the whole task became faster.

## Boundaries and evidence

- Browser measures Send invocation to the first nonempty answer text visible in the viewport. Hidden reasoning and app overhead are included. This is sampled DOM visibility, not physical display paint; results use the upper bound of the observation interval. All samples passed the existing coverage check.
- Actual result starts at the first result word, not the end of the answer. Lookup snapshots were inspected manually to distinguish the opening from the first appearance of Alex.
- Small repeated-prompt sample, two question types, same growing history sequence in each arm. No worksheet or long-session conclusion. These are not 95th-percentile estimates.
- Production baseline and preview candidate use different hosting environments and separate synthetic families. Those differences prevent attributing all timing differences solely to the prompt.
- Baseline remained READY at dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i, source 2e67c7f13a0e67b3b8d726c6615180dc94db71ce. Candidate 1a8e31da was READY at dpl_4Nm2pUt3fcqZogrv9ANLf2thfuoR. No production promotion.
- Prompt generation/parity, instructions checks, Eve build, stream-duration guard, and tenant isolation checks passed. No claim about full GitHub CI.
- Both disposable Auth accounts were removed and their synthetic families retired through the ownership-checked cleanup utility. Credentials removed. Cleanup receipts accompany the evidence.

## Decision

Stop this experiment at its cap. The prompt change is a useful candidate for reducing silence on longer tasks, but is not sufficient for a five-second target. Preserve it for review rather than starting another architecture rewrite or promoting an old production-based branch automatically. If pursuing a guaranteed immediate indication, a visible app status can provide that independently, but must be measured separately from a model-generated response. Any further speed experiment should isolate one measured source of delay and have a fixed stop rule.

Full observations, exact per-send timings, read-only database verification, cleanup receipts and reproduction scripts are beside this report. No real family data or sign-in credentials are included.
