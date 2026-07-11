# SMS progress messages

**Status:** Approved in chat on 2026-07-11

## Goal

When an SMS request will require substantial reasoning, research, or several
tools, Homa sends one short progress message before beginning the slow work.
The parent then knows the turn is active instead of waiting on a silent phone.

This phase uses the existing Telnyx SMS channel. RCS typing indicators remain a
separate phase because Telnyx cannot validate them until Homa has a registered
test agent.

## Behavior

- `send_heads_up` becomes the first action for a genuinely slow SMS turn.
- Slow work includes substantial reasoning, research, several dependent tools,
  and generated materials.
- Fast answers, greetings, clarifying questions, signup steps, consent flows,
  and one-step account actions do not receive a progress message.
- The message is one short plain-text sentence that says what Homa is working
  on. It does not claim a precise completion time.
- One progress message may be sent during the existing dedupe window. Material
  tool fallbacks share the same lane, so they cannot stack another message.
- The completed answer remains the one normal reply to the inbound text.

## Architecture

The implementation generalizes the existing path rather than adding another
transport:

1. SMS instructions tell Eve when `send_heads_up` is appropriate.
2. `send_heads_up` reads the authenticated channel and phone attributes. It
   never accepts a destination from the model.
3. The shared SMS progress helper claims a family-and-phone dedupe window, so
   two parents in one family cannot suppress each other's progress messages.
4. The helper gives Telnyx five seconds to accept the progress message. It
   aborts that request on timeout and continues the agent turn.
5. `generate_image` and `create_printable` keep their automatic fallback on the
   same helper.

No delayed timer is added. A timer inside the Eve function would not be
crash-safe and could race a fast final reply. Homa also does not acknowledge
every inbound text because that would double message volume and make simple
conversations feel mechanical.

## Failure handling

- A progress-send rejection, exception, or five-second timeout never blocks the
  agent's actual work or final reply.
- The tool returns an honest failure note so Eve continues without claiming
  that the parent received a message.
- Existing Telnyx channel gates, webhook signature checks, inbound receipt
  claims, and final-reply delivery ledger behavior remain unchanged.
- The current coarse in-memory dedupe remains intentionally unchanged in this
  phase. Durable progress-message accounting would require a schema change and
  is not needed to solve the immediate silent-wait problem.

## Testing

Implementation follows red, green, refactor:

1. Add focused tests for first-send acceptance, duplicate suppression,
   per-parent isolation, request cancellation, Telnyx rejection, thrown
   transport errors, and custom versus fallback text.
2. Update the smallest production surface needed to make those tests pass.
3. Run the focused tests, conversation continuity checks, typecheck, lint for
   edited files, the Next build, and the Eve build.

## RCS follow-up

Add a founder action to register a branded Homa RCS agent with Telnyx and obtain
a beta test agent ID. After that external prerequisite exists, design and test a
separate RCS transport with `IS_TYPING`, capability checks, inbound webhook
verification, one final-reply transport per turn, and SMS fallback.
