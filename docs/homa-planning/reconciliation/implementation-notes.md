# Documentation reconciliation implementation notes

## 2026-07-11 08:59 EDT

### Plan-confirmed

The active goal requires a separate exhaustive file manifest and material-claim ledger. The implementation plan records both artifacts and the zero-open-entry completion gate.

### Discovery

The starting repository was on `main` at `6116cb4` with a large pre-existing working tree spanning application code, migrations, CI, live guidance, and historical planning records. Those changes are user work and are part of the current repository state that this audit must observe.

### Deviation

1. **What the plan said:** The shared execution workflow normally creates a clean isolated worktree before edits.
2. **What the repository revealed:** A new worktree from HEAD would omit the large uncommitted implementation state that the documentation must reconcile, while stashing, committing, or copying it would mutate or take ownership of user work.
3. **Conservative choice:** Preserve the working tree in place and create `codex/documentation-reconciliation-2026-07-11` before audit edits. Do not stash, stage, commit, or overwrite pre-existing changes. Delegated discovery remains read-only.
4. **Revisit:** Once the audit diff is isolated by path and all checks are green, the user can choose how to integrate it with the pre-existing work.

### Discovery

The prior code-review tracker records CR-51 as only partially complete. It confirms an app-source punctuation cleanup, but it does not provide exhaustive documentation coverage, semantic claim evidence, production reconciliation, or zero-open-entry checks.

### Next highest-risk gap

Freeze the complete candidate universe and distinguish live guidance, historical records, drafts, generated artifacts, and vendored documentation before editing any claims.

## 2026-07-11 09:01 EDT

### Discovery

Two pre-existing intentional plan files are untracked but referenced by current documentation: `plans/2026-07-11-onboarding-depth-fork.md` and `plans/2026-07-11-the-wall.md`. The audit also creates new documentation that begins untracked.

### Deviation

1. **What the plan said:** Build the candidate universe only from tracked paths returned by `git ls-files`.
2. **What the repository revealed:** A tracked-only universe would omit current decision records, create broken-link blindspots, and omit the audit's own new artifacts.
3. **Conservative choice:** Use the union of tracked files and untracked intentional documentation returned by Git under explicit safe pathspecs. Record `tracked`, `pre-existing-untracked`, or `audit-created` as the starting state. Continue to exclude ignored files and all prohibited directories.
4. **Revisit:** At final review, every surviving pre-existing untracked decision record must either be included in the delivered change, replaced by a canonical tracked record, or listed as an exact blocker.

## 2026-07-11 09:07 EDT

### Discovery

The current production alias resolves to a READY Vercel deployment of commit `6116cb4`, created 2026-07-11 06:30 UTC. Public probes returned 200 for `/`, `/onboarding`, `/signin`, `/terms`, and the three public AI-readable text files. `/conference`, `/waitlist`, and `/map` return 308 to `/onboarding`. Anonymous `/app` returns 307 to `/signin?next=%2Fapp`. `www.thankshoma.com` returns 308 to the apex domain.

### Discovery

The production landing page still says Homa is invite-only. The current working tree removes that statement. Production `ai.txt` matches the working tree byte for byte, while production `llms.txt` and `llms-full.txt` do not. Any statement that the public invite-only cleanup is shipped is therefore false until a newer deployment becomes READY and the live files are reprobed.

### Discovery

Production registers three Vercel cron jobs: the public map cron hourly, one managed eve endpoint hourly, and the managed fleet-research schedule at `47 6 * * *`. Registration does not prove successful execution.

### Discovery

The production migration history and local migration directory do not use matching timestamps consistently. A name-first comparison found 51 shared names, 6 local-only names, and 2 production-only names. The newest production record is `children_full_birthday`. The current local `revoke_deny_all_tables` and `family_billing` migrations are not recorded remotely. The two production-only names are `child_reports_grant_hygiene` and `hours_source_labels`; no matching local migration filenames exist. This is a reproducibility gap, not permission to rewrite applied migration history.

### Discovery

The installed Vercel CLI is 54.18.7 while current deployment logs use 55.0.0. The installed Supabase CLI is 2.22.6 while 2.109.1 is current. Production evidence must use discovered command help and avoid assuming newer flags. No global tool upgrade was performed.

### Next highest-risk gap

Finish the exact manifest coverage check, then create ledger entries that distinguish production, committed HEAD, and uncommitted working-tree claims. The stale eve-version-bump parked-session step is the highest-risk operational document identified so far.

## 2026-07-11 09:29 EDT

### Plan-confirmed

The candidate universe now comes from repository-wide Git cached and untracked enumeration with explicit pathspec exclusions for all three prohibited roots. Exact manifest coverage remains the gate, and ignored files are still excluded.

