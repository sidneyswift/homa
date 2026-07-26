# Gateway plan: every door is an adapter, every loop wakes the agent

> Founder direction 2026-07-09 evening ("boil the ocean"): finish the
> gateway. Every conversational surface becomes an adapter on the ONE
> agent, and proactive loops wake the agent instead of sending templates.
> Companion ruling: docs/homa-planning/15-agentic-architecture.md (the
> doctrine); build-log entries carry the audit trail. Tickets check off
> as they land; each names its files.

The doctrine, one line: **every conversational surface is an adapter on
the one agent; a surface that cannot be yet (voice) must share the record
and the guarded writes until it can; loops that talk to families wake the
agent, and only receipts stay templates.**

> Continuity correction (2026-07-11, live morning-brief incident): adapters
> share the agent definition, not an Eve session. Channel-local continuation
> tokens cannot carry a dispatch turn into an SMS/email/web reply. The gateway
> now crosses one deeper seam first: `lib/conversation-continuity/` owns the
> canonical episode, adult identity, per-recipient delivery, reply edge, and
> unresolved open loop; Eve sessions are replaceable execution adapters.

## Where each surface stands

| Surface | Today | After this plan |
|---|---|---|
| Web chat | eve channel | unchanged |
| SMS | eve channel, pinned tools | unchanged |
| Email | outbound-only, replies to a human inbox | inbound adapter: a reply IS an agent turn |
| Voice | federated (Telnyx brain, shared record + guarded writes) | unchanged by design; documented exception |
| Journal prompt | template send from the map cron | dispatcher wakes the agent; the agent composes; the channel delivers |
| Funnel emails (reminder, band-ready, retest, report) | deterministic templates | unchanged by ruling: receipts and logistics, bound copy, pre-setup recipients |
| Transcript sync, narrative self-heal, purges | pipeline crons | unchanged by ruling: pipelines, not conversations |

## Tickets

### GW-1 · Doctrine into the ruling doc
- [x] Add the doctrine line + this plan's cross-reference to
  `docs/homa-planning/15-agentic-architecture.md`.

### GW-2 · Shared groundwork (migration #39)
- [x] `families.journal_opt_out_at timestamptz` (STOP for the email side;
  Telnyx owns SMS STOP at the platform level).
- [x] Widen `conversation_messages.channel` check to
  `('web','sms','email','dispatch')`.
- [x] `agent_schedules` table: `(id, family_id fk cascade, kind check
  ('journal_prompt'), next_run_at, lease_until, last_run_at, enabled,
  created_at, unique (family_id, kind))`. RLS on, zero policies
  (server-only, same posture as learning_reviews).
- [x] `resolveAgentAccess` accepts pinned channels `sms | email |
  dispatch`; conversation-log labels follow.

### GW-3 · Email inbound adapter (custom eve channel)
- [x] `agent/channels/email.ts` (`defineChannel`): POST inbound route,
  keyed by `RESEND_INBOUND_SECRET` (dark when unset, same posture as the
  SMS flag). Parses Resend inbound payloads tolerantly (text preferred,
  quoted-reply tail stripped), resolves the family by exact from-address
  match on `families.email`, and:
  - "stop"-shaped replies set `journal_opt_out_at` and confirm by email,
    never starting a turn;
  - unmatched senders are dropped with an event, never a turn;
  - matched replies `send()` into the agent with
    `{channel:'email', familyId}` stamped (pinned tools work), one
    durable session per family address per day.
- [x] Outbound delivery: the channel's `message.completed` handler
  (finishReason stop only) emails the agent's reply back through the
  shared shell, threaded under the original subject.
- [x] `agent/instructions/email-mode.ts`: short plain-text replies, no
  markdown, an evening "here's how today went" reply IS the journal.
- [x] Spoofing posture documented in-file: possession of the keyed URL is
  the wall (same as every webhook here); from-address matching alone
  never grants more than that family's own pinned scope, and every write
  still passes the shared guards.

