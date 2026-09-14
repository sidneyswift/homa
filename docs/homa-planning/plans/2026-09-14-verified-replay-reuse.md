# Reuse a freshly verified conversation replay once

Status: local checks pass; hosted verification pending. Owner: gh#1171,
draft PR #1191. Astra remains medium. The acceptance goal stays Send to first
useful visible answer within five seconds for 19/20 normal replies. This
restoration experiment is only one part of that goal, not a substitute for it.

## Finding Unknowns: the repeat is not all redundant

The previous printable trial's logs show the same old Workflow stream read on
mount and again on Send. Candidate mount performed binding read, old stream and
confirmation 29 to 27 seconds before Send. Its Send repeated those three
requests before new admission at +2.685 seconds. Control did the same, with
new admission at +2.774 seconds. These are observed request timings, not an
estimate that all 2.7 seconds can be removed.

Three landmines, one compatibility boundary:

- GH #602 and #702 protect cross-tab work and stale cursors. A cached transcript
  is not a current server binding. Keep a fresh authenticated, uncached binding
  read before every send and keep existing active-turn waiting rules.
- A new user turn, binding timestamp or session can invalidate an earlier replay.
  Compare runtime session ID, latest user sequence, binding timestamp and latest
  user-message timestamp. Any mismatch or failed check discards the witness.
- A pending approval or incomplete stream is not an idle conversation. Do not
  cache those outcomes. Keep replay confirmation and parked-input handling.
- Eve 0.19's legacy client cannot reconstruct a continuation token from replay.
  A cache hit still returns a display-only replay and follows existing fresh
  session rotation. Session-handle clients retain their current path.

## Implementation contract

Keep one in-memory, single-use replay cache per authenticated chat storage key.
Store only a successful replay after the existing server confirmation. Clone
its events before the display layer receives them. Expire after one minute,
reject clock rollback and retain at most 512 events; larger histories replay
normally. Do not persist the witness in local storage or send it as authority.
Only consult it after the normal decision says to resume an inactive binding.

Wire the same cache into mount restoration and send restoration. Clear it on
failed reads, changed bindings, active-work waiting, fresh/current decisions,
or unsupported results. Preserve authentication, server ownership, cross-tab
locks, saved messages, approvals and generation behavior. No schema, query,
model, dependency or fleet-skill change is needed.

Existing authorization covers this reversible improvement and protected hosted
experiments. No production promotion is included. Stop new Sends if recording,
activation or generation fails, retain the failure and investigate it.

## Local evidence

The full chat guard passed 352 assertions plus both real browser cases for
cross-tab cache/lock behavior and React streaming/recovery. Those browser cases
exercise existing shared infrastructure, not a mounted full Homa app. The final
focused restoration suite passes 37 assertions, including two added cases after
the full guard: a binding changes during replay, and a session-handle client
must ignore the legacy replay cache. Web typecheck and targeted lint pass.

New tests cover one fresh binding read with no repeated stream, single-use
consumption, event-copy isolation, changed sequence/session/timestamps, failed
binding lookup, expiration, clock rollback, another tab's active window,
uncacheable approvals/oversized history, and the unchanged default path when
no cache is supplied. The full hosted app must still establish actual use.
Private logs use /private/tmp/homa-replay-cache-*.log.

## Hosted screen

Compare newly source-built protected previews of this change and 107a3857,
keeping the existing immediate turn, deferred tools/indexing and timing flags.
Keep warmup, racing, priority and skill-linked tools off. Each reserved synthetic
account retains its actual history. Freeze question order before signing in;
record the mount-to-Send interval so an expired cache is not misclassified.

Use one first-Send definition and one counting-game request per arm. Keep all
four Sends, including startup. Verify mount reads and confirms the old stream;
a cache hit must still show one binding read after Send, but no repeated old
stream and no replay-confirmation request. Compare preparation separately from
model/tool time, manually judge useful prefixes and verify saved messages.
Four Sends do not establish a p95 or equal-quality result. Sequential model
calls remain a separate, larger bottleneck for activity requests.