### Discovery

The prior extension and named-root boundary missed exactly four intentional documentation-bearing files: `.github/workflows/ci.yml`, `apps/web/.env.example`, `apps/mobile/.env.example`, and `scripts/telnyx-provision.mts`. Their workflow contract, environment guidance, or executable runbook is a primary purpose of the file. Ordinary code comments, migrations, generic configuration, `.gitignore`, and `.vercelignore` support repository claims as executable evidence but are not independent documentation artifacts.

### Deviation

1. **What the plan said:** Enumerate documentation under named safe roots and include documentation extensions plus a short special-file list.
2. **What the repository revealed:** That allowlist silently omitted documentation at `.github`, under `scripts`, and in `.env.example` files, and it would miss a future top-level documentation location until someone remembered to expand the roots.
3. **Conservative choice:** Enumerate the full Git index and untracked, non-ignored set from the repository root while excluding prohibited roots in the Git pathspec itself. Apply a strict primary-purpose predicate, with the four executable or configuration references explicitly named, so unrelated executable comments remain evidence-only.
4. **Revisit:** When another nonstandard file becomes an intentional documentation contract, add it explicitly with format, area, authority, claim scope, and a manifest row instead of broadening all source or configuration files into claim scope.

### Next highest-risk gap

Create the claim ledger and reconcile the newly in-scope CI, environment, Telnyx, Marble, and human-authored calibration Findings claims against repository and production evidence.

## 2026-07-11 09:53 EDT

### Discovery

The shared working tree gained `plans/2026-07-11-sms-family-invites.md` during Task 1 review. Repository-wide dynamic candidate enumeration caught the pre-existing-untracked plan, and the manifest now records its open claim scope without modifying the plan itself.

## 2026-07-11 10:13 EDT

### Plan-confirmed

Task 2 created the strict 15-column claim ledger, two sanitized evidence baselines, typed open and terminal resolution rules, canonical-reference checks, group integrity, and bidirectional ledger-to-manifest coverage. The first 73-row, 33-group checkpoint established the control shape but did not yet include every semantic group named by the Task 2 plan. Signup, SMS, multi-parent, subject taxonomy, paywall placement, pricing and plan name, and mobile parity remained to be added before seed-scope coverage could be claimed.

### Discovery

The branch advanced concurrently after the audit began. The audit-start base and production deployment remain `6116cb4`, while the current branch HEAD observed for repository evidence is `a9f6e8b`. Repository claims now name the later working-tree observation explicitly, and production claims remain tied to the deployed commit.

### Discovery

Dynamic enumeration found two additional pre-existing-untracked files under `docs/superpowers/` while Task 2 was in progress. With the three new audit artifacts, exact candidate and manifest counts are now 375 rather than the earlier no-concurrency estimate of 373.

### Deviation

1. **What the plan said:** Add the three Task 2 audit artifacts and expect 373 candidates if no other documentation appears.
2. **What the repository revealed:** Two unrelated untracked documentation files appeared before validation completed.
3. **Conservative choice:** Add open manifest rows for both without reading them into this claim seed or modifying their content. Preserve the concurrent work and keep exact coverage.
4. **Revisit:** Their documentation-domain pass must inventory their material claims before either file can become terminal.

### Discovery

The local Vercel CLI is `54.18.7` while session guidance identifies `55.0.0` as current. The audit records `pnpm add -g vercel@latest` as the recommended upgrade but does not mutate global tooling. The local Supabase CLI is `2.22.6` and advertises `2.109.1`.

### Plan-confirmed

At the first Task 2 checkpoint, `pnpm check:docs -- --allow-open` passed with exact 375-of-375 file coverage, valid lifecycle and alias controls, 73 ledger rows in 33 groups, and 47 intentionally open claims. That result proved structural validity only; the later seed-scope review still found the seven missing semantic groups listed above.

At that checkpoint, strict `pnpm check:docs` failed only on the intended completion gates: 361 manifest rows remained audit-active, in-progress, or unresolved, and 47 ledger rows remained open. It reported no structural, coverage, lifecycle, alias, or claim-ledger validation error.

### Deviation

1. **What the plan said:** Enforce the Task 2 ledger contract and defer only hardening that would overcomplicate this batch.
2. **What the checker revealed:** Reference syntax, safe repository existence, evidence class, and bidirectional coverage are deterministic now, while production freshness windows and exact line-range validation need a later evidence-refresh design.
3. **Conservative choice:** Implement the deterministic Task 2 rules, including component-by-component reference safety, and explicitly defer production freshness and full locator-range validation to Task 6.
4. **Revisit:** Task 6 should add observed-at freshness thresholds by claim kind and validate locator ranges against the referenced revision without invalidating preserved history.

