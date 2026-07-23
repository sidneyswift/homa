# Receipt spine: the page of firsts and the provenance viewer

<!--
Status: BUILD PLAN, not yet implemented. Derived from the celebration-v1
design workflow (2026-07-22): one design pass per tranche, then three
adversarial skeptics per tranche (correctness, harm, law), then a revise
pass that folded surviving objections back in. The objections that
survived are listed at the bottom; they are already reflected in the
file specs above them.

Every file:line citation was written by an agent that read the repo. Treat
them as strong leads, not gospel: re-verify each before you touch it, the
codebase moves. Builds on docs/homa-planning/plans/2026-07-22-celebration-system.md.
-->

## Summary

The receipt spine still ships as pure read-time projections over rows that already exist, with no migration and no new SQL, reusing loadProjectionInput (repository.ts:578-581, postgres-repository.ts:1908-1928) through one new service method. Three objection classes were fatal and are folded in wholesale. First, the retraction rule keyed on a sibling row's source, and four live paths supersede the founding row and append nothing (progress-service.ts:829-835 answer:null, :1018-1023 undo, :1169-1175 batch undo, :1376-1382 walk coverage), reachable from api/map/answer/route.ts:175; the rule is now row-scoped and source-blind: a first stands unless every row on the item was superseded with nothing left active, or that row lost a resolved conflict. Second, conflict resolution never supersedes the loser (check-in-service.ts has no supersedeEvidence call; effective-evidence.ts:296-339 selects the winner at read time), so a row the household settled against would have founded a first; resolved-conflict losers are now retired, and an open conflict no longer removes anything, it marks the line. Third, this is the first parent-facing render of stored quotes anywhere (only apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134 does today), and the write path stores a whole inbound message as the quote (manage_child_progress.ts:73) or a model-chosen 400-character span validated only for provenance (claim-validation.ts:107-112), so a deterministic render gate now suppresses any quote naming another child in the roster or matching BANNED_WORDS/EM_DASH. Also folded in: onboarding_walk and legacy rows can no longer found a first (walk-prompt-store.ts:391 stamps the request clock on a batch of recollections carrying quote null), the beginning label is cut because observed_at is a report timestamp not an event date, taxonomy rows whose statement is a bare topic name (scorable.ts:45) render only behind a parent quote, the permanence copy is rewritten to be literally true, and the door is suppressed and the kid switcher redirected so an empty firsts page is never one tap from a sibling's full one.

## Files

### `apps/web/lib/child-progress/quote-gate.ts` (create)

**Purpose.** The deterministic render gate every stored quote passes before a parent reads it. New file, folded in from objections 4 and 13.

Imports at top: `import { BANNED_WORDS, EM_DASH } from "@homa/core";` (packages/core/src/map/copy-laws.ts:12 and :14; verify the barrel re-exports both, otherwise import from the deep path the way other web callers do).

Module comment states what this is and why it is allowed to be deterministic: this is a security floor, not a capability. AGENTS.md's second exception to models-judge-code-verifies covers exactly this shape (scanMemoryContent in lib/agent-memory.ts). Roster-name checking is exact string verification over a known catalog, not interpretation of meaning, and the failure mode is suppression, never misattribution. It also names why the gate exists at all: today a stored quote reaches a human only in the founder console (apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134), and ProgressTopicView carries no quote (types.ts:345-388), so the firsts page is the first parent-facing render in the product's history.

```ts
export interface QuoteGateContext {
  /** Display names of every OTHER child in this family, from the
   *  caller's own RLS-loaded roster. Never model-supplied. */
  otherChildNames: readonly string[];
}

export type QuoteGateVerdict =
  | { kind: "render"; quote: string }
  | { kind: "suppress"; reason: "blank" | "other_child" | "banned_words" | "em_dash" };

export function gateStoredQuote(
  quote: string | null,
  context: QuoteGateContext,
): QuoteGateVerdict;
```

Logic, in order, first match wins:
1. `quote === null || quote.trim() === ""` gives `{ kind: "suppress", reason: "blank" }`.
2. `EM_DASH.test(quote)` gives reason `em_dash`.
3. `BANNED_WORDS.test(quote)` gives reason `banned_words`. BANNED_WORDS is `/\b(behind|delayed?|disorder|diagnos\w*|screening|assessment|percentile)\b/i` (copy-laws.ts:12) and carries no `g` flag, so `.test` is stateless and safe to reuse.
4. For each name in `context.otherChildNames`, build `new RegExp(\`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])\`, "iu")` over the escaped trimmed name and test it. Unicode property lookaround rather than `\b` so a non-ASCII name still matches on a real boundary. Skip blank names. Any hit gives reason `other_child`.
5. Otherwise `{ kind: "render", quote }`, the quote unchanged and untruncated.

A private `escapeForRegExp` helper escapes `.*+?^${}()|[]\\`.

Comment on the ordering: the reason is not rendered to a parent and exists only so tests can assert which rule fired. Telling a mother her own sentence was filtered for a word she used would be worse than saying nothing, so the renderer omits the quote section entirely rather than explaining.

### `apps/web/lib/child-progress/provenance.ts` (create)

**Purpose.** Pure mapper from one evidence row to the one receipt a parent may read, carrying both the human-authored-quote fence and the render gate.

Imports at top: `import { getMapItem, getScorableItem } from "@homa/core";`, `import { gateStoredQuote, type QuoteGateContext } from "./quote-gate";`, `import type { ProgressCheckInChannel, ProgressEvidence, ProgressEvidenceAnswer, ProgressSourceKind } from "./types";`

Module comment in the abilities.ts header idiom: this module exists so no surface can attribute Homa's own sentence to a parent, and so no surface can put one child's name on another child's keepsake. Names the 2026-07-19 recall class (PR #52) for the first and the multi-child capture path for the second.

```ts
/** The only sources whose stored `quote` is a human's own sentence.
 *  Journal and conversation rows store a verbatim substring of the
 *  adult's canonical inbound message. Every other source either stores
 *  no quote at all, or stores Homa's own words: lesson_listen stores a
 *  model-written clause in parent-report style, and rendering that as
 *  "her own words" is the recall internal-visibility failure repeated. */
const HUMAN_AUTHORED_QUOTE_SOURCES: ReadonlySet<ProgressSourceKind> =
  new Set(["journal", "conversation"]);

export interface ProvenanceRecord {
  evidenceId: string;
  itemId: string;
  /** The catalog line. A parent-observable sentence for bank items; a
   *  bare topic name for taxonomy items, which is why isBankStatement
   *  exists. */
  statement: string;
  /** True when getMapItem resolved the id, so `statement` is one of the
   *  225 authored bank sentences rather than a taxonomy topic name. */
  isBankStatement: boolean;
  subjectId: string;
  subjectDisplayName: string;
  answer: ProgressEvidenceAnswer;
  source: ProgressSourceKind;
  channel: ProgressCheckInChannel | null;
  adultDisplayName: string | null;
  /** The adult's own words, gate-passed. Never a model-authored string,
   *  never a string naming another child in this family. */
  quote: string | null;
  /** True when a human-authored quote existed and the gate held it
   *  back. The renderer then shows no quote AND no "no words saved"
   *  line, because that line would be false. */
  quoteSuppressed: boolean;
  observedAt: string;
  createdAt: string;
}

export function humanAuthoredQuote(
  evidence: ProgressEvidence,
): string | null;

export function buildProvenanceRecord(
  evidence: ProgressEvidence,
  gate: QuoteGateContext,
): ProvenanceRecord | null;
```

humanAuthoredQuote: returns `evidence.quote` only when it is non-null, non-blank, and `HUMAN_AUTHORED_QUOTE_SOURCES.has(evidence.source)`; otherwise null. This runs BEFORE the render gate, so a lesson_listen quote is dropped as not-a-human's-words rather than reported as suppressed.

buildProvenanceRecord:
1. `const found = getScorableItem(evidence.itemId); if (found === undefined) return null;` Returning null rather than throwing is deliberate and commented: projection.ts:128-131 throws on an unknown item id, which is right for the scored projection and wrong for a celebration page, where a retired catalog id must never take the page down.
2. `const isBankStatement = getMapItem(evidence.itemId) !== undefined;`
3. `const authored = humanAuthoredQuote(evidence);` then `const verdict = authored === null ? null : gateStoredQuote(authored, gate);`
4. `const quote = verdict?.kind === "render" ? verdict.quote : null;` and `const quoteSuppressed = verdict !== null && verdict.kind === "suppress" && verdict.reason !== "blank";`
5. **The renderability floor.** `if (quote === null && !isBankStatement) return null;` Commented: a taxonomy item's statement is `topic.name` (packages/core/src/map/scorable.ts:45), a bare noun phrase like "Persuasive Writing" or "Knowing What You Don't Know", and skill-catalog.ts:43-49 puts all of them in front of the extraction model, so taxonomy ids arrive on exactly the rows a parent quotes. A dated noun phrase with no sentence under it is a coverage checklist line, which is the thing the spec puts on the shelf. Either her words carry the row or an authored bank sentence does; nothing else renders.
6. Build the record field by field, `statement: found.item.statement`, `subjectId: found.subject.id`, `subjectDisplayName: found.subject.displayName`.

Nothing here carries memberUserId, familyId, idempotencyKey, messageId, supersedesId or supersededAt into the record: those are ledger internals and never cross to a client payload. `observedAt` and `createdAt` are carried because the derivation orders on both.

buildProvenanceIndex from the original plan is CUT. It had one caller (the map tranche) and no caller here, and the map tranche can add it with its own selection semantics.

### `apps/web/lib/child-progress/firsts.ts` (create)

**Purpose.** The deterministic derivation, rewritten row-scoped and source-blind after objections 1, 2, 6, 7, 11 and 12.

Imports at top: `import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";`, `import { buildProvenanceRecord, type ProvenanceRecord } from "./provenance";`, `import type { QuoteGateContext } from "./quote-gate";`, `import type { ProgressConflict, ProgressEvidence, ProgressSourceKind } from "./types";`

Module comment states the four laws it enforces and cites each: implied abilities can never appear because they are not rows; a regression, a downgrade and a re-affirmation never move or remove a line (spec R3 and section 5E, "History does not un-happen"); a record the family took back does leave, because a celebration may not assert what a parent removed; the page is ordered by date and never grouped by subject.

```ts
/** Answers stamped with the request clock about abilities the child
 *  already had. walk-prompt-store.ts:391 sets observedAt to now for a
 *  whole signup sitting, progress-service.ts:1297 writes them with
 *  quote null, and packages/core/src/map/bank.ts:24 says the bank asks
 *  what is "answerable from memory". Fifteen of them share one instant
 *  and none of them is a day something happened. `legacy` is the same
 *  shape, migrated. Neither may found a first. */
const RECOLLECTION_SOURCES: ReadonlySet<ProgressSourceKind> =
  new Set(["onboarding_walk", "legacy"]);

export interface ChildFirst {
  /** The row that founded it, and the only receipt this line makes. */
  provenance: ProvenanceRecord;
  /** True when an open conflict names the founding row. The line stays
   *  and says so; a disagreement is not a retraction. */
  contested: boolean;
  /** Set on the earliest first in each subject, so the page can name
   *  where a subject came into the record. Null everywhere else. */
  subjectMarker: { subjectId: string; displayName: string } | null;
}

export function deriveChildFirsts(input: {
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  gate: QuoteGateContext;
}): ChildFirst[];
```

Logic, in order:

1. `retiredEvidenceIds: Set<string>`. For every conflict with `state === "resolved"`, add whichever of `evidenceIdA` / `evidenceIdB` is not `resolvedEvidenceId`. Comment, with the citation: conflict resolution calls `transaction.resolveProgressConflict` and nothing else (check-in-service.ts:1002-1010; grep for supersedeEvidence in that file returns nothing), so the losing row stays active and unsuperseded forever. effective-evidence.ts:296-339 copes by selecting the winner at read time, machinery this module deliberately bypasses. Without this set, a row the household settled AGAINST would found a first.

2. `openConflictEvidenceIds: Set<string>`. For every conflict with `state === "open"`, add both sides. Used for `contested` only. It does NOT remove a candidate. Comment: conflicts open with `evidenceIdA` set to the previous effective row (progress-service.ts:1929), which for a one-row item IS the founding row, so skipping it would silently delete a mother's own sentence from a keepsake the moment a second adult tapped a different answer.

