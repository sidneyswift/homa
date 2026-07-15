# SMS check-in answer binding

**Status:** Approved in chat on 2026-07-15

## Goal

Let Eve judge what a parent's natural-language assessment answer means while
deterministic code continues to own identity, tenancy, and the exact check-in
that may change.

The parent may answer naturally, ask for clarification, change topics, or
return after a clarification. Homa must never require a growing phrase list to
recognize valid answers, and must never let the model choose a family,
recipient, workflow, revision, or delivery identity.

## Root cause

The production incident did not come from answer classification. Eve
consistently translated the parent's bounded capability answer to
`getting_there`.

The failure happened earlier in conversation continuity:

1. The first natural answer did not match the deterministic phrase patterns.
2. Recovery reissued the same question at newer revisions.
3. Older reply loops remained eligible, making later texts ambiguous.
4. `manage_child_progress` received no trusted current delivery and correctly
   refused every write.

Adding another answer phrase fixes one example but preserves the wrong
responsibility split.

## Responsibility split

### Eve owns meaning

Eve decides whether the current parent message is:

- an assessment answer that maps to `easily`, `getting_there`, `not_yet`,
  `not_sure`, or `skip`;
- a request for clarification;
- a topic change that pauses the check-in; or
- unrelated text that should not change progress.

A separate classifier call is not added. The existing Eve turn already makes
this judgment with the full family and conversation context.

### Deterministic code owns authority

Server code derives a trusted active-progress context from authenticated
transport state. The model never supplies this context.

The lookup returns a workflow only when exactly one current check-in delivery:

- belongs to the authenticated family;
- belongs to the authenticated adult or exact authenticated destination;
- is active;
- is still the check-in's current delivery; and
- was delivered through the current channel.

Zero or multiple matches return no trusted progress context.

## Data flow

1. The SMS adapter authenticates the sender through `family_phones` and
   persists the canonical inbound message as it does today.
2. A child-progress module resolves the current workflow from the authenticated
   family, adult, channel, and destination. It returns the check-in ID and
   current delivery ID only for one exact match.
3. The adapter adds those values to trusted session attributes separately from
   general conversation reply resolution.
4. `createProgressToolContext` reads the trusted values. The public
   `manage_child_progress` command schema remains unchanged.
5. For `respond_check_in`, the tool adapter requires the model's `checkInId` to
   match the trusted active check-in before calling the progress service.
6. The progress service retains its existing family, recipient, state,
   revision, and current-delivery validation before any write.

Conversation continuity may still resolve ordinary offers, journal prompts,
and explicit provider replies. Phrase matching in that module is no longer a
security or correctness prerequisite for progress answers.

## Clarifications and topic changes

A clarification does not replace the active workflow identity. The original
check-in remains current, so the parent's next answer can be judged by Eve and
submitted against the same trusted delivery.

If the parent changes topics, Eve answers the new request and calls
`pause_check_in` with `topic_change`. If Eve does not call a progress action,
no progress row changes.

When a paused workflow resumes, the service clears the old delivery and issues
a fresh prompt through the existing delivery-binding path.

## Failure handling

- Unknown family or destination: no progress context and no write.
- Multiple current workflows for one recipient: no progress context, Homa asks
  which check-in the parent means.
- Model supplies another check-in ID: deterministic refusal.
- Stale or replaced delivery: deterministic refusal.
- Off-topic text: no write unless Eve incorrectly submits an answer, with
  behavioral evaluations guarding that judgment.
- Provider-native reply metadata remains useful for conversation continuity,
  but cannot bypass child-progress validation.

## Testing

Implementation follows red, green, refactor:

1. Add resolver tests for one exact workflow, wrong phone, wrong adult, wrong
   channel, stale delivery, and multiple active workflows.
2. Add a clarification regression proving that a resolved generic reply loop
   does not erase the original active progress context.
3. Add tool-adapter tests proving a matching trusted check-in can respond and a
   model-supplied mismatch cannot reach the service.
4. Remove the incident-specific answer-phrase regression. Existing continuity
   heuristics may help conversational context, but they are not authoritative
   for progress writes. Retain structural revision and ambiguity tests.
5. Add behavioral cases for bounded numeric answers, generic yes requiring
   clarification, and an off-topic message pausing without changing progress.
6. Run continuity, ChildProgress, tenant-isolation, typecheck, lint, Next
   build, Eve build, and the disposable PostgreSQL ChildProgress harness.

## Rollout

This is a code-only change. It adds no schema and mutates no existing family
data. Deploy the tested code, wait for Vercel `READY`, and verify the live
deployment. The affected paused workflow can resume normally and receive a
fresh delivered question.
