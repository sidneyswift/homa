# 48-hour review: delivery reliability (2026-07-18)

Session scope: review every customer interaction and every production
update from 2026-07-16 through 2026-07-18, find the improvements nobody
has addressed, ticket them, and ship the ones that are live production
failures (founder ruling `prod-bugs-fixed-not-stored`, 2026-07-14).

## Evidence reviewed

Customer interactions (48h window):

- Homa daily digest 2026-07-16 11:00 UTC: 3 delivery problems. Failed
  SMS sends for The Limberger family, The Riley family, and The Noser
  family, all with the same error: "SMS over the carrier size limit
  (11 segments, max 10)". 20 new signups, 17 of them still named
  "My family".
- Homa daily digest 2026-07-17 11:00 UTC: 2 delivery problems. One more
  failed SMS send with the same carrier-size error, plus "Task run
  failed: morning brief (run never completed (reaped after 2 hours))".
  4 new signups, 3 of them still named "My family".
- Handwrytten order confirmations show the Limberger family is a real
  trial family that received a founder thank-you card the same day
  their SMS silently failed.
- No inbound parent support email in the window.

Production updates (48h window, origin/main): PR #6/#7 (Eve stream
timeout fix + CI guard), PR #8 (landing hero), PR #9 (chat next-step
suggestions), PR #14/#15/#18/#19 (morning research brief v2, sandbox
gated), inspo flywheel, packet lab, hero doodle fix, expired-web-token
degrade (44904db), PR #20 (morning offer funnel). CI on main is green
as of the PR #20 merge; the mid-day failures on 2026-07-17 were fixed
by later commits the same day.

## What is NOT addressed by those updates

1. The SMS transport refuses any text over 10 segments and nothing
   adapts the message: the family simply gets no text (email fallback
   fires only when the family has an email on file). Four refusals hit
   three named real families inside 48 hours. The v2 brief formatter
   validates segment count at composition time, but v2 is gated to
   sandbox families, so production families keep hitting the refusal.
2. A hung task run is only detected by the 2-hour reaper, and the
   schedule was already advanced to tomorrow when the session started,
   so the family's brief for that day is simply lost. The outbox index
   was explicitly designed to allow a same-day retry (failed runs fall
   out of the index, see 20260711030000_homa_tasks_framework.sql), but
   no code path ever performs that retry.
3. Most new signups stall before the family-name step, and the digest
   prints them as an undifferentiated "My family, My family, ..." list,
   hiding the one number that matters (how many stalled).

## Tickets

| ID | Priority | Status | Summary |
|---|---|---|---|
| DR-1 | P0 | IN PROGRESS this session | Oversized SMS: transliterate to GSM-7, then split into up to 3 carrier-legal messages, instead of refusing delivery. Refusal remains only for pathological payloads (over 30 segments after adaptation). |
| DR-2 | P1 | IN PROGRESS this session | Reaped morning-brief runs with zero accepted delivery get exactly one same-morning retry, still gated by the delivery window and the outbox. |
| DR-3 | P2 | IN PROGRESS this session | Digest signups line separates named signups from signups that stalled before naming their family. |
| DR-4 | P2 | OPEN | Activation follow-up for stalled signups (the 17-of-20 problem). Needs a founder call on outreach channel, timing, and consent before any send. Not a code defect; not shipped this session. |
| DR-5 | P3 | OPEN | Extend the DR-2 retry to journal_prompt and custom kinds once morning-brief retries have a week of clean digest evidence. |

## DR-1 design

- `lib/sms-segments.ts` gains `gsm7Transliterate` (smart punctuation to
  GSM equivalents, accents decomposed, emoji dropped), `splitForSms`
  (greedy word-boundary split into parts that each fit the 10-segment
  cap), and `planSmsParts` (fit as-is, else transliterate, else split
  into at most 3 parts, else refuse).
- `submitHomaSms` sends the planned parts sequentially. All parts
  submitted reports `submitted` with the first provider message id; a
  failure on the first part reports that failure; a failure after the
  first part reports `unknown` (partial delivery is genuinely
  uncertain). The MMS path is unchanged (media sizes by media).
- Adaptation applies only to messages that would otherwise be refused,
  so no currently-delivering message changes shape.

## DR-2 design

- `reapStaleTaskRuns` returns what it reaped (run, schedule, kind,
  whether any delivery was accepted or uncertain).
- The hourly dispatcher retries a reaped `morning_brief` run when the
  run reached nobody, the schedule and local day are known, and this is
  the first failed run for that schedule and day (so a hung retry can
  never loop). The retry reuses `loadFamilyTaskForRun` plus the normal
  `dispatchScheduledTask` path, so the delivery window, preflight, and
  outbox all apply unchanged.

## DR-3 design

- Extract a pure `formatSignupsLine` from the digest, count families
  still carrying the DB default name, and print them as one stalled
  count after the named signups.
