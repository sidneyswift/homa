# Models judge, code verifies (binding, founder ruling 2026-07-21)

This is the full text of the ruling, its history, and its corollaries.
It was carried verbatim in `AGENTS.md` until 2026-07-24, when the law
statement stayed there and this record moved here so the always-loaded
file stays lean. Nothing below changed in substance during the move.
The binding summary lives in `AGENTS.md` § "Models judge, code verifies";
if the two ever disagree, this file is the authority and `AGENTS.md`
gets fixed.

## The law

Whenever a capability has to turn human language into structured data,
**a model makes the judgment and deterministic code verifies the result.**
Never write pattern matching (regex, keyword lists, token-overlap scores,
alias tables) to decide what a sentence *means*. That is a judgment call,
and hand-written patterns are bad at it in a way that is invisible until
you measure.

The split, precisely:

| The model decides | Code decides |
|---|---|
| Which skill a sentence describes, which child it is about, how strong the claim is, whether a message reports anything at all | Whether that skill exists, whether the child is in this family, whether the quote really appears in the message, whether the claim is age-plausible, what number the answer produces, idempotency, tenancy, rate limits |

A model proposes; it never has authority. Its output is a **structured
object validated by a schema** whose fields are enums and ids drawn from
real catalogs, plus a verbatim quote the code re-checks against the
source text. If any check fails, the claim is dropped, never softened.
The scorer, the ledger, and every tenancy rule stay exactly as
deterministic as before.

## Why this is a law and not a preference

The child-progress journal originally matched a mother's sentence to one
of 225 skill lines with token-overlap scoring and six hand-written alias
rules. It looked safe ("the model has no scoring authority") and it was
tested. In production it produced **one** evidence row in the product's
lifetime: it rejected its own documentation's example sentences, read
"she" as a different person, treated a capitalized book title as a second
human, and recorded "struggled to read" as mastery. The safety was
illusory. We had not avoided judgment, we had encoded bad judgment in a
place no eval could see, and the failure mode was total silent data loss
that nobody noticed for months. See
`docs/homa-planning/plans/2026-07-21-progress-signal-capture-audit.md`.

## Corollaries

Each one was learned the same way:

- **Do not pre-filter the model's options with the pattern matcher you
  are replacing.** Pass the whole catalog; a lexical shortlist
  reintroduces the exact recall failure.
- **Verify provenance, not phrasing.** "This quote appears verbatim in
  the transcript" is a real guarantee. "This clause shares 50% of its
  tokens with that quote" is a guess wearing a number.
- **Measure the judgment layer against real language**, with fixtures
  taken from production and from the product's own documentation, and
  ratchet the number. Deterministic tests below the judgment prove
  nothing about whether signal ever arrives.
- **A deterministic component that reliably produces nothing is not the
  safe choice.** Silence is a failure mode, and it is the one least
  likely to page anyone.
- **A per-item rule belongs in the validator, not the transport schema.**
  The entry-length cap sat on the Zod schema, so one merged entry six
  characters over threw away the model's entire response, two correct
  splits included. Schemas should be permissive enough to parse; the
  validators reject one proposal and let the rest through.

## Exceptions

Exception, narrowly: exact string work that is *verification rather than
interpretation* stays deterministic and lexical. Checking that a
delivered SMS contains the exact question we sent is verification. Deciding
what a mother meant is not.

Second exception, on different grounds: **a security floor is not a
capability.** The law is about components whose low recall means *lost
signal*, where silence is invisible failure. A deny-list guarding a
boundary fails the other way: its recall is not the product, and it is
never the only control. `scanMemoryContent` (lib/agent-memory.ts) pattern
matches saved memories for instruction-shaped text, which is interpretation
by the letter of this law, and it stays deterministic anyway because the
real control is structural (memory renders inside a labelled data block
that the agent is told is never instructions) and because a model asked to
judge attacker-controlled text is inside the blast radius of the thing it
is judging. Keep such floors cheap, keep them honest about what they are,
and never let one stand in for a capability.

## Applied to memory, 2026-07-21

The contradiction guardrail (`findConflictingMemories`) was this law's
violation in the memory system. It judged "does this new fact supersede
that one" with one scalar, cosine distance under 0.5, calibrated on a
single observed pair. Measured against the rows compaction later merged,
true-conflict distances ran 0.307 to 0.537 across the threshold, and 5 of
28 rows had no embedding at all. When it did fire correctly its only
output was advisory prose to a model mid-conversation, and the flagged
duplicate rode in every prompt for eleven days. Fleet-wide it produced two
superseded rows in the product's lifetime, the same "one evidence row"
signature as the journal matcher. It was deleted rather than tuned,
because the compliant replacement already existed: compaction proposes
with a model over the whole store and verifies in code, off the critical
path. Its judgment layer is measured by
`scripts/memory-compaction-eval.mts` against production language.
