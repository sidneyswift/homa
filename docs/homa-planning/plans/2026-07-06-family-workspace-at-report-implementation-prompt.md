# Implementation prompt: family workspace provisions at first report

Date: 2026-07-06 (night). Founder ruling, same session as the D8 overturn:
"ok so we should probably fix that so once they generate a report they
create a family workspace." This re-decides lead-magnet decision D3 (was
"lead records now, account claim at invite"): the account already moved
into the flow (password as the last question, 2026-07-06; open signup,
2026-07-05), and now the workspace follows it. The invite-time bridge
(MJ-09) shrinks to a reconciliation path for legacy leads only.

Companion to `2026-07-06-llm-report-narrative-implementation-prompt.md` but
independently shippable, and smaller. Either can land first; they touch the
same score route, so coordinate the merge.

## Mission

The moment a lead's first report is generated, her already-real auth account
gains its real product workspace: a `families` row, her `family_members`
membership, and `children` rows mirrored from her lead kids. From that
moment the eve agent's every-turn family context can see her kids. No new
access is exposed anywhere (see Flagged, below); this is data plumbing.

## Read first

1. `AGENTS.md` (tenancy laws; familyId from auth context only)
2. `supabase/migrations/20260705153000_create_my_family_rpc.sql` and
   `20260706061222_family_memory.sql` (the CURRENT 3-arg
   `create_my_family(family_name, family_us_state, parent_name)`, security
   definer, one-family-per-user guard, authenticated-only)
3. `supabase/migrations/20260704033742_tenancy_v0.sql` (children INSERT
   policy: members add children)
4. `apps/web/app/home/actions.ts` (the existing RLS-respecting write
   patterns to copy: RPC for family, plain insert for children)
5. `apps/web/app/api/map/signup/route.ts` and `/api/map/state/route.ts`
   (how a lead becomes an auth user; the session cookie exists by score
   time for both password and Google paths)
6. `apps/web/app/api/map/score/route.ts` (the single choke point where
   every report is generated; the bridge hooks here)
7. `apps/web/lib/map/store.ts` (LeadRow.auth_user_id, lead_children shape,
   linkAuthUser's fold-together behavior)
8. `apps/web/lib/supabase/server.ts` and `apps/web/agent/channels/eve.ts` +
   `apps/web/agent/instructions/family-context.ts` (what the agent resolves
   from family_members, i.e. what this bridge lights up)

## Binding constraints

- NO service-role key. All product-table writes run as the signed-in user
  under RLS: `create_my_family` RPC for the family, plain `children`
  inserts under the members-add-children policy, exactly like
  `home/actions.ts` does. If this prompt seems to need a service role,
  the design is wrong; stop.
- `familyId` is never taken from the client. It comes from the RPC return
  or from the user's own `family_members` lookup.
- Lead tables stay deny-all and server-only; nothing in this change makes
  them readable to callers.
- `pnpm check:isolation` stays green; extend the checker if it does not
  already cover the new column.
- Imports at top, small modules, no em dashes in any copy or comment.

## Design

### 1. Migration

- `alter table public.lead_children add column child_id uuid references
  public.children(id) on delete set null;` (nullable; the link that makes
  mirroring idempotent and lets rescores push profile updates forward).
- No new RLS needed (lead tables already deny-all; children policies
  unchanged).

### 2. Bridge module: `apps/web/lib/map/bridge.ts`

`ensureFamilyWorkspace(leadId): Promise<{ familyId: string } | null>`

1. Resolve the auth user from the request's Supabase session
   (`createSupabaseServerClient()`). No session or no user: return null
   silently (legacy email-only leads keep the old invite-time path; emit
   `map.family_bridge_skipped` {reason: "no-auth-session"}).
2. Under the user's RLS client, look up `family_members` for an existing
   family. If none, call `create_my_family` with family_name default,
   us_state and parent_name from the lead row. Handle the RPC's "already
   belong to a family" race by re-reading membership.
3. Load the lead's children (server store, all of them, including
   pending-band kids: a kid too young to score is still a real kid the
   agent should know about). For each with `child_id` null: insert into
   `children` as the user (name, the REAL birth date from lead_children,
   profile `{ interests, focus: help_with ?? undefined }`), then stamp
   `lead_children.child_id` server-side. For each with `child_id` set:
   update the product child's profile from current lead interests and
   help_with (mirror forward, last-write-wins; the product profile has no
   other writer for these fields today).
   Note: `home/actions.ts` writes day-01 birth dates only because its form
   collects month+year; the column takes full dates, and lead birthdates
   are real days by founder ruling (2026-07-06). Mirror the real date.
4. Emit `map.family_bridged` {lead_id, family_id, children_created,
   children_updated} on success.

Idempotent by construction: membership lookup, child_id links, and the
RPC's own guard. Safe to call on every score.

### 3. Trigger

In `POST /api/map/score`, after `createReport` succeeds and before the
response: `await ensureFamilyWorkspace(lead.id)` in a try/catch that only
logs; a bridge failure must NEVER block or delay the report itself. (The
narrative prompt moves email into a background phase; this call is quick
row writes and stays in the foreground path. If the narrative build lands
first, hook after its `createReport` call the same way.)

Also call it from the rescore path implicitly (same route) so profile
updates flow after deep dives, and kids added later mirror on their first
report.

### 4. Stretch (build only if trivial after the above)

Seed one family memory per child with a whatsWorking note when present
(`lib/agent-memory` helpers, kind "what_works", the parent's own words).
If the memory helpers need auth context this path does not have, skip;
the narrative build already feeds these notes into the report facts.

## Flagged, deliberately NOT done here (founder decides separately)

- Nothing new links to `/chat` or `/home` from the report or emails. The
  report CTA band still says "You're on the invite list". Whether a
  report-holding family should be invited straight into chat is a product
  and positioning call (FAQ says invite-only); this build just makes the
  workspace real so that flipping that switch later is copy, not plumbing.
- No migration of lead answers, scores, or reports into product tables;
  lead tables remain the funnel's source of truth. MJ-09 reconciliation
  still owns the full merge story for legacy leads.

## Work order

1. Migration + `bridge.ts` + score-route hook + events.
2. Extend `scripts/isolation-check.mjs` coverage if the new column needs it.
3. Verify: `pnpm typecheck`, `pnpm build`, `pnpm check:map`,
   `pnpm check:isolation` all green.
4. Live e2e: fresh onboarding run (new email) through signup and report;
   then confirm in the same browser that `/home` shows the family and kids
   without any setup step, and `/chat`'s agent context block lists the
   kids with ages and interests (the family-context dynamic resolves).
   Rescore after a deep dive; confirm no duplicate children and profile
   updates applied. Add a sibling, score them, confirm they mirror into
   the SAME family.
   STOP: screenshots of /home and the chat context behavior to the
   founder, then clean up test rows by lead id AND family id (both
   worlds now), per the standing build-log lesson.

## Edge cases the e2e must cover

- Returning parent whose email already had an MVP-era account and family:
  bridge reuses the existing family, mirrors kids into it, creates nothing
  duplicate.
- Two kids, one pending-band: both mirror; pending-band kid has no report
  and that is fine.
- Lead folded by linkAuthUser mid-flow (second device): child_id links
  travel with the lead_children rows; no orphan children created.
- Bridge failure (e.g. RPC error): report still renders and emails
  normally; `map.family_bridge_skipped` or error log is the only trace,
  and the next score call retries it.
