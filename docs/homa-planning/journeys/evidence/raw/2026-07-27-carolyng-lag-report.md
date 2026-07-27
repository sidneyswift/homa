# Carolyng: "Homa is lagging and it doesnt show up in our chat"

Reported 2026-07-27 15:24 EDT (19:24Z) by WhatsApp:

> Homa is lagging i have asked her about things multiple times and it doesnt
> show up in our chat

Family `304f0003` (co-founder, Amalia / Alma / Ara). Evidence below is direct
read-only prod psql plus Vercel deploy history, gathered 2026-07-27 21:00Z.

## Headline

Her messages were never lost, and Homa's replies were never lost. Every one of
her 39 web messages in the last 72 hours has a matching assistant reply row.
What did not show up is **the material itself**. She asked for the same packet
edit five times and for a Spanish version three times, Homa said "It's ready"
and "Right there above" each time, and the card on her screen kept showing the
13:00Z version.

Two independent defects produce that, and they compound:

1. A stale `final` outranks every newer revision in the same chain, so the
   renderer keeps serving the old packet.
2. Nothing promotes a passing build to `final`, so all of today's work sat as
   `draft` and never reached her binder either.

Both are live in production right now. Neither is fixed by the session-fork fix
that shipped today.

## What the last 24 hours actually looked like

Her web transcript, 07-26 16:43Z to 07-27 18:45Z, 34 turns. The pattern is one
request repeated until she gave up on it:

| Time (Z) | She said | Homa replied |
|---|---|---|
| 12:56 | Can page 4 images be bigger to help fill up page? | ready, "noticeably bigger" |
| 13:00 | Make the images to color in on page 4 bigger | technical snag |
| 13:13 | Images on page 4 need to be bigger to color | still failing |
| 13:14 | Make the images 15% bigger on page 4 | still failing |
| 13:15 | Revise this page | still failing |
| 13:39 | I dont see my packet ... in my binder | "both were still sitting as drafts" |
| 13:40 | Make the images larger on page 4 | ready |
| 13:47 | Make the images on page 4 larger | ready, "passed the quality check" |
| 13:50 | Make yhe images on page 4 larger | ready, "bigger again now" |
| 16:12 | Where is the updated packet? | "Right there above ... showing now" |
| 16:13 | Pictures on page 4 can be bigger still | ready |
| 16:19 | Can you make this in spanish? | translated, 11 of 12 pages clean |
| 16:29 | Can you make a Spanish Latin American version | "It's ready now" |
| 16:30 | Homa can you make a spanish version? | "Here it is again above" |
| 17:07 | Spanish version ready yet? | "It's ready" |

Note the shape: "Where is it?", "Where is the updated packet?", "Spanish version
ready yet?", "I dont see my packet". Four separate times she tells us she cannot
see the artifact, and each time Homa answers as though it is on screen.

### Defect 1: a stale final masks every newer revision

`selectParentVisibleMaterialRevisions` (`apps/web/lib/materials/parent-visible.ts:55`)
picks one row per revision chain, and a `final` wins unconditionally:

```
const finals = chain.filter((candidate) => candidate.status === "final");
if (finals.length > 0) { selected.push(newest(finals)); continue; }
```

Her chain is rooted at `56b99d51`, created 13:00:27Z, status `final`. Every edit
after that was written as a `draft` revising it:

| Material | Created | Status | Revises |
|---|---|---|---|
| `56b99d51` | 13:00:27 | **final** | `a0c4bbca` |
| `d77a0780` | 13:43:36 | draft | `56b99d51` |
| `f71c7d97` | 13:50:32 | draft | `56b99d51` |
| `6e41c98e` | 13:53:55 | draft | `f71c7d97` |
| `d85453e5` | 16:14:45 | draft | `56b99d51` |

The chain contains a final, so the selector returns `56b99d51` and discards all
four. `archiveFromServerHistory` (`apps/web/lib/chat-history-model.ts:248`) runs
that selector across the family's whole material payload on every history load,
not per message, so this bites on every page load and every new session. The
live in-session render is per message and does show the new card, which is why
the card appears during the turn and then reverts the moment she reloads.

Fleet blast radius, 30 days: 5 masked drafts across 2 families, 4 of them hers
today. Narrow because few families iterate this hard.

### Defect 2: nothing promotes a passing build to final

