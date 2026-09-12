# Clean runtime prompts

## 2026-09-12, plan-confirmed

The user approved moving developer maintenance notes out of model prompts, removing historical filesystem analogies, retaining actual build dependencies, and generating common voice rules while preserving role-specific guidance. Owning issue: gh#1174. This task reuses its clean worktree on codex/gh-1174-clean-runtime-prompts from f89110d9.

## 2026-09-12, discovery

Eve embeds the leading instructions.md comment verbatim. The report generator preserves its entire Markdown source, and the curriculum API reads its Markdown unchanged. Voice extraction already strips the first comment. The existing split guard checks headings, not synchronized voice content. Chat, report and curriculum voice sections are adapted, so only shared boundaries should be canonicalized; report pronoun rules and stricter document wording remain role-specific.

## 2026-09-12, plan-confirmed

Authoring templates will live outside the Eve agent tree, with a shared voice-rules source. Generated Markdown stays at existing runtime paths, avoiding new runtime file reads or a harness change. CI will compare rendered text with committed outputs and reject developer comments or unresolved template markers. Existing voice/report generators remain the packaging path.

## 2026-09-12, deviation

The plan expected the existing report pipeline to regenerate fixtures. A real isolated gateway call instead rejected its unchanged production response schema because drawer keys and activity/materials were optional. Tracked suspected live failure gh#1175. The bounded correction makes empty slots nullable and required, keeps deterministic formatting unchanged, adds provider-schema contract tests, and uses this release's report version/fixtures for validation. No production database or artifact credentials were available to the fixture run.

## 2026-09-12, discovery

The report version contract also requires a founder tone review of regenerated fixtures before shipping. Its source is plans/2026-07-06-llm-report-narrative-implementation-prompt.md, Work order and stop points, STOP 1. Prepare both complete narratives and all engineering validation before presenting the required review.

## 2026-09-12, plan-confirmed

Four generator failure-mode tests, eleven split tests, runtime prompt packaging/tracing, 156 voice tests, check:map, typecheck, lint, prompt budgets, the Eve production build, and the three stream-duration checks pass. Compiled Eve instructions have no comments or authoring markers. Chat text is byte-identical after removing its leading comment; the generated voice persona has no diff from main. Both report fixtures generated through Astra and passed the report gate. One real curriculum generation using synthetic facts passed its copy gate and respected the requested one-subject, one-week scope.

The optional documentation reconciliation audit is not green on clean main: its immutable inventory, coverage, migration evidence, and claim ledger already fail. The new source/review files also need enrollment in that historical audit inventory. Local relative path warnings introduced by the authoring notes were corrected to full repository paths. This release does not claim to close the repository-wide documentation audit.

## Next implementation

- Inspect compiled model text rather than assuming Markdown comments are hidden.
- Edit prompt sources and regenerate; voice extraction remains a separate packaging dependency.
- Test the provider JSON schema itself and regenerate report fixtures with only model credentials.
- Prepare the two complete generated examples before the required founder tone review.