3. `withdrawnItemIds: Set<string>`. An item is withdrawn when it has zero rows satisfying `supersededAt === null && !retiredEvidenceIds.has(row.id)`. Comment, with all four citations: this is the only removal test, and it is source-blind on purpose. correctProgressAnswers supersedes every active row for an item at or before the cutoff (progress-service.ts:801-818) and then `continue`s without appending when the answer is null (:829-835) or is not_sure/skip (:836-856); undoProgressEvidence (:1018-1023), undoProgressOperation (:1169-1175) and the walk coverage path (:1376-1382) supersede and append nothing at all. The live route api/map/answer/route.ts:175 reaches the first of those through legacy-adapters.ts:309-317. Keying the removal on a sibling row's `source` missed every one of them, and would additionally have let a client choose the outcome, since api/map/report/correct/route.ts:91-105 reads `source` out of the request body.

4. `candidates`: rows where all of
   - `answer === "easily"`
   - `!RECOLLECTION_SOURCES.has(row.source)`
   - `!retiredEvidenceIds.has(row.id)`
   - `!withdrawnItemIds.has(row.itemId)`
   - `buildProvenanceRecord(row, input.gate) !== null`
   Note what is deliberately absent: there is no `supersededAt === null` test. A superseded row is still a day that happened. Comment: this is what makes a regression, a downgrade and a re-affirmation all leave the date alone. March easily superseded by a July not_yet keeps its March line, because the item still has an active row and the mother denied nothing; the item only leaves when nothing is left standing on it at all.
   Comment on `easily` only: getting_there and not_yet are honest answers and belong on Progress, but a page of firsts built from them opens with the things a child could not do, which is a deficit ledger wearing a celebration's name.

5. Founding row per itemId: the minimum by `(observedAt epoch ns, createdAt epoch ns, id ascii)`, the exact inverse of effective-evidence.ts:175-198 `isLaterEvidence`, so both modules break ties the same way and a first never moves between renders. Do NOT walk forward to a later row when the earliest one is unrenderable: `buildProvenanceRecord` already handles renderability by falling back to the bank statement, and choosing a first's date by what happens to render would make the date an artifact of the filter.

6. Sort the surviving founding rows ascending by the same triple. Oldest first.

7. `contested = openConflictEvidenceIds.has(founding.id)`.

8. `subjectMarker` on the first occurrence of each `subjectId` in that order.

CUT from the original plan: `isBeginning` and every use of it. Objection 5 is right that `observed_at` is a report timestamp on every path except lessons (manage_child_progress.ts:76, check-in-service.ts:507 and walk-prompt-store.ts:391 all pass the request clock; only lib/lessons/worker.ts:355-368 passes a distinct time), so "the earliest thing on the record, everything below it came after" is a claim about message arrival dressed as a claim about a child. The top row is still the top row without a sentence asserting temporal priority. Flagged as a founder decision.

The function is pure and synchronous, takes no clock, and never takes ageMonths: a first is a fact about a date, not about a child's age today.

### `apps/web/lib/child-progress/firsts-copy.ts` (create)

**Purpose.** Every parent-facing string for the firsts page and the provenance body, rewritten so nothing promises what the derivation cannot keep.

Imports at top: `import type { ProgressCheckInChannel, ProgressSourceKind } from "./types";`

Note what is NOT imported: `progressSourceLabel` from view-copy.ts is deliberately absent (objection 10). It returns check-in vocabulary ("Onboarding", "Correction", "Report correction", "Earlier progress answer", view-copy.ts:78-109), which is right on a Progress card and wrong on a keepsake. This module defines its own nouns and uses them on the line a parent actually reads.

Module comment: the receipt law in one paragraph, plus the permanence rule. Every string names something that already happened and carries its date. Nothing counts, nothing compares, nothing looks forward. "finally" and "at last" are banned here specifically because both say the day should have come sooner. No string may promise that a line never leaves, because two things do remove a line and the page has to say which.

Exact strings:

```ts
export const FIRSTS_TITLE = "Firsts";

export function firstsHeading(childName: string): string {
  return `${childName}'s firsts`;
}

export function firstsIntro(childName: string): string {
  return (
    `Every line here is something ${childName} did, with the day it ` +
    "was reported. A later answer never rewrites a day that already " +
    "happened. If someone takes an answer back, its line comes off, " +
    "and that is the only way a line leaves."
  );
}

export function firstsSubjectMarker(subjectDisplayName: string): string {
  return `The first thing you told me about ${subjectDisplayName}.`;
}

export function firstsSubjectMarkerBody(
  source: ProgressSourceKind,
): string {
  return (
    `This one came from ${firstsSourceNoun(source)}. It counts the ` +
    "same as anything else here."
  );
}

export const FIRSTS_CONTESTED_LINE =
  "Two adults in your family remember this one differently. Both " +
  "answers are saved, and this day stays here.";

export function firstsSourceNoun(source: ProgressSourceKind): string;

export function firstsMeta(
  adultDisplayName: string | null,
  source: ProgressSourceKind,
  dateLabel: string,
): string;

export function firstsQuoteLabel(
  adultDisplayName: string | null,
): string;

export function firstsNoQuote(source: ProgressSourceKind): string {
  return (
    `This came from ${firstsSourceNoun(source)}. There are no words ` +
    "saved with it."
  );
}

export function firstsMatchedAbility(statement: string): string {
  return `Homa matched this to: ${statement}`;
}

export function provenanceChannelLine(
  channel: ProgressCheckInChannel | null,
): string | null;

export function firstsEmptyHeading(childName: string): string {
  return `${childName}'s firsts will land here.`;
}

export function firstsEmptyBody(childName: string): string {
  return (
    `The first time you tell me about something ${childName} did, it ` +
    "lands here with the day you told me and, when you wrote them, " +
    "your own words. The signup questions do not land here: those " +
    "were about what was already true."
  );
}

export const FIRSTS_DOOR = "See the firsts";
export const FIRSTS_PROVENANCE_SUMMARY = "Where this came from";
export const FIRSTS_JUMP_RECENT = "Jump to the most recent";
```

CUT from the original plan, each for a named reason: `FIRSTS_ROW_LABEL` ("First time"), `FIRSTS_BEGINNING_LABEL` and `firstsBeginningBody`. A per-row "First time" chip and a "Where this starts / everything below it came after" body both assert event precedence off `observed_at`, which records when a message arrived. The page title, the heading and the intro carry the frame honestly; the row does not need a chip that overclaims.

Also cut: the two permanence sentences. The old `firstsIntro` said "Nothing here ever changes or goes away" and the old `firstsEmptyBody` said "Nothing ever leaves this page", both false the moment a parent undoes an answer.

firstsSourceNoun: exhaustive switch over all twelve ProgressSourceKind values (types.ts:8-20) with a `never` default in the view-copy.ts:110-112 idiom. Nouns are ADULT-NEUTRAL, because the reporting adult may not be the reader: journal "a note"; conversation "a conversation with me"; check_in "a check-in"; checklist "the progress checklist"; deep_dive "a focused check-in"; correction "a correction"; report_correction "a correction on the report"; report_probe "a report follow-up"; recheck "a follow-up check"; onboarding_walk "the first set of questions"; legacy "an earlier answer"; lesson_listen "a lesson recording". The last two stay defined and stay exhaustive even though RECOLLECTION_SOURCES keeps them off the page, so the switch cannot rot.

firstsMeta: non-blank `adultDisplayName` gives `` `${adultDisplayName} · ${firstsSourceNoun(source)} · ${dateLabel}` ``, otherwise `` `${firstsSourceNoun(source)} · ${dateLabel}` ``. Comment: no "Adult 1" fallback here. view-copy.ts:192-195 numbers adults because a conflict card must distinguish two of them; a receipt with no attributed adult should say less, not invent a label. The mid dot is the house separator (view-copy.ts:189), never an em dash.

firstsQuoteLabel: non-blank name gives `` `${adultDisplayName}'s own words` ``, otherwise `"The note this came from"`. Never "Your own words" when the adult is unknown: two adults report in the same family and guessing which one is a fabrication.

provenanceChannelLine: exhaustive over ProgressCheckInChannel (types.ts:61-67) plus null: web "In the app"; sms "By text"; email "By email"; lesson "In a lesson you recorded"; voice "On a call"; dispatch "In a message Homa started"; null returns null so the line is omitted rather than rendered blank. Comment: the evidence table's check constraint only permits web, sms, email and lesson (20260714033500_lesson_listen.sql:175-182), so voice and dispatch are unreachable today; the switch stays exhaustive because a silently wrong channel label on a receipt is worse than a compile error.

### `apps/web/lib/child-progress/firsts-from-ledger.ts` (create)

**Purpose.** The adapter from the existing ledger read to the serializable client payload, now taking the family roster so the quote gate has something to check against.

Imports at top: `import { deriveChildFirsts } from "./firsts";`, the copy functions from "./firsts-copy", `import type { ChildProgressProjectionInput } from "./repository";`, `import { formatProgressDate } from "./view-copy";`

Module comment: why this cannot come from the Progress page's view, with the two file:line facts (progress-service.ts:441-446 prefers the cached projection; types.ts:345-388 has no quote and one row per item), and what it costs instead: one existing repository method, one extra repeatable-read transaction, on the firsts route and on the Progress route's door check.

```ts
export interface FirstsProvenanceView {
  evidenceId: string;
  itemId: string;
  /** The catalog line. Rendered as the row's lead ONLY when there is no
   *  quote, and only bank statements ever reach that branch. */
  statement: string;
  subjectDisplayName: string;
  /** Already formatted in the family's own time zone. */
  dateLabel: string;
  /** Adult, source and date on one line, or source and date alone. */
  metaLine: string;
  /** The adult's own words, gate-passed. Null when none survives. */
  quote: string | null;
  quoteLabel: string | null;
  /** The honest replacement when the row genuinely stores no words.
   *  Null when a quote existed and the gate held it back, because
   *  "there are no words saved with it" would be false. */
  noQuoteLine: string | null;
  /** "Homa matched this to: <statement>", shown inside the disclosure
   *  whenever the row leads with a quote. */
  matchedAbilityLine: string | null;
  channelLine: string | null;
}

export interface FirstsRowView {
  provenance: FirstsProvenanceView;
  /** The row's lead line. The parent's words when there are any,
   *  otherwise an authored bank sentence. Never a taxonomy topic
   *  name, which provenance.ts refuses to let through unquoted. */
  lead: { kind: "quote"; text: string } | { kind: "statement"; text: string };
  contestedLine: string | null;
  subjectMarker: { heading: string; body: string } | null;
}

export interface ChildFirstsPage {
  childId: string;
  childName: string;
  rows: FirstsRowView[];
}

export function firstsPageFromLedger(input: {
  ledger: ChildProgressProjectionInput;
  /** Display names of every OTHER child in this family, from the
   *  caller's RLS-loaded roster. Never model-supplied, never from the
   *  URL. */
  otherChildNames: readonly string[];
}): ChildFirstsPage;
```

Body: calls `deriveChildFirsts({ evidence: ledger.evidence, conflicts: ledger.conflicts, gate: { otherChildNames } })`, then maps each ChildFirst to a FirstsRowView. Every date formats through `formatProgressDate(provenance.observedAt, ledger.timeZone)` (view-copy.ts:142-159) so an 11pm report never lands on the wrong day. `childId` and `childName` come from `ledger.child` (repository.ts:20-24 ProgressChildRecord carries id, name, birthDate), so the route does not have to pass the name separately.

`lead` is `{ kind: "quote" }` when `provenance.quote !== null`, otherwise `{ kind: "statement", text: provenance.statement }`. `matchedAbilityLine` is `firstsMatchedAbility(statement)` in the quote case and null in the statement case, so the ability is never hidden, only demoted below the sentence that actually is the receipt. `noQuoteLine` is `firstsNoQuote(source)` only when `provenance.quote === null && !provenance.quoteSuppressed`. `contestedLine` is `FIRSTS_CONTESTED_LINE` when `first.contested`, else null.