### Next highest-risk gap

Resolve the governance and public-surface conflicts first: restricted-tree wording, environment-template allowlisting, wordmark scope, BUILD status drift, invite-only versus free access copy, and the three unsupported public absolutes. Production-dependent resolutions need a new READY deployment and fresh probes before terminal status.

## 2026-07-11 10:31 EDT

### Discovery

The first D8 ledger resolution reversed founder precedence. `journeys/10-reconciliation.md` says HOMA in the wordmark and UI surfaces, with Homa in prose and conversation. BUILD matches that ruling. AGENTS, DESIGN, and `docs/homa-design/readme.md` narrow all-caps usage to the wordmark and remain explicit conflicts for their later domain passes.

### Deviation

1. **What the plan said:** The Task 2 seed must include signup, SMS, multi-parent, subject taxonomy, paywall placement, pricing and plan name, mobile parity, design package status, migrations, and CI coverage.
2. **What the first seed revealed:** It had design-package, migration, and CI groups, but the other seven named semantic groups were only represented indirectly or not at all.
3. **Conservative choice:** Add explicit open groups for each missing topic, preserve policy conflicts, use no invented ticket IDs, and record current repository presence separately from production proof.
4. **Revisit:** Each open group now names the exact decision, ticket, or production evidence needed for a terminal resolution.

### Discovery

Component-by-component existence validation found two ledger references to nonexistent `packages/core/src/skills.ts`. Both were replaced with the current `packages/core/src/index.ts` and `packages/core/src/map/content.ts` evidence paths. Repository references now allow safe files, directories, and named aliases while refusing missing nodes, prohibited roots, non-directory components, and unknown symlinks.

### Plan-confirmed

The production evidence method now matches the commands actually used. Node.js fetch and crypto produced public probes and hashes. `supabase migration list --linked` failed because the checkout is unlinked and is recorded only as a limitation. The successful CLI path used `--db-url` with a redacted URL assembled in process memory, followed by a separate read-only Postgres name query with connection values redacted.

### Discovery

The refreshed name-first migration comparison at `2026-07-11T10:26:38-04:00` found 58 local names, 53 remote names, 51 shared names, 7 local-only names including `family_sms_invites`, and 2 remote-only names. This remains history divergence only, not proof of schema behavior.

### Plan-confirmed

After the gap corrections, `pnpm check:docs -- --allow-open` passes with exact 375-of-375 coverage, 95 claim rows in 40 groups, and 64 intentionally open claims. Strict `pnpm check:docs` fails only on the intended completion gates: 361 manifest rows and 64 claim rows remain open. Syntax, diff-whitespace, trailing-whitespace, and em-dash checks pass.

### Next highest-risk gap

Resolve the newly explicit policy conflicts without changing product behavior: D8 wording in live governance and design guidance, signup acquisition framing, C5 versus the current subject taxonomy, PRD versus later paywall placement, plan naming, and the missing ticket homes for SMS invitations and mobile parity.

## 2026-07-11 10:38 EDT

### Discovery

A new untracked specification, `docs/superpowers/specs/2026-07-11-native-media-service-design.md`, appeared in the current candidate inventory and remains open without content changes.

### Next highest-risk gap

Reconcile the newly observed native-media service specification during the documentation domain pass while preserving concurrent ownership of its content.

## 2026-07-11 10:41 EDT

### Discovery

Two untracked rescue-ramp documents were observed in the Task 2 candidate inventory and disappeared before final review:

- `docs/superpowers/plans/2026-07-11-rescue-ramp-game.md`
- `docs/superpowers/specs/2026-07-11-rescue-ramp-game-design.md`

Three scoped searches covered tracked and untracked paths under `docs`, the current `docs` file tree, and Git history for `docs/superpowers/**`. They found no surviving path, relocation, or tracked history for either file.

### Deviation

- Planned: keep every current candidate represented as an open manifest row until claim reconciliation.
- Actual: both candidates vanished concurrently before their content could receive final review.
- Reason: the shared working tree changed outside this audit, and no authoritative source remained from which to reconstruct the documents.
- Impact: both paths remain as terminal `removed` and `deleted` records in the manifest and ledger. Revisit them only if an authoritative version is restored.

### Next highest-risk gap

Reconcile the newly observed native-media service specification during the documentation domain pass while preserving concurrent ownership of its content.

## 2026-07-11 10:48 EDT

### Discovery

Quality review found that the initial environment-template baseline confused tracked state with ignore precedence. Both `.env.example` templates are tracked, but `git check-ignore -v --no-index` reports the later root `.env*` rule for the mobile template. The nested web ignore file explicitly re-allows only the web template.

