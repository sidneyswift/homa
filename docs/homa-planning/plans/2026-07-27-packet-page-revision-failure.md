# Packet page revision failure: Carolyng, 2026-07-27

Status: FIXED and deployed (PR #239, merge bbed4a4b), backfill applied.
See "Correction" below: the first diagnosis named the amplifier, not the
trigger, and the parent recovered on her own before the fix shipped.

## Correction (written after the fix merged)

Two things in the original diagnosis below are wrong or incomplete, and
the record should say so plainly.

**She was not still blocked.** The original text was written while the
failure looked ongoing. In fact Carolyng recovered at 13:54 UTC, about
90 minutes before the fix deployed, in the SAME session that had been
failing (`wrun_01KYHJDNS822AT36ANSS2R76X1`, turns 15 to 17). All three
recovery builds still used the old path: 45KB of arguments, no
pageIndex. So the failure was transient, not a hard ceiling, and the
"try a new conversation" advice Homa gave was not what resolved it.

**The trigger was retrieval, not emission.** The re-emission cost is
real and measured, but it is the amplifier. What actually stopped turns
5 to 7 was that the model could not GET the packet to rebuild it:

| Turn | Time | Event |
|---|---|---|
| turn_4 | 13:03 | reviewer flags the draft, version suppressed |
| turn_5-7 | 13:13-13:16 | find_materials returns "Nothing saved matches", three fabricated failures |
| turn_14 | 13:39:32 | parent complains her packet is missing from the binder; `mark_material_final` runs |
| turn_15 | 13:40:24 | find_materials returns the html; `create_printable` works again |

140 of this family's 147 materials were `status = 'draft'`, and
`find_materials` defaults to finals. So the packet was invisible to the
search that needed it. Finalizing it is what restored the capability,
40 seconds later. The draft-stranding gap is a known open item and this
incident is evidence of how it actually bites.

pageIndex still helps this exact case, and more than the original
framing suggested: with it the model needs only the material ID for the
eleven unchanged pages and html for the one it rewrites, so the
retrieval it could not complete becomes much smaller. But pageIndex
alone would not have prevented this. The draft-stranding trigger needs
its own fix and has its own issue.

Everything below is the original diagnosis, unedited.

---

Source: co-founder screenshot of Homa telling Carolyng "there's a
technical issue on my end with creating printable materials in this
conversation." Traced against production Postgres (family
`304f0003-6c55-4c31-807a-941aff214283`, web session
`wrun_01KYHJDNS822AT36ANSS2R76X1`).

## What she was trying to do

Carolyng has been iterating on one 12-page packet for Amalia, "Amalia's
Big World of Living and Non-Living" (about 45KB of stored HTML), since
2026-07-25. Her edits are page-scoped and physical, the notes of someone
holding the printout: make the glue boxes on page 5 bigger, put real
pictures on the page 11 cut-out cards, make the page 4 coloring images
big enough for a three-year-old to color.

On 2026-07-27 she asked four times in fifteen minutes for the page 4
images to be bigger. She got three consecutive apologies claiming a
technical fault.

## What actually happened

Timeline for session `wrun_01KYHJDNS822AT36ANSS2R76X1`, all UTC.

| Turn | Time | Model calls | Tool calls | Outcome |
|---|---|---|---|---|
| turn_3 | 13:00:06 | 24,713 out | `create_printable` | Review PASSED, shown |
| turn_4 | 13:03:34 | 23,640 out | `create_printable` | Review **FAILED**, suppressed |
| turn_4 | 13:07:42 | **28,117 out** | **none** | Emission produced no tool call |
| turn_4 | 13:08:00 | 798 out | none | "I hit a technical snag" |
| turn_5 | 13:13:51 | 370 out | `find_materials` | "technical issue on my end" |
| turn_6 | 13:15:04 | 358 out | `load_skill` | "still hitting that same technical issue" |
| turn_7 | 13:15:30 | 2,468 out | `find_materials` x3 | "still unable to build or revise" |

Three findings settle it.