The payload is assembled field by field, never by spreading a ledger row. `ChildProgressProjectionInput.evidence` is `StoredProgressEvidence`, which carries `idempotencyKey` on top of `ProgressEvidence`'s `memberUserId`, `familyId`, `messageId`, `supersedesId` and `supersededAt` (repository.ts:26-28, types.ts:246-265); none may reach a client payload, and a test serializes the result and asserts their absence by key name. `familyId` is deliberately absent from ChildFirstsPage too: the page never needs it, and a payload that does not carry it cannot leak it. `birthDate` from ProgressChildRecord is likewise never copied across.

No count of firsts is computed or exposed. `rows.length` is available to callers as a list length and is never rendered: a per-child count of firsts is the exact number a mother would compare across her children.

### `apps/web/lib/child-progress/progress-service.ts` (modify)

**Purpose.** Add the one read method the receipt spine needs, beside the view read it deliberately cannot use.

Insert directly after `getChildProgressView` (which spans :436-455), so the two reads sit together and the comment explains the split:

```ts
  /**
   * The receipt spine's read: one child's whole ledger, quotes and all.
   *
   * getChildProgressView above prefers the cached projection, which is
   * right for the Progress page and useless here: it holds one
   * effective row per item and no quote at all, so neither
   * min(observed_at) nor a parent's own words can be recovered from it.
   * A receipt surface has to come down to the rows themselves.
   */
  getChildProgressLedger(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    return this.repository.loadProjectionInput(familyId, childId);
  }
```

No new SQL: `loadProjectionInput` is already on the ChildProgressRepository interface (repository.ts:578-581) and already implemented (postgres-repository.ts:1908-1928) inside a repeatable-read read-only snapshot, so evidence and conflicts are read consistently. `ChildProgressProjectionInput` is already referenced throughout this file; confirm the existing `./repository` type import covers it before adding anything.

### `apps/web/lib/child-progress/runtime.ts` (modify)

**Purpose.** Expose the ledger read to Next routes through the same singleton seam every other progress read uses.

Add beside `getChildProgressView` (runtime.ts:180-186):

```ts
export function getChildProgressLedger(
  familyId: string,
  childId: string,
) {
  return childProgressService.getChildProgressLedger(familyId, childId);
}
```

`ChildProgressProjectionInput` is already re-exported from this module (runtime.ts:360-371 `export type { ChildProgressProjectionInput, ... } from "./repository"`), so no type export is added. Verify rather than duplicate.

### `apps/web/lib/child-progress/route-policy.ts` (modify)

**Purpose.** Put the firsts route behind the same live-progress gate as every other ledger surface.

Add `"child_firsts"` to the childId-carrying arm of `ProgressRoutePolicyInput` (route-policy.ts:6-10, currently `surface: "child_progress" | "child_report"; childId: string`) and a case to the switch that mirrors `child_progress`: enabled continues, disabled redirects to `/app/${encodeURIComponent(route.childId)}/report`. Code comment: the firsts page reads the evidence ledger directly, so it must be dark wherever the ledger is dark, or it renders a record the product is not yet serving.

### `apps/web/lib/view-context.ts` (modify)

**Purpose.** Send a kid switch from the firsts page to that child's Progress page, never to that child's firsts page.

Add `const FIRSTS_PAGE = /^\/app\/([^/]+)\/firsts$/;` beside PROGRESS_PAGE (view-context.ts:60) and a branch in `kidSwitchTargetPath` (view-context.ts:72-81) returning `` `/app/${childId}/progress` ``, NOT `/app/${childId}/firsts`.

This reverses the original plan, folding in objection 8. The regex block's own comment says kid-scoped routes keep the surface ("Progress stays Progress"), so this branch needs its own comment explaining the exception: two children's firsts pages are the one pair of surfaces in the product where a one-tap swap performs a complete comparison with no number rendered, which is the structural hazard section 7 raises against the kid pill. In production, 11 of 25 multi-kid families have a child with zero evidence rows beside a sibling with up to 45 (spec section 5C), so the swap lands an empty keepsake directly on top of a full one. Progress is the right landing surface: it is that child's own page and it carries its own invitation.

Returning null instead is wrong: the switcher would silently stay put, which reads as the page being broken.

### `apps/web/app/app/[childId]/firsts/page.tsx` (create)

**Purpose.** The server route: re-scope the child, load the ledger, hand the roster to the quote gate, render the page.

Follows apps/web/app/app/[childId]/progress/page.tsx:19-75 exactly. Imports at top only, in that file's ordering.

```tsx
export const metadata: Metadata = {
  title: "Firsts",
  robots: { index: false },
};

export default async function ChildFirstsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) { ... }
```

Steps, in order:
1. `const { childId } = await params;`
2. `const policy = progressRoutePolicy({ surface: "child_firsts", childId }, liveProgressEnabled()); if (policy.kind === "redirect") redirect(policy.href);`
3. `const data = await getAppData(); if (!data) redirect("/onboarding");` getAppData runs every read under the caller's RLS context (lib/app-data.ts:20-25).
4. `const child = data.children.find((entry) => entry.id === childId); if (!child) notFound();` This is the tenancy re-scope: the childId from the URL is client input and never reaches a query until it has been matched against the caller's own RLS-loaded children, exactly as progress/page.tsx:42-43 does.
5. `const otherChildNames = data.children.filter((entry) => entry.id !== child.id).map((entry) => entry.name);` The gate's roster. It comes from the authenticated read, never from the model and never from the URL.
6. `const ledger = await getChildProgressLedger(data.family.id, child.id);` familyId comes from the session.
7. `if (ledger === null)` render `<FirstsPage page={{ childId: child.id, childName: child.name, rows: [] }} />` rather than notFound: a child with no ledger row yet is a normal new child, not a missing page.
8. `return <FirstsPage page={firstsPageFromLedger({ ledger, otherChildNames })} />;`

A read failure is not swallowed: wrap step 6 in try/catch, `console.error` and render the existing `ProgressUnavailable` component with the child's id and name, matching progress/page.tsx:64-75. A celebration page that renders half a record is worse than one that says it could not load.

### `apps/web/app/app/[childId]/progress/page.tsx` (modify)

**Purpose.** Compute whether the firsts page has anything on it, so the door is never a lie.

New, folded in from objection 8. Today the door would be gated on `neverAssessed` (progress-view.tsx:216, `view.subjects.length === 0 && report === null`), and projection.ts:511-523 builds subjects from all effective evidence regardless of answer, so a child whose every answer is getting_there or not_yet is NOT never-assessed and would get a door into an empty page. The same is true of a child whose only easily answers came from the onboarding walk, which the derivation now excludes. Neither emptiness is predictable from the view.

Add `getChildProgressLedger(data.family.id, child.id)` as a third entry in the existing `Promise.all` at progress/page.tsx:45-62, wrapped so a ledger failure degrades to `null` and only costs the door, never the Progress page:

```tsx
  const [pageState, lessons, ledger] = await Promise.all([
    loadChildProgressPageState(/* unchanged */),
    lessonListenEnabled() ? listLessonsForChild(...) : Promise.resolve([]),
    getChildProgressLedger(data.family.id, child.id).catch(() => null),
  ]);
```

Then, after the existing `pageState.status === "unavailable"` branch:

```tsx
  // The firsts door only renders when there is something behind it.
  // A door into an empty keepsake lands hardest on the child whose
  // answers were honest, which is exactly who section 5A protects.
  const hasFirsts =
    ledger !== null &&
    firstsPageFromLedger({
      ledger,
      otherChildNames: data.children
        .filter((entry) => entry.id !== child.id)
        .map((entry) => entry.name),
    }).rows.length > 0;
```

Pass `hasFirsts` (a boolean, never a count) into `<ProgressView ... />`. Import `firstsPageFromLedger` and `getChildProgressLedger` at the top with the other lib imports.

The cost is one extra repeatable-read transaction of three indexed selects on the Progress route, run in parallel with two reads already there. Recorded in risks.

### `apps/web/components/progress/firsts-page.tsx` (create)

**Purpose.** The page itself: one child, ordered strictly by date, oldest at the top, the parent's own words leading each row.

Server component, no "use client", no state. Imports at top: `PageColumn` from ../dashboard/page-column, `ProvenanceBody` from ./provenance-body, the copy functions from ../../lib/child-progress/firsts-copy, and `type { ChildFirstsPage }` from ../../lib/child-progress/firsts-from-ledger.

```tsx
export function FirstsPage({ page }: { page: ChildFirstsPage }) { ... }
```

Structure:
- Header: `firstsHeading(page.childName)` as the h1, `firstsIntro(page.childName)` beneath it. No count, no date range, no "since" line.
- Empty state when `page.rows.length === 0`: `firstsEmptyHeading` and `firstsEmptyBody` in the card treatment abilities-card.tsx:110-122 uses for `sky.lit === 0`. No zero, no scoreboard.
- `FIRSTS_JUMP_RECENT` as a plain anchor to the last row's id, rendered only when there are three or more rows. The list runs oldest first because the record starts at the top; the anchor is how a mother reaches today without scrolling. It is a link, never a count.
- One `<ol>` of rows. Each `<li>` carries, in order:
  - the subject marker when present, as a small heading (`marker.heading`) plus body (`marker.body`) above the row's own content;
  - the lead. `row.lead.kind === "quote"` renders a `<blockquote>` of the parent's sentence, whole and untruncated, as the row's largest text. `row.lead.kind === "statement"` renders the authored bank sentence in the same slot. This is the inversion objection 9 asked for: the receipt leads, the catalog label does not;
  - `row.provenance.metaLine`, adult and source and date on one line;
  - `row.contestedLine` when present;
  - `<details>` with `<summary>{FIRSTS_PROVENANCE_SUMMARY}</summary>` wrapping `<ProvenanceBody data={{ kind: "reported", provenance: row.provenance }} />`. Progressive disclosure, not a modal, so the page stays a server component and the detail is already in the server-rendered HTML.

What this component must never render, each pinned by a test: a per-row "First time" chip, a beginning label, a month or year heading, a period grouping, any element whose text is a bare number, a percentage, another child's name, a kid comparison, the words "finally" or "at last", or an em dash. The kid switcher is not rendered here; swapping children is handled by the sidebar through kidSwitchTargetPath, which now navigates to that child's Progress page.

### `apps/web/components/progress/provenance-body.tsx` (create)

**Purpose.** The provenance viewer's body: date, channel, adult, the matched ability, and their own words. Shared and presentational so the map tranche wraps the same body in its sheet.

No "use client". Imports at top: `type { FirstsProvenanceView }` from ../../lib/child-progress/firsts-from-ledger and the copy this file needs from ../../lib/child-progress/firsts-copy.

```tsx
export type ProvenanceBodyData = {
  kind: "reported";
  provenance: FirstsProvenanceView;
};

export function ProvenanceBody(
  props: { data: ProvenanceBodyData },
): JSX.Element;
```

One prop shape and one case. The discriminated union stays so the map tranche can add `{ kind: "implied", ... }` without changing this file's call sites.

CUT from the original plan: the `implied` case, and with it the `abilities.ts` `impliedByItemId` change that fed it. It had no caller in this tranche (abilities-card.tsx:62-70 renders the star strip `role="presentation" aria-hidden="true"` with no tap target, and a grep across apps/web finds no route referencing ABILITIES_OPEN), and abilities.ts merged four days ago in PR #108. Shipping an unused edit into freshly merged derivation code buys nothing this tranche can verify. The map tranche adds both together, where it has a caller and a test that exercises it.

Reported case renders, in order: `provenance.dateLabel`; `provenance.channelLine` when non-null; `provenance.metaLine`; `provenance.matchedAbilityLine` when non-null (the catalog line, demoted here); then exactly one of
- a `<blockquote>` of `provenance.quote` under `provenance.quoteLabel` when the quote is present,
- `provenance.noQuoteLine` when it is present,
- nothing at all when both are null, which is the suppressed-quote case.

The third branch is commented: a stored quote existed and the render gate held it back, and there is no honest short sentence for that. "There are no words saved with it" would be false. Explaining the filter would either accuse a mother of her own phrasing or advertise a filter she cannot act on. Silence here is the only option that says nothing untrue.

The quote is rendered whole, never truncated: these are the parent's own words and shortening them changes what she said. The column caps at 500 characters (20260711213330:95) and writers slice to 500 (progress-service.ts:1586, :1614), so there is a bound already.