### Deviation

- Planned: record the templates as intentionally tracked exceptions to the secret-file boundary.
- Actual: the initial baseline described both templates as effectively allowlisted.
- Reason: the first pass inspected Git tracking and the early root exception without testing the later matching rule for each path.
- Impact: the baseline and ledger now distinguish current tracking from ignore behavior. The live governance conflict remains open for the operational documentation pass.

### Next highest-risk gap

Resolve the environment-template policy and ignore-rule drift without exposing values or changing product behavior, then continue the live operational documentation pass.

## 2026-07-11 10:58 EDT

### Files inspected

The read-only live operational pass inspected 21 files:

- `.github/workflows/ci.yml`
- `AGENTS.md`
- `BUILD.md`
- `DESIGN.md`
- `HUMAN-TODO.md`
- `README.md`
- `CLAUDE.md`
- `apps/mobile/.env.example`
- `apps/mobile/AGENTS.md`
- `apps/mobile/README.md`
- `apps/mobile/CLAUDE.md`
- `apps/web/.env.example`
- `apps/web/AGENTS.md`
- `apps/web/README.md`
- `apps/web/CLAUDE.md`
- `data/state-requirements/README.md`
- `packages/core/README.md`
- `packages/design/README.md`
- `packages/taxonomy/NOTICE.md`
- `scripts/telnyx-provision.mts`
- `supabase/README.md`

The read-only web-guidance pass inspected 10 files:

- `apps/web/agent/curriculum-call-instructions.md`
- `apps/web/agent/curriculum-writer.md`
- `apps/web/agent/instructions.md`
- `apps/web/agent/memory-extractor.md`
- `apps/web/agent/report-writer.md`
- `apps/web/agent/skills/materials-studio/SKILL.md`
- `apps/web/agent/skills/research-brief/SKILL.md`
- `apps/web/public/ai.txt`
- `apps/web/public/llms.txt`
- `apps/web/public/llms-full.txt`

### Evidence observed

- The workflow configures the named build and guard commands, but its isolation step lacks the database credential that the current isolation guard requires. Its triggers cover pushes and pull requests for `main`, not every push.
- Root tenancy guidance states `SET LOCAL` as current, while `apps/web/lib/agent-db.ts` identifies that hardening as upcoming ticket M1-02.
- The Telnyx provisioning script's `--status` promise is false because an existing assistant can still receive a POST update.
- Retired `lead_*` guidance remains in the web environment template and package README after the drop migration.
- The public state-academic-mapping, child-never-sees-prompts, planner-reshuffle, hours-on-home, and no-JavaScript absolutes are not supported by current code.
- Report drawer guidance says 320 characters while the hard gate permits 360.
- Materials review is fail-open, so automatic-review absolutes are not current guarantees.
- The memory extractor's permanent diagnosis ban conflicts with founder ruling D6 and upcoming ticket MJ-13.
- Current `llms.txt` and `llms-full.txt` differ from production. Their revised access wording is not shipped.

### Changes made

No live operational or web-guidance file was edited during these read-only passes. Their material claims still need ledger rows before remediation.

### Unresolved conflicts

Production-dependent Telnyx, report generation, material delivery, proactive task, billing, and authenticated isolation claims still require bounded live evidence. Policy conflicts remain open where a later founder ruling has not yet been indexed or where the authoritative source is ambiguous.

### Next highest-risk gap

Finish the explicit founder-supersession index and close the Task 2 control review. Then convert these 31 file audits into claim-ledger groups and remediate the highest-risk live guidance first.

## 2026-07-11 11:08 EDT

### Discovery

The explicit founder-supersession sweep found 18 missing policy topics plus four authority ambiguities. The ledger now indexes the full discovered set as paired claim groups, including billing, age scope, photo consent, conference scope, the lead-magnet surface and route, retired founding-families language, onboarding identity and storage, report narrative generation, family-skill promotion, pricing and Homa Plus naming, copy priority, trajectory geometry, voice retention, SMS onboarding, proactive tasks, report-as-dashboard, assessment depth, full birthdays, direct printing, and private minors' media.

The sweep also found two pairs of colliding ruling labels. Global D3 is the age-range decision, while lead-magnet D3 is the workspace-timing decision. Global D8 is the casing decision, while lead-magnet D8 is the report-prose decision. The ledger now requires namespaced references for those decisions.

### Evidence observed