### GW-4 · Dispatcher: crons that talk to families wake the agent
- [x] `apps/web/lib/schedule-store.ts`: atomic `claimDue` (lease via
  `update ... returning`), `complete` (advance to the next 8pm in the
  family's own time zone), `release` (retry next tick), plus idempotent
  hourly self-seeding: eligible families (children + tz + email, not
  opted out) gain their `journal_prompt` row automatically; ineligible
  rows disable themselves.
- [x] `agent/schedules/dispatch.ts` (`defineSchedule`, hourly): seeds,
  claims due rows, and for each wakes THE agent via `receive()` on the
  dispatch channel with the family principal; at-least-once with the
  local-date guard as the outbox key.
- [x] `agent/channels/dispatch.ts` (custom channel): owns proactive
  delivery. The agent's composed prompt goes out by SMS when a line is
  linked, else by email; `journal.prompt_sent` gains a `channel` prop.
- [x] The map cron's template journal pass retires;
  `JOURNAL_PROMPT_ENABLED` now gates seeding + dispatch. Template email
  copy survives as the delivery shell and the documented fallback.

### GW-5 · Events + guards
- [x] Registry: `email.message_received`, `email.opt_out`,
  `journal.prompt_sent` + channel prop; emitters wired; `check:events`
  green.
- [x] Isolation probes: `agent_schedules` unreadable/unwritable to anon.
- [x] Full suite green: typecheck, lint, build, check:map, check:events,
  check:skills-targeting, check:isolation; `eve info` zero diagnostics.

### GW-6 · E2E against the real dev agent
- [x] Email loop: synthetic family; fixture inbound POST → agent turn ran
  (session started, reply composed), conversation_messages carry channel
  'email', memory/hours written through pinned tools where the fixture
  message warrants, "stop" fixture sets the opt-out without a turn.
- [x] Dispatcher loop: dev dispatch route
  (`POST /eve/v1/dev/schedules/dispatch`) → schedule row claimed, agent
  composed a prompt, delivery attempted on the right channel, row
  advanced to the next local 8pm, second dispatch inside the same day is
  a no-op (idempotency).
- [x] Cleanup: synthetic rows cascade-deleted; zero residue verified.

### GW-7 · Rulings recorded (no code)
- [x] Voice stays federated until eve ships a voice channel (documented
  exception, unchanged compensations: shared context, guarded writes,
  transcript sync, post-call extraction).
- [x] Funnel emails and pipeline crons stay deterministic (receipts and
  plumbing, not conversations); logged here and in the build-log.

### GW-8 · Ops handoff (human steps; all completed, founder queue now lives in GitHub Issues)
- [x] Inbound mail at Resend: MX added via `vercel dns` (2026-07-09
  9:21pm), webhook configured by the founder (`email.received` only),
  `RESEND_INBOUND_SECRET` in Vercel prod + local, live route verified.
- [x] Journal reply-to flipped to `homa@mail.thankshoma.com` (deployed
  2026-07-09 late): every Homa email's replies now route to the agent.
- [x] PROD end-to-end proof (2026-07-10 8pm, "finish it"): a real
  inbound payload to the production webhook became a real agent turn
  on the deployed runtime: both conversation rows persisted
  (channel 'email'), 40 reading minutes logged with source='email', a
  memory saved, the reply email dispatched, and a follow-up "stop" set
  journal_opt_out_at without a turn. Synthetic family cascade-cleaned.
- [x] Dispatcher registered in production: `vercel crons ls` shows the
  eve schedule mounted hourly alongside /api/map/cron.
- [ ] `JOURNAL_PROMPT_ENABLED=true` when the founder read-aloud passes
  (unchanged gate; the ONLY remaining switch in this plan).

## Findings from the E2E (2026-07-09 late evening)

- Migration #40 (found live): eve's `message.received` and
  `message.completed` events carry INDEPENDENT sequence counters, so the
  old `(session_id, sequence)` idempotency key silently swallowed the
  assistant row on adapter channels. The identity key is now
  `(session_id, turn_id, role, sequence)`. Same migration widens
  `hours_log.source` for `email`/`dispatch`.
- Cross-channel `receive()` matches the target channel by reference,
  with a route-fingerprint fallback. Bundle boundaries break reference
  identity in dev, and a zero-route channel has no fingerprint, so the
  dispatch channel carries a health route on purpose.
- Local dev sandbox: microsandbox's first VM boot proved unusable on the
  dev machine (minutes of CPU, turn never progressed), so
  `agent/sandbox.ts` pins just-bash locally; deployed runtime still
  resolves Vercel Sandbox with deny-all egress.
- E2E transcript highlights: inbound email became a real agent turn
  (memory saved, 45 reading minutes logged with `source='email'`, both
  conversation rows persisted); the dispatcher seeded, claimed,
  composed a personalized prompt off the family's saved memory
  ("Maya sounding out three whole words on the couch today is such a
  real milestone in her letter sounds work. How did the rest of her day
  go?"), delivered through the approved email shell, advanced to the
  next local 8pm, and refused to double-fire the same day; "stop"
  opted out without a turn and the row disabled on the next tick.

## Status
GW-1 through GW-7 checked (E2E against homa-prod-backed dev,
2026-07-09) and GW-8's plumbing verified against PRODUCTION on
2026-07-10. Every conversational door is an adapter on the one agent
(web, SMS, email; voice federated by documented exception), and the
dispatcher is mounted as a live hourly cron. One switch remains, the
founder's by design: `JOURNAL_PROMPT_ENABLED=true` after the read-aloud.