### `apps/web/components/progress/progress-view.tsx` (modify)

**Purpose.** Give the firsts page a door from the surface a parent is already on, and only when there is something behind it.

Add `hasFirsts: boolean` to the component's props. Immediately after the `<AbilitiesCard ... />` block (progress-view.tsx:319+), inside the same `neverAssessed ? null :` guard AND additionally gated on `hasFirsts`, add a plain `Link` to `/app/${view.childId}/firsts` with the text `FIRSTS_DOOR`, styled as the quiet secondary link the page already uses. Import `FIRSTS_DOOR` at the top with the other lib imports, never inline.

Both gates are load-bearing and each needs its own reason in the comment. `neverAssessed` (:216) keeps the first check-in as the page's one ask for a brand-new child. `hasFirsts` keeps a door out of the page for a child who has been reported on honestly and has no `easily` rows outside the signup questions, because that door leads to an empty keepsake and, before this tranche's view-context change, was one tap from a sibling's full one.

Check progress-view.test.tsx after the change: it asserts on rendered markup, and the added text must not trip its deficit-language or no-count scans. Existing call sites must pass the new prop; grep for `<ProgressView` before editing.

### `package.json` (modify)

**Purpose.** Run the new tests in the guards that already gate this area.

`check:child-progress` (package.json:10) globs `apps/web/lib/child-progress/*.test.ts`, so quote-gate.test.ts, provenance.test.ts, firsts.test.ts, firsts-copy.test.ts and firsts-from-ledger.test.ts join it with no edit.

`check:progress-ui` (package.json:16) lists files explicitly. Append, beside their siblings: `apps/web/lib/child-progress/quote-gate.test.ts`, `apps/web/lib/child-progress/firsts.test.ts`, `apps/web/lib/child-progress/provenance.test.ts`, `apps/web/lib/child-progress/firsts-copy.test.ts`, `apps/web/lib/child-progress/firsts-from-ledger.test.ts`, `apps/web/components/progress/firsts-page.test.tsx`, `apps/web/components/progress/provenance-body.test.tsx`. `apps/web/lib/child-progress/route-policy.test.ts`, `apps/web/lib/view-context.test.ts` and `apps/web/components/progress/progress-view.test.tsx` are already in the list.

## Tests

### `apps/web/lib/child-progress/firsts.test.ts`

- min(observed_at) per item_id founds the first, and a later easily row on the same item never replaces it
- the list is ordered strictly ascending by date and never grouped by subject: a science row from March sits above a math row from April
- two rows at the identical observedAt break the tie by createdAt then by ascii id, matching effective-evidence.ts, and the same input renders the identical array twice
- a not_yet row never founds a first
- a getting_there row never founds a first, and the same item later answered easily founds its first on the easily date
- REGRESSION KEEPS THE LINE: a later appended not_yet on the same item leaves the firsts array deeply equal to the run without it
- DOWNGRADE KEEPS THE LINE AND THE DATE: a report_correction to getting_there supersedes the March easily and appends an active getting_there row; the first still renders with the March date and the March quote
- RE-AFFIRMATION KEEPS THE DATE: a report_correction to easily supersedes the March easily and appends a July easily; the first still renders March, not July
- RETRACTION REMOVES THE LINE, delete path: every row on the item superseded with none appended (the answer:null shape from progress-service.ts:829-835) drops the item entirely
- RETRACTION REMOVES THE LINE, undo path: a single superseded row with nothing appended (undoProgressEvidence shape) drops the item
- RETRACTION REMOVES THE LINE, batch undo path: two items superseded in one operation with nothing appended both drop
- RETRACTION REMOVES THE LINE, not_sure path: rows superseded and only a selectionAnswer written (progress-service.ts:836-856 shape) drops the item, since selectionAnswers are not evidence rows
- legacy reconciliation churn does not delete history: a superseded founding row whose item still carries any active row keeps its first
- a resolved conflict that settled AGAINST the easily row removes that row from candidacy, and the item leaves the page when no other easily row stands
- a resolved conflict that settled FOR the easily row leaves the first exactly where it was
- an OPEN conflict naming the founding row does not remove it: the first still renders and carries contested true
- an open conflict on a different item leaves this item's first alone and contested false
- an onboarding_walk easily row never founds a first, even when it is the earliest row on the child
- a legacy-sourced easily row never founds a first
- a walk row and a later journal row on the same item produce one first, dated the journal row
- a taxonomy item id with no surviving quote produces no row, and the same item id with a gate-passing quote produces one
- an item id the catalog no longer resolves is skipped rather than throwing
- an implied ability can never appear: a run whose only easily row lights a hard prerequisite closure still produces exactly one first, for the reported item
- subjectMarker is set on the earliest first in each subject and on no other row
- the derivation exposes no isBeginning field and no row carries a beginning flag
- a child with no qualifying rows returns an empty array rather than throwing

### `apps/web/lib/child-progress/quote-gate.test.ts`

- a clean quote passes through byte-identical and untruncated
- a quote naming another child in the roster is suppressed with reason other_child
- the roster check is case-insensitive: 'ella' matches a roster child named 'Ella'
- the roster check respects word boundaries: a child named 'Ana' does not suppress a quote containing 'banana'
- the roster check handles a non-ASCII name: a child named 'Zoë' is matched in 'Zoë read it'
- the child the page is about is NOT in otherChildNames, so her own name never suppresses her own quote
- a quote containing 'behind' is suppressed with reason banned_words
- a quote containing 'diagnosis' is suppressed with reason banned_words
- a quote containing an em dash is suppressed with reason em_dash
- a null quote and a whitespace-only quote both suppress with reason blank
- BANNED_WORDS is reused across calls without flag-state leakage: the same regex object gives the same verdict twice
- an empty roster suppresses nothing on the other_child rule

### `apps/web/lib/child-progress/provenance.test.ts`

- a journal row's quote is carried through as the adult's own words
- a conversation row's quote is carried through
- a lesson_listen row's quote is dropped to null even though the column is populated, because that string is a model-authored clause and not a human's words, and quoteSuppressed stays false because nothing a human wrote was held back
- every non-journal, non-conversation source drops its quote, asserted by iterating the full ProgressSourceKind union so a new source cannot silently opt into being quoted
- a journal row whose quote names a sibling gives quote null and quoteSuppressed true
- a journal row whose quote contains 'behind' gives quote null and quoteSuppressed true
- a check_in row with a null quote gives quote null and quoteSuppressed FALSE, so the renderer may say no words were saved
- a bank item with a suppressed quote still returns a record, because the authored bank statement can carry the row
- a taxonomy item with a suppressed quote returns null, because a bare topic name under a date is not a receipt
- a taxonomy item with a gate-passing quote returns a record and isBankStatement false
- isBankStatement is true for a bank id and false for an mt_-prefixed taxonomy id
- buildProvenanceRecord returns null for an unresolvable item id rather than throwing
- the record never carries memberUserId, familyId, idempotencyKey, messageId, supersedesId or supersededAt, asserted over Object.keys
- adultDisplayName passes through unchanged, including null

### `apps/web/lib/child-progress/firsts-from-ledger.test.ts`

- dates render in the ledger's own time zone: a 2026-03-03T04:00:00Z row reads as March 2 for a family in America/Los_Angeles
- childId and childName come from ledger.child and birthDate is never copied into the payload
- metaLine reads adult, source noun and date separated by mid dots when the adult is known
- metaLine drops the adult segment when adultDisplayName is null, and never renders 'Adult 1'
- metaLine uses the firsts source noun and never a progressSourceLabel string: a report_correction row reads 'a correction on the report', never 'Report correction'
- a row with a surviving quote leads with kind quote and carries matchedAbilityLine naming the catalog statement
- a row with no stored quote leads with kind statement and carries a populated noQuoteLine and a null matchedAbilityLine
- a row whose quote was suppressed leads with kind statement and carries BOTH a null quote and a null noQuoteLine
- contestedLine is populated only for a contested first
- channelLine is null for a row with a null channel, so the renderer omits the line
- the serialized payload contains no memberUserId, familyId, idempotencyKey, supersededAt, supersedesId or sourceRevision key
- the payload carries no count of firsts, no total, and no number that is not part of a date string
- the payload for a ledger with no qualifying rows has an empty rows array and still carries childId and childName
- otherChildNames reaches the gate: the same ledger produces a quote-led row with an empty roster and a statement-led row when the roster names the sibling in the quote

### `apps/web/lib/child-progress/firsts-copy.test.ts`

- no exported string contains an em dash
- no exported string contains a BANNED_WORDS match from packages/core/src/map/copy-laws.ts:12
- no exported string contains 'finally' or 'at last'
- no exported string contains a percentage, 'out of', 'remaining', 'total' or 'so far'
- no exported string names a sibling relationship or a second child
- PERMANENCE PROMISE: no exported string contains 'never goes away', 'nothing ever leaves', 'always stays' or 'forever', because two paths do remove a line
- firstsIntro states the removal condition in the parent's own terms
- firstsSourceNoun is exhaustive over every ProgressSourceKind and returns a non-empty adult-neutral noun for each
- no source noun contains the word 'you', so a second adult's row never reads as the reader's own
- provenanceChannelLine is exhaustive over every ProgressCheckInChannel and returns null only for null
- firstsQuoteLabel never says 'your own words' when the adult is unknown
- firstsEmptyBody never asserts the parent has told Homa nothing and renders no zero
- the module exports no FIRSTS_ROW_LABEL, no FIRSTS_BEGINNING_LABEL and no firstsBeginningBody

### `apps/web/components/progress/firsts-page.test.tsx`

- renders one list item per first, in date order, oldest first
- a quote-led row renders the parent's sentence as the row's lead, in a blockquote, above the meta line
- a quote-led row does not render the catalog statement in the lead position
- a statement-led row renders the authored bank sentence and no blockquote
- renders no 'First time' chip and no beginning label anywhere
- renders no month heading, no year heading and no period grouping element
- renders no count of firsts, no percentage and no 'out of'
- renders the subject marker exactly once per subject
- a contested row renders the contested line and still renders its quote
- renders no second child's name and no comparison language
- contains no em dash, no 'behind', no 'finally' and no 'at last'
- the empty state invites rather than reporting zero, and contains no bare 0
- each row exposes its provenance through a details element whose summary is the fixed label
- the jump link is absent for a one-row page and present for a three-row page
- a taxonomy-id fixture with a quote renders her words; the same fixture with the quote suppressed renders nothing for that item

### `apps/web/components/progress/provenance-body.test.tsx`

- renders the date, the channel line, the meta line and the quote under its label
- renders the quote whole rather than truncated, including a 500-character quote
- renders the matched-ability line when the row led with a quote
- a row with no stored quote renders the honest no-quote line and no blockquote
- a row whose quote was suppressed renders NEITHER a blockquote NOR the no-quote line, and renders no explanation of the suppression
- a lesson-sourced row renders its date and channel line and never renders a quote
- the rendered output contains no em dash and no BANNED_WORDS match
- the component exports no implied case in this tranche

### `apps/web/components/progress/progress-view.test.tsx`

- the firsts door renders when hasFirsts is true and the child is not never-assessed
- the firsts door does not render when hasFirsts is false, even though the abilities card does
- the firsts door does not render for a never-assessed child
- adding the door does not introduce a count, a percentage or a banned word into the page's existing scans

### `apps/web/lib/view-context.test.ts`

- kidSwitchTargetPath returns the sibling's PROGRESS path from /app/<id>/firsts, never the sibling's firsts path
- kidSwitchTargetPath still keeps the surface on /app/<id>/progress and /app/<id>/report
- kidSwitchTargetPath still returns null for an unrelated /app path

### `apps/web/lib/child-progress/route-policy.test.ts`

- child_firsts continues when live progress is enabled
- child_firsts redirects to the child's report when live progress is disabled
- the child id is percent-encoded in the redirect href

## Edge cases

