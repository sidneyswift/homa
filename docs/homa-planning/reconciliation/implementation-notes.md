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
