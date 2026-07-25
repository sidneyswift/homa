# Under the Hood: The Personalization Keystone — what-works.md

**Date:** 2026-07-25
**Subject:** How Homa knows *how* Story actually learns — not just where he is developmentally, but which hooks land and which don't — and the message-classification pipeline that keeps that model current from nothing but Alessa's normal voice memos. Traced from `content/learners/story/what-works.md`, the signal taxonomy inside `skills/homa-track-story-coach/SKILL.md`, and real entries in `learning-journal.jsonl`. Includes a correction to Homa's own prior planning record — the feedback mechanism that's actually live today is not the one that was originally planned.
**Purpose of this series:** Documenting Homa's mechanisms to port the concepts into the Homa cloud app (different harness). Same structure as prior entries: **concept (portable)** / **OpenClaw implementation (replaceable)** / **porting notes & gaps**. Directly answers the open question from [2026-07-21 — Spanish worksheet generation](2026-07-21-spanish-worksheet-generation.md), which named this file as the source of Story's likeness/interest details without tracing how it gets written. Related: [2026-07-25 — Story-coach benchmarking system](2026-07-25-story-coach-benchmarking-system.md) (the *where* companion to this doc's *how*).

---

## The core idea, and why it exists

Two files answer two different questions about the same child:

- `story-profile.json` answers **"where is he?"** — academic/developmental position against benchmarks (the subject of the story-coach doc).
- `content/learners/story/what-works.md` answers **"how does he actually learn?"** — which hooks, modalities, and formats land, cited and dated.

The file's own header states the stakes directly: *"This is the difference between a generic suggestion and one Story will actually sit down for."* And it exists because of a specific, named failure, quoted from a 2026-06-28 Sidney↔Alessa transcript: Homa's suggestions were **"the most obvious"** and didn't fit Story — there was no model of what actually engages him, and the roadmap ledger calls this **"THE keystone"** fix, ranked `highest` leverage of everything in Homa's capability backlog. Every one of the 8 worksheet/activity-generating skills, plus story-coach's own research-application step, now reads this file *first* — it's not a passive log, it's a hard read-before-generate gate.

---

## Layer 1: The file's actual shape

**Concept:** Personalization data needs to be structured enough to be skimmed by an agent under time pressure, but must preserve provenance — every claim traceable to when and how it was learned, so stale or wrong signal can be identified and corrected rather than silently trusted forever.

**OpenClaw implementation**, `content/learners/story/what-works.md` sections:
- **Interests & hooks (the levers)** — e.g. "Paw Patrol — the strongest hook... use characters to carry a concept (e.g. handwriting letter U → 'Skye under an umbrella')," cited to the founding transcript.
- **How he learns (modality)** — hands-on/sensory preferred; "immersive, multi-touch units beat single-pass" (a topic lands when surrounded by material, not covered once); "concept-through-everything for hard ideas" when something doesn't click on the first pass; explicitly **"few worksheets at this age... don't default to worksheets."**
- **What's worked (dated, cited — append-only, growing)** — a chronological list, each entry `date — observation → why it matters (source: transcript / voice note)`. E.g. *"2026-07-02 — when he got tired of reading a Bob book, Less improvised a phonics game instead of pushing the book → worked really well... gamify > drill the instant a preferred activity fatigues."*
- **What he resists / needs more reps on** — the negative space, equally structured.
- **Where Alessa is strong vs. wants Homa's help** — a division-of-labor section so Homa fills gaps ("expanding math beyond the book") rather than duplicating what Alessa already does well (immersive science/humanities units), which the file names explicitly as "not over-supplementing."

**Every entry is dated and sourced** (`transcript` or `voice note`), and the file states plainly at the top: *"Agent-maintained; Less never edits it."* — it's a write-only-by-Homa, read-by-everyone artifact, not a form Alessa fills in.

**Porting notes / gaps:**
- The four-section shape (levers / modality / dated evidence log / explicit division-of-labor) is directly portable to any personalization-file schema, and the append-only cited-evidence-log pattern is the single most valuable piece — it's what lets a downstream skill judge *how much to trust* a given claim (a 3-week-old single mention vs. a pattern repeated five times).
- Gap: the cloud app needs an equivalent per-learner "how" file, read-gated into every content-generation path the way this one is — and the same write-only/agent-maintained convention, so the file can't drift out of sync with a parent's casual hand-edits.

---

## Layer 2: One message, up to six destinations — the signal taxonomy

**Concept:** A parent talking naturally in a chat channel produces messy, multi-topic raw text. Getting personalization data out of it requires a classifier that can pull *several different kinds of signal out of a single message* and route each to the right store — rather than treating the message as one blob with one destination.

**OpenClaw implementation:** the story-coach skill's Ambient Learning Loop (same cron, `Story Ambient Learning`, documented in the ambient-coverage doc) applies this taxonomy to every scanned message:

| Signal | Trigger pattern | Destination |
|---|---|---|
| Story observation | "he can/started/stopped X" | `story-profile.json` — updates `current`, `verified`, recomputes position |
| Correction | "actually he X now" / "no, he doesn't Y anymore" | Replaces the old value outright — doesn't keep both |
| Milestone reached | "he did X 3 times this week" | Archives the matching intervention if it hits `graduate_when`; drafts the next one |
| Preference / interest | "he loves X" / "he keeps asking about Z" | `MEMORY.md`, interests |
| Routine / context change | "we dropped Spanish class" | `MEMORY.md`, context — affects calendar-aware planning |
| **Feedback on a suggestion/worksheet** | "that worked" / "he loved it" / "this isn't working" / "stop suggesting X" | **`content/learners/story/what-works.md`**, dated + cited |
| Daily recap | a voice memo summarizing the whole day | Fan out: each sub-observation routed per the other rows, plus a compliance-log entry |
| Question / directive | "can you..." | **Not a signal** — skipped, already handled in real time |
| Plans / intentions | "next week we'll try..." | Not an observation — usually skipped, occasionally `MEMORY.md` if strategically meaningful |

**The uncertainty rule:** when it's unclear whether something is signal or noise, log it to `learning-journal.jsonl` at `confidence: low` but **don't mutate the profile or what-works.md**. Stated principle: *"Better to under-update than to corrupt state."*

**A traced real example** (from `learning-journal.jsonl`, 2026-07-03T01:23, an 85-second voice memo): Alessa described four things in one message — an addition lesson with counters, a Spanish class song, a handwriting worksheet review, and a phonics game improvised when Story got tired of a Bob book. Each got classified separately: three logged as `story_observation` (routed toward `story-profile.json`, though in this case already captured in real time, so no duplicate write), and the phonics-game detail became the *"gamify > drill on fatigue"* entry that now lives in what-works.md — a case of the same raw message producing both a mechanical profile-observation entry and a higher-level, generalizable *pattern* entry, because the pattern ("switch format when a preferred activity fatigues, don't push through") is a reusable teaching lesson, not just a one-time data point.

**Porting notes / gaps:**
- The core reusable idea: **build one multi-label classifier over raw parent input, not N separate single-purpose extractors** — a single 85-second voice memo legitimately contains four different kinds of signal, and processing it as one blob would lose most of it.
- The **"skip real-time-handled content, skip pure plans/intentions"** exclusions are equally important — a classifier that logs *everything* as a profile signal drowns the real signal in noise (directives and hypotheticals aren't facts about the child).
- Gap: cloud app needs its own signal taxonomy tuned to what it actually needs to route (developmental-state store vs. preference store vs. a generalizable "what works" pattern store vs. context/memory), plus the same low-confidence-log-don't-mutate escape valve for ambiguous input.

---

## Layer 3: A correction to Homa's own planning record — the mechanism that's actually live isn't the one that was planned

**Concept, and why this belongs in an engineering doc rather than just a footnote:** systems document their *intended* mechanisms in planning artifacts (roadmaps, memory, specs) well before — or instead of — the real mechanism that ends up shipping. Trusting the plan instead of re-verifying against current code is a real failure mode, and this system has a live example of it.

**What was planned (2026-04-25):** in response to Alessa calling Homa "dumb," the stated fix was a **reaction-based feedback loop** — Alessa taps 👍/👎/🤷 on Homa's messages, logged to `feedback.jsonl`, a weekly retro cron clusters the patterns.

**What's actually live (verified today, 2026-07-25):** `feedback.jsonl` does not exist on disk. `operations/roadmap.md` still lists **"enable Slack reaction events"** as an open, unbuilt proposal — the Slack app's config only has outbound `statusReactions` wired, no inbound `reaction_added` event handler, so a tap on a message never reaches Homa at all. The doctor's `check_feedback_loop` fires this as a known low-severity finding, essentially every night, and nobody has treated it as urgent — **because the actual feedback loop moved to natural language instead.** The signal taxonomy in Layer 2 is explicit: *"Less gives this as voice memos in the main chat, not emojis."* Alessa just... says "that worked" or "he loved it" out loud, and the ambient loop catches it.

**Why the plan never got formally retired:** nothing forced a reconciliation. The roadmap item sits there because it's technically still true and still cheap-ish to build, not because anyone re-evaluated whether it's still needed. Voice-memo phrase detection turned out to satisfy the actual need (get feedback into what-works.md) via a channel Alessa was already using constantly (voice memos, established as her dominant input mode across every other doc in this series) — so the original plan quietly became unnecessary without anyone marking it done, dead, or superseded.

**Porting notes / gaps:**
- The generalizable lesson: **when a system's usage pattern reveals the real, cheaper path to a goal, the original planned path should be explicitly retired**, not left dangling in a backlog where it looks like an open gap. An unretired plan is a false "todo" that costs future audits (this doc series) real investigation time to discover is moot.
- For the cloud app: don't assume a documented feedback mechanism is the live one — grep the actual routing code / current skill files, the way this investigation did, before building on top of a planning artifact's claim.
- This doc series' own memory record had exactly this staleness (a saved memory from 2026-04-25 still described reactions as "the chosen learning loop"); it's been corrected as part of writing this entry, which is itself a small instance of the same discipline this doc argues for.

---

## Summary: the portable formula

```
two complementary per-learner files: WHERE (scored position vs. benchmarks) + HOW (cited, dated hooks/modality/what-worked)
  → the HOW file is a hard read-gate before any content-generation skill runs — not optional context
    → one multi-label classifier over raw natural-language input (voice memos, chat)
        fans a single message to up to N destinations by signal type
        explicitly excludes directives/plans as non-signal
        under uncertainty: log low-confidence, don't mutate state
      → when the real usage pattern reveals a cheaper feedback channel than the one originally planned,
        explicitly retire the old plan — don't let it rot in a backlog as a phantom gap
```

## Known gaps to fill in the cloud architecture

1. A per-learner "how they learn" file (interests/hooks, modality, dated cited evidence log, explicit division-of-labor with the parent) — read-gated into every generation path, agent-maintained only.
2. A multi-label signal classifier over raw parent input that fans one message to several typed destinations, with an explicit non-signal exclusion list and a low-confidence/don't-mutate escape valve.
3. A process for retiring superseded planned mechanisms (not just building new ones) — this system's own reaction-feedback plan sat "open" in the backlog for three months after a better mechanism had already replaced it in practice.