**1. The tool was never broken.** `create_printable` ran successfully in
this same session at 13:00:06, and the SMS session
`wrun_01KXCW04KN1SZHVBXGF5N7W13Y` built materials for the same family at
13:20:25 while the web session was still apologizing.

**2. The tool was never called in turns 5, 6, 7.**
`recordToolCallRequested` fires on eve's `actions.requested`, before
execution (`apps/web/agent/hooks/record-tool-calls.ts:30`). An absent row
means the model never emitted the call. There are no `failed` rows and no
`is_error` rows anywhere in the session.

**3. The one real failure was turn_4's retry.** At 13:07:42 the model
spent 28,117 output tokens over 3m50s and produced no tool call and no
message. That is the size of a full 12-page packet emission. The call did
not survive into a parseable tool call.

So: one genuine failure, then three fabrications.

## Root cause: edit cost scales with document size, not edit size

`create_printable` has three paths, and none of them can express "change
page 4, keep the other eleven."

- `html` is one page.
- `pageImageUrl` is one page.
- `pages[]` takes per-entry `html`, `pageImageUrl`, or `fromMaterialId`,
  and `fromMaterialId` contributes **all** of that material's pages
  (`create_printable.ts:424`, `for (const body of splitPageBodies(...))`;
  the schema's own describe says "a multi-page material contributes all
  its pages").

Referencing the packet by id therefore returns the old page 4, which is
the thing she wants changed. The only remaining option is to re-emit all
twelve pages of HTML as tool arguments. Measured cost per one-page edit:

- about 45KB of HTML in the arguments
- 24,000 to 38,000 output tokens
- 3 to 5.5 minutes of generation before the tool even starts

That is the whole bug. A parent asking for a smaller and smaller change
pays the same escalating price every time, and at twelve pages the
emission is fragile enough to fail outright.

Supporting evidence that this is a size problem, not a Carolyng problem:
across the fleet in the last 14 days, 112 of 121 materials are single
page and average 3KB. Every material of 7 pages or more belongs to this
one family. The SMS worksheets that kept succeeding during the outage
were 3 to 5KB single pages.

## Contributing failures

**Fabricated technical faults.** Turns 5, 6 and 7 assert a technical
issue that did not exist, three times, without one retry. This violates
the tool-honesty law. The real reason was available and actionable: the
quality reviewer had said "Page 4: the coloring illustration does not use
the full page width or remaining vertical space as requested." Carolyng
was never told that. She could have answered it.

**The reviewer judges 4 pages and suppresses 12.** `REVIEW_PAGE_CAP = 4`.
The reviewer saw pages 1 to 4 of 12 and its page 4 verdict suppressed the
whole document. The tool result says so plainly ("The reviewer only saw
pages 1 to 4 of 12; the rest are unreviewed") and suppresses anyway.

**A flagged draft is invisible.** "This version is NOT shown to her: a
flagged draft never renders as a card, on any channel." So a failed
review produces nothing the parent can see, react to, or accept. She
cannot say "that's fine, print it."

**Materials strand in draft.** 140 of this family's 147 materials are
`status = 'draft'`. Consistent with the known finalize gap.

**Session cost.** Context grew from 49k to 276k input tokens. The session
burned 6.7M input and 127k output tokens. `find_materials` returning full
44KB packet HTML into context is a large part of that.

## Ruled out

- **The onboarding generation gate.** `suppressInTurnGeneration` makes
  `create_printable` structurally absent, which would produce exactly
  this symptom, but Carolyng's family has `context->'onboarding'` null and
  `profile_completed_at` set, so the predicate is false. The tool also ran
  twice in the same session.
- **Compaction.** `agent.ts` compacts at 0.75 of the window; at 276k
  tokens against Sonnet 5's window it had not triggered.
- **A tool error, timeout, or deadline.** No failed or errored rows, and a
  concurrent SMS session succeeded.

## Separate latent bug found on the way

`completeOnboarding()` (`lib/onboarding/store.ts:152`) has **zero
callers**. `beginOnboarding` writes `state: "active"`, the record wins
over `profile_completed_at` (`state.ts:126`), and nothing ever writes
`state: "done"` outside the eval fixture. A family that enters the chat
flow can never leave it.

23 live families are latched `active`, 21 of them with completed
profiles, all stamped 2026-07-24. While `HOMA_CHAT_ONBOARDING` is off the
predicate short-circuits false and they are unaffected. The moment the
flag goes back on, all 23 permanently lose `create_printable` and
`generate_image` in web chat and permanently bypass the $19 wall.

This is not Carolyng's bug. It is armed, not firing. It needs its own
issue.

## Solutions, simplest to most complex

### 1. Stop fabricating faults (skill and instructions, no code)

Never claim a technical problem unless a tool returned an error. When the
quality check flags a version, say what it flagged. Carolyng should have
seen "the checker says page 4's image still isn't filling the space,
want me to try a taller layout or leave it?" instead of three apologies.

Cheapest change here, and the only one that addresses the thing she
actually experienced: being lied to.

### 2. Cap the silent retry loop (skill, no code)

After two failed review cycles on the same page, stop and ask her.
Retrying a 3-minute emission a third time is worse than a question.

### 3. Relay the reviewer's verdict deterministically (small code)

The tool already knows the review failed and why. On a second consecutive
failure in a `revisesId` chain, have the result note instruct Homa to
surface the verdict verbatim and ask how to proceed. Anti-loop enforced
by code rather than hoped for in prose.

### 4. Review only what changed (small code)

When `revisesId` is set and the request names pages, review those pages
instead of pages 1 to 4. Today the reviewer's window and the parent's
edit are unrelated, which is why a page 4 request got judged by a page 4
verdict only coincidentally.

### 5. Show flagged drafts, labeled (small code, needs a founder ruling)

Render the flagged version with the reviewer's objection attached, and
let her accept it. "Here's the attempt, the checker thinks page 4 still
has white space, want it anyway?" A dead end becomes a decision. This
reverses the current flagged-draft law, so it is a founder call.

### 6. Page-level reuse: `fromMaterialId` plus `pageIndex` (the real fix)

Let a page entry name one page of an existing material. A one-page edit
becomes eleven `{fromMaterialId, pageIndex}` entries plus one new
`{html}`. Emission drops from about 45KB to about 4KB, from 25-38k output
tokens to roughly 2k, from minutes to seconds.

Small because the pages are already addressable: stored HTML is
delimited, `splitPageBodies` exists, and line 424 already splits it. The
schema simply has no way to name an index.

Better ergonomics on the same idea: a `basePacketId` plus sparse
`pageOverrides`, so the common case reads `{basePacketId: X,
pageOverrides: [{index: 4, html: "..."}]}`.

**Recommended.** This is the change that would have made today work.

### 7. Trim what goes into context (small code, compounding)

`find_materials` returns full 44KB packet HTML. Default it off and return
it only when asked for a specific material. Directly reduces the 276k
context that made the session fragile and expensive.

### 8. Move packet builds to the agent-jobs runner (medium)

A 12-page rebuild is the long-running-task shape the agent-jobs primitive
already exists for and is live in prod. Async it behind a progress card
and the turn stops being the thing that can fail. Fixes latency and
fragility, does not fix the token cost.

### 9. Model a packet as ordered page materials (large)

Stop storing a packet as one 45KB blob. Make it an ordered collection of
one-page materials plus a compile step. Editing page 4 then edits one 4KB
material and recompiles. This makes per-page review, per-page reuse,
sibling reuse and the Binder all better, and it is the data model the
product's actual edit unit implies. Real migration, real risk.

### 10. Rejected: patch or diff based edits

Having the model emit a diff or a CSS instruction instead of HTML would
be cheapest of all and is the wrong shape for Homa. It asks the model to
make exact edits to text it cannot reliably see, which is the inverse of
models judge, code verifies. Page-level reuse gets the same saving with
the model still emitting whole content that code can verify.

## Recommendation

Ship 1 today: she is being told something untrue, repeatedly, right now,
and that is the part she can see. Then 6 as the actual fix, with 7
alongside it since it is nearly free. 3, 4 and 5 are worth doing and can
follow. 8 and 9 are real work that should be decided on their own merits,
not folded into this fix.