- RETRACTION, all four shapes. correctProgressAnswers supersedes every active row for an item at or before the cutoff (progress-service.ts:801-818) and then appends nothing when the answer is null (:829-835) or is not_sure/skip (:836-856); undoProgressEvidence (:1018-1023), undoProgressOperation (:1169-1175) and the walk coverage path (:1376-1382) supersede and append nothing at all. The delete shape is parent-reachable today through api/map/answer/route.ts:175 into legacy-adapters.ts:309-317. Resolution: an item leaves the page when it has zero rows that are both unsuperseded and not retired by a resolved conflict. Source is never read.
- REGRESSION, DOWNGRADE and RE-AFFIRMATION. Each leaves at least one active row on the item, so the item is not withdrawn, and superseded rows remain candidates, so the founding row and its date do not move. This is the spec's own ruling (R3 'Nothing ever leaves this list, including after a regression report'; section 5E 'The list of firsts is never edited by a regression. History does not un-happen'). Pinned by three separate deep-equality tests.
- RESOLVED CONFLICT, settled against the row. Conflict resolution calls resolveProgressConflict and nothing else (check-in-service.ts:1002-1010; no supersedeEvidence call exists in that file), so the losing row stays active and unsuperseded forever and effective-evidence.ts:296-339 copes by selecting the winner at read time. A read-time module that bypasses that selection would otherwise render a first for an observation the household settled did not happen. Resolution: retire the non-resolvedEvidenceId side of every resolved conflict.
- OPEN CONFLICT. Conflicts open with evidenceIdA set to the previous effective row (progress-service.ts:1929), which for a one-row item is the founding row. Removing it would delete a mother's own sentence from a keepsake the moment a second adult tapped a different answer, and restore it silently later. Resolution: the line stays and carries FIRSTS_CONTESTED_LINE, in the idiom view-copy.ts:196-198 already uses for conflicts ('Both are saved').
- ONBOARDING WALK. walk-prompt-store.ts:391 stamps observedAt with the request clock for every walk answer, progress-service.ts:1297 writes them with quote null, and packages/core/src/map/bank.ts:24 says the bank asks what is answerable from memory. A signup sitting therefore produces up to fifteen quote-less rows sharing one instant, about abilities a seven-year-old has had for years. Resolution: onboarding_walk and legacy sources can never found a first. The empty-state copy names the exclusion so a family whose only easily answers are walk answers is not told she has said nothing.
- observed_at IS A REPORT TIMESTAMP. manage_child_progress.ts:76 and check-in-service.ts:507 both pass context.now; only lib/lessons/worker.ts:355-368 passes a distinct time. A Sunday-night catch-up about a January morning sorts by Sunday. Resolution: the page never asserts that one event preceded another. The beginning label and body are cut, the per-row 'First time' chip is cut, and firstsIntro says 'with the day it was reported'. Flagged for a founder line, because the spec's R3 asks for a beginning label.
- TAXONOMY STATEMENTS. packages/core/src/map/scorable.ts:45 sets statement to topic.name for every taxonomy topic, and skill-catalog.ts:43-49 puts all of them in front of the extraction model, so the rows carrying a parent's quote are the rows most likely to be taxonomy ids. 'Persuasive Writing' under a date is a coverage checklist line. Resolution: a taxonomy row renders only behind a gate-passing quote, which becomes the row's lead; the catalog line moves into the disclosure as the ability Homa matched it to. A quote-less taxonomy row is dropped. Test fixtures include an mt_-style id, because bank-only fixtures never surface this.
- A QUOTE THAT NAMES ANOTHER CHILD. manage_child_progress.ts:73 sets quote to the whole canonical inbound message on the base write, and :85-96 loops over capture.childIds writing a row per named sibling from that one message; per-claim quotes are model-chosen spans up to 400 characters (claim-extraction.ts:36) stored sliced to 500 (progress-service.ts:1586), and claim-validation.ts:107-112 verifies only that the span appears in the message. Nothing screens content. This is the first parent-facing render of a stored quote in the product (today only apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134 shows one). Resolution: gateStoredQuote suppresses any quote naming another roster child, matching BANNED_WORDS, or containing an em dash. The roster comes from the caller's RLS-loaded getAppData().children, never from the model.
- A SUPPRESSED QUOTE MUST NOT BECOME A LIE. firstsNoQuote says 'There are no words saved with it', which is false when a quote existed and the gate held it back. Resolution: quoteSuppressed is carried on the record, and in that case the disclosure renders neither the quote nor the no-quote line. Silence, not a false sentence and not an explanation that would accuse a mother of her own phrasing.
- A QUOTE THAT IS NOT A HUMAN'S WORDS. lesson_listen evidence stores the model's parent-report clause, not a transcript excerpt (lib/lessons/worker.ts:349 joins pair.clause, :359 passes it as quote; lib/lessons/pairs.ts:36-38 defines clause as model prose and excerpt as the verbatim words). Fenced by HUMAN_AUTHORED_QUOTE_SOURCES before the render gate runs, so it reports as 'no human words' rather than 'suppressed'.
- NO QUOTE AT ALL. Check-ins (check-in-service.ts:504), corrections (progress-service.ts:865), walk answers (:1297) and legacy adapters (legacy-adapters.ts:573) all write quote null, which is most rows in production. Such a row renders only if its item resolves through getMapItem, so what a parent reads is an authored bank sentence with a date, never a taxonomy noun phrase.
- A CORRECTION-FOUNDED FIRST. A mother who mis-tapped getting_there and fixes it upward three weeks later leaves a correction-sourced easily row as the only easily row on that item. It founds a real first on a real date with no words. It renders through the bank-statement branch with the source noun 'a correction on the report', which says what it is without dressing it as an observed moment.
- NO ATTRIBUTED ADULT. The capture trigger sets adult_display_name_snapshot to NULL whenever member_user_id is null (20260711213330:1168-1187), covering lesson rows with no createdBy and any agent write with an unresolved actor. The meta line drops the adult segment rather than falling back to 'Adult 1' the way the conflict card does at view-copy.ts:192-195.
- A RENAMED OR REMOVED ADULT. mapPostgresProgressEvidenceRow prefers the CURRENT family_members.display_name over the snapshot (postgres-repository-helpers.ts:168-170), so a March quote can render under a name changed in July. Existing product behavior, not new, but now visible on a keepsake.
- TIES ON THE EXACT SAME observedAt. Broken by createdAt then ascii id, the inverse of effective-evidence.ts:175-198, so the order never changes between renders. With walk batches excluded, the remaining tie population is small.
- TIME ZONE. Every date renders through formatProgressDate with the ledger's own timeZone (view-copy.ts:142-159; ChildProgressProjectionInput.timeZone at repository.ts:33). An evening report in a UTC-8 family otherwise lands on the following day.
- A CATALOG ID THE BANK NO LONGER RESOLVES. projection.ts:128-131 throws for an unknown item, which is correct for the scored projection and wrong here. buildProvenanceRecord returns null and the row is skipped, so retired taxonomy content can never 500 a celebration page.
- A VERY LONG QUOTE. The column caps at 500 characters (20260711213330:95) and writers slice to 500 (progress-service.ts:1586, :1614). Nothing truncates further, because shortening her words changes what she said.
- A CHILD WITH NO LEDGER ROW AT ALL. getChildProgressLedger returns null for a brand-new child; the route renders the empty state with the child's name rather than notFound, and the empty state contains no zero.
- THE EMPTY PAGE ON THE STRUGGLING CHILD. neverAssessed is view.subjects.length === 0 && report === null (progress-view.tsx:216) and projection.ts:511-523 builds subjects from all effective evidence regardless of answer, so a child answered honestly as getting_there and not_yet is not never-assessed. Resolution: the door is additionally gated on hasFirsts, computed from the same ledger read on the Progress route, and kidSwitchTargetPath sends a kid switch from the firsts page to the sibling's Progress page rather than the sibling's firsts page.
- TWO CHILDREN IN ONE HOUSE. The page takes one childId, the payload carries one child, no count of firsts is computed or rendered, the switcher never lands one keepsake list on another, and the quote gate keeps a sibling's name out of a blockquote.
- LIVE-PROGRESS FLAG OFF. The route redirects to the child's report through progressRoutePolicy, so the firsts page is never reachable while the ledger it reads is dark.
- A FOREIGN OR STALE childId IN THE URL. Matched against getAppData().children before it reaches any query, exactly as progress/page.tsx:42-43 does; familyId comes only from the session. api/map/report/correct/route.ts:91-105 reads `source` out of the request body, but the revised derivation reads no source when deciding whether a line leaves, so a client can no longer influence that outcome.

## Risks and rejected objections

- ACCEPTED IN FULL, objections 1 and 11 (the source-keyed retraction fence). Verified: progress-service.ts:829-835, :1018-1023, :1169-1175, :1376-1382 all supersede without appending, and legacy-adapters.ts:309-317 into api/map/answer/route.ts:175 makes the first shape parent-reachable. The original rule would have kept a retracted first on a permanent page forever. The fence is now source-blind.
- ACCEPTED IN FULL, objection 2 (item-scoped drop). The rule is row-scoped and the item leaves only when nothing stands on it. I did NOT take the objection's literal fix ('re-derive the founding row from the remaining active candidates'), because on its own that moves the date: a March easily superseded by a July correction would re-found the first in July and lose her March quote. Superseded rows stay candidates unless the item is withdrawn or the row lost a resolved conflict, which keeps the date fixed through a regression, a downgrade and a re-affirmation alike.
- ACCEPTED IN FULL, objection 12 (resolved-conflict losers). Verified by grep: check-in-service.ts contains no supersedeEvidence call, so the losing row is active forever and effective-evidence.ts:296-339 handles it by selection. A read-time module bypassing that selection had to retire losers explicitly.
- ACCEPTED IN FULL, objections 4 and 13 (no quote content gate). Verified that this tranche is the first parent-facing quote render and that the write path stores whole inbound messages. I did NOT take objection 13's preferred fix, a model pass returning a safe sub-span. Reasons, both binding: the spec's own model-judgment budget (section 5F) names five judgment surfaces and this is not one, and adding a model call to a page render is an unbudgeted per-view cost; and AGENTS.md's second exception to models-judge-code-verifies covers exactly this shape, a security floor whose failure mode is suppression rather than lost signal, the same class as scanMemoryContent. The interim fix the objection itself offers, deterministic roster membership plus the existing copy laws, IS what ships. The fence is only as good as the roster and the word list, which is stated plainly in the module comment.
- ACCEPTED IN FULL, objections 3, 6 and 14 (permanence copy vs derivation). The copy now states the one removal condition. I REJECT objection 6's stronger form, 'never remove a row at all'. A parent who undoes an answer has said the record should not exist; a keepsake that keeps rendering it with her quote under it is Homa telling her the retraction did not take, which is a receipt-law violation in the other direction. What I accept from it is everything else: no removal on a regression, no removal on a downgrade, no removal merely because a conflict is open.
- ACCEPTED, objection 7 (onboarding walk). Verified walk-prompt-store.ts:391 and progress-service.ts:1297. I did NOT take the alternative offered ('collapse an identical-timestamp batch into one entry'), because that entry would be a summary of a form, and a summary of a form is not a receipt. Exclusion is simpler and honest. Cost: a family whose only easily answers came from signup sees an empty firsts page, which is why the door is now gated on hasFirsts and the empty copy names the exclusion.
- ACCEPTED, objection 5 (observed_at is a report timestamp), with a different remedy. The objection offered gating isBeginning on a margin; I cut the beginning label and body outright instead, because a margin threshold is a magic number that still asserts event precedence off a column recording message arrival. The spec's R3 explicitly asks for a beginning label ('The very first row Homa ever wrote about this child sits at the top of the page, labelled as the beginning'), so this needs a founder line: either the label comes back with an honest wording about the record rather than the child, or a capture-time `happened_on` column is a separate additive migration in a later tranche.
- ACCEPTED, objection 9 and 13b (taxonomy statements). I did NOT take the offered fix of restricting the page to bank ids, because that would drop exactly the journal and lesson rows that carry a parent's own words, which are the best receipts on the page. Nor did I take the authored past-tense line per topic: 1,412 taxonomy items is a content project, not a tranche. The shipped rule is narrower and cheaper: a quote leads the row when one survives the gate, and a quote-less row renders only if the id resolves through getMapItem.
- ACCEPTED, objection 10 (check-in vocabulary on a keepsake). firstsSourceNoun now carries the meta line and progressSourceLabel is not imported into this surface at all. The nouns are additionally adult-neutral, which the original draft got wrong: 'a note you wrote' is a fabrication when the reporting adult is not the reader.
- ACCEPTED, objection 8 (the empty page and the kid switcher). Both fixes taken. The cost is one extra loadProjectionInput transaction on the Progress route, run inside the existing Promise.all and degraded to null on failure so it can never take Progress down. That is a real regression in Progress-route cost and it is the price of a door that is never a lie.
- REJECTED, objection 2's scenario C as a live hazard. api/map/report/correct/route.ts:91-105 does read `source` out of the request body, which is worth noting, but the revised derivation reads no source when deciding whether a line leaves or which row founds it, so a client cannot choose the outcome. Recorded here rather than fixed, because the route's source handling is out of this tranche's scope and is not exploitable through the firsts page.
- CUT FROM THE TRANCHE: the abilities.ts impliedByItemId change and the ProvenanceBody implied case. Both had no caller here (abilities-card.tsx:62-70 renders the star strip role=presentation aria-hidden with no tap target, and no map route exists), and abilities.ts merged four days ago in PR #108. The map tranche adds them together where a test can exercise them.
- FOUNDER LINE NEEDED, five items, none of which this tranche can settle: (1) restricting firsts to easily rows, which is judgment not the brief's literal wording; (2) cutting the beginning label that R3 asks for, because observed_at cannot support it; (3) removing a line when a parent retracts an answer, against R3's 'nothing ever leaves' as literally written; (4) excluding onboarding_walk and legacy rows, which for some families means an empty page; (5) suppressing a parent's own quote when it names a sibling, which is Homa deciding not to show a mother her own sentence.
- loadProjectionInput loads every evidence row for the child in one repeatable-read transaction, and it now runs on two routes rather than one. The largest child in the spec's own production figures is 45 easily answers, so this is comfortable today, but the read is unbounded and grows with the ledger.
- Oldest-first ordering means a mother scrolls to reach today. The spec is explicit that the record starts at the top, so the mitigation is an anchor link, never a reversed list and never a count.
- The human-authored-quote allowlist means a future source that starts writing a real parent quote will be silently dropped rather than silently misattributed. The exhaustive-union test makes the omission visible at review time, but only to a reviewer who reads the failure.