- The later founder ruling explicitly resolves the upper-tier name to Homa Plus. CLM-0091 no longer describes plan naming as unresolved; it records the stale PRD wording as the conflict.
- The later build-log and plan rulings are explicit, but top-level authority guidance still points narrowly to the founder queue in `journeys/10`. Those later rulings remain open until the source-of-authority wording is canonicalized.
- The send-to-printer plan is still proposed and keeps its reversal in a founder decision queue. It is not treated as controlling.
- Global D7 does not resolve private-by-default handling for minors' media. That decision remains open.
- A new concurrent implementation plan, `docs/superpowers/plans/2026-07-11-native-media-service.md`, appeared and was added to the manifest as unresolved without editing its contents.

### Changes made

The ledger grew from 97 claims in 41 groups to 145 claims in 64 groups. Manifest back-references now cover every indexed supersession source. No product behavior or live source documentation changed in this iteration.

### Verification

`pnpm check:docs -- --allow-open` passes with 375 current candidates, 377 manifest rows, 2 preserved terminal rows, 145 ledger claims in 64 groups, 361 open manifest rows, and 113 open claims.

### Next highest-risk gap

Run the repaired Task 2 specification and quality reviews. Then reconcile the live governance authority wording before resolving any later founder-ruling group as canonical.

## 2026-07-11 11:14 EDT

### Discovery

The second Task 2 specification review found four semantic omissions after the structural check passed. Older brand rows still used bare D8 identifiers. Global D6 sensitive-memory policy was absent. The birthday group omitted the superseded D-mp-4 day-01 normalization. The D-ht summary omitted the retained evening journal loop and the exact Homa's tasks navigation name. The production alias list also needed to distinguish custom domains from all deployment aliases.

### Changes made

- All global casing references now use `global-D8-casing`.
- GRP-065 records global D6, the current extractor conflict, and ticket MJ-13.
- GRP-062 now includes D-mp-4 as a superseded birthday decision.
- GRP-059 now states all five D-ht decisions materially.
- The production baseline labels the two public domains as custom-domain aliases and records that five total aliases were listed during the targeted recheck.

### Next highest-risk gap

Repeat the Task 2 specification review, then run the independent quality review before live-document remediation begins.

## 2026-07-11 11:24 EDT

### Discovery

The Task 2 quality review found that the remote migration comparison had become stale relative to concurrent working-tree changes. The original comparison observed 58 local files and 53 remote history entries at `2026-07-11T10:26:38-04:00`. The local directory contained 62 files at `2026-07-11T11:24:44-04:00`.

Four local names appeared after the remote snapshot: `conversation_continuity`, `conversation_continuity_hardening`, `conversation_continuity_indexes`, and `family_sms_invite_submission_hardening`.

### Changes made

The production baseline now time-bounds the original comparison and records the later local-only drift without claiming remote state. CLM-0021 and CLM-0081 are historical snapshots rather than verified-current production claims. CLM-0020 remains open until the remote history is refreshed.

### Next highest-risk gap

Finish checker hardening so repository drift, typed references, exclusion classes, tracked deletions, and terminal remediation evidence are machine-enforced before Task 2 closes.

## 2026-07-11 11:31 EDT

### Discovery

The new migration drift guard detected another concurrent local migration while checker hardening was in progress. `family_sms_invite_dual_confirmation` raised the current local count from 62 to 63.

### Changes made

The local side of the production baseline now records 63 files and five post-snapshot names. The remote history remains explicitly unrefreshed, so no new remote parity claim was made.

### Next highest-risk gap

Complete the checker hardening pass and confirm the drift guard passes against the current shared tree.

## 2026-07-11 11:34 EDT

### Discovery

The migration drift guard caught `conversation_inbound_receipts` appearing concurrently after the 63-file refresh.

### Changes made

The local baseline count is now 64 with six names added after the remote snapshot. Remote history remains unrefreshed and open.

### Next highest-risk gap

Confirm the hardened checker against this latest shared-tree state, then repeat the independent quality review.

## 2026-07-11 11:35 EDT

### Discovery

A second timestamped `conversation_inbound_receipts` migration appeared during verification. The local directory now has 65 files. Seven files were added after the remote snapshot, with six distinct names.

### Changes made

The drift evidence records both timestamped files explicitly. No remote or schema inference was made.

### Next highest-risk gap

Obtain one stable checker pass against the shared tree, then rerun quality review.

## 2026-07-11 11:39 EDT

### Discovery

A third timestamped `conversation_inbound_receipts` migration appeared during checker review. The local directory now has 66 files, with eight post-snapshot files carrying six distinct names.

### Changes made

The drift evidence was refreshed without changing the preserved remote snapshot.

### Next highest-risk gap

Complete checker verification before the next concurrent migration change.

## 2026-07-11 12:04 EDT

### Task 2 approval

The final specification and independent quality reviews approved the audit controls after two additional hardening rounds.

