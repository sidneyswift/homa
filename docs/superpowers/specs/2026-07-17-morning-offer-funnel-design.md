# Morning offer funnel design

Status: approved for implementation 2026-07-17.

## Goal

Give the founder one truthful, cohort-based view of whether morning brief
offers receive a linked reply, become an explicit yes or no decision, are
accepted, and lead to a completed deterministic effect.

## Product contract

One row in the cohort is one successfully sent morning brief delivery with an
open reply loop. The selected seven or twenty-eight day range is applied to
the delivery's `sent_at`. Every later stage is read from that same delivery,
even when the reply or fulfillment happened outside the selected send range.

The main chain is:

1. Delivered: a morning brief offer reached one recipient.
2. Linked reply: one inbound message causally resolved that offer's open loop.
3. Decision: the linked reply was classified as accepted or declined.
4. Accepted: the decision was affirmative.
5. Fulfilled: an accepted offer produced a successfully saved, reviewed
   material or a successfully created scheduled task.

The card also shows mutually exclusive side buckets:

- Waiting: the twenty-four hour reply window is still open.
- No linked reply: the reply window ended without a causal reply.
- Other reply: a linked reply answered or clarified without deciding yes or no.
- Unclassified: a resolved legacy row has no outcome label.
- Possible interest: same-episode activity within four hours that could not be
  causally linked. It never enters the funnel.

Rates always name their denominator. A rate with no denominator displays a
plain no-data state, never `0%`.

## Reply classification

Causality remains conservative and deterministic. Signed delivery identity and
provider reply metadata win. With no provider-native identity, a bounded
affirmative or negative may match only when exactly one eligible offer exists.
Multiple plausible offers remain ambiguous.

Classification uses one versioned pure module. It recognizes common,
high-precision parent wording while refusing questions, mixed polarity, and
long prose as a yes or no decision. Every newly resolved loop stores the
resolution method and classifier version. Existing causally resolved rows are
backfilled from their linked inbound message. Rows without a linked message
remain visibly unclassified.

## Fulfillment truth

Fulfillment is a deterministic effect, not an inference from chat prose or
episode timing. A server-only `conversation_offer_fulfillments` row reserves
the exact target id before:

- `create_printable` saves a material whose quality review passed, or
- `create_task` successfully creates the scheduled task.

The reservation re-scopes the source delivery and result identifier inside the
authenticated family, requires a resolved accepted morning brief loop, and is
idempotent per source delivery. The source delivery id comes from trusted
continuity attributes, never model input. The funnel counts the reservation
only after its exact material or task row exists.

When an accepted reminder needs a clarification turn, the exact delivery id
stays on the authenticated thread binding and is carried forward separately
from reply-claim state. A completed material or task stores that same delivery
id on its own durable row through a server-only completion write. Authenticated
clients cannot set material provenance directly. The binding clears after the
completion is reconciled.

## Founder interface

The overview replaces the three morning-offer tiles and the separate possible
interest tile with one full-width counts-only card. It shows the five-stage
chain, explicit no-data language, outcome side buckets, and the selected range.
No family names, message content, addresses, or child information appear.

The card excludes sandbox families. Operational delivery totals elsewhere on
the overview retain their existing fleet-wide semantics.

## Rollout

The migration is additive and must lead because the code reads the new
fulfillment table and writes the new loop audit columns. Apply the migration,
run the isolation guard, deploy code, wait for Vercel READY, then probe the
founder overview and one accepted sandbox offer through fulfillment.

Rollback returns to the previous code while leaving additive columns and rows
in place.

## Verification

- Pure reply-classifier and cohort-summary tests
- Continuity claim and event tests
- Fulfillment tenant-scope and idempotency tests
- Disposable PostgreSQL schema and journey tests
- Admin, continuity, research brief, event, isolation, typecheck, lint, Next,
  and Eve build gates
- Copy reader gate, copy editor gate, and rendered admin UX review
