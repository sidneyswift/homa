# BUILD.md · engineering entry point

Homa is in execution. This file contains the stable build contract for agents. It does not duplicate a volatile feature checklist or claim that repository code is deployed.

The fixed near-term deadline is July 13, 2026, when Alessa demonstrates Homa at a homeschool conference. The public site and onboarding entry points must remain usable on a phone. A route returning HTTP 200 does not prove that signup, storage, email, billing, voice, or agent behavior works end to end.

## Authority and evidence

Use two separate axes of truth:

1. Product policy: explicit founder rulings, then the PRD, then journey specifications, then judgment.
2. Observed behavior: current code, tests, configuration, and migrations establish repository behavior. Direct deployment, HTTP, database, and provider observations establish production behavior.

The canonical founder-ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5, including its later-ruling register. A later founder ruling can supersede the PRD only after it is entered there with its original dated source. Code does not silently overturn policy, and a plan does not prove implementation or deployment.

Current evidence lives in `docs/homa-planning/reconciliation/`:

- `documentation-manifest.tsv`: disposition of every documentation file.
- `claim-ledger.tsv`: material claims, authority, evidence, and resolution.
- `evidence/repository-baseline.md`: time-bounded repository observations.
- `evidence/production-baseline.md`: time-bounded deployment and production observations.

The latest recorded production baseline is a snapshot, not a standing guarantee. Refresh it whenever a completion claim depends on current production state.

## Read before changing product code

1. `AGENTS.md` for commands, boundaries, copy rules, and deployment discipline.
2. `docs/homa-planning/13-mr-prd.md` for the product contract and its reconciliation status.
3. `docs/homa-planning/journeys/10-reconciliation.md` §5 for founder rulings and later supersessions.
4. The named backlog ticket and its current implementation plan, if one exists.
5. The code, tests, configuration, and migrations that currently own the behavior.
6. `docs/homa-design/SKILL.md`, then `docs/homa-design/readme.md`, for UI or copy work.

Historical phase narratives and shipped-work notes live in `docs/homa-planning/build-log.md` and dated plans. They are evidence of what was decided or observed at that time, not a substitute for current repository or production verification.

## Repository shape

- `apps/web`: the one deployable Next.js application, including marketing, onboarding, authenticated product routes, and the eve agent.
- `apps/mobile`: an Expo client using the same Supabase and web-agent backend. It is not part of the root `pnpm dev` task.
- `packages/core`: shared events, map content and scoring, schemas, and other domain code.
- `packages/taxonomy`: the skill graph and its validation tooling.
- `packages/design`: an upcoming shared package under ticket M1-17. Web and mobile currently keep synchronized local copies.
- `supabase/migrations`: local migration history. Local file presence never proves remote application.
- `docs/homa-planning`: product contract, ticket backlog, dated plans, decisions, runbooks, and historical research.
- `docs/homa-design`: canonical design source.
- `docs/homa-benchmarks`: dated benchmark evidence and source material for the map bank.

The route and package-specific maps belong in `apps/web/README.md` and `apps/mobile/README.md`. Do not duplicate them here.

## Current implementation boundaries

- Web callers reach Supabase with their own JWT, so RLS is the browser-session tenancy wall.
- SMS, email, dispatch, and other server-originated channels derive a family from authenticated transport mappings, then call family-pinned server libraries. They do not accept a model-chosen family.
- Ticket M1-02 owns the remaining non-service-role plus transaction-local `SET LOCAL` hardening for server-originated database work.
- Generated artifacts are uploaded to durable storage before the turn ends. Sandbox and local files are scratch space only.
- `packages/design` does not yet supply runtime tokens or components. Ticket M1-17 owns that integration.
- State-requirement snapshots are reviewed legal-reference data. Product display does not re-verify statutes on every render.
- The public map uses national developmental and academic benchmarks. State-requirement data describes homeschool law, not state academic standards.

If a capability is absent from the current repository or lacks production evidence, describe it only with a registered upcoming ticket or remove the claim.

## Non-negotiable laws

