# Hours capture acceptance

This focused model acceptance calls the actual Planner and Hours tool definitions,
canonical recall, and production write services against a disposable PostgreSQL
cluster with all migrations. The synthetic SMS fixture owns a real family,
membership, episode, session, and each current parent message before invoking the
existing authenticated pinned seam. It does not fabricate browser credentials or
claim to verify full-fleet routing, hosted UI, or SMS provider authentication.
Skill-load and write-call order remain in the trace. Tools always execute their
real production validators; the fixture does not invent a runtime requirement
that a skill must load before an available tool can execute.

The earlier unshipped generic Eve fixtures lacked a canonical parent-message
identity. Their plausible tool calls could not establish a saved record. This
replacement checks the persisted Hours rows, immutable operation receipts,
activity links, quotes, source IDs, and retry behavior. The model judges the
activity boundaries and title reference; code verifies the effects. Ambiguous and
private context must produce no write attempt. A direct adversarial private-source
attempt also exercises the actual writer's refusal.

From the repo root with Node 24:

```sh
HOMA_HOURS_ACCEPTANCE_REPORT=/tmp/hours-capture-acceptance.json corepack pnpm eval:sandbox --exec node --import ../../node_modules/tsx/dist/loader.mjs evals/hours-capture-acceptance/launch.ts
```

The launcher uses the canonical isolation scrub before starting the model/writer
child. Only Vercel OIDC is copied from the local environment file. Never opt out
of isolation. Set `HOMA_HOURS_ACCEPTANCE_REPORT` to an absolute JSON path outside
the repo. `HOMA_HOURS_ACCEPTANCE_FILTER` runs only check names containing one of
its pipe-separated substrings, useful for the deterministic `actual tool` regression without a model
call. Each artifact names the checks actually run. The runner refuses a hosted database and verifies the
cluster's actual data directory belongs to the disposable sandbox. It starts no
Eve server. Output contains synthetic model text and real local durable receipts.

Implementation note, 2026-09-07: revived the frozen two-issue harness after the
user requested finishing all remaining work. Kept the production tool bodies and
source validators intact, replaced the generic eval channel with a verified
canonical fixture, and matched the focused skill announcement to the installed
Eve seam. This is acceptance evidence for #1090 and #1093, not a new product path.

Discovery, 2026-09-07: the real model saved two distinct same-turn activities,
but exact retries of either tool call returned a possible-duplicate warning about
the other row. The tool searched broad same-subject candidates before reaching
the accepted operation's replay path. The bounded repair lets an existing,
family-scoped accepted operation proceed to the unchanged transactional writer,
which still validates source ownership, exact payload, and current saved state.
Regression acceptance must require the original receipt, not just unchanged row
counts. This is a #1090 product fix discovered by the model acceptance.

Discovery, 2026-09-07: model capture omitted the participant list for one of two
named-child sessions and omitted earlier-source context while copying a book
title into its note. Both omissions had defaults with product meaning. The agent
schemas now require an explicit childIds array and a nullable workContext choice.
Empty children still means whole-family work; null context still permits ordinary
faithful note summaries. The original note contract did not clearly require a
current-message substring, so this change preserves summary notes rather than
silently turning them into quotes. Missing choices fail schema validation before
effects. Saved records, manual note editing, and writer/RPC request formats are
unchanged; model tool invocations must satisfy the current explicit schema.

The visible earlier-title case still omitted provenance after those skill and
schema changes. `hours-note-grounding.ts` therefore checks non-verbatim notes
before the existing writer runs. It checks the final composed annotation,
including an earlier work title when the optional detail note is absent. A bounded model proposes whether the note is a
faithful summary, with exact source IDs and quotes; deterministic code checks
each citation against the current canonical parent message and any independently
verified workContext source. Missing support returns a refusal to recall the
parent source or clarify the work, never a guessed title or silently shortened
note. Complete current-message quotations keep the fast path. A fragment may
drop a negation or quote an instruction sample as history, so fragments receive
the same semantic check as paraphrases. An accepted
operation reaches the unchanged immutable replay validator without depending on
a new model judgment.

The source preflight is read-only, family/member scoped, and limited to two
seconds. The model call has a fifteen-second abort with no retries, within the
existing forty-five-second tool deadline. Existing transactional source,
ownership, ordinal, child, duration, and immutable-payload checks remain the
authority for effects. The model check can add latency or refuse when unavailable;
it never authorizes unrelated records or changes the manual note-editing path.
The current source uses `canonicalInboundAuthAttributes` after its authenticated
read, matching channel normalization for tabs, newlines, Unicode whitespace and
the code-point limit. A mismatched canonical text cannot borrow a real source ID.

The `model note grounding` group exercises actual log_hours calls for a literal
note, faithful paraphrase, unsupported earlier title, verified earlier title,
assistant-source refusal, and source-injection refusals, including a literal
fragment that would drop its surrounding context. Composed-title cases cover an
omitted detail note, an earlier negated instruction example, and two unresolved
books. Negative model cases
require an unsupported-note judgment; model unavailability cannot count as a
passing semantic refusal. The delayed-duration group additionally checks the
capturing model's complete emitted response and the actual two-source durable
receipt. Successful capture also requires a natural model stop, a nonempty final
response and a truthful confirmation checked against the actual tool receipts.
A saved row followed by silent tool-step exhaustion is a failure.
`hours-note-grounding.test.ts` covers malformed citations and the complete-quote
fast path without calling a model.