- Every repository fragment in authority, evidence, canonical, ruling-registry, and ticket-registry references now resolves to an exact Markdown heading, HTML anchor, or in-range line locator.
- Registered markers must occur inside the registered fragment rather than elsewhere in the same file.
- Terminal command and production claims require an exact registered truth detail and its matching baseline section. A repository baseline cannot stand in for production evidence, and invented truth details fail.
- The immutable first-seen baseline now includes the sanitized founder-history archive created during remediation.
- The migration drift guard records 68 current local files at `2026-07-11T12:00:55-04:00`; the remote comparison remains the earlier time-bounded snapshot.

`pnpm check:docs -- --allow-open` passes with 377 current candidates, 379 manifest rows, 2 preserved removals, 147 claims in 65 groups, 363 open manifest rows, and 115 open claims. Strict `pnpm check:docs` fails only for those open completion gates.

### Files remediated in the first canonical pass

- Root authority and operations: `AGENTS.md`, `BUILD.md`, `README.md`, `DESIGN.md`, `HUMAN-TODO.md`.
- Preserved founder history: `docs/homa-planning/history/2026-07-11-human-todo-archive.md`.
- Planning authority: `docs/homa-planning/README.md`, `13-mr-prd.md`, and `journeys/10-reconciliation.md`.
- Package and operational guidance: mobile and web READMEs and agent rules, the web environment template, core and design package READMEs, the taxonomy notice, the state snapshot README, the Supabase README, and the Telnyx provisioning comments.
- Design and copy governance: `.agents/skills/homa-design/SKILL.md`, `.agents/skills/homa-copy-writer/SKILL.md`, `docs/homa-design/CLAUDE.md`, `docs/homa-design/readme.md`, and `marketing/voice/house-style.md`.
- Public summaries: `apps/web/public/ai.txt`, `llms.txt`, and `llms-full.txt`.

### Material changes

- Founder precedence now has one canonical index with original dated sources, later rulings, namespaced collisions, and four explicit open decisions.
- The PRD preserves its 2026-07-03 baseline while a controlling reconciliation table identifies later policy and current implementation gaps.
- BUILD is now stable guidance rather than a stale embedded Phase B snapshot. Repository and production truth are separated.
- The founder checklist is a short current action queue. Its prior mixed setup history was relocated, annotated, and stripped of literal private contact and family identifiers.
- Public summaries no longer claim state academic mapping, a verified five-minute duration, a child-never-sees-prompts absolute, automatic planner reshuffling, hours-versus-state compliance, universal curriculum integration, or no-JavaScript behavior.
- A fresh parent-reader gate found internal terms and disclaimer-shaped wording in the first public-summary draft. Accepted fixes now explain the practical behavior in plain language and move maintainer language out of the parent explanation.

### Unresolved conflicts

- D10, DM7, direct printer integration, and private-by-default handling for minors' media still require founder decisions.
- Current production bytes still differ from the rewritten `llms.txt` and `llms-full.txt`; exact deployment parity and live access state remain open.
- Telnyx, Stripe, materials delivery, proactive task execution, and authenticated tenant behavior need bounded live evidence before any surviving production claim becomes terminal.
- Runtime agent prompts and skills contain factual conflicts, but changing them can alter product behavior. They require a deliberate policy-versus-behavior pass rather than edits made only to align documentation.

### Next highest-risk gap

Convert the completed root, operational, design-governance, and public-summary audits into claim-ledger rows and terminal manifest dispositions. Then reconcile the remaining runtime prompts without changing behavior merely to make their documentation true.

## 2026-07-11 12:01 EDT

### Files inspected

`scripts/docs-reconciliation-check.mjs`, the claim ledger, both reconciliation evidence baselines, all repository files targeted by a fragment-bearing ledger reference, every registered ruling and ticket source, and the reconciliation control README.

### Discovery

Repository references previously proved only that their path existed. Mixed-case heading fragments, shortened heading text, malformed or out-of-range line fragments, and a marker elsewhere in a registry source could survive structural validation. Terminal production and command claims could also cite any generic audit-evidence path, while any nonempty `truth_basis` detail satisfied the prefix check.

Concurrent documentation remediation renamed the founder registry and the mobile boundary section while this hardening pass was running. The ledger locators were repaired against the surviving exact headings. A new `conversation_episode_backfill` migration then raised the local migration count to 68 without a fresh remote query; CLM-0020 records 68 as a local-only recount and remains open.

### Changes made

The checker now resolves exact GitHub-style Markdown heading slugs, duplicate-heading suffixes, decoded case-sensitive HTML IDs and legacy anchor names, and positive in-range `L` line locators. Fenced Markdown, HTML comments, and script or style bodies cannot supply false HTML IDs. Every fragment-bearing authority, evidence, and terminal canonical reference uses this resolver.