1. Tenant identity comes from authenticated context or an authenticated transport mapping, never from model or client choice. Every model-supplied ID is re-scoped server-side. Run `pnpm check:isolation` before schema or query changes.
2. Durable product state belongs in Postgres and durable artifacts belong in Blob storage. Conversation history and sandbox files are not load-bearing state.
3. Features use the typed event registry. Billable capabilities also use the action-cost registry before they ship.
4. Product language never uses red or a "behind" label for a child's progress and never compares siblings. Honest downward trajectory segments are allowed when the surrounding treatment stays neutral and growth-oriented. The trajectory chart plots a measured below-age frontier as its real negative months (founder ruling 2026-07-13, `trajectory-real-negative-months`); copy surfaces keep growth framing and `monthsAhead` stays non-negative.
5. Child-photo personalization requires the D4 consent, retention, provider, and no-face-recognition floor. Private-by-default sharing for minors' media remains an unresolved founder decision and must not be invented.
6. Distress content follows the companion-not-therapist and distress-data-firewall rules. Sensitive health and diagnosis memory remains an MJ-13 implementation gap under founder ruling D6.
7. Homa copy uses sentence case, reassurance before information, offers rather than commands, and no em dash. HOMA appears in the wordmark and on UI surfaces; Homa appears in prose and conversation.
8. eve version changes require `node scripts/eve-upgrade-check.mjs` and the procedure in `docs/homa-planning/runbooks/eve-version-bump.md`. Agent-module changes also require `pnpm --filter web exec eve build`.
9. Production schema and production code ship together. Breaking migrations never lead the code that reads them. Use code-first deployment or expand-contract; additive migrations may lead.
10. Imports remain at the top of the file. Do not add inline imports.

## ChildProgress rollout order

ChildProgress uses an exact flag because its code must be safe before its
additive tables exist. Use this order:

1. Keep `HOMA_LIVE_PROGRESS_ENABLED` false.
2. Deploy the repository code, wait for Vercel READY, and probe legacy web
   onboarding, token reports, and unlinked SMS signup.
3. Apply the additive ChildProgress migration and its initial backfill.
4. Run `pnpm progress:reconcile -- --dry-run` with an explicit
   `HOMA_PROGRESS_DATABASE_URL`, review its PII-free counts, then run the same
   command without `--dry-run`.
5. Enable `HOMA_LIVE_PROGRESS_ENABLED`, wait for READY, then probe authenticated
   Progress, permanent token reports, web corrections, and linked-family SMS.

Rollback is flag-first. If a post-enable probe fails, set the flag false and
wait for READY. Do not drop the additive tables or install a reverse database
bridge. Legacy writers continue through `child_answers`; run the final
reconciliation again before a later re-enable. Before the flag is enabled, a
migration or reconciliation problem is handled by leaving the flag false.

## Verification before handoff

Run the commands listed in `AGENTS.md` that match the change. The full repository handoff gate is:

```sh
pnpm typecheck
pnpm lint
pnpm check:child-progress
pnpm check:progress-ui
pnpm child-progress:e2e
pnpm build
pnpm --filter web exec eve build
pnpm check:isolation
pnpm check:map
pnpm check:events
pnpm check:skills-targeting
pnpm check:taxonomy
pnpm check:continuity
```

During the documentation reconciliation, also run `pnpm check:docs`. The `--allow-open` form is an interim structural check only and is not a completion signal.

A green local build is not a green deployment. After a push that touches schema, agent modules, or the deployment pipeline, wait for the intended Vercel deployment to become READY, probe the affected live path, and record sanitized evidence before calling production work complete.

## When sources conflict

Do not invent policy. Record the exact claims, sources, evidence, and smallest missing decision in the reconciliation ledger. Ask the founder when the authority chain cannot resolve the conflict. Append the ruling to `docs/homa-planning/build-log.md`, then register it in `docs/homa-planning/journeys/10-reconciliation.md` §5 so the decision has one canonical index without erasing its dated source.

Never access `homa-macmini/`, `homa-research/`, or `homa-template/`.
