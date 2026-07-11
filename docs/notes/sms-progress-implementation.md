# SMS progress implementation notes

## 2026-07-11 17:02 EDT · Plan-confirmed

The focused test failed because `apps/web/lib/sms-progress.ts` did not exist,
then passed after the shared service was added. The service awaits Telnyx,
returns the acceptance result, and preserves the existing three-minute
per-instance dedupe behavior.

All three existing callers now use the shared service:
`send_heads_up`, `generate_image`, and `create_printable`. Material tools still
provide the automatic fallback when the agent omits its first progress call.

## 2026-07-11 17:02 EDT · Discovery

The existing progress dedupe uses `lib/map/ratelimit.ts`, which is deliberately
per serverless instance. This phase keeps that established behavior because the
approved scope excludes a schema change. A later durable delivery record would
need a separate design and migration.

## 2026-07-11 17:02 EDT · Deviation

1. **What the plan said:** Use the exact draft tool and instruction strings
   shown in the implementation plan.
2. **What the code revealed:** Homa's required reader and editor gates found
   inconsistent names for the completed reply, a nested action sentence, and
   one three-clause instruction in those drafts.
3. **Conservative choice:** Keep the approved behavior and apply the editor's
   clarity fixes at the SMS instruction and tool producer. Do not change the
   fallback timing promise because the approved design intentionally avoids an
   invented estimate.
4. **Revisit:** Review real-phone transcripts after rollout. If parents still
   need timing guidance, choose evidence-based ranges by work type instead of
   one universal estimate.

## 2026-07-11 17:05 EDT · Deviation

1. **What the plan said:** Preserve the inherited family-first progress
   dedupe key.
2. **What the code revealed:** Multi-parent families can have two adults text
   Homa independently. A family-wide key lets one parent's slow request
   suppress the other parent's progress message for three minutes.
3. **Conservative choice:** Scope the in-memory key to both authenticated
   family and phone. This keeps material fallbacks deduped for one parent
   without coupling two adults' turns.
4. **Revisit:** A durable progress ledger may replace the in-memory window
   later, but it must preserve this per-recipient boundary.

## 2026-07-11 17:21 EDT · Deviation

1. **What the plan said:** Await Telnyx so the tool reports acceptance
   honestly, and prohibit exact progress timing.
2. **What the code revealed:** The underlying Telnyx fetch had no application
   timeout, so a stalled progress request could delay the real work. Three
   material instruction layers still promised "a minute or two."
3. **Conservative choice:** Give only the progress request a five-second abort
   signal and pass it through the shared Telnyx helper. Keep every other SMS
   caller unchanged. Remove the duration promise from every material producer.
4. **Revisit:** Use live submission latency before changing the five-second
   boundary. Any future timing copy needs evidence by work type.

## 2026-07-11 17:21 EDT · Plan-confirmed

Final verification matched the revised plan: 10 focused SMS tests and all 65
continuity tests passed. Edited-file lint, IDE diagnostics, web typecheck, Next
production build, and Eve build also passed. The final review found no critical
or important issue. No live SMS was sent, and no deployment or RCS path was
claimed.

## What this changes about attempt #2

- Treat progress text as a shared SMS concern from the start, not a materials
  helper that later needs renaming.
- Bound any best-effort message sent before the real work; awaiting an
  unbounded provider request can recreate the silence the message should fix.
- Run the Homa reader and editor gates before freezing generated-copy examples
  into an implementation plan.
- Keep RCS transport work separate until a registered Telnyx beta agent makes
  live typing and fallback behavior testable.