Registered rulings and tickets now require a fragment, a resolvable target section, and their marker inside that section. The registry locators and every invalid ledger fragment were corrected without changing the underlying source claims.

Terminal production and command claims now use an explicit full-detail evidence registry. Production details map only to exact production-baseline sections; command details map only to exact repository-baseline command observations. Negative probes cover invalid general fragments, duplicate and HTML anchors, malformed and out-of-range lines, registry scope substitution, invalid terminal canonical references, swapped production and command baselines, and invented nonempty evidence details.

### Verification

`node --check scripts/docs-reconciliation-check.mjs` passed. The interim documentation check reached a structurally valid 147-row claim ledger with 115 intentionally open rows. Its remaining structural failures at this observation were concurrent drift outside this subtask: the newly created human-TODO archive had not yet been added to the manifest and immutable first-seen baseline, and the production baseline still recorded 67 local migrations after the 68th file appeared.

### Next highest-risk gap

Record the new archive in the manifest and immutable baseline, refresh the local-only production drift note to 68 without inferring remote state, then rerun open and strict documentation checks against the stable shared tree.

## 2026-07-11 12:41 EDT

### Files inspected

The root governance and package guidance remediated in the first pass, both public summaries, the founder decision registry, the current and archived founder queues, every affected manifest row, and all 147 existing ledger rows.

### Evidence observed

- Local migrations remain at 68. The remote comparison was not refreshed.
- The fresh public-summary editor gate confirmed that all prior must-fix findings are resolved and that `llms.txt` introduces no unique material claim.
- `pnpm check:docs -- --allow-open` passes with 377 candidates, 379 manifest rows, 363 open manifest rows, and 56 open claim rows.

### Changes made

- Fifty-nine formerly open claim rows now have terminal transitions with exact authority, evidence, remediation, and canonical locators.
- Founder rulings now use the section 5 registry as the canonical index while dated build-log and plan sources remain preserved.
- Public-summary ownership moved to the internal web README so public copy contains no maintenance meta-commentary.
- The human-operations archive now owns the relocated historical claim references; the live queue owns only current founder actions and re-verification gates.

### Unresolved conflicts

- Current production still serves older public-summary bytes, so removed worktree claims cannot yet be treated as removed from production.
- D10, DM7, direct printer integration, and private-by-default minors' media remain explicit founder decisions.
- The numbered planning corpus mixes historical proposals with current claims. The active audit has identified stale materials, channel, Blob, session, recall, and ticket-status statements that still need lifecycle treatment.

### Next highest-risk gap

Finish the numbered planning audit, classify each file as current contract, canonical ticket registry, or historical decision record, then annotate or consolidate it without overwriting concurrent product changes.

## 2026-07-11 12:44 EDT

### Files inspected

All 17 numbered benchmark research files, the benchmark README, the Homa-authored Marble usage note, the frozen upstream Marble documentation and licenses, the current map bank and bands, the taxonomy data manifest, assembly and mapping code, both taxonomy validators, the freshness script and runbook, and the reconciliation rows for this domain.

### Evidence observed

- `pnpm check:map` exited 0 with 16 subjects and 224 cited items at map bank version `2026.07.5`.
- `pnpm check:taxonomy` exited 0 with 1,590 topics, 3,221 edges, 102 assembled domains, 183 clusters, and 224 assigned bank items. Checksums, mappings, ids, references, and DAG checks passed.
- The upstream source count of 54 topic-bearing domains and Homa's 102 assembled domains describe different layers. Homa's registry contains 55 Marble-derived domain records, including one cluster-only record, plus 47 authored domains.
- The current local migration count remains 69. No fresh remote comparison was made.

### Changes made

- Every numbered benchmark file now carries a dated historical-research boundary. The original findings and source record remain intact.
- `docs/homa-benchmarks/README.md` is the canonical current lifecycle and use policy. It identifies the current bank, keeps porting manual, and states that an exit-zero freshness run may still require manual `BLOCK` review.
- `docs/homa-benchmarks/marble/README-HOMA.md` now separates upstream and assembled counts, explains the mutating refresh workflow, scopes frozen upstream relative links, and replaces a present legal conclusion with the preserved founder decision plus a current-review gate.
- Twenty benchmark claims received terminal ledger entries. The 17 research records are historical-annotated; the two current guides are retained with corrected claims.
- A concurrent untracked Binder prototype appeared after the original inventory. It was added immediately to the first-seen control and manifest as an open planning artifact without editing the prototype.

### Verification