`mark_material_final` is a separate tool the model has to remember to call.
Across her entire day it fired **once**, at 13:39:32Z, and only because she
complained that her binder was empty. Every build after that stayed `draft`:
13:43, 13:50, 13:53, 16:14, 16:27, 16:29. The binder is hard-pinned to
`status: "final"` (`apps/web/app/app/binder/page.tsx:46`), so none of today's
work is in her binder.

Fleet, last 7 days: 30 drafts across 10 families versus 7 finals across 2. The
finalize gap is fleet-wide even though the masking bug is not.

### Defect 3: the tool tells Homa the card is visible when it is not

`create_printable` returns one of two notes. On a passing build
(`apps/web/agent/tools/create_printable.ts:810`):

> The card with the preview and print button is already visible in chat.

It returned exactly that for the 13:50, 13:53, 16:14 and 16:29 builds, all four
of which the renderer suppressed or stranded. The tool decides visibility from
`reviewPassed`; the renderer decides from chain status. They disagree, and Homa
faithfully repeats what the tool told her. This is why she got "Right there
above" while looking at an unchanged packet, and it reads to her as Homa lying.

### "Lagging" is real, and separate

Her web turn latency over 30 hours, 34 turns: median 40s, mean 167s, max 780s.
Twelve turns took over two minutes. Split by kind, conversation-only turns run 4
to 40 seconds and every materials build runs 3.5 to 13 minutes.

A busy label with materials phase text does exist (`busyLabel`,
`apps/web/app/app/message-parts.tsx:1013`), so she is not staring at nothing.
But it only renders while the stream is alive, and a 13-minute build is long
enough that she sent a follow-up 4 to 38 seconds after a reply landed on eight
occasions, which is the behaviour of someone who does not believe anything is
happening.

### Session forking: real, and fixed 90 minutes after she complained

Ten distinct eve web sessions in 72 hours, with two clear forks:

- 02:02:11Z message into session `…BS1RQ1`, then 02:02:51Z, 40 seconds later,
  into `…TMJ8Q4`. Replies landed in both at 02:03:11 and 02:07:35.
- 03:29:54Z into `…DEMZ65`, no reply. 03:36:24Z she started `…FPMC8J`. The
  reply to her 03:29 message finally landed at 03:38:26Z, in the session she had
  already abandoned.

That second one is literally "I asked and it didn't show up." PR #227 fixes it,
and reached production at **20:53:37Z today**, about 90 minutes after her
message and after every turn above. Her whole day ran on the unfixed build. So
forking contributed, but fixing it does not address defects 1 to 3.

## The plan, ordered

Merged by likelihood and by cost, so the earliest steps are both the most
probable cause and the cheapest to land.

1. **Fix the stale-final masking.** Change the chain selector so recency wins
   unless the newer row failed review. Pure function, unit testable, no
   migration, no schema change. Needs one product ruling first: what should a
   parent see when the newest revision has not been finalized (see below).
   This is the fix for the words she actually used.
2. **Close the finalize gap, then backfill.** Promotion on a passing build must
   be deterministic rather than a tool call the model may forget. Per AGENTS.md's
   own latent-vs-deterministic split, a durable write with one authorized
   outcome belongs in code. Then backfill her six stranded drafts so today's
   work appears in her binder.
3. **Make the tool's visibility claim true.** `create_printable` must derive
   "is this visible to her" from the same selector the renderer uses, so Homa
   can never be told a card is on screen when it is not. Tool-honesty law.
4. **Verify #227 is live and forking has stopped.** Cheap: re-run the session
   count for her family for messages after 20:53Z and confirm one session per
   continuous conversation.
5. **Instrument the materials build turn.** Find where 3.5 to 13 minutes goes
   before optimising anything. Latency is the "lagging" half of her report and
   is unaddressed by 1 to 3.
6. **Fix revision re-basing.** Her 13:43, 13:50 and 16:14 edits each revise
   `56b99d51` rather than the previous draft, so consecutive edits did not
   accumulate and each one restarted from the 13:00 version. This is why "make
   page 4 bigger" never seemed to stick even when it worked.
7. **Separate ask, own investigation.** At 18:39Z and 18:45Z she reported a
   lesson recorded under Alma that belonged to Amalia and asked to move it.
   Homa searched twice and found no recording at all. Not diagnosed here.

## Open ruling needed for step 1

Inside one revision chain, when the newest passing revision is a `draft` and an
older `final` exists, what should the parent see? Options: newest passing wins
outright, newest passing wins with a visible draft badge, or final wins only
when it is also the newest. This decides step 1's implementation and is a
product call, not an engineering one.