## Verified facts (re-verify before building)

- apps/web/lib/child-progress/progress-service.ts:801-818 supersedes every active evidence row for the item at or before the correction cutoff, then :829-835 is `if (change.answer === null) { if (shouldOverrideCompatibility) {...} continue; }`, which appends NO evidence row, and :836-856 takes the same `continue` for a non-evidence answer, writing only a selectionAnswer. Objection 1 confirmed.
- apps/web/lib/child-progress/progress-service.ts:1018-1023 (undoProgressEvidence) and :1169-1175 (undoProgressOperation) each call transaction.supersedeEvidence and append nothing. progress-service.ts:1376-1382 does the same in the walk coverage path.
- apps/web/lib/child-progress/legacy-adapters.ts:309-317 deleteAnswer sends `changes: [{ itemId, answer: null }], source: "correction"` into saveChildProgressCorrection; apps/web/app/api/map/answer/route.ts:174-181 calls deleteAnswerWithProgressStatus, so the supersede-without-append shape is live and parent-reachable.
- apps/web/lib/child-progress/check-in-service.ts:1002-1010 resolves a conflict with transaction.resolveProgressConflict and nothing else; `grep -n supersedeEvidence apps/web/lib/child-progress/check-in-service.ts` returns no matches. The losing evidence row is never superseded. Objection 12 confirmed.
- apps/web/lib/child-progress/effective-evidence.ts:296-339 handles that by selecting the resolved winner at read time and preferring a later active row created after the resolution, machinery a read-time firsts module does not use.
- apps/web/lib/child-progress/types.ts:264-291: ProgressConflictFields carries evidenceIdA and evidenceIdB; OpenProgressConflict has state 'open' with resolvedEvidenceId null; ResolvedProgressConflict has state 'resolved' with resolvedEvidenceId: string and resolvedAnswer.
- apps/web/lib/child-progress/types.ts:246-265 ProgressEvidence carries id, childId, familyId, itemId, answer, source, memberUserId, adultDisplayName, quote, channel, messageId, checkInId, supersedesId, supersededAt, observedAt, createdAt. repository.ts:26-28 StoredProgressEvidence adds idempotencyKey.
- apps/web/lib/child-progress/repository.ts:20-24 ProgressChildRecord is { id, name, birthDate }; :30-38 ChildProgressProjectionInput carries child, familyId, timeZone, sourceRevision, evidence, conflicts, selectionAnswers. :578-581 declares loadProjectionInput on the interface.
- apps/web/lib/child-progress/postgres-repository.ts:1908-1928 implements loadProjectionInput inside a repeatable-read read-only snapshot.
- apps/web/lib/child-progress/progress-service.ts:436-455 getChildProgressView returns the cached loadLiveView result when present and only falls back to loadProjectionInput, so the Progress page's hot path never loads a quote.
- apps/web/lib/child-progress/types.ts:345-388 ProgressTopicView carries itemId, statement, detail, answer, source and observedAt only: no quote, no channel, no messageId. projection.ts:520-522 builds topic candidates from resolved.effectiveEvidence only.
- packages/core/src/map/scorable.ts:45 sets `statement: topic.name` for every taxonomy topic, and :60-64 getScorableItem returns getMapItem(itemId) ?? taxonomyIndex.get(itemId), so getMapItem presence is the exact bank-vs-taxonomy test. Objection 9 confirmed.
- apps/web/lib/child-progress/skill-catalog.ts:43-49 pushes every taxonomyScorableItems() entry into the catalog the extraction model sees, with the comment that before this the model could see only 225 of roughly 1,600 abilities.
- apps/web/agent/tools/manage_child_progress.ts:73 sets `quote: context.canonicalInboundText` on the base write and :76 sets `observedAt: context.now`; :83-96 loops over capture.childIds writing one operation per named sibling off that same message. Objections 4, 5 and 13 confirmed.
- apps/web/lib/child-progress/claim-extraction.ts:36 allows a model-chosen quote of up to 400 characters; apps/web/lib/child-progress/claim-validation.ts:107-112 quoteAppearsIn lowercases, collapses whitespace and checks substring containment, and nothing else screens quote content.
- apps/web/lib/child-progress/progress-service.ts:1573-1596 claimWrites stores claim.quote sliced to 500 characters as the evidence quote.
- apps/web/lib/child-progress/check-in-service.ts:507 sets observedAt to context.now and :504 sets quote to null; apps/web/lib/map/walk-prompt-store.ts:391 sets observedAt to now.toISOString() for every walk answer; apps/web/lib/child-progress/progress-service.ts:1297 writes walk evidence with quote null. Only lib/lessons/worker.ts:355-368 passes a distinct observedAt. Objections 5 and 7 confirmed.
- apps/web/components/progress/progress-view.tsx:216 is `const neverAssessed = view.subjects.length === 0 && report === null;` with the comment that a child with no subjects and no report has never been assessed; AbilitiesCard is rendered at :319. Objection 8 confirmed.
- apps/web/lib/view-context.ts:58-81: PROGRESS_PAGE, REPORT_PAGE and KIDS_PAGE are the only kid-scoped routes kidSwitchTargetPath knows, and it returns null (stay put) elsewhere.
- apps/web/lib/child-progress/route-policy.ts:1-20 ProgressRoutePolicyInput's childId arm currently accepts only 'child_progress' | 'child_report'.
- apps/web/app/app/[childId]/progress/page.tsx:29-62 is the pattern this route copies: params awaited, progressRoutePolicy, getAppData, data.children.find with notFound(), then a Promise.all of loadChildProgressPageState and listLessonsForChild; :64-75 renders ProgressUnavailable on failure.
- apps/web/lib/child-progress/view-copy.ts:78-110 progressSourceLabel covers all twelve ProgressSourceKind values and returns check-in vocabulary ('Onboarding', 'Correction', 'Report correction', 'Earlier progress answer'); :142-159 formatProgressDate formats through Intl in the family's zone and throws TypeError on an invalid zone; :189 and :196-198 establish the mid-dot separator and the 'Both are saved.' conflict idiom; :192-195 is the 'Adult 1' / 'Adult 2' fallback the receipt surface deliberately does not copy.
- packages/core/src/map/copy-laws.ts:12 BANNED_WORDS is /\b(behind|delayed?|disorder|diagnos\w*|screening|assessment|percentile)\b/i with no g flag; :14 EM_DASH is /, /; :24 GENDERED_PRONOUNS exists but is scoped to generated prose, not a parent's own words, so this tranche does not apply it to quotes.
- apps/web/lib/child-progress/abilities-copy.ts:109-113 abilityStateBody('implied', childName) already exists and is already tested; it is the string the map tranche's implied provenance case will use.
- apps/web/components/progress/abilities-card.tsx:62-70 renders the star strip with role="presentation" aria-hidden="true"; :107-122 is the sky.lit === 0 invitation card whose treatment the firsts empty state copies.
- apps/web/lib/child-progress/legacy-adapters.ts:583-587 maps source 'conversation' to 'correction' on the live correction path, so a conversation-sourced evidence row is rare; keeping 'conversation' in the human-authored allowlist is correct and harmless either way.
- supabase/migrations/20260711213330_agent_led_live_progress.sql:95 defines quote text with a 500-character check; :1168-1187 capture_child_progress_evidence_adult_name nulls adult_display_name_snapshot when member_user_id is null; :1825-1855 supersedes stale legacy:%/legacy-reconcile:% rows that no longer match a child_answers row, skipping rows in open conflicts.
- supabase/migrations/20260714033500_lesson_listen.sql:175-182 constrains the evidence channel to ('web','sms','email','lesson'), so 'voice' and 'dispatch' are unreachable on this table even though types.ts:61-67 types them.
- apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134 is the only .quote render under apps/web/app or apps/web/components today, confirming this tranche is the first parent-facing quote surface.
- apps/web/lib/app-data.ts:19-25 states the signed-in app frame's reads run under the caller's RLS context and :29 types children as ChildRecord[]; the Progress route reads child.name and child.birth_month off it.
- package.json:10 check:child-progress globs apps/web/lib/child-progress/*.test.ts; package.json:16 check:progress-ui lists files explicitly and already includes apps/web/lib/view-context.test.ts, apps/web/lib/child-progress/route-policy.test.ts and apps/web/components/progress/progress-view.test.tsx.
- docs/homa-planning/plans/2026-07-22-celebration-system.md R3 states 'Nothing ever leaves this list, including after a regression report' and section 5E states 'The list of firsts is never edited by a regression. History does not un-happen', with the sample copy 'The day he first read them is still on his list of firsts, because that day happened.' Section 5E's correction example is about an IMPLIED ability ('It came from her multiplying two-digit numbers on the fourteenth, which implies it'), which never appears on this page, so the spec does not rule directly on a retracted reported first.

## Objections folded in (already reflected above)

### [FATAL] Rule 5's drop condition keys on the wrong signal, so every retracted first stays on the permanent page forever. The plan drops a first only when `founding.supersededAt !== null` AND the item carries an active `correction`/`report_correction`-sourced row. Three live retraction paths supersede the founding row and append no evidence row at all, so the second condition is never satisfied and Homa keeps asserting an event the parent explicitly removed.

**Evidence.** Retraction paths that supersede with no new row: apps/web/lib/child-progress/progress-service.ts:827-834 (`if (change.answer === null) { ... continue; }` inside correctProgressAnswers, after the supersede loop at :809-818 has already cleared every active row for the item); progress-service.ts:836-856 (a `not_sure`/`skip` correction takes the same `continue` and writes only a selectionAnswer); progress-service.ts:1017-1022 (undoProgressEvidence, function at :917) and progress-service.ts:1168-1175 (undoProgressOperation, function at :1053), both of which call `transaction.supersedeEvidence` and append nothing. The `answer: null` branch is not theoretical: apps/web/lib/child-progress/legacy-adapters.ts:302-318 `deleteAnswer` sends `changes: [{ itemId, answer: null }]`, reached from apps/web/lib/map/store.ts:557 `deleteLegacyProgressAnswer`, reached from the live route apps/web/app/api/map/answer/route.ts:175. Failing scenario: Homa records `reading.sentence` easily from a March journal message; in July the mother removes that answer from the report page; `/api/map/answer` DELETE supersedes the March row and writes no correction row; `correctedItemIds` is empty for that item; the firsts page still renders "First time ... : March 3" with her quote under it, permanently, while the Progress page has correctly dropped the ability. The plan's own edgeCases list asserts the opposite ("only a correction or an undo sets superseded_at ... Leaving the first standing means Homa keeps asserting an event the mother says never happened"), so this is the exact failure it claims to prevent.

**Fix.** Stop inferring retraction from a sibling row's `source`. Drop the founding row when `founding.supersededAt !== null` and no active (`supersededAt === null`) `easily` row exists for that item with `observedAt >= founding.observedAt`; then re-derive the founding row from the remaining active candidates. That covers undo, batch undo, `answer: null`, `not_sure`/`skip`, and the reconciliation supersession at supabase/migrations/20260711213330_agent_led_live_progress.sql:1825-1855 with one condition, and it does not need to know which of eleven sources performed the write.

### [FATAL] The drop is item-scoped rather than row-scoped, and the report page's ordinary correction path is `report_correction`, so a later genuine first is silently deleted and the plan's own stated law ("a later regression never edits the list") is false on the most common regression path.

**Evidence.** The report correction route is live and routes ordinary answer changes, including regressions and re-affirmations, through correctProgressAnswers: apps/web/app/api/map/report/correct/route.ts:91-105 destructures a client-supplied `source` and calls `correctAnswersWithProgressStatus`; apps/web/lib/map/store.ts:598-625 accepts `changes: Array<{ itemId, answer: MapAnswer | null }>` with `source: "report_correction" | "report_probe" | "recheck" | "conversation"`; apps/web/lib/child-progress/legacy-adapters.ts:319-348 forwards to `saveChildProgressCorrection`; apps/web/lib/child-progress/legacy-adapters.ts:218 and :585 additionally map `conversation` to `correction`, so a chat correction lands as source `correction` too. progress-service.ts:800-820 then supersedes EVERY active row for the item at or before the cutoff. Failing scenario A (silent loss of a true first): March easily (the real first, with the mother's quote) → July regression tapped on the report page as `report_correction` not_yet → March row superseded, item in `correctedItemIds`, item dropped → in September the mother reports it easily again through chat, which appends without superseding (recordKnownChildEvidence at :1796, appendEvidenceWrite at :1842, supersession only on explicit request at :1938-1987), so the July correction row stays active, `correctedItemIds` still contains the item, the founding row is still the superseded March row, and the whole item is dropped again. The September first, which is exactly the "she can do it now" event the page exists for, never appears and nothing tells anyone. Failing scenario B (re-affirmation deletes a first): March easily → July the mother taps the same item on the report and re-confirms easily → March superseded, item in `correctedItemIds`, first vanishes because she agreed with it. Failing scenario C (client controls the erasure): route.ts:91-105 takes `source` from the request body, so whether a first is erased or preserved is chosen by the caller, not by the ledger. The plan's firsts.ts module comment and edgeCase both claim "an ordinary later not_yet appends and never supersedes, so a regression cannot reach this branch"; the report page and the chat correction path both reach it.

**Fix.** Make the rule row-scoped, not item-scoped: never delete an item, only re-derive the founding row from candidates that are still standing under the objection-1 test. A regression or a correction then retires the row it actually retired and leaves a later genuine `easily` free to found a new first with its own date.

### [SERIOUS] The page's own copy promises permanence that the same plan's derivation breaks, so the first thing a parent reads on the page is a false statement about how the page behaves.

**Evidence.** The plan's `firstsIntro` reads "Every line is something ${childName} did, with the day you told me about it. Nothing here ever changes or goes away." and `firstsEmptyBody` ends "Nothing ever leaves this page." The same plan removes rows in two places: firsts.ts step 1 skips any founding row that is either side of an open conflict, and step 5 drops the item on correction. The plan's own risks list concedes it ("it is the one place in this tranche where a line can leave the page") and its firsts.test.ts case "a founding row that is one side of an open conflict is skipped, and the item reappears once the conflict is resolved" pins the disappearance as intended behavior. Failing scenario: two adults disagree about one observation; a conflict opens (progress-service.ts:760-772 shows open conflicts are first-class); the mother opens the firsts page, the March row she remembers is gone, and the intro line under the heading tells her nothing here ever goes away. The spec is on the copy's side, not the derivation's: R3 says "Nothing ever leaves this list, including after a regression report" (docs/homa-planning/plans/2026-07-22-celebration-system.md, R3).

**Fix.** Pick one and make code and copy agree. Either keep contested and corrected rows on the page with an honest inline line ("you and <adult> remember this differently; both are saved", mirroring the existing conflict treatment at apps/web/lib/child-progress/view-copy.ts:189-198), or change the intro to promise only what the derivation delivers. Do not ship a permanence promise beside a derivation that removes rows.

### [SERIOUS] The firsts page is the first parent-facing render of stored evidence quotes anywhere in the product, and it ships with no content gate, so a sibling's name or a banned word can appear verbatim inside a blockquote on one child's keepsake page.

**Evidence.** Today quotes render only in the founder console: apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134 is the only `.quote` render in apps/web/components or apps/web/app (grep over *.tsx). The only verification a stored quote has ever passed is provenance: apps/web/lib/child-progress/claim-validation.ts:107-112 `quoteAppearsIn` lowercases and collapses whitespace and checks substring containment, nothing else; there is no screen for sibling names, banned words, or diagnosis language. Multi-child messages are a first-class, expected input on this exact path: apps/web/agent/tools/manage_child_progress.ts:73 sets `quote: context.canonicalInboundText` as the base and :85-96 loops over `capture.childIds` writing a row per named sibling from that one message, and `claimWrites` (progress-service.ts:1573-1598) stores `claim.quote`, a model-chosen span of that same message capped only at 500 characters. Failing scenario: the mother texts "Noah read a whole sentence out loud tonight, I was worried he was behind after Ella flew through this at four"; the model's quote for Noah's claim is verbatim and passes validation; Noah's firsts page renders a blockquote containing both "behind" (packages/core/src/map/copy-laws.ts:12 BANNED_WORDS) and his sister's name, under the label "Sarah's own words". The plan's firsts-copy.test.ts cases only scan the module's own exported strings, and firsts-page.test.tsx only asserts against fixtures the plan authors, so neither catches a production quote.

**Fix.** Run every quote through a deterministic render gate before it reaches the page: reject the quote (fall back to `firstsNoQuote`, which the plan already has) when it matches BANNED_WORDS/EM_DASH from packages/core/src/map/copy-laws.ts or contains the name of any other child in `getAppData().children`. Suppressing a quote costs one honest line; rendering it costs the page's one law. Test it with a fixture whose quote names a sibling and one whose quote contains "behind".

### [SERIOUS] `observed_at` is the report timestamp, not the date the thing happened, on every write path except lesson listen. A page whose entire premise is strict date ordering is therefore ordered by when the mother typed, and its opening "Where this starts / everything below it came after" line is a factual claim the data cannot support.

**Evidence.** apps/web/agent/tools/manage_child_progress.ts:76 sets `observedAt: context.now` for every journal write; apps/web/lib/child-progress/check-in-service.ts:507 sets `observedAt: context.now` for every check-in response; walk answers inherit the caller's `observedAt` through recordWalkAnswerInTransaction (progress-service.ts:1269-1310) on the same request clock. Only apps/web/lib/lessons/worker.ts:355-368 passes a distinct `observedAt` from the lesson. Failing scenario A (the dominant first-write path): a new family completes the onboarding walk and answers thirty items, of which twenty are `easily`. All twenty rows carry the same instant. The firsts page renders twenty "First time" rows all dated the same day, ordered by `createdAt` then ascii id, and labels whichever row won the tie-break "Where this starts. The earliest thing on ${childName}'s record. Everything below it came after." Nothing came after anything; they were one questionnaire about abilities the child has had for years, and the source noun the plan assigns is "your first set of questions". Failing scenario B: the mother catches up Sunday night on three weeks of notes; a January ability reported late sorts below a March ability reported promptly, so the strictly chronological page states a false order and can name the wrong event as the beginning. The plan's `firstsIntro` ("with the day you told me about it") is honest about this, but `FIRSTS_ROW_LABEL = "First time"`, `FIRSTS_BEGINNING_LABEL`, and `firstsBeginningBody` all assert the stronger claim, and the plan's edgeCases never mention that observed_at is a report timestamp.

**Fix.** Either drop the beginning label and body entirely (the row is still the top of the page without a sentence asserting temporal priority), or gate them: render `isBeginning` only when the earliest row is strictly earlier than the second row by a real margin and does not share its `observedAt` with any other row. Relabel the row's date line so it says what the field means ("you told me on 3 March"), and suppress the beginning treatment for a ledger whose earliest rows are all one onboarding sitting. Confirm with the founder before shipping any line that asserts one event preceded another off a column that records when a message arrived.

### [FATAL] The page promises permanence in copy the derivation cannot keep. `firstsIntro` says "Nothing here ever changes or goes away" and `firstsEmptyBody` says "Nothing ever leaves this page", but derivation rule 1 (skip a founding row that is one side of an open conflict) and rule 5 (drop a corrected item) both delete rows a mother has already read. Worse, both deletions are silent and neither is caused by the mother saying the day did not happen.

**Evidence.** Conflict path: conflicts open with `evidenceIdA: previousEffectiveEvidence.id` (apps/web/lib/child-progress/progress-service.ts:1929) whenever a second adult answers the same item differently (:1900-1906). For an item with one row, that previous effective row IS the founding row. Concrete: mom journals in March, "Noah read a whole sentence out loud" (journal, quote, easily). It is the only row on that item and the earliest row on the page, so it renders as "Where this starts". In September dad taps not_yet on that item in a check-in; a conflict opens with evidenceIdA = mom's March row; on her next visit the March row and her own sentence are gone, "Where this starts" now names a different day, and the page still tells her nothing ever goes away. Correction path: the report correction UI posts source `report_correction` for any answer she edits (apps/web/app/onboarding/r/[token]/receipts-list.tsx:82), and correctProgressAnswers supersedes every active row for that item at or before the cutoff (progress-service.ts:801-814), including the founding row. So a mother who downgrades one answer from easily to getting_there ("he can do it, just not reliably") permanently deletes a dated first and her own quote from a keepsake page, having denied nothing.

**Fix.** Never remove a row. Derive firsts from every `easily` row regardless of superseded_at or conflict state, which is what the spec's own regression ruling requires ("The list of firsts is never edited by a regression. History does not un-happen."), and let the provenance body carry the later disagreement as an additional dated line in the parent's own terms. If a founder rules that a corrected item must leave, the two copy strings cannot promise permanence and must state plainly what can change and why.

### [FATAL] Every onboarding-walk row founds a first with a false date, and the page's most loaded line, "Where this starts", lands on an arbitrary row from a signup questionnaire. This hits every family on day one, and the walk is the largest source of `easily` rows.

**Evidence.** Walk answers are stamped at answer time: `observedAt: now.toISOString()` (apps/web/lib/map/walk-prompt-store.ts:391) into a source `onboarding_walk` row (apps/web/lib/child-progress/progress-service.ts:1269-1305), and the bank statements the walk asks about are explicitly "answerable from memory" (packages/core/src/map/bank.ts:24), i.e. abilities the child has had for months or years. Concrete: a family signs up 3 July 2026 and answers 15 walk questions "easily" about a 7-year-old who has counted past 20 since he was 5. The firsts page opens with 15 rows, each chipped "First time", each dated Jul 3 2026, ordered arbitrarily because their observed_at values are seconds apart and the tie break falls through to createdAt then ascii id. The beginning body, "The earliest thing on Noah's record. Everything below it came after", is untrue of the other 14. The September evening she actually journals about sits below the block. Walk rows also carry `quote: null` (progress-service.ts:1297), so the top of the keepsake is 15 quote-less form answers whose provenance reads "There are no words saved with it."

**Fix.** Exclude `onboarding_walk` and `legacy` rows from founding a first: they are recollections stamped with the day she filled in a form, not observations, and they carry no words. If they must appear, collapse an identical-timestamp batch into one entry that says what it is (what she told Homa was already true on the day she started), never label it "First time", and never let it carry `isBeginning`.

### [SERIOUS] The empty firsts page, and the copy on it, land on exactly the struggling child the spec's §5A exists to protect, and the plan's own kid-switcher change puts a sibling's full page two taps away on the same surface.

**Evidence.** Candidates are `easily` rows only, but the door is gated on `neverAssessed = view.subjects.length === 0 && report === null` (apps/web/components/progress/progress-view.tsx:216), and projection builds subjects from all effective evidence regardless of answer (apps/web/lib/child-progress/projection.ts:511-523). So a child whose rows are all getting_there/not_yet is not never-assessed: the abilities card renders and FIRSTS_DOOR renders beside it. Concrete: a two-kid family, the older child struggling. Mom answered the walk honestly for him: mostly getting_there, a few not_yet. She taps "See the firsts" on his page and reads "Sam's firsts will land here. The first time you tell me Sam did something, it gets a line here with the date and your own words." She has told Homa about Sam repeatedly, and honestly; the page tells her she has not, and the reason it is empty is that her answers were honest. She then uses the kid switcher, which this plan wires to keep the surface (apps/web/lib/view-context.ts:60-81 change), and lands on her 7-year-old's page of 36 firsts. No number is rendered and the comparison is complete, which is the structural hazard the spec itself raises against the kid pill (§7 D7).

**Fix.** Suppress FIRSTS_DOOR when the ledger yields no qualifying rows; the door is computable from the same read. Rewrite the empty body so it never asserts she has said nothing. And do not register this surface in kidSwitchTargetPath: send a kid switch from the firsts page to that child's Progress page instead, so swapping children never lands one keepsake list directly on top of another.

### [SERIOUS] Rendering `statement` verbatim turns most rows into curriculum labels, so the keepsake reads as a coverage checklist with dates rather than a receipt.

**Evidence.** For taxonomy items `statement` is the topic NAME, not a parent-observable sentence: `statement: topic.name` (packages/core/src/map/scorable.ts:45). Real names include "Persuasive Writing", "Research & Source Evaluation", "Discovering Tutankhamun's Tomb", "Planning, Revising and Editing Writing" (packages/taxonomy/data/topics.json, 1,721 topics against 225 bank items). The journal and conversation extraction catalog passes all of them to the model (apps/web/lib/child-progress/skill-catalog.ts:39-46), so the rows carrying the mother's own quotes are the rows most likely to be taxonomy topics. Concrete: mom writes "Ivy spent the whole afternoon arguing in writing about why we should get a dog and I could not stop laughing." The keepsake row renders as chip "First time", date "Mar 3, 2026", statement "Persuasive Writing", with her sentence collapsed inside a `<details>`. A page of those is the coverage view the spec shelves. The plan's stated reason for not conjugating (past tense cannot be derived without a model) does not apply, because nothing needs conjugating if the row leads with the sentence the ledger already stores.

**Fix.** Lead each row with the parent's own quote when one exists; that is the receipt, and hiding it behind progressive disclosure inverts the page's purpose. Move the catalog statement into the disclosure as the ability Homa matched it to. For quote-less rows, do not render a bare taxonomy topic name under a "First time" chip.

### [SERIOUS] `firstsMeta` reuses `progressSourceLabel`, so the receipt line on a keepsake reads in check-in vocabulary, and a correction-founded first's entire provenance is a form edit.

**Evidence.** progressSourceLabel returns "Onboarding", "Correction", "Report correction", "Earlier progress answer" (apps/web/lib/child-progress/view-copy.ts:78-109), and corrections write `quote: null` (apps/web/lib/child-progress/progress-service.ts:865). Concrete: a mother mis-tapped getting_there on the report, fixes it to easily three weeks later through receipts-list.tsx:82. That correction row is now the only `easily` row on the item, so it founds the first. Her son's row reads "First time · Jul 3, 2026 · Counts past 20 without getting stuck", meta "Sarah · Report correction · Jul 3, 2026", and the provenance body says "This came from a correction you made on the report. There are no words saved with it." The plan defines a warm `firstsSourceNoun` and then does not use it on the line a parent actually reads.

**Fix.** Use `firstsSourceNoun` in metaLine and keep `progressSourceLabel` off this surface entirely. Let a correction-sourced row found a first only when no other `easily` row exists for the item, and when it does, date and describe it as what it is rather than as an observed first.

### [FATAL] The correction fence never fires for the most common correction shape. `deriveChildFirsts` step 5 drops a first only when the founding row is superseded AND the item carries an active `correction`/`report_correction` row, but the live "remove this answer" path supersedes without ever appending a row, so the retracted first stays on the page forever.

**Evidence.** apps/web/lib/child-progress/legacy-adapters.ts:309-317 sends `changes: [{ itemId, answer: null }], source: "correction"`; apps/web/lib/child-progress/progress-service.ts:801-818 supersedes every active row for the item at or before the cutoff, then :829-835 hits `if (change.answer === null) { ... continue; }` and appends NO evidence row. Same shape for undo (progress-service.ts:1018-1023), batch undo (:1169-1175) and walk coverage answers (:1376-1382). The path is live and parent-reachable: apps/web/app/api/map/answer/route.ts:175 calls `deleteAnswerWithProgressStatus`. Failing scenario: mother taps undo on the March 3 "easily" for math.counts-to-10 (mis-tap, or "he cannot actually do that" expressed as a removal). Row F gets `superseded_at`; no correction-sourced row exists; `correctedItemIds` is empty; the firsts page still renders "First time / Mar 3, 2026 / Counts out loud to 10 without skipping numbers" with her quote under it, permanently, for an ability she removed and which no longer lights on Progress or the map.

**Fix.** Stop keying on source. Drop the item when the founding row is superseded and the item has no active (`supersededAt === null`) `easily` row at all. That covers delete-corrections, undo, batch undo and walk coverage, and it still leaves legacy reconciliation churn alone because those items retain an active row. Add fixtures for each of the four supersession-without-append paths, not just `correction`.

### [SERIOUS] A row the family explicitly resolved AGAINST still founds a first. Conflict resolution never supersedes the losing evidence, so once the conflict closes the loser is active, unsuperseded, and not in an open conflict, which is exactly the plan's candidate test.

**Evidence.** apps/web/lib/child-progress/check-in-service.ts:1002-1010 calls `transaction.resolveProgressConflict` and nothing else; `grep -n supersedeEvidence apps/web/lib/child-progress/check-in-service.ts` returns nothing, so neither side is ever superseded. apps/web/lib/child-progress/effective-evidence.ts:296-339 handles this by *selecting* the resolved winner at read time, machinery the plan deliberately bypasses. The plan's firsts.ts step 1 only collects `conflict.state === "open"`, and its own test list encodes the bug: "the item reappears once the conflict is resolved". Failing scenario: dad reports `easily` on math.counts-to-100 March 3, mom reports `not_yet` March 3, a conflict opens, mom resolves it as `not_yet`. Dad's `easily` row is active and unsuperseded. It is the minimum by observedAt, so the firsts page renders "First time / Mar 3, 2026 / Counts to 100, by ones or by tens" attributed to dad, for an observation the household settled did not happen.

**Fix.** Exclude any row that lost a resolved conflict: for every `conflict.state === "resolved"`, add whichever of `evidenceIdA`/`evidenceIdB` is not `resolvedEvidenceId` to a `losingEvidenceIds` set and filter candidates on it, alongside the open-conflict set. Add a test: resolved-as-not_yet leaves the item off the page entirely; resolved-as-easily keeps it.

### [SERIOUS] The provenance body renders stored quotes verbatim and whole with no content gate, on the first parent-facing surface ever to render them. Nothing in the write path prevents a quote from naming a sibling or carrying a deficit clause, so a celebration page can render a sibling comparison in the mother's own words.

**Evidence.** apps/web/lib/child-progress/claim-extraction.ts:36 allows a model-chosen span of up to 400 characters; the system prompt at :79-96 constrains provenance and roster membership only, saying nothing about other children appearing inside the span. apps/web/lib/child-progress/claim-validation.ts:143-190 checks catalog membership, family membership, verbatim presence, age plausibility and the confidence cap, and nothing about quote content. Today `quote` reaches a human only in the founder console (apps/web/app/admin/families/[familyId]/progress/page.tsx:133-134); `ProgressTopicView` carries no quote (apps/web/lib/child-progress/types.ts:344-386), so this tranche is the first parent-facing render. The codebase already knows the hazard: the matcher path cuts a clause at an embedded non-child actor token (apps/web/lib/child-progress/journal-matcher.ts:319-338), a guard the claims path has no equivalent of. Failing scenario: mother texts "Ava read the whole page by herself, which Ben still can't do." The model's high-confidence `easily` claim for Ava quotes the whole sentence (it is the span that backs the claim, and it passes `quoteAppearsIn`). Ava's firsts page renders it whole under "Sarah's own words", naming a sibling with a can't-clause, on a page the plan says nothing ever leaves. The plan explicitly forecloses the only mitigation it names: "The quote is rendered whole, never truncated."

**Fix.** Gate the quote before render, model-proposes/code-verifies: pass the roster plus the stored quote to a judgment step that returns a safe verbatim sub-span, then verify in code that the returned span appears verbatim in the stored quote and contains none of the family's other children's names. Drop to `firstsNoQuote` when the check fails, never soften. Cheaper interim: render a quote only when it contains no other roster child's name (a deterministic membership check over known ids, not a meaning judgment), which is the same class of security floor as `scanMemoryContent`.

### [SERIOUS] `row.provenance.statement` is a bare noun-phrase topic label for 86% of the catalog, so "First time" plus "Every line is something Noah did" renders as a curriculum label attributed as an act the child performed.

**Evidence.** packages/core/src/map/scorable.ts:45 sets `statement: topic.name` for every taxonomy topic; `npx tsx -e "taxonomyScorableItems().length"` returns 1412 against 225 bank items. Real values: `mt_e8CZ7E5qW7 :: Number bonds to 9`, `mt_LH714Riydn :: Knowing What You Don't Know`, `computer_science.ai-in-daily-life :: AI in Daily Life`. apps/web/lib/child-progress/skill-catalog.ts:41-49 puts all 1,412 in front of the extraction model, so journal and lesson_listen claims routinely write these ids. Bank statements are fine (`packages/core/src/map/content.ts:211` "Counts out loud to 10 without skipping numbers"); taxonomy ones are not. Failing render: "First time / Mar 3, 2026 / Knowing What You Don't Know" under `firstsIntro` "Every line is something Noah did, with the day you told me about it." That is not a receipt naming an act, and the plan rules out the fix in advance ("never re-conjugated", "There is deliberately no 'the first time Noah sounded out...' sentence anywhere").

**Fix.** Either restrict the firsts page to rows whose `itemId` resolves through `getMapItem` (bank statements only) and say so, or add a one-time authored past-tense line per topic and render only rows that have one. Do not ship the raw `topic.name`. Whichever way it goes, the test fixtures must include at least one `mt_`-style taxonomy id, because bank-only fixtures will never surface this.

### [SERIOUS] The page's own copy promises a permanence the same module breaks in two places. `firstsIntro` says "Nothing here ever changes or goes away" and `firstsEmptyBody` says "Nothing ever leaves this page", while `deriveChildFirsts` removes rows on an open conflict and removes items on a correction.

**Evidence.** The plan's firsts-copy.ts strings, against its own firsts.ts step 1 (open-conflict rows are skipped) and step 5 (corrected items are dropped), and its own risks entry: "This is the only case where a row leaves and returns." Failing scenario: mother corrects one ability on Tuesday; on Wednesday the line is gone and the sentence directly above the gap still says nothing here ever goes away. Second scenario, same copy: a second adult disagrees about one observation, a conflict opens, and that first silently vanishes until someone resolves it, with the page still promising permanence. This is a false sentence on the one surface whose stated law is that every sentence names something that already happened.

**Fix.** Either weaken the promise to what the derivation actually guarantees ("A day you told me about does not stop being true because something changed later") or keep the row and mark its state, so the promise stays literally true. Add a copy test that fails if any exported string asserts permanence while `deriveChildFirsts` retains any removal branch.