`pnpm check:docs -- --allow-open` passes with 378 candidates, 380 manifest rows, 329 open manifest rows, and 53 open claim rows.

### Next highest-risk gap

Integrate the journey, design, and marketing domain audits, then reconcile the remaining planning prototypes and specialist instructions. Production parity and authenticated behavior claims remain open and must not be inferred from repository checks.

## 2026-07-11 13:05 EDT

### Files inspected

The complete journey library from `00-pm-kickoff.md` through
`11-naming-domain-memo.md`, its raw tester memo, the founder decision registry,
the reconciled PRD, the backlog, the current route tree, the event registry, and
the implementation sources cited by journey claims.

### Evidence observed

- The current public acquisition aliases redirect to `/onboarding`, not to a
  standalone conference or waitlist page.
- The typed analytics registry contains 65 schemas; the historical journey
  proposal contains a different 89-event model.
- Current taxonomy, trajectory, audio, and report behavior is narrower than
  several dated journey proposals.
- D5 and D6 are policy decisions, while MJ-13 remains the corresponding
  implementation gap.

### Changes made

- Journey files 00 through 08 and 11 now carry dated historical boundaries.
- Journey 09 preserves historical discovery planning while keeping only the
  phone-only M0-07 field-kit section current and upcoming.
- Journey 10 now identifies section 5 as the current founder-policy index and
  preserves all other sections as the dated capstone record.
- The raw tester memo remains verbatim evidence while nonportable source paths
  and stale implementation locators were removed or corrected.
- Thirteen terminal ledger rows now own the journey library's dispositions.

### Unresolved conflicts

- The casing registry conflicts with the current wordmark glyph and with the
  narrower wordmark-only instruction supplied for this audit.
- The transcript-retention ruling and the cited journey question still describe
  different audio contexts.

### Next highest-risk gap

Reconcile marketing operations and dated content without treating provider
access, staged files, or repository presence as publication evidence.

## 2026-07-11 13:08 EDT

### Files inspected

All 68 marketing documentation candidates: governance, workflow, four routines,
four synthetic reader personas, eight scorer fixtures, house style, campaigns,
two draft bundles, creator research, raw research, 29 signals, and the swipe
file. The dated marketing contract, scorer executions, local scheduler state,
provider authentication boundaries, and public blog probes were also inspected.

### Evidence observed

- Postiz is not authenticated.
- Higgsfield account access is available, but no current generation or delivery
  was verified. Account identifiers and exact balances were deliberately omitted
  from the evidence record.
- No Homa marketing scheduler is installed. The old example depended on an
  absent `cursor-agent` executable.
- The public blog index and RSS route respond, the RSS feed is empty, and the
  staged homeschool-hours article URL returns 404.
- The passing scorer fixture exits 0. The failing fixture exits 1 with seven
  expected findings.
- Local migrations remain at 70. The remote history was not re-queried.

### Changes made

- Current workflow statuses now use dated `local-only`, `staged-only`,
  `blocked-on-human`, and `disabled` meanings.
- Routine guidance now stops incomplete runs without WIP commits and marks
  scheduled execution as uninstalled and unapproved.
- Every dated signal is archived pending fresh source, truth, consent, and
  channel review.
- Campaigns, both content bundles, creator research, raw research, and swipe
  material now carry historical or draft boundaries and no publication
  authorization.
- The dated DM1 through DM7 planning contract remains current; operational
  status is canonical in the marketing workflow and DM7 remains open.
- Seventeen marketing ledger rows are terminal. CLM-0224 keeps the casing
  authority conflict open instead of choosing a policy.

### Verification

`pnpm check:docs -- --allow-open` passes with 378 candidates, 380 manifest rows,
238 open manifest rows, 224 ledger rows, and 54 open claims.

### Next highest-risk gap

Classify the design-system corpus into canonical current sources, M1-17
prototype inputs, and historical explorations. Remove current-product readings
from prototypes before reconciling agent skills that consume design and copy
rules.

## 2026-07-12 Task 9 documentation intake

- The agent-led live Progress plan, design specification, and implementation
  note were added to the first-seen baseline and manifest as unresolved
  pre-existing untracked documentation.
- Their rows distinguish local repository and disposable-Postgres evidence
  from unapplied migration and unverified production state.
- The local migration recount advanced from 70 to 71 for
  `agent_led_live_progress`. The remote migration history was not queried.
- `pnpm check:docs -- --allow-open` now reports valid Task 9 coverage and valid
  migration drift evidence. It still fails on unrelated concurrent drift:
  14 candidates remain absent from the baseline and manifest, and pre-existing
  absent Higgsfield rows still need terminal lifecycle dispositions.
