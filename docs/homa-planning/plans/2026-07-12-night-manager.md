# The night manager · analyst inside, builder outside

> Status: PLAN (2026-07-12 evening, chat-derived founder rulings). The
> options lab that produced these decisions is
> plans/2026-07-12-night-manager-directions.html (ten options, ladder,
> evidence). Build both sessions dark tonight; nothing flips on before
> the July 13 conference day is over (D-nm-7). Build-log entry and
> founder-ruling index update land with the session 1 commit.

## What this is

One system that manages the project while the founder sleeps. Every
night it reads customer usage and chats, identifies bugs, friction,
feature demand, and spend anomalies, then turns the clear ones into
small pull requests and the rest into tickets and a morning report.

It is two halves on purpose. The analyst runs inside the product
deployment, where the data and credentials already live. The builder
runs in the dev toolchain, where the repo and CI already live. The
product agent's posture (bash off, deny-all egress) does not change.

## Founder direction, distilled (2026-07-12 evening)

1. An agent should manage this project in the cloud: read customer
   usage and chats every night, proactively identify and fix bugs,
   improvements, and features.
2. Keep it contained in the monorepo as much as possible.
3. AI timeline: build now, do not pad estimates across weeks.
4. Full chat access. "We're a startup, we can worry about laws once we
   find pmf." The admin should be able to read all chat clients.
5. The agent (Cursor session) is authorized to flip Vercel env vars.

## Founder decisions (D-nm-1 .. D-nm-7)

- **D-nm-1 · architecture: two-stage.** The analyst is a nightly eve
  schedule inside apps/web (the fleet-research.ts pattern). The builder
  is a nightly GitHub Actions job running the Cursor CLI headless.
  Chats and usage never require new product credentials; code changes
  never happen inside the product runtime.
- **D-nm-2 · chat access: full and raw.** The analyst reads raw
  conversation_messages across every channel, and the founder console
  gets a chat reader (/admin/chats) over the same table. Redaction
  machinery is deferred post-PMF by explicit ruling. One flippable
  hygiene default survives because it costs nothing: the builder keeps
  family names, phone numbers, and emails out of GitHub PR and issue
  text (GitHub history is permanent and third-party; early-family trust
  is a business asset). Overriding that is one line in the skill.
- **D-nm-3 · builder runner: GitHub Actions + Cursor CLI first.** Most
  monorepo-contained: trigger, brain, and guardrails are repo files.
  The recorded upgrade path is apps/manager, an eve app whose schedule
  spawns a 24-hour Vercel Sandbox (single-vendor Vercel); revisit after
  the pipeline has earned trust, or if Actions chafes.
- **D-nm-4 · autonomy: staged.** Nights 1 to 3 run observation mode
  (issues + backlog PRs only). Then fix PRs unlock. The founder merges
  everything. Auto-merge for trivial green fixes is a later ruling,
  only behind machine-enforced deploy-law gates (lab card 10).
- **D-nm-5 · findings surfaces: all three.** Morning email (existing
  digest rail), /admin/nights (history), and a backlog PR when the
  night produced ticket-worthy findings.
- **D-nm-6 · budget: about $5/night across both halves.** Kill switches:
  NIGHT_REPORT_ENABLED env for the analyst, disabling the workflow for
  the builder. Analyst model spend lands in model_usage automatically
  (the record-usage hook rides every channel).
- **D-nm-7 · conference sequencing.** Code ships dark tonight (additive
  only). Envs flip after the conference day. Deploy laws apply as
  written: watch READY, probe live.

## Architecture · existing rail → new piece

| Existing rail (proven) | New piece |
|---|---|
| `agent/schedules/fleet-research.ts` nightly cron + env flag + run rows | `agent/schedules/night-report.ts` |
| `dispatch.ts` pattern: handler builds context, model composes | `lib/admin/night-context.ts` (deterministic adminDb reads; the model never gets a DB tool, so tenant-isolation law holds) |
| `agent/channels/research.ts` + instruction mode | `agent/channels/founder-report.ts` + `agent/instructions/founder-report-mode.ts` |
| `homa_task_runs` outbox + reaper + founder console alerts | same table, new kind `night_report` |
| `lib/map/email.ts` admin email rail (digest) | night report email each morning |
| `/admin` console, `requireFounder()`, `adminDb()` laws | `/admin/nights` and `/admin/chats` pages |
| `.github/workflows/ci.yml` + repo secrets | `.github/workflows/night-manager.yml` |
| `.agents/skills/` convention | `.agents/skills/night-manager/SKILL.md` |
| CI guards + Bugbot subagents | required reviewers on every night PR; Vercel Agent toggles are a founder dashboard action |

## Session 1 · the analyst (inside apps/web)

Build order, all dark behind `NIGHT_REPORT_ENABLED`:

1. **Migration** `supabase/migrations/<ts>_night_reports.sql`: additive
   table `night_reports` (id, report_date unique, body_md, findings
   jsonb, tokens int, created_at). Admin-only surface, no client reads.
   Run `pnpm check:isolation` before the schema change (house rule).
   Additive migrations may lead the deploy.
2. **Context builder** `apps/web/lib/admin/night-context.ts`: sequential
   adminDb reads per the db.ts laws (max 1 connection, never
   Promise.all, ::text casts): last-24h usage and spend by family and
   channel, task-run and delivery trouble, email trouble, signups and
   funnel movement, quiet families, and raw chat transcripts from
   conversation_messages grouped by family with channel tags (D-nm-2),
   capped per family so context stays sane; beyond the cap, count and
   sample.
3. **Instruction mode** `agent/instructions/founder-report-mode.ts`:
   what to hunt (bugs users hit, friction phrases, repeated asks, spend
   anomalies, families going quiet), the output contract (findings as
   typed JSON + a plain morning email body), and the D-nm-2 hygiene
   line for anything marked ticket-bound.
4. **Channel** `agent/channels/founder-report.ts`: research.ts-shaped;
   on message.completed it writes the night_reports row, finishes the
   run row, and sends the email through the digest rail to
   HOMA_ADMIN_DIGEST_EMAIL.
5. **Schedule** `agent/schedules/night-report.ts`: cron `45 7 * * *`
   (07:45 UTC, after fleet research at 06:47, about 3:45am ET), env
   gate, run row, receive into the channel.
6. **Builder feed** `app/api/admin/night-report/route.ts`: GET, bearer
   `NIGHT_REPORT_TOKEN`, returns the latest (or ?date=) report JSON.
7. **Console pages** `app/admin/nights/page.tsx` (report list + detail,
   existing admin ui components) and `app/admin/chats/page.tsx` (the
   founder chat reader: family picker, cross-channel thread from
   conversation_messages, requireFounder + adminDb, sequential).

Checks before push: `pnpm check:isolation`, typecheck, lint,
`pnpm --filter web exec eve build` (agent/ changed), `pnpm build`.
eve dev never fires cron, so the manual dispatch route is the test
path, then one supervised manual fire in prod after envs flip.

## Session 2 · the builder (repo files only)

1. **Skill** `.agents/skills/night-manager/SKILL.md`: fetch the report
   from the endpoint; triage into {fix now, ticket, watch}; observation
   mode switch; PR rules (small diffs, one concern per PR, no schema
   changes unless expand-contract is written into the PR body, never
   touch homa-macmini/ homa-research/ homa-template/, no eve version
   bumps, AGENTS.md is law); backlog PRs follow 03-backlog.md
   conventions; identifier hygiene default (D-nm-2); turn and budget
   caps.
2. **Workflow** `.github/workflows/night-manager.yml`: cron `0 9 * * *`
   (9:00 UTC, about 5am ET, after the analyst), checkout, install
   Cursor CLI, curl the report with NIGHT_REPORT_TOKEN, `agent -p`
   pointed at the skill, deterministic git/gh steps for branches, PRs,
   and issues. Secrets: `CURSOR_API_KEY`, `NIGHT_REPORT_TOKEN`.
3. **Reviewers**: CI already gates every PR; Bugbot review on night PRs;
   Vercel Agent code review + investigations are founder dashboard
   toggles (only step in this plan the agent cannot do).

## Rollout and ops

| Step | Owner | When |
|---|---|---|
| Build sessions 1 + 2, all dark | agent | tonight |
| Push, watch Vercel READY, probe /admin | agent | tonight |
| Apply additive migration | agent | after READY |
| Set HOMA_ADMIN_DIGEST_EMAIL (needs the address) | agent via Vercel CLI, founder supplies address | after conference |
| Generate + set NIGHT_REPORT_TOKEN (Vercel env + gh secret) | agent | after conference |
| Set CURSOR_API_KEY gh secret (needs the key) | agent via gh, founder supplies key | after conference |
| Flip NIGHT_REPORT_ENABLED=true | agent via Vercel CLI | after conference |
| Toggle Vercel Agent + Bugbot in dashboards | founder | any time |
| Manual first fire, read the report together | both | first evening after flip |
| Nights 1 to 3 observation mode, then unlock fix PRs | founder call | that week |

Verified tonight: gh CLI is authenticated (repo + workflow scopes) and
the Vercel CLI is logged in, so secrets and env flips are agent-side.

## Risks and open items

- **03-backlog.md churn**: the backlog file edits often; on merge
  conflict the builder falls back to filing an issue, never force
  resolves.
- **Cursor CLI in Actions**: documented, but if limits bite, the same
  skill runs as a scheduled Cursor Automation with zero rewrite
  (recorded fallback), or later as apps/manager + Vercel Sandbox.
- **Chat volume**: per-family excerpt caps keep the analyst's context
  bounded as families grow; the cap is a constant in night-context.ts.
- **Two-place token**: NIGHT_REPORT_TOKEN lives in Vercel env and a
  GitHub secret; rotation is one CLI command each, noted in the skill.
- **Conference day**: nothing flips before it (D-nm-7).

## Doc-keeping

With the session 1 commit: append the D-nm rulings to
docs/homa-planning/build-log.md (including the chat-access ruling) and
register D-nm-2 in the journeys/10-reconciliation.md §5 later-ruling
register, since it supersedes the MJ-13-derived redaction default for
founder-facing surfaces.
