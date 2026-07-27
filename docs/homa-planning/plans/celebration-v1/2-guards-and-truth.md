# Guards and truth: coverage-is-not-ability, corrections, the comparative question, measurement

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

Revised after three skeptics. The original plan shipped a correction path that could not reach the abilities it was built to correct, a copy line that contradicted the screen beside it, an event that could not typecheck, and a threshold that re-created a ranked label the founder removed four days ago. Four guards remain, rebuilt. (1) Coverage is not ability: `AbilitiesSky` gains `reported`, and one single-shape clause travels with the count on the abilities card only. The stat-tiles clause is cut entirely (its number is a checklist answer count from a stored report snapshot, a different catalog and a staler value than `sky.reported`), and the live gold "Ahead of age" tile comes off the per-kid page instead. (2) Correction and regression: a contested ability becomes a visible `contested` star rather than a deleted node, which fixes a live silent count drop, keeps the item addressable, and makes `correct_ability` reach it; `AbilityNode` gains `impliedBy` so the implied-correction receipt names a real source and date instead of a model's memory; `isNew` stops counting `not_yet` and `contested`, so a correction no longer mints "1 new star since last week"; `correct_ability` is a batch action carrying a model-proposed quote that code re-checks verbatim, and the adapter handles the whole result union. (3) The comparative question and the correction move go BELOW the phone-persona split, because voice has four tools and none of them writes to a map; voice gets a two-sentence variant in the boundary file that binds hardest. (4) The instrument ships with a census join that makes its rate a rate, and the offer-declines kill condition is cut because `conversation.reply_resolved` carries nothing to join a letter on.

## Files

### `apps/web/lib/child-progress/abilities.ts` (modify)

**Purpose.** Three changes, each closing a way the map lies: a contested ability becomes a visible state instead of vanishing, an implied ability remembers what implied it, and the derivation accepts the contested set.

1. ADD to `AbilityState` (line 36-43), after `"implied"`:
```ts
  /** Two adults answered this one differently. Never confirmed, never
   *  implied, never offered as ready, and never removed: a node that
   *  disappears is a count that falls under a card promising it only
   *  ever counts up. */
  | "contested"
```

2. ADD to `AbilityNode` (line 45-54):
```ts
  /** For an implied node only: the reported ability whose hard closure
   *  lit this one, so a correction receipt can name a real source with
   *  a real date. Earliest observedAt wins, ties broken by itemId, so
   *  it is stable across reads. NOT a first: `observedAt` above stays
   *  null for implied nodes and the firsts page never reads this. */
  impliedBy: { itemId: string; statement: string; observedAt: string } | null;
```
Set `impliedBy: null` on every reported node pushed at lines 168-175.

3. Change the signature (line 114-117) to:
```ts
export function deriveAbilityMap(
  evidence: readonly AbilityEvidenceInput[],
  ageMonths: number,
  contestedItemIds: readonly string[] = [],
): SubjectAbilityMap[]
```
At the top of the body: `const contested = new Set(contestedItemIds);`

4. Record the closure source. Replace the confirmed-set loop (lines 127-136) with one that also fills a `Map<string, AbilityEvidenceInput>` named `impliedSource`, keyed by the implied topic id, keeping the entry with the earliest `observedAt` (tie broken by `itemId.localeCompare`). The loop already holds both `itemId` and `entry`; nothing new is queried.

5. After the explicit-beats-implied loop (lines 137-139), add:
```ts
  // A topic two adults disagree about is not a demonstrated ability and
  // must not be re-lit through the back door. Effective evidence drops
  // an open-conflict item entirely (effective-evidence.ts:296-297), so
  // without this the item leaves `explicit`, the graph re-adds it via a
  // mastered topic's closure, and the answer she just contested comes
  // back as a dimmer star.
  for (const itemId of contested) confirmed.delete(itemId);
```

6. In the implied loop (lines 182-196) skip contested ids (`if (explicit.has(topicId) || contested.has(topicId)) continue;`) and set `impliedBy` from `impliedSource.get(topicId) ?? null`, mapped to `{ itemId, statement: getScorableItem(...)?.item.statement, observedAt }`; drop the node's `impliedBy` to null if the source id does not resolve in the catalog.

7. AFTER the implied loop, push contested nodes:
```ts
  // A contested ability stays on the map in its own state. Deleting it
  // would drop `lit` by one with nothing anywhere saying why, under a
  // card whose intro line promises the map only counts up, and it
  // would make the item unaddressable by the correction path. It also
  // fixes a live drop: an open conflict on an item no closure covers
  // already removes its node today.
  for (const itemId of contested) {
    if (explicit.has(itemId)) continue;
    const found = getScorableItem(itemId);
    if (!found) continue;
    const subject = subjectMap(found.subject.id);
    subject.nodes.push({
      itemId,
      statement: found.item.statement,
      subjectId: found.subject.id,
      typicalMonths: found.item.typicalMonths,
      state: "contested",
      observedAt: null,
      impliedBy: null,
    });
    subject.contested += 1;
  }
```
Add `contested: number` to `SubjectAbilityMap` (interface at line 70-84), initialised to 0 in `subjectMap`. Do NOT add it to the subject sort key at lines 245-249; a contested item is not evidence of a busy subject.

8. In the ready-next loop (line 201-231) add `if (contested.has(ready.topic.id)) continue;` beside the existing `if (explicitEntry) continue;`, so a contested ability is never offered back as ready.

9. Extend the module docblock's semantics list (lines 23-33) with a fourth bullet: a contested topic is neither confirmed, implied, nor ready, it is its own state, and it is never removed.

Verified true today and unchanged: an explicit non-easily answer keeps a node dark at lines 137-139, and line 183 skips anything in `explicit`, so the spec's "no new mechanic" claim (line 373) holds for a same-adult correction. It failed only for the contested case.

### `apps/web/lib/child-progress/abilities-view.ts` (modify)

**Purpose.** Carry the number the coverage clause is about, and stop counting a walk-back as this week's new star.

1. Add `reported: number` to `SubjectSky` (beside `lit`, line 59) and to `AbilitiesSky` (beside `lit`, line 65), with this comment on the interface field:
```ts
  /** Nodes this parent actually reported, implied ones excluded. The
   *  count the coverage clause names: a mother controls how much she
   *  has told Homa, never how much the graph inferred. A contested
   *  node counts, because she reported it twice, differently. */
  reported: number;
```
Compute per subject inside the `map.map` at lines 182-209 as `reported: stars.filter((star) => star.state !== "implied").length`, and at the top level (line 213) as `reported: subjects.reduce((total, subject) => total + subject.reported, 0)`.

2. FIX THE LIVE HAZARD THIS TRANCHE CREATES. `isNew` (lines 111-116) is state-blind and `newThisWeek` (line 207) counts every `isNew` star, while `abilities.ts:174` stamps `observedAt` on EVERY explicit node including `not_yet`. So a correction or a regression dated today mints a new star: `abilities-card.tsx:148-149` renders "1 new star since last week." in sage, and `:140` renders "· 1 new this week", for the ability she just took away. Change the signature to `isNew(observedAt: string | null, state: AbilityState, now: Date)` and return false immediately for `not_yet` and `contested`:
```ts
function isNew(
  observedAt: string | null,
  state: AbilityState,
  now: Date,
): boolean {
  // A star that went out is not a star that lit. A correction and a
  // regression both write an explicit not_yet dated today, so without
  // this the ability a mother just took back is celebrated in sage as
  // this week's win, on the card, the same week.
  if (state === "not_yet" || state === "contested") return false;
  if (observedAt === null) return false;
  ...unchanged...
}
```
Update the one call site in `toStar` (line 165) to `isNew(node.observedAt, node.state, now)`.

3. Extend the module docblock's NO DENOMINATORS paragraph (lines 19-25) with one sentence: `reported` is never a denominator for `lit`, nothing computes a ratio of the two, and the existing catalog-size walk (abilities-view.test.ts:104-133) already fails any number over 1000 or any key matching /percent|ratio|denominator/.

NOT changed: `AbilityStar` does not gain `impliedBy`. The sky is the client payload and the implied source is server-side receipt material only; putting a second dated statement into the payload would give the client a second date to render beside a star that must never carry one.

### `apps/web/lib/child-progress/abilities-copy.ts` (modify)

**Purpose.** One coverage clause with one shape, the contested state's words, and correction copy that is true on the screen it describes.

1. The coverage clause, added after `abilitiesCount` (line 32-36). ONE shape at every count. No threshold:
```ts
/**
 * What the count measures, in one clause, with Homa as the actor.
 *
 * Deliberately one shape at every number. A threshold ("a young map"
 * under twelve, otherwise not) is a binary class assignment rendered
 * on one child's page one tap from the sibling switcher, built out of
 * the exact quantity founder ruling `kid-standing-chip` (2026-07-22)
 * found to be systematically backwards: in production, family
 * a64e1ba5's 12-year-old has 10 easily answers beside a 7-year-old's
 * 36, because age bands ask older children harder questions while
 * implied closure pushes the other way. "Young" would land on the
 * older child. One shape cannot be compared because there is nothing
 * to compare.
 */
export function abilitiesCoverageClause(
  childName: string,
  reported: number,
): string {
  const things = reported === 1 ? "one thing" : `${reported} things`;
  return (
    `${childName}'s map is built from the ${things} you have told me ` +
    "so far. Each one you add lights more of it."
  );
}
```
Exact strings: `"Sam's map is built from the one thing you have told me so far. Each one you add lights more of it."` and `"Ivy's map is built from the 41 things you have told me so far. Each one you add lights more of it."`

2. The contested state's words. Add to `abilityStateLabel` (line 70-81) `case "contested": return "Answered two ways";` and to `abilityStateBody` (line 95-115):
```ts
    case "contested":
      return (
        "Two adults answered this one differently. Both answers are " +
        "kept, and nothing is settled until you choose."
      );
```
Insert `abilityStateLabel("contested")` into `ABILITIES_LEGEND` (line 86-92) between `not_yet` and `implied`. The wording follows the projection's existing conflict sentence (projection.ts:281-282) so one disagreement is described the same way on both surfaces.

3. The correction and regression receipts. These say what actually happens, which is a state change, not a removal. "Off the map" is false: `abilities.ts:163-179` pushes an explicit `not_yet` as a node, `abilities-card.tsx:89-91` draws it as a stone-ringed circle, `abilities-view.ts:206` counts it in `lit`, and tapping it renders `abilityStateBody("not_yet")`, which says in Homa's own voice "This one stays on the map".
```ts
/**
 * The two shapes of "that is not right", which are not the same thing.
 * A CORRECTION says the ability was never demonstrated, so the star
 * goes to not yet and its first, if it had one, goes with it. A
 * REGRESSION says it was true and is not true today, so the star goes
 * to not yet and the first stays, because that day happened.
 *
 * Neither string says "off the map", because nothing leaves the map.
 * The node stays, in an honest state, which is what the map's own
 * popover already tells her when she taps it.
 */
export function abilityCorrectedImplied(
  childName: string,
  statement: string,
  impliedByStatement: string,
  impliedByDate: string,
): string {
  return (
    "Thank you, that is exactly the kind of thing I get wrong. I have " +
    `moved "${statement}" to not yet on ${childName}'s map. It was ` +
    `there because you told me about "${impliedByStatement}" on ` +
    `${impliedByDate}, and the map filled this one in underneath it. ` +
    "Filling it in is not the same as watching them do it."
  );
}

export function abilityCorrectedReported(
  childName: string,
  statement: string,
): string {
  return (
    "Thank you, that is exactly the kind of thing I get wrong. I have " +
    `moved "${statement}" to not yet on ${childName}'s map, and taken ` +
    "it off their list of firsts, because that one was mine and not " +
    "theirs."
  );
}

export function abilityRegressed(
  childName: string,
  statement: string,
  firstDate: string,
): string {
  return (
    "I have written that down as it is today. The day " +
    `${childName} first did "${statement}" is still on their list of ` +
    `firsts, ${firstDate}, because that day happened. Do you want a ` +
    "small way back in, or leave it for now?"
  );
}
```
`abilityCorrectedImplied` may only be called with an `impliedBy` that came off the node (abilities.ts, new field). It has no defaultable parameter on purpose: a caller with no source cannot reach this string and must use `abilityCorrectedReported`.

No em dash anywhere. Sentence case. The child is "they" unless the caller supplies parent-gendered copy, matching instructions.md:39-42.

### `apps/web/components/progress/abilities-card.tsx` (modify)

**Purpose.** Render the clause where the count renders, and give the contested star a mark of its own.

1. Import `abilitiesCoverageClause` alongside the existing copy imports (lines 2-10), at the top of the file.

2. In the non-empty branch, replace the bare count paragraph at lines 139-141 with:
```tsx
        <div className="min-w-0 sm:max-w-[18rem] sm:text-right">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-subtle">
            {abilitiesCount(sky.lit, sky.newThisWeek)}
          </p>
          {/* A count of abilities is a count of what she has told Homa,
              and older children get harder questions, so the bare
              number across two children is not merely unkind, it is
              wrong. The clause travels with the number, always. */}
          <p className="mt-1 text-xs leading-snug text-muted">
            {abilitiesCoverageClause(childName, sky.reported)}
          </p>
        </div>
```
The two numbers differ by construction (`lit` includes implied, `reported` does not), so the clause names its own number in words ("the 3 things you have told me") while the headline names abilities. The read "3 of 38" is available to a determined reader; the alternative, dropping the headline count, deletes the surface's own ruled copy (`abilitiesCount`, `abilities-map-v1`) and is a bigger change than this tranche should make unilaterally. Flag it to the founder rather than choosing silently; see risks.

3. `starFill` (line 26-37) gains `case "contested": return "var(--stone-300)";` and the `boxShadow` expression at lines 88-91 becomes `star.state === "not_yet" || star.state === "contested" ? "inset 0 0 0 1px var(--stone-400)" : undefined`. `starOpacity` (line 39-43) returns 0.7 for `"contested"`, keeping implied at 0.65 and everything else at 1. A contested star is visibly present and visibly unsettled, which is the honest render.

4. The empty branch (lines 109-123) renders no count and therefore no clause; leave it exactly as it is. `abilitiesNewStars` at line 149 is week-scoped and sits inside the same card, so it takes no second clause: one clause per surface, adjacent to the standing count.

5. Extend the component docblock (lines 12-24) with one sentence naming the law: the count travels with a clause saying what it measures, and any future surface rendering `sky.lit` or `SubjectSky.lit` owes the same clause, fed from the same `sky.reported` and never from a report snapshot.

### `apps/web/lib/child-progress/abilities-from-view.ts` (modify)

**Purpose.** Feed the derivation the contested ids the view already knows about.

In `abilitiesSkyFromView` (lines 46-59), change the derivation call to:
```ts
  const map = deriveAbilityMap(
    abilityEvidenceFromView(view),
    ageMonths,
    view.conflicts.map((conflict) => conflict.itemId),
  );
```
`ChildProgressView.conflicts` is `OpenProgressConflictView[]` (types.ts:334-343, :415), which is exactly the set whose topic view carries `answer: null, state: "conflict"` (projection.ts:276-278) and which `abilityEvidenceFromView` already skips at line 30.

Extend the docblock's last paragraph (lines 18-21): skipping conflicted topics from the evidence is not enough on its own, because the graph would re-imply them, so the ids also go to the derivation as contested, where they become their own state rather than disappearing.

### `apps/web/components/dashboard/stat-tiles.tsx` (modify)

**Purpose.** Remove the live gold ranked whole-child tile from the per-kid page. Do NOT put the abilities clause here.

REMOVED from the original plan: the abilities coverage clause does not go on this component. `observations` (line 27) sums `report.scores.observationCount`, defined at packages/core/src/map/scoring.ts:310 over CHECKLIST answers inside a stored `child_reports` snapshot (apps/web/lib/dashboard.ts loads them), which is a different catalog and a staler value than `sky.reported`. Attaching the sentence "the N things you have told me so far" to it would put two different numbers under one claim about the same child on the same day: /app/kids/[childId] saying 34, /app/progress saying 15. A clause that exists to make a number honest cannot ship over two numbers. Leave the "Your answers" tile's `sub` as `"every answer sharpens the picture"`. No `childName` prop.

WHAT THIS TRANCHE DOES CHANGE: delete the `else if (aheadCount > 0)` branch (lines 60-66) and its `aheadCount` computation (lines 28-34), so the third tile falls through to the existing "Reports" tile. That branch renders a gold tile labelled "Ahead of age" with the child's own count and the sub-caption `"${n} subjects across the family ✦"`. On the per-kid page it is called with `kidCount={1}` and a single report (app/app/kids/[childId]/kid-view.tsx:109), directly beneath the sibling switcher at kid-view.tsx:85-106, so a mother of two reaches gold on one child and nothing on the other, one tap apart. That is the structural hazard founder ruling `kid-standing-chip` (2026-07-22) names in its own words, and the caption is additionally false on a single-child page, where "across the family" describes one child. The ruling's text scopes itself to `kid-pill.tsx`; this extends it by analogy, so say so in the PR body rather than treating it as covered.

Update the component docblock (lines 3-9) to drop "ahead" from the list of what the tiles count.

### `apps/web/lib/child-progress/progress-service.ts` (modify)

**Purpose.** A correction row carries no quote today, so a correction traces to nothing. Give it provenance without touching the payload hash.

1. Extend `CorrectProgressAnswersInput` (lines 138-147) with fields the ledger column already has room for:
```ts
  /** The parent's own words for this correction, already re-checked
   *  verbatim against the authenticated inbound message by the caller.
   *  Null for the report page's inline correction, which is a tap. */
  quote?: string | null;
  channel?: ProgressCheckInChannel | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  /** What the map said before she took it back, for the celebration
   *  census only. Optional because the report page's inline path does
   *  not derive a sky; the event field is nullable to match. */
  contestedState?: "mastered" | "emerging" | "implied" | null;
```

2. In `correctProgressAnswers`, replace the hardcoded provenance in the `appendEvidenceWrite` call (lines 865-868) with `quote: input.quote ?? null, channel: input.channel ?? null, messageId: input.messageId ?? null, providerMessageId: input.providerMessageId ?? null`.

3. DO NOT change `hashChildProgressOperationPayload` (lines 701-708). The original plan added the four new fields to it; that is wrong twice over. It fixes nothing, because the idempotency key already includes `providerMessageId` (tool-contract.ts:289-309), so two corrections from two different messages already get different keys. And it regresses: a receipt written before the deploy carries a hash computed without the quote, so the same replayed call after the deploy computes a different hash and `claim.receipt.payloadHash !== payloadHash` returns `idempotency_mismatch` (lines 733-735) for a correction that already committed.

The DB accepts all of this unchanged: `child_progress_evidence` already has `quote text` with a `char_length <= 500` check, plus `channel`, `message_id`, `provider_message_id`, and `'correction'` is already in the source check constraint (supabase/migrations/20260711213330_agent_led_live_progress.sql). NO MIGRATION.

Bounding is NOT done here and NOT by truncation. `validateProgressEvidenceWrite` (lines 388-395) throws `TypeError("Progress evidence quote cannot exceed 500 characters")`, and `withCommittedProgressEvents` (progress-events.ts:654-665) awaits the operation outside its try, so the throw escapes and the whole correction is lost. The caller supplies a model-proposed quote capped at 400 by schema and re-checked verbatim against the inbound text, which satisfies the 500 ceiling structurally. See tool-contract.ts below.

### `apps/web/lib/child-progress/claim-validation.ts` (modify)

**Purpose.** Export the provenance check so the correction path uses the same one the journal path uses.

Change `function quoteAppearsIn` (line 108) to `export function quoteAppearsIn`. It collapses whitespace and lower-cases both sides, so the model may trim and re-case but never invent. Nothing else in the file changes. One check, one definition, used by both writers of evidence quotes.

### `apps/web/lib/child-progress/tool-contract.ts` (modify)

**Purpose.** There is no correction action on the model-facing boundary today, so "he cannot actually do that" in chat writes nothing. Add the narrowest one, as a batch.

1. Add `"correct_ability"` to the published action enum (lines 47-58) and two optional fields to the published object schema: `itemIds: z.array(z.string()).optional()` and `quote: z.string().optional()`.

2. Add to the discriminated union (after `resolve_conflict`, ending line 141):
```ts
    z
      .object({
        action: z.literal("correct_ability"),
        childId: childIdSchema,
        /** A batch, not a single item, because the idempotency key is
         *  derived per action per turn (progressOperationIdempotencyKey,
         *  below): a second correct_ability in one message claims the
         *  same key with a different payload hash and returns
         *  idempotency_mismatch, so "he can't count past ten, and he
         *  can't write his name either" would land one correction and
         *  silently lose the other. `changes` is already an array in
         *  the service, so one call is one operation and one undo. */
        items: z
          .array(
            z
              .object({
                itemId: z.string().trim().min(1).max(120),
                /** not_yet retires the star; getting_there says she
                 *  overstated it rather than invented it. "easily" is
                 *  deliberately absent: this action only takes down. */
                answer: z.enum(["getting_there", "not_yet"]),
              })
              .strict(),
          )
          .min(1)
          .max(6),
        /** The parent's own words, copied EXACTLY from her message.
         *  Code re-checks it against the authenticated inbound text and
         *  refuses the whole command if it is not there. 400 keeps it
         *  under the ledger's 500-character ceiling, which throws
         *  rather than truncating (progress-service.ts:388-395), and
         *  matches claim-extraction.ts:36. */
        quote: z.string().trim().min(1).max(400),
      })
      .strict(),
```

The model decides which abilities she means, how strong the walk-back is, and which of her words back it. Code decides everything else: the items exist in the catalog (`getMapItem`, progress-service.ts:693), each is currently a star on THIS child's derived map, the child is in the authenticated family (`loadProjectionInputForUpdate`, progress-service.ts:719-723), and the quote is verbatim in the authenticated inbound text.

### `apps/web/lib/child-progress/tool-operations.ts` (modify)

**Purpose.** Declare the operation the adapter calls.

Add to `ChildProgressToolOperations` (interface opens at line 16), in the same shape as `recordJournalEvidence` (lines 61-76):
```ts
  correctAbility(
    context: ProgressCheckInContext,
    input: {
      childId: string;
      items: ReadonlyArray<{
        itemId: string;
        answer: "getting_there" | "not_yet";
      }>;
      quote: string;
      contestedState: "mastered" | "emerging" | "implied" | null;
      idempotencyKey: string;
    },
  ): Promise<CorrectProgressAnswersResult>;
```

### `apps/web/lib/child-progress/tool-result-adapter.ts` (modify)

**Purpose.** Handle the whole correction result union, the way the three adapters beside it already do.

Add a fourth exported adapter, matching `adaptJournalResult`'s shape exactly (lines 121-181):
```ts
export async function adaptCorrectionResult(input: {
  result: CorrectProgressAnswersResult;
  context: ProgressCheckInContext;
  childId: string;
  operations: ChildProgressToolOperations;
}): Promise<ManageChildProgressResult> {
  const { result } = input;
  switch (result.status) {
    case "answers_corrected":
      return progressUpdateResult({
        context: input.context,
        childId: input.childId,
        affectedItemIds: result.affectedItemIds,
        undoToken: result.operationId,
        operations: input.operations,
      });
    // The other adult already answered this one, so the disagreement is
    // the real answer and the conflict card is where it belongs. A flat
    // refusal here would be the common case, not the edge: a contested
    // item is exactly the shape a correction arrives about.
    case "conflict_pending":
      return progressConflictViewResult({
        context: input.context,
        childId: input.childId,
        conflictId: result.conflictId,
        operations: input.operations,
      });
    // The write already committed. Telling her it failed would send her
    // to correct it again.
    case "duplicate":
      return adaptCorrectionResult({ ...input, result: result.original });
    case "unknown_child":
    case "unknown_actor":
    case "unknown_item":
    case "idempotency_mismatch":
      return refusedProgressResult();
    default: {
      const exhaustiveResult: never = result;
      return exhaustiveResult;
    }
  }
}
```
Import `CorrectProgressAnswersResult` as a type from ./progress-service at the top of the file, beside the existing type imports (lines 1-4). `progressConflictViewResult`, `progressUpdateResult`, and `refusedProgressResult` are already imported (lines 12-20).

NOTE, and it is why the original plan was wrong here: `result.status !== "answers_corrected" -> refusedProgressResult()` collapses a committed write and a real conflict into a lie. Every sibling adapter in this file recurses on `duplicate` (lines 82-83, 170-171, 197-201) and routes `conflict_pending` to the conflict view (lines 84-104, 163-169).

### `apps/web/lib/child-progress/tool-adapter.ts` (modify)

**Purpose.** Route the command, verify the items are really stars on this child's map, verify the quote is really hers, and pass the pre-write state to the census.

1. In the inbound-text guard (lines 68-79) add `command.action === "correct_ability"` to the set that refuses when `context.canonicalInboundText === null || context.inboundMessageId === null`. A correction with no message to trace to is not a receipt.

2. Add the case in the switch (after `record_journal_evidence`, line 153-165):
```ts
    case "correct_ability": {
      // Provenance first: the model chose these words, code checks she
      // actually said them. A paraphrase is refused, never softened.
      if (
        !quoteAppearsIn(context.canonicalInboundText, command.quote)
      ) {
        return refusedProgressResult();
      }
      // Then existence: an ability that is not on this child's map
      // cannot be taken off it, and a foreign id resolves to nothing
      // because the view loads inside the authenticated family.
      const view = await operations.getChildProgressView(
        context.familyId,
        command.childId,
      );
      if (!view) return refusedProgressResult();
      const stars = new Map(
        abilitiesSkyFromView(view, new Date(context.now)).subjects
          .flatMap((subject) => subject.stars)
          .map((star) => [star.itemId, star.state] as const),
      );
      if (command.items.some((item) => !stars.has(item.itemId))) {
        return refusedProgressResult();
      }
      const priorState = stars.get(command.items[0].itemId);
      return adaptCorrectionResult({
        result: await operations.correctAbility(context, {
          childId: command.childId,
          items: command.items,
          quote: command.quote,
          contestedState:
            priorState === "mastered" ||
            priorState === "emerging" ||
            priorState === "implied"
              ? priorState
              : null,
          idempotencyKey,
        }),
        context,
        childId: command.childId,
        operations,
      });
    }
```
The star lookup now finds contested items too, because `deriveAbilityMap` pushes them as `contested` nodes rather than deleting them. Without that change this branch would refuse every correction about a contested ability, which is the case the tranche exists for.

3. The regression census. In `case "record_journal_evidence"` (lines 153-165), load the sky BEFORE calling the operation and pass the pre-write states through, so a journal `not_yet` on a previously lit ability can be counted as a regression:
```ts
    case "record_journal_evidence": {
      // The pre-write states, for the celebration census only. It has to
      // be read before the write: afterwards the item is not_yet and
      // there is no way to tell a regression from a first report of
      // "cannot do it". One extra view read on a path that already makes
      // a model call per message.
      const before = await operations.getChildProgressView(
        context.familyId,
        command.childId,
      );
      const priorStates = before
        ? new Map(
            abilitiesSkyFromView(before, new Date(context.now)).subjects
              .flatMap((subject) => subject.stars)
              .map((star) => [star.itemId, star.state] as const),
          )
        : new Map<string, AbilityState>();
      const result = await operations.recordJournalEvidence(context, {
        childId: command.childId,
        priorStates,
        idempotencyKey,
        ...(command.subjectId ? { subjectId: command.subjectId } : {}),
      });
      return adaptJournalResult({
        result,
        context,
        childId: command.childId,
        operations,
      });
    }
```
Add `priorStates: ReadonlyMap<string, AbilityState>` to `recordJournalEvidence`'s input in tool-operations.ts; `manage_child_progress.ts` forwards it to the runtime wrapper.

Imports at the top of the file, never inline: `abilitiesSkyFromView` from ./abilities-from-view, `quoteAppearsIn` from ./claim-validation, `adaptCorrectionResult` from ./tool-result-adapter, `type AbilityState` from ./abilities.

The channel guard at lines 51-63 already refuses `voice` and `dispatch`, so `correct_ability` is unreachable from the phone line by construction; the instructions change below stops Homa claiming otherwise there.

### `apps/web/agent/tools/manage_child_progress.ts` (modify)

**Purpose.** Wire the operation and tell the model when to reach for it.

Add to `childProgressOperations` (object at lines 33-116):
```ts
  correctAbility(context, input) {
    return correctProgressAnswers({
      familyId: context.familyId,
      childId: input.childId,
      memberUserId: context.memberUserId,
      source: "correction",
      changes: input.items.map((item) => ({
        itemId: item.itemId,
        answer: item.answer,
      })),
      // Never a delete. `change.answer === null` takes the delete branch
      // (progress-service.ts:827-835), which removes the row from
      // `explicit`, and the graph closure re-lights the item as implied
      // on the very next read. A correction always writes an explicit
      // answer.
      quote: input.quote,
      channel: writingChannel(context.channel),
      messageId: context.inboundMessageId,
      providerMessageId: context.providerMessageId,
      contestedState: input.contestedState,
      observedAt: context.now,
      idempotencyKey: input.idempotencyKey,
    });
  },
```
where `writingChannel` is a small local narrowing to `"web" | "sms" | "email" | null` (the adapter already refuses every other channel, so it is belt and braces, not logic). `correctProgressAnswers` is already exported from ../../lib/child-progress/runtime (runtime.ts:144-158); import it at the top of the file.

Extend the tool description (line 125) with one clause in its clipped idiom: `Use correct_ability only when the parent says specific abilities on the child's map are not true of them, naming the abilities she means and quoting her own words; it takes stars down and never puts one up.`

Do NOT add a regression action. A regression is her observation of today and `record_journal_evidence` already handles it: claim extraction's answer enum includes `not_yet` (claim-extraction.ts:30, rule at :52-55), the write appends rather than supersedes, and effective evidence then picks the later row by `observedAt` (effective-evidence.ts:200-212), which leaves the earlier `easily` row with `superseded_at` null and the firsts page untouched.

### `apps/web/lib/child-progress/runtime.ts` (modify)

**Purpose.** The only place celebration.correction_recorded can actually be emitted.

The original plan put this in `progressEventsForCorrectionResult` and in `tool-result-adapter.ts`. Neither works. `ProgressEventName` is `Extract<EventName, \`progress.${string}\`>` (progress-events.ts:28) and `ProgressEvent` is a mapped union over exactly that (:30-35), so a `celebration.*` entry does not typecheck; `emitProgressEvent` (:552 onward) is a closed per-name switch, so a name with no case emits nothing; and `progressEventsForJournalObservation` (:194-204) returns `[]` for every status except `no_match | activity_only | ambiguous`, that is, for every status where something was actually written.

1. In the `correctProgressAnswers` wrapper (lines 144-158), inside the existing `withCommittedProgressEvents` callback and after `emitProgressEvents(progressEventsForCorrectionResult(...))`, add a literal call:
```ts
      if (result.status === "answers_corrected") {
        for (const itemId of result.affectedItemIds) {
          await emitMapEvent("celebration.correction_recorded", {
            family_id: input.familyId,
            child_id: result.childId,
            contested_state: input.contestedState ?? null,
            kind: "correction",
            surface: surfaceForChannel(input.channel ?? null),
          });
        }
      }
```
`surfaceForChannel` is a local: web -> "chat", sms -> "sms", email -> "email", null -> "report" (the report page's inline correction passes no channel, legacy-adapters.ts:571-579).

2. In the `recordJournalProgressEvidence` wrapper (lines 103-114), after `emitEvidenceResultEvents(result)`, emit the regression side:
```ts
      if (result.status === "recorded") {
        for (const row of result.evidence) {
          const before = input.priorStates?.get(row.itemId);
          // A regression is a walk-back of something that was lit. A
          // not_yet on an ability nobody had claimed is a first report,
          // not a regression, and counting it would inflate the number
          // the founder page is told never to sum with corrections.
          if (row.answer !== "not_yet") continue;
          if (before !== "mastered" && before !== "emerging" &&
              before !== "implied") continue;
          await emitMapEvent("celebration.correction_recorded", {
            family_id: input.familyId,
            child_id: input.childId,
            contested_state: before,
            kind: "regression",
            surface: surfaceForChannel(input.channel ?? null),
          });
        }
      }
```
Add `priorStates?: ReadonlyMap<string, AbilityState>` to `RecordJournalProgressEvidenceInput` (progress-service.ts) as a non-persisted, analytics-only field; it must not enter `hashChildProgressOperationPayload` or any write.

Both calls are literal `emitMapEvent("celebration.correction_recorded", ...)` inside `apps/web/lib`, which is a `scripts/events-check.mts` ROOT (line 28-33) and matches its `EMIT_CALL` regex (line 50), so the registry-parity guard sees the emitter and the event does NOT need staging. Import `emitMapEvent` from ../map/events at the top of the file.

Wrap both loops so a failure cannot break the write: `withCommittedProgressEvents` already catches inside its callback (progress-events.ts:658-661), and `emitMapEvent` swallows its own errors.

### `apps/web/agent/instructions.md` (modify)

**Purpose.** Two always-on sections, both BELOW the phone-persona split, because voice cannot do what they describe.

CORRECTED FROM THE ORIGINAL PLAN. Both sections go BELOW `## What you know each turn` (line 65), not above it. `scripts/telnyx-provision.mts:364` splits the persona on that literal heading, so anything above it ships to the hosted Telnyx assistant, and that assistant has exactly four tools: send_email, remember, log_hours, send_signup_link (apps/web/agent/general-call-instructions.md:12-22; telnyx-provision.mts:349-351 says the port trims tools because "the hosted assistant has none of them"). `manage_child_progress` is not among them, and `tool-adapter.ts:51-63` refuses every channel outside web/sms/email anyway. Telling voice-Homa to "take the star down with correct_ability" produces exactly the fabrication class general-call-instructions.md:5-8 exists to stop. The comparative move has the same problem: its step 4 names "the one ability sitting open next", but ready_next reaches the agent only through `explore_child_map` (instructions.md:100-110, below the split), and `{{family_context}}` carries only "does easily" and "working edge" (apps/web/lib/family-context.ts:154-157). The phone rules also bind hardest and cap a turn at one or two sentences (telnyx-provision.mts:355-357, :368-375), so a five-part reply is unfollowable there by construction.

Section one, inserted after `## Multiple children` (line 379):

```
## When she asks how one child compares to another

Sometimes she asks it straight: "is Ben behind his sister?", "should he be
further along than her by now?". This is the most frightened question she
will ask you, and the answer is never the comparison. Do this, in one short
reply:

1. Name the worry once, plainly. "I hear the worry in that."
2. Say you are staying with the child she named, and then stay there.
3. One true, concrete thing that child does now, from their own map
   snapshot, in her words where you have them.
4. The one ability sitting open next for them, from explore_child_map's
   ready_next. If you have not looked it up, do not name one.
5. One small offer, a ten-minute way in. Then stop.

Never answer the comparison. Never repeat the word she used. Never say the
other child's name, and never reach for "his sister", "your other one", or
"the older one" instead. Never rank the two, in either direction, and never
reassure her by telling her the other child is unusual. If nothing is
confirmed yet for the child she named, say that plainly and offer that
three quick questions would light a good part of their map. Two children in
one house are two separate pictures, always.

This is not a rule against talking about two children. "Can Ben and Ivy do
this lesson together?" is an ordinary question and gets an ordinary answer.
```

Section two, inserted after `## Live progress and check-ins` (line 213, before `## Memory`):

```
## When she says an ability is not true

Two different sentences, and they are not the same thing.

"He cannot actually do that" says you were wrong. Thank her, call
correct_ability with the abilities she means and her own words as the
quote, and say where it came from: if the map filled it in underneath
something else she reported, name that thing and its date, and say plainly
that filling it in is not the same as watching a child do it. Say you have
moved it to not yet; do not say it is off the map, because it is not, it
stays there in an honest state. Never argue, never re-light it, never ask
her to prove it. If the other adult in the family answered that one
differently, you will get the disagreement card back instead: show it and
let her settle it, do not push past it.

"He used to read those and now he will not" says the child changed. That is
her observation of today, so record it the way you record any observation,
with record_journal_evidence. Say you have written it down as it is today,
and say that the day he first did it is still on his list of firsts,
because that day happened. Then ask, once, whether she wants a small way
back in or would rather leave it.

Either way you thank her and stop. A parent correcting you is the most
valuable thing that happens all week.
```

Why always-on and not a fleet skill, against AGENTS.md's placement table: both rules must apply before any skill can load and neither is a reusable procedure a better model improves. The hard part is a prohibition, and routing a comparative question through `load_skill` costs a turn at the moment she is most raw, with a routing miss being total (the model improvises, which is the failure being fixed). These sections cost roughly 45 lines of the second-scarcest surface in the product, and they now cost the phone persona nothing.

### `apps/web/agent/general-call-instructions.md` (modify)

**Purpose.** Voice gets the prohibition it can keep and a two-sentence move it can actually perform.

This file is appended AFTER the persona and after the phone rules (telnyx-provision.mts:355-357: "appended last so they bind hardest"), which is the only place a voice rule survives the one-or-two-sentence cap.

1. Add one bullet to the existing "What you cannot do on this call (binding)" list (lines 24-33):
```
- change, add to, or take anything off a child's map or their progress
  record, including taking down an ability she says is not true,
```
and extend the honest-path paragraph below it so the same shape applies: say you have not changed anything, and that the way to fix a map is in text or in the app, where the record can actually be written.

2. Add a new section at the end, matching the file's binding-heading idiom:
```
## When she compares one child to another (binding)

If she asks whether one child is behind another, or further along, do not
answer the comparison and do not say the other child's name. Two short
sentences, and then pass the ball back:

> "I hear the worry in that. Let me stay with Ben, he's doing [the thing
> the family context says he does easily] on his own now. Want me to text
> you a couple of easy ways into what's next for him?"

Only name something the family context in front of you actually says about
that child. You cannot look anything up on a call, so if it is not in front
of you, say you will look properly and text her, and leave it there. Never
say "behind", never rank the two children in either direction, and never
reassure her by describing the other child.
```
The named thing comes from the "does easily" line the voice context already carries (apps/web/lib/family-context.ts:154). There is deliberately no ready-next: voice has no `explore_child_map`.

### `packages/core/src/events.ts` (modify)

**Purpose.** Four typed events so the celebration system is measurable from the day the guards ship.

Add after the `conversation.*` block (which ends around line 767) so the celebration cluster reads together, with a prefix comment matching the file's idiom:
```ts
  // The celebration system's instrument (plan 2026-07-22, §5G), shipped
  // with the guards on purpose. Opens are counted over WEEKS, never
  // sends: a mother who opens one letter that week is engaged that
  // week, and a second open is not a second signal. No PII: child_id is
  // the subject and every name lives in the row it points at.
  "celebration.letter_opened": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      entry: z.enum(["email", "app"]),
    })
    .strict(),
  "celebration.letter_composed": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      // The deepest rung of the fallback chain the letter had to reach.
      // Three consecutive weeks at 5 or greater is the sameness fence.
      fallback_depth: z.number().int().min(1).max(7),
      named_worry_rail: z.boolean(),
      // True when a hard-day hold suppressed the send. A held letter is
      // never counted as an unopened one.
      held: z.boolean(),
    })
    .strict(),
  "celebration.letter_muted": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      scope: z.enum(["child", "family"]),
      state: z.enum(["muted", "unmuted"]),
    })
    .strict(),
  "celebration.correction_recorded": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      // What the map said before she took it back. "implied" is the one
      // that pauses R5 if it runs hot: the graph, not the parent, is
      // what would be wrong. Nullable because the report page's inline
      // correction does not derive a sky, and a guessed state is worse
      // than a missing one.
      contested_state: z
        .enum(["mastered", "emerging", "implied"])
        .nullable(),
      kind: z.enum(["correction", "regression"]),
      surface: z.enum(["chat", "sms", "email", "map", "report"]),
    })
    .strict(),
  "celebration.map_census": z
    .object({
      family_id: z.uuid(),
      child_id: z.uuid(),
      reported: z.number().int().min(0),
      implied: z.number().int().min(0),
    })
    .strict(),
```

CUT FROM THE ORIGINAL PLAN: the widen of `conversation.offer_fulfilled` from `source: z.literal("morning_brief")` to an enum including `friday_letter`. Nothing in this tranche emits it, and the offer-declines kill condition it was for has no data path at all (see celebration-metrics.ts). A widened enum with no emitter and no consumer is exactly the promise this repo's own staging guard exists because it rots. R6 widens it when R6 has an emitter.

### `scripts/events-check.mts` (modify)

**Purpose.** Keep the MJ-08 parity guard green for the three events whose emitters ship with R6.

Populate `STAGED_EVENTS` (the empty array at line 19):
```ts
const STAGED_EVENTS: ReadonlyArray<readonly [string, string]> = [
  ["celebration.letter_opened", "celebration R6 (the Friday letter)"],
  ["celebration.letter_composed", "celebration R6 (the Friday letter)"],
  ["celebration.letter_muted", "celebration R6 (the Friday letter)"],
];
```
`celebration.correction_recorded` and `celebration.map_census` are NOT staged: both get real literal `emitMapEvent`/`emitMapEventOnce` call sites in this tranche, inside `apps/web/lib`, which the scanner's roots (lines 28-33) and regex (line 50) cover. Verify by running `pnpm check:events` locally before pushing; the guard fails in both directions, so a staged entry that gains an emitter also fails (lines 89-96).

### `apps/web/lib/child-progress/abilities-census.ts` (create)

**Purpose.** The denominator for the implied-correction kill condition, without re-deriving 1,600 topics per child fleet-wide in a batch job.

```ts
import { emitMapEventOnce } from "../map/events";
import type { AbilitiesSky } from "./abilities-view";

/**
 * One dated reading of how much of a child's map is reported versus
 * implied, so "the correction rate on implied abilities" has an honest
 * denominator (plan 2026-07-22 §5G kill condition two).
 *
 * Deliberately a census rather than a batch job: the Progress page has
 * already derived this child's whole sky to render it, so the number is
 * free at exactly the moment it is correct. Once per child per day is
 * plenty for a rate measured over weeks, and the dedupe window is what
 * keeps a mother who reloads her page from inflating anything.
 *
 * It is biased toward visited children by construction, which is why the
 * summarizer joins corrections to censused children and reports the
 * covered-child count beside every rate built from it.
 */
const CENSUS_DEDUPE_SECONDS = 24 * 60 * 60;

export async function emitAbilityCensus(input: {
  familyId: string;
  childId: string;
  sky: AbilitiesSky;
}): Promise<void> {
  await emitMapEventOnce(
    "celebration.map_census",
    {
      family_id: input.familyId,
      child_id: input.childId,
      reported: input.sky.reported,
      implied: input.sky.lit - input.sky.reported,
    },
    { childId: input.childId, windowSeconds: CENSUS_DEDUPE_SECONDS },
  );
}
```
`emitMapEventOnce` (apps/web/lib/map/events.ts:26-59) already takes the transaction advisory lock keyed on name plus child id, applies the same-child window, and swallows its own errors, so analytics can never break the page.

### `apps/web/app/api/progress/census/route.ts` (create)

**Purpose.** Emit the census from a beacon, never from a server render.

Modelled on apps/web/app/api/map/report-viewed/route.ts, whose docblock states the reason: server components must not emit on render because prefetches double-count.

Imports at the top, in this order: `z` from zod; `emitAbilityCensus` from ../../../../lib/child-progress/abilities-census; `abilitiesSkyFromView` from ../../../../lib/child-progress/abilities-from-view; `liveProgressEnabled` from ../../../../lib/child-progress/flag; `getChildProgressView` from ../../../../lib/child-progress/runtime; `clientIp, rateLimited` from ../../../../lib/map/ratelimit; `requireFamilyWithActor` from ../../../../lib/map/session.

`const censusSchema = z.object({ childId: z.uuid() });`

POST: rate limit on `census:${clientIp(request)}` at 30; return `{ ok: true }` and emit nothing when `!liveProgressEnabled()`; resolve `requireFamilyWithActor()` for the family id, NEVER from the body (auth-context law, and the sibling route's docblock at app/api/progress/conflict/route.ts:9-16); load the view with `getChildProgressView(access.familyId, parsed.data.childId)`; if it resolves, derive the sky with `abilitiesSkyFromView(view, new Date())` and call `emitAbilityCensus`. A foreign child id resolves to null and emits nothing. Always return `{ ok: true }`: analytics never surface errors to the caller.

Caller: a small `useEffect` beacon in the Progress page's client boundary, fired once per mount, exactly like the report page's.

### `apps/web/lib/admin/celebration-metrics.ts` (create)

**Purpose.** One pure summarizer and one pure kill-condition function, so the numbers are testable without a database and the kill decision is not a judgment call in someone's head.

Follows apps/web/lib/admin/morning-brief-metrics.ts: row types, a pure summarizer, and a separate query function with no logic in it.

```ts
export interface CelebrationChildWeekRow {
  childId: string;
  /** ISO week key, e.g. "2026-W30". One row per child per week. */
  weekKey: string;
  /** A letter was composed and not held that week. */
  sent: boolean;
  opened: boolean;
  muted: boolean;
  fallbackDepth: number | null;
}

export interface CelebrationCorrectionRow {
  childId: string;
  contestedState: "mastered" | "emerging" | "implied" | null;
  kind: "correction" | "regression";
}

export interface CelebrationCensusRow {
  childId: string;
  reported: number;
  implied: number;
}

export interface CelebrationInstrumentSummary {
  childWeeksSent: number;
  childWeeksOpened: number;
  childrenSent: number;
  childrenMuted: number;
  deepFallbackChildWeeks: number;
  weeksSinceFirstLetter: number;
  /** Corrections on implied nodes, restricted to children that have a
   *  census row in this window. The unrestricted count is not a
   *  numerator for anything. */
  correctionsOnImpliedCensused: number;
  correctionsOnImpliedAll: number;
  correctionsOnReported: number;
  /** contested_state null: the report page's inline path. Reported so
   *  nobody reads a rate off a partial population. */
  correctionsUnattributedState: number;
  regressions: number;
  impliedNodes: number;
  reportedNodes: number;
  childrenWithCensus: number;
}

export function summarizeCelebrationInstrument(input: {
  childWeeks: readonly CelebrationChildWeekRow[];
  corrections: readonly CelebrationCorrectionRow[];
  census: readonly CelebrationCensusRow[];
  now: Date;
}): CelebrationInstrumentSummary;
```

Rules the summarizer enforces, each a way the number could lie:
- A held child-week (`celebration.letter_composed` with `held: true`) is neither sent nor unopened. A hard-day hold must never read as disengagement.
- Opens dedupe to one per child-week before counting, so `childWeeksOpened / childWeeksSent` is a rate over weeks and a mother who opens the same letter four times counts once.
- `census` takes the LATEST row per child only, and `childrenWithCensus` reports how many children have one at all.
- `correctionsOnImpliedCensused` counts ONLY corrections whose `childId` appears in the census set. Without this the numerator is a fleet-wide flow (corrections arrive from SMS families who may never open the web Progress page) and the denominator is a visited-children stock, so the ratio is not a rate and can exceed 1. `correctionsOnImpliedAll` is carried beside it so the gap between the two populations is visible rather than hidden.
- `deepFallbackChildWeeks` counts child-weeks with `fallbackDepth >= 5`.

Then the kill conditions, from plan §5G:
```ts
export type CelebrationKillStatus =
  | "ok" | "watch" | "tripped" | "not_enough_data";

export interface CelebrationKillVerdict {
  key: "letter_opens" | "implied_corrections";
  label: string;
  status: CelebrationKillStatus;
  reading: string;
  action: string;
}

export function celebrationKillVerdicts(
  summary: CelebrationInstrumentSummary,
): CelebrationKillVerdict[];
```
Thresholds hard-coded here rather than in a dashboard query: per-child opens below 0.40 once `weeksSinceFirstLetter >= 8` trips `letter_opens` (action: "The letter is wallpaper. Its shape changes or it stops."); `correctionsOnImpliedCensused / impliedNodes` above 0.10 trips `implied_corrections` (action: "R5 pauses until the graph is fixed."). "watch" is within 5 points of the opens threshold or within 2 points of the corrections threshold. "not_enough_data" when `weeksSinceFirstLetter < 8`, or `impliedNodes === 0`, or `childrenWithCensus < 20`.

CUT FROM THE ORIGINAL PLAN: the `offer_declines` kill condition, `CelebrationOfferRow`, and `offersDecided/offersAccepted/offersDeclined`. `conversation.reply_resolved` is `.strict()` with exactly `family_id, channel, resolution, resolved_outcome, cross_channel, resolution_method, classifier_version` (packages/core/src/events.ts:726-745): no task_run_id, no child_id, no loop id, nothing to join a letter on. `tasks.run_completed`'s kind enum has no `friday_letter` either. The only available correlation is family_id plus a time window, which the morning brief also occupies, so every morning-brief decline would be attributed to the letter and would trip a hard-coded action that removes a feature on another feature's numbers. This condition ships with R6, when the emitter that populates a source field ships with it.

`loadCelebrationInstrument(range)` reads `public.events` through `adminDb()` for the five names and returns the row arrays. Query only, no logic: every judgment is in the pure functions above.

### `apps/web/app/admin/celebration/page.tsx` (create)

**Purpose.** One founder-facing page. Never parent-facing: every number here is a cross-child comparison and that is exactly why it may never leave the console.

Follows apps/web/app/admin/drip/page.tsx's shape (SectionHead plus tiles) and reuses the tile treatment from apps/web/app/admin/morning-offer-funnel.tsx:6-24 and `percent` from apps/web/lib/admin/format.

Sections, in order:
1. "Letters" tiles: child-weeks sent, child-weeks opened with `percent(opened, sent)`, children muted, and the share of child-weeks at fallback depth 5 or greater.
2. "Corrections" tiles: corrections on implied nodes among censused children with the rate against `impliedNodes`, the unrestricted count beside it, corrections on reported nodes, corrections with no recorded prior state, and regressions counted separately. A regression is not an error and must never be summed with corrections; put the two in different tiles with a line saying so.
3. "Coverage" line, not a tile: `childrenWithCensus` children have a census row, and every rate above is computed over those children only.
4. "Kill conditions": one row per `celebrationKillVerdict` showing label, status, reading, and the action it commands, so the page states in advance what tripping means. A third row is a static "offer declines: not instrumented, ships with R6" note, so nobody assumes silence means healthy.

Add a nav entry to apps/web/app/admin/admin-nav.tsx. I did not read admin-nav.tsx or drip/page.tsx line by line; match their existing idiom rather than the sketch above where they differ.

## Tests

### `apps/web/lib/child-progress/abilities.test.ts`

- an explicit not_yet on an implied topic keeps it dark, with no contested set involved (pins the spec's no-new-mechanic claim at abilities.ts:137-139)
- a contested item id is never confirmed, even when a mastered topic's hard closure implies it
- a contested item id appears as exactly one node, in state contested, never implied
- a contested item id never appears in readyNext
- a contested item id that is NOT covered by any closure still appears as a contested node (today it disappears entirely, which is the live count drop this fixes)
- an empty contestedItemIds argument leaves the derivation deepEqual to the two-argument call
- a contested item id that is not in the catalog is ignored rather than throwing
- an implied node carries impliedBy naming the reported ability whose closure lit it, with that ability's own observedAt
- when two reported abilities imply the same topic, impliedBy names the earlier one, and the same one on every re-derivation
- a reported node carries impliedBy null
- an implied node's own observedAt stays null even though impliedBy carries a date

### `apps/web/lib/child-progress/abilities-view.test.ts`

- reported counts only nodes the parent answered, never implied ones (STORY_EVIDENCE has 3 explicit answers plus graph implications; assert sky.reported === 3 and sky.lit > 3)
- reported counts a contested node, because she reported it twice, differently
- reported is zero and lit is zero for a child with no evidence
- a not_yet node dated today is never counted in newThisWeek
- a contested node is never counted in newThisWeek
- an easily node dated today is still counted in newThisWeek (the fix does not break the celebration it exists beside)
- abilitiesSkyFromView passes the view's open-conflict item ids through, so a conflicted ability renders as one contested star and never as an implied one
- opening a conflict on an ability never lowers sky.lit, in both the closure-covered and the uncovered case
- the existing catalog-size walk still passes with the new reported field present
- the clause has exactly one shape: no reported count produces different wording than any other (assert abilitiesCoverageClause output differs only in the number for 0, 1, 6, 12, 13, 41)
- the clause names the child, the reported count, and Homa's part, and never the lit count
- the clause obeys the voice laws at 0, 1, 12, 13, 41: no em dash, no /behind/i, no percentage, no 'of'-followed-by-a-number shape

### `apps/web/components/progress/abilities-card.test.tsx`

- the coverage clause renders whenever the count renders
- the clause names the child by name
- the empty-map branch renders neither the count nor the clause
- exactly one occurrence of /each one you add lights more of it/ in the rendered text
- a contested star renders with the stone ring and is distinguishable from an implied star's fill
- a corrected ability does not raise the headline count and the card never claims removal (render a sky with a not_yet node dated today; assert no /new star/ text and no /off the map/ text)
- the card renders no percentage, no 'of 1600', and no em dash with the clause present

### `apps/web/components/dashboard/stat-tiles.test.tsx`

- the per-kid page renders no ranked whole-child label (kidCount 1, a report with two ahead subjects and no plans, assert no /ahead/i in the rendered text)
- the third tile falls through to Reports when there are no plan check-offs
- the 'Your answers' tile keeps its existing sub-caption and gains no child name
- NEW FILE: add this path to the check:progress-ui script list in package.json, which enumerates files rather than globbing

### `apps/web/lib/child-progress/progress-service.test.ts`

- a correction carrying a quote writes it onto every evidence row in the batch, with channel and message id
- a correction with no quote still writes (the report page's inline tap path) and leaves quote null
- a two-item correction from one message produces ONE operation with two evidence rows and one undo token
- a correction of the same items from the same message replays as duplicate and writes nothing twice
- the payload hash is unchanged by the new provenance fields: a receipt whose stored hash was computed before this change still replays as duplicate rather than idempotency_mismatch
- a correction still supersedes every active row at or below its cutoff, unchanged
- a correction while an open conflict exists on that item returns conflict_pending and writes nothing
- a 620-character inbound message does not reach the service as a quote (the caller's 400-cap schema is the guard); a 501-character quote passed directly still throws, unchanged

### `apps/web/lib/child-progress/tool-contract.test.ts`

- correct_ability parses with childId, one item at not_yet, and a quote
- correct_ability parses with six items and rejects seven
- correct_ability rejects answer easily (this action only ever takes a star down)
- correct_ability rejects a quote over 400 characters, so the ledger's 500 ceiling can never be reached
- correct_ability rejects an empty items array
- correct_ability rejects an unknown extra field (strict object)
- the published tool input schema advertises correct_ability, itemIds, and quote

### `apps/web/lib/child-progress/tool-adapter.test.ts`

- NEW FILE, covered by the check:child-progress glob
- correct_ability refuses when the inbound message text or id is missing, so a correction never writes without provenance
- correct_ability refuses when the model's quote is not a verbatim substring of the inbound text
- correct_ability accepts a quote the model trimmed and re-cased, matching quoteAppearsIn
- correct_ability refuses when any item in the batch is not currently a star on this child's map
- correct_ability reaches a CONTESTED star and returns the conflict card, not a refusal (the case the tranche exists for)
- a successful correct_ability returns a progress_update result carrying the corrected topic statements and an undo token
- a duplicate correction returns the original progress_update, never a refusal
- an unknown_item result returns a refusal
- correct_ability refuses when the child id belongs to no child in the authenticated family
- correct_ability is refused on the dispatch and voice channels
- record_journal_evidence forwards the pre-write star states, and forwards an empty map when the view does not resolve

### `apps/web/lib/child-progress/progress-events.test.ts`

- celebration.correction_recorded fires once per affected item on a committed correction, with the pre-write state the adapter supplied
- celebration.correction_recorded fires with contested_state null on the report page's inline path
- a journal not_yet on an item that was mastered before the write emits kind regression
- a journal not_yet on an item that was NOT lit before the write emits nothing
- a journal easily emits no celebration event
- a correction that returns conflict_pending emits no celebration event
- an emit failure does not fail the write

### `apps/web/lib/admin/celebration-metrics.test.ts`

- a held child-week is neither sent nor unopened
- two opens in one child-week count as one opened child-week
- the open rate divides by child-weeks sent, never by letters sent
- the latest census per child is the one used, and childrenWithCensus reports how many children have one at all
- corrections from a child with no census row are excluded from correctionsOnImpliedCensused and still counted in correctionsOnImpliedAll
- the implied-correction rate can never exceed 1 for any input, including 30 corrections against 25 censused children
- corrections with contested_state null land in correctionsUnattributedState and in no rate
- regressions are counted separately from corrections and never summed into the correction rate
- letter_opens reads not_enough_data before week eight and tripped at 39 percent in week nine
- implied_corrections reads not_enough_data when impliedNodes is zero or childrenWithCensus is under twenty
- implied_corrections trips above ten percent and reads watch between eight and ten
- every verdict carries the action it commands, so tripping is never a discussion
- NEW FILE: add this path to the check:admin script list in package.json

### `packages/core/src/events.test.ts`

- each new celebration.* schema parses a valid payload and rejects an unknown field
- celebration.letter_composed rejects a fallback_depth of 0 and of 8
- celebration.map_census rejects a negative reported or implied count
- celebration.correction_recorded accepts contested_state null and rejects an unknown state string
- conversation.offer_fulfilled still parses source morning_brief and still REJECTS friday_letter (the widen is deliberately not in this tranche)
- no celebration.* schema admits a name, an email, or any free text field

### `apps/web/evals/celebration/comparative-question.eval.ts`

- a direct sibling comparison gets the named worry, stays with the child she named, gives one concrete thing and one open ability, and offers one small way in, with no banned word, no sibling name or role noun, no ranking vocabulary, and no em dash

### `apps/web/evals/celebration/comparative-question-no-evidence.eval.ts`

- a comparison about a child with an empty map offers three quick questions and invents no ability

### `apps/web/evals/celebration/comparative-question-negative.eval.ts`

- a practical two-child logistics question is answered directly, naming both children, without triggering the comparison move

### `apps/web/evals/celebration/ability-correction.eval.ts`

- "he cannot actually do that, he has never counted past ten" calls manage_child_progress with correct_ability, carries a verbatim quote from the message, and thanks her without arguing
- "he can't count past ten, and he can't write his name either" produces ONE correct_ability call carrying two items, not two calls
- "he used to read those and now he will not" records an observation and does NOT call correct_ability, and says the first is still on his list
- the reply never says the ability is off the map

## Edge cases

- A correction and a regression both mint a new star this week, today. `isNew` (abilities-view.ts:111-116) ignores state, `newThisWeek` (line 207) counts every isNew star, and abilities.ts:174 stamps observedAt on every explicit node including not_yet. So the moment `correct_ability` exists, a mother who takes an ability away sees "1 new star since last week." in sage on the same card that week. Fixed in this tranche by passing state into isNew and refusing not_yet and contested. The tranche is what makes this routine, so the fix ships with it, not after.
- A correction says "off the map" while the star is still on the map, relabelled. An explicit not_yet is pushed as a node (abilities.ts:163-179), drawn as a stone-ringed circle (abilities-card.tsx:88-91), counted in lit (abilities-view.ts:206), and its own popover says "This one stays on the map" (abilities-copy.ts:105-108). The copy now says what happens: moved to not yet. Homa never contradicts the next screen.
- A correction of an IMPLIED ability raises the reported count by one. The implied node had no explicit row; the correction adds one, so `reported` goes from N to N+1 and the clause says she has told Homa one more thing. That is true: she did tell Homa something, namely that the child cannot do it. The clause stays honest and nothing else moves.
- A correction written as a DELETE re-lights the star. `correctProgressAnswers` supports `change.answer === null` (progress-service.ts:827-835), which removes the row from `explicit`, and the closure at abilities.ts:131-135 re-adds the item as implied on the very next read. The `correct_ability` schema makes this unrepresentable by omitting a null answer.
- A contested ability was re-lit as implied, and an uncovered one vanished. An open conflict drops the item from effective evidence (effective-evidence.ts:296-297), the projection renders it with answer null (projection.ts:276-278), `abilityEvidenceFromView` skips it (line 30), and the closure either re-adds it dimmer or the node disappears and `lit` silently falls by one under a card promising the count only goes up. The contested state fixes both directions and keeps the item addressable by the correction path.
- Two corrections in one message lose the second. `progressOperationIdempotencyKey` (tool-contract.ts:289-309) hashes action plus turn or provider message id, with no item in it, and the adapter computes it once (tool-adapter.ts:90-93). A second `correct_ability` in one turn claims the same key with a different payload hash and gets `idempotency_mismatch` (progress-service.ts:733-735). The batch shape makes one message one operation, which is also what `changes: Array<...>` was built for.
- A correction longer than 500 characters throws out of the transaction. `validateProgressEvidenceWrite` (progress-service.ts:388-395) throws a TypeError, `withCommittedProgressEvents` (progress-events.ts:655-665) awaits the operation outside its try, so the throw escapes and the most valuable message of her week writes nothing. Solved structurally: the model supplies a quote capped at 400 by schema, and code re-checks it verbatim, so no truncated prefix is ever stored and provenance stays checkable.
- A duplicate correction reports failure after the write committed. eve retrying inside one turn re-uses the same provider message id, so the key and hash match, the service returns `duplicate` with the real receipt, and a bare refusal would send her to correct it again. `adaptCorrectionResult` recurses, like the three adapters beside it.
- The model names a plausible ability the child never had. Verified before any write: every item in the batch must be a star on this child's derived map right now, checked against `abilitiesSkyFromView` over a view loaded with the authenticated family id, and the quote must be verbatim in her message. A miss returns a refusal, never a softened write.
- A correction arrives while the other adult has answered differently. `correctProgressAnswers` returns `conflict_pending` and writes nothing (progress-service.ts:762-782). This is the common case for a contested ability, not an edge one, and it now returns the conflict card so she can settle it rather than a flat refusal she cannot act on.
- A correction of a REPORTED ability must remove its first; a regression must not. `correctProgressAnswers` supersedes every active row at or below the cutoff (progress-service.ts:801-818), while a journal append leaves the earlier row's superseded_at null. The firsts projection, when it ships, must read min(observed_at) over rows that are easily AND not superseded by a correction-sourced row. Correcting an IMPLIED ability has no firsts consequence at all: implied nodes carry observedAt null (abilities.ts:52-53, :193) and never reach the page.
- The implied-correction receipt names a source the system does not record. The closure loop (abilities.ts:131-135) adds bare ids to a Set and discards the originating item, `AbilityNode` had no impliedBy, and implied nodes carry no date, so the only thing that could fill "it came from X on DATE" at runtime was the model's memory of the turn. That is a fabricated receipt on the one surface §1 says must trace to her own words with a date. `impliedBy` now carries the source id, statement and date, deterministically (earliest observedAt, ties by itemId).
- Voice is told to perform a write voice cannot perform. The hosted Telnyx assistant has four tools and none of them is manage_child_progress (general-call-instructions.md:12-22; telnyx-provision.mts:349-351), and tool-adapter.ts:51-63 refuses voice anyway. Both new instruction sections now sit BELOW the `## What you know each turn` split, and general-call-instructions.md gains an explicit "you cannot change a child's map on this call" line, in the same file and the same shape as the worksheet and binder prohibitions written after the 2026-07-19 fabricated-worksheet call.
- The comparative move is unfollowable on the phone. telnyx-provision.mts:355-357 appends the phone rules last "so they bind hardest", and :368-375 caps a turn at one or two sentences with one thought. A five-step reply loses most of its steps and the model improvises which ones, which is the failure the section exists to prevent. Voice gets a two-sentence variant in the boundary file instead, sourced only from what `{{family_context}}` carries.
- Voice is told to name a ready-next it cannot see. ready_next reaches the agent only through `explore_child_map` (instructions.md:100-110, below the split), and family-context.ts:154-157 pushes only "does easily" and "working edge". The web section now says not to name one without looking it up; the voice section names only what is in front of it and otherwise offers to look and text her.
- A threshold in the coverage clause re-creates the label the founder just removed. `YOUNG_MAP_REPORTED_MAX = 12` would put "map is young" on family a64e1ba5's 12-year-old (10 easily answers) and the grown-map shape on the 7-year-old (36), one tap apart on the sibling switcher, which is the exact hazard and the exact backwardness founder ruling `kid-standing-chip` (2026-07-22) names. One shape at every count cannot be compared.
- The clause could state a different number than the one it names. The stat tile's `observations` is a checklist answer count summed from stored `child_reports` snapshots (stat-tiles.tsx:27, scoring.ts:310), a different catalog and a staler value than `sky.reported`. Attaching the sentence to it would put 34 on one page and 15 on another for the same child on the same day. The clause is bound to `sky.reported` and renders on the abilities card only.
- Two counts sit one line apart on the abilities card. `abilitiesCount(sky.lit, ...)` and the clause's `sky.reported` differ by construction, so a reader can supply the fraction herself. This is a real cost, not a hidden one: the alternative is deleting the surface's own ruled headline count, which is a bigger unilateral change than this tranche should make. Flag it to the founder in the PR with the two-number screenshot rather than choosing quietly.
- Reported is zero but lit is not. A child whose only evidence is one easily answer that implies eight topics reads "the one thing you have told me so far" beside eight stars. That is exactly the truth the clause exists to say. A child with zero reported answers has zero lit nodes and hits the empty branch, which renders no count and no clause.
- The census is biased toward visited children. A page-render census only exists for children whose Progress page is opened, so the implied-correction numerator is restricted to censused children by a join on child_id and the covered-child count renders beside every rate. Naming the coverage is the difference between a measurement and a number.
- Opens divided by sends would flatter the letter. A mother who opens one of four letters in a month is not 25 percent engaged in any useful sense; the summarizer dedupes to child-weeks before dividing. Getting this wrong is the difference between a kill condition that fires and one that never does.
- A held letter must never read as an unopened one. `celebration.letter_composed` carries held true and those child-weeks leave both numerator and denominator, or a family in a 72-hour distress hold drives the kill condition that stops the letter for everyone.
- The comparative instruction could over-fire into refusing all multi-child talk. The adjacent-negative eval exists for this, the instruction says so in its own last line, and the household view, the planner, and the family dashboard all legitimately name two children. Founder ruling `choice-card-web-only` (2026-07-21) established that a constraint from one situation is not a global law.
- Homa is asked the comparison about a child who is not in the family. The map snapshot carries only this family's children, so there is nothing to name; the reply degrades to the no-evidence shape rather than reaching for a general developmental claim.
- A regression event fires on a first report of "cannot do it". The runtime emitter requires the item to have been mastered, emerging or implied before the write, using the pre-write states the adapter read. Without that gate every "he can't do X yet" would be counted as a walk-back and the founder page's regression number would be noise.

## Risks and rejected objections

- REJECTED, partially: the objection that the contested fix lowers `sky.lit` under a card promising it only counts up, and that abilitiesIntro must change before shipping. The premise is right and the conclusion is not, because the fix is not deletion. Pushing the contested item as its own visible node means lit is unchanged when the item was implied and RISES by one when it was not covered by any closure. That second case is a live count drop today: an open conflict on an uncovered item removes the node entirely (effective-evidence.ts:296-297 plus abilities-from-view.ts:30 plus no closure), so `abilitiesIntro`'s "The map only ever counts up" is already false in production and this tranche makes it true. The intro line stays. The objection's second half, that a harder ability would be lit with its prerequisite dark, is also resolved: the prerequisite is visible in the contested state, not dark.
- REJECTED: adding quote, channel, messageId and providerMessageId to `hashChildProgressOperationPayload`, which the original plan proposed and one objection endorsed dropping. Dropped, for the objection's reason plus one more. It fixes nothing, since the key already includes providerMessageId (tool-contract.ts:289-309), and it regresses across the deploy boundary: a receipt written before the change stores a hash computed without the quote, so the same replayed correction after the change returns idempotency_mismatch for a write that already committed.
- REJECTED: scoping the idempotency key as `${key}:${itemId}` instead of batching. The batch is better on the repo's own terms. `CorrectProgressAnswersInput.changes` is already `Array<{ itemId, answer }>` (progress-service.ts:143), the per-change evidence key already suffixes `:change:N:itemId` (progress-service.ts:868), and one message becomes one operation with one undo token, which is what the parent-facing receipt needs. A per-item key would give her two undo tokens for one sentence.
- REJECTED: truncating the correction quote in the manage_child_progress wiring the way the journal path does at progress-service.ts:1586. It would stop the throw, but it stores a prefix whose tail silently vanished, and the law says verify provenance rather than approximate it. The model-supplied quote re-checked verbatim by `quoteAppearsIn` is the shape claim-extraction already uses, satisfies the 500 ceiling structurally at 400, and gives a receipt that can be re-verified against the message forever.
- REJECTED: widening `ProgressEventName` to admit celebration names and adding a case to `emitProgressEvent`'s switch. It typechecks, but it puts a non-progress event inside a pipeline whose whole contract is the `progress.` prefix, and the events-check scanner only sees literal names inside emit calls (scripts/events-check.mts:50), so the emitter would be invisible to the guard even after the widen. Two literal `emitMapEvent("celebration.correction_recorded", ...)` calls in runtime.ts are simpler, visible to the guard, and keep the progress pipeline typed as it is.
- REJECTED: making the census a nightly fleet job over all live-progress children instead of a page beacon. It would fix the population bias at the source, but it re-derives roughly 1,600 topics per child fleet-wide on a schedule for a number the Progress page already computes for free. The join plus the covered-child count gets the same honesty at no marginal cost. Revisit if `childrenWithCensus` stays under twenty for three weeks, which is exactly what the not_enough_data status will say.
- CORRECTED FACT, and the plan's own error: the original verifiedFacts claimed kid-pill.tsx:34-45 emits "Growing right now", "Ahead ✦" and "On track". Those were removed at commit 4042463; kid-pill.tsx:51-62 now returns only getting-started chips or null. D7 was ruled the same day (`kid-standing-chip`, 10-reconciliation.md:174) and explicitly KEPT the getting-started chips, so the original plan's recommendation to remove the chip contradicted a shipped ruling. The D7 edge case is dropped.
- Removing the "Ahead of age" tile extends a narrowly-scoped ruling by analogy. `kid-standing-chip` names kid-pill.tsx, not stat-tiles.tsx. The tile is a ranked whole-child label in gold on the per-kid page directly beneath the sibling switcher, and its caption "N subjects across the family" is factually wrong when kidCount is 1, so the ruling's stated cause covers it verbatim. Say so in the PR body and let the founder overrule rather than treating it as already ruled.
- The coverage clause ships one shape where the spec's own example (line 342) says "Sam's map is young." That is a deliberate departure, on the grounds of `kid-standing-chip` rather than of the spec, and it should be named as such: the spec's line 340 asks for a clause naming what the count measures, which one shape does; the "young" wording adds a threshold the ruling's own cause language argues against. If the founder wants the two shapes back, that is a ruling, not a tweak.
- Two counts still sit one line apart on the abilities card, and a determined reader can compute 3 of 38. Fixing that properly means either dropping the ruled headline count or rewriting it to name both numbers, both of which change `abilities-map-v1` copy. Deliberately not decided here; flagged to the founder with the rendered card.
- `correct_ability` gives the model a way to take stars down from a sentence it misread. Every mitigation is deterministic: it can only lower an answer, every item must already be a star on this child's map, the quote must be verbatim in her authenticated message, the write is one operation with an undo token, and `undo_progress_update` already exists. Still, look at the first two weeks of real rows in the founder console before calling it settled.
- Adding an eleventh action to manage_child_progress grows the model's decision surface. A separate tool would be worse by AGENTS.md's tool rules: same effect, same ledger, same tenancy. The routing risk (calling correct_ability when she meant to report a regression) is real and is what the ability-correction eval measures.
- Changing `deriveAbilityMap`'s arity and adding an AbilityState touches a pure function four call sites and two test files depend on, plus every switch over AbilityState (abilities-copy.ts:70-81, :95-115, abilities-card.tsx:26-43). The third parameter defaults to an empty array and a deepEqual test pins the old shape, but run `pnpm check:child-progress` and `pnpm check:progress-ui` before pushing; a missed switch case is a typecheck failure, not a silent one, which is the good version of this risk.
- The regression census costs one extra `getChildProgressView` per record_journal_evidence call, including the many calls that record nothing. That is one read on a path that already makes a model call per message, and it is the only place the pre-write state exists outside the service transaction. If it shows up in latency, move it inside the service and read `projectionInput` instead.
- The census beacon adds one write to public.events per child per Progress visit, deduped to one per day, and `emitMapEventOnce` takes a transaction advisory lock on every call including the deduped ones (map/events.ts:36-41). The same pattern already runs on every report view, so the shape is proven.
- Three of the five new events have no emitter until R6. STAGED_EVENTS keeps `pnpm check:events` green, but a staged entry is a promise and this repo's guard exists because staged events rot. If R6 slips past two more weeks, remove them rather than carrying them.
- The offer-declines kill condition is cut, so one third of §5G's stated instrument is not instrumented. That is honest rather than complete: `conversation.reply_resolved` has no field that identifies a letter, and the only available correlation (family_id plus a time window) is shared with the morning brief, so shipping the number would mean removing a feature on another feature's data. The admin page carries a static row saying so, so silence is not read as health.
- The comparative-question instruction has no deterministic floor. `packages/core/src/map/narrative-gate.ts` runs only over model-composed report and plan narrative, never over chat, and BANNED_WORDS (copy-laws.ts:12) would not catch a comparative sentence carrying no banned word and no number. Extending the gate to chat is build-order item 1's ticket. Until then the evals are the whole floor, and evals are sampled, not enforced.
- Voice is covered by a prohibition and a two-sentence move, and by no test. There is no eval harness over the Telnyx persona in this repo, so the voice half of this tranche ships verified by reading only. Say so plainly rather than implying parity, and put a real call through the line after deploy asking the comparative question and asking Homa to take an ability off a map.
- `${mapped} of ${possible}` still renders on the per-kid page (stat-tiles.tsx:41), a literal denominator two tiles from a card whose whole point is that counts need context. This tranche deliberately does not fix it: it is a report-scores tile and it belongs to the comparison-guard ticket. Leaving it means the no-denominator law is enforced on one card and violated in the same viewport. Flag it to the founder rather than letting it sit as a finding.

## Verified facts (re-verify before building)

- apps/web/lib/child-progress/abilities-view.ts:111-116 `isNew` takes only observedAt and now, with no state parameter, and :207 `newThisWeek: stars.filter((star) => star.isNew).length` applies no state filter. apps/web/lib/child-progress/abilities.ts:174 sets `observedAt: entry.observedAt` on every explicit node including not_yet. A correction or regression dated today therefore counts as a new star this week. CONFIRMED, and it is the tranche's most consequential fix.
- apps/web/lib/child-progress/abilities.ts:163-179 pushes every item in `explicit` as a node regardless of answer, :206 in abilities-view.ts counts `lit: stars.length` over all of them, apps/web/components/progress/abilities-card.tsx:88-91 draws not_yet with `inset 0 0 0 1px var(--stone-400)`, and apps/web/lib/child-progress/abilities-copy.ts:105-108 says "This one stays on the map". "Off the map" copy would be refuted by the next screen. CONFIRMED.
- apps/web/lib/child-progress/abilities.ts:131-135 iterates `hardPrerequisiteClosure(itemId)` and adds bare ids to a Set, discarding the originating item; AbilityNode (:45-54) has no impliedBy field; :193 sets `observedAt: null` for every implied node. There is no source and no date for an implied-correction receipt today. CONFIRMED.
- apps/web/lib/child-progress/effective-evidence.ts:297 `if (openConflictItems.has(itemId)) continue;` skips any item with an open conflict; apps/web/lib/child-progress/projection.ts:276-278 builds the contested topic view with `answer: null, state: "conflict"`; apps/web/lib/child-progress/abilities-from-view.ts:30 skips topics with `answer === null`. A contested item leaves `explicit` and is either re-added by the closure as implied or disappears from the map entirely.
- apps/web/lib/child-progress/progress-service.ts:762-782 returns `{ status: "conflict_pending", conflictId, itemId }` and writes nothing whenever an open conflict names any item in `changes`. Contested items are exactly the shape a correction arrives about, so this is the common path, not an edge.
- apps/web/lib/child-progress/tool-result-adapter.ts:82-83, :170-171 and :197-201 all recurse on `duplicate` into `result.original`; :84-104 and :163-169 route `conflict_pending` to `progressConflictViewResult`. Collapsing either into a refusal contradicts every sibling adapter in the file.
- apps/web/lib/child-progress/progress-service.ts:158-170 defines `CorrectProgressAnswersResult` as answers_corrected, ProgressConflictPendingResult, unknown_child, unknown_actor, unknown_item, idempotency_mismatch, and duplicate. Seven members, not one.
- apps/web/lib/child-progress/tool-contract.ts:289-309 `progressOperationIdempotencyKey` hashes `[action, ...(providerMessageId ? ["provider", channel, providerMessageId] : ["runtime", runtimeSessionId, turnId])]`. No childId, no itemId. apps/web/lib/child-progress/tool-adapter.ts:90-93 computes it once per command. Two correct_ability calls in one turn collide.
- apps/web/lib/child-progress/progress-service.ts:701-708 `hashChildProgressOperationPayload` hashes kind, familyId, childId, memberUserId, source and `changes`, and :733-735 returns idempotency_mismatch when an existing receipt's hash differs. Adding provenance fields to that hash would break replays of receipts written before the change.
- apps/web/lib/child-progress/progress-service.ts:388-395 throws `TypeError("Progress evidence quote cannot exceed 500 characters")`. apps/web/lib/child-progress/progress-events.ts:655-665 `withCommittedProgressEvents` awaits the operation OUTSIDE its try, so the throw escapes and nothing commits. apps/web/lib/child-progress/tool-contract.ts:197-202 `boundedInboundText` caps at 8,000, not 500. The original plan's cited precedent did the opposite of what it claimed.
- apps/web/lib/child-progress/claim-extraction.ts:36 caps the model's quote at 400 and apps/web/lib/child-progress/claim-validation.ts:108-113 `quoteAppearsIn` re-checks it as a whitespace-collapsed, case-insensitive substring. It is currently module-private and must be exported.
- apps/web/lib/child-progress/progress-service.ts:1586 and :1614 truncate journal quotes with `Array.from(...).slice(0, 500).join("")`, which is why the journal path never hits the throw.
- apps/web/lib/child-progress/progress-events.ts:28 `type ProgressEventName = Extract<EventName, \`progress.${string}\`>` and :30-35 build ProgressEvent as a mapped union over exactly that; :552 onward is a closed per-name switch with an explicit `emitMapEvent("progress.x", event.props)` per case. A celebration name cannot be returned from progressEventsForCorrectionResult (:228-242) and would emit nothing if it were.
- apps/web/lib/child-progress/progress-events.ts:194-204 `progressEventsForJournalObservation` returns `[]` unless status is no_match, activity_only or ambiguous, that is, unless nothing was recorded. A regression recorded through record_journal_evidence never reaches it.
- apps/web/lib/child-progress/runtime.ts:103-114 wraps recordJournalProgressEvidence and :144-158 wraps correctProgressAnswers, both inside withCommittedProgressEvents, and both are under apps/web/lib, which is a scripts/events-check.mts ROOT (lines 28-33).
- scripts/events-check.mts:50 matches `emit(Map)?Event(Once)?( ... "name.name"` within a 200-character window, :80-87 fails any registry name with no emitter unless staged, and :19 STAGED_EVENTS is currently empty.
- packages/core/src/events.ts:726-745 defines conversation.reply_resolved `.strict()` with family_id, channel, resolution, resolved_outcome, cross_channel, resolution_method and classifier_version. No task_run_id, no child_id, no loop id. :748-755 defines conversation.offer_fulfilled with `source: z.literal("morning_brief")`. :766-773 defines tasks.run_completed with kind enum journal_prompt, morning_brief, custom, fleet_research, with no friday_letter. The offer-declines kill condition has nothing to join on.
- apps/web/lib/map/events.ts:26-59 implements emitMapEventOnce with a transaction advisory lock keyed on name plus child id and a caller-supplied window, requires family_id in props, and swallows its own errors.
- apps/web/components/dashboard/kid-pill.tsx:51-62 returns only "Opens at age 2", "Checklist ready", "Just getting started" or null. The ranked labels were removed at commit 4042463 ("The kid header stops ranking the child"), and the file's own docblock at :12-29 records why.
- docs/homa-planning/journeys/10-reconciliation.md:174 records founder ruling `kid-standing-chip` (2026-07-22): no ranked whole-child label on the per-kid page header, cause named as the sibling switcher directly beneath plus the label being frequently backwards because age bands ask older children harder questions while implied closure pushes the other way. The getting-started chips and the per-subject badges are explicitly kept.
- apps/web/components/dashboard/stat-tiles.tsx:60-66 renders a gold "Ahead of age" tile with value `String(aheadCount)` and sub `"${n} subjects across the family ✦"`, reachable whenever planTotal is 0 and aheadCount is above 0. apps/web/app/app/kids/[childId]/kid-view.tsx:109 renders StatTiles with kidCount 1 and one report, directly beneath the sibling switcher at :85-106.
- apps/web/components/dashboard/stat-tiles.tsx:27 computes observations as the sum of `report.scores.observationCount` over stored reports; :41 renders `${mapped} of ${possible}`. These are checklist answer counts from `child_reports` snapshots, a different catalog and a staler value than sky.reported.
- apps/web/lib/child-progress/tool-contract.ts:47-58 lists ten actions and none is a correction, so chat has no path to write a correction row today. :83-154 is the strict execution union.
- apps/web/lib/child-progress/progress-service.ts:865-868 hardcodes `quote: null, channel: null, messageId: null, providerMessageId: null` on every correction write, so a correction currently traces to nothing. apps/web/lib/child-progress/legacy-adapters.ts:581-588 is the report page's inline correction path and spreads `...input`, so optional new fields are additive there.
- apps/web/lib/child-progress/progress-service.ts:801-818 supersedes every active row at or below the correction cutoff; :827-835 is the delete branch taken when `change.answer === null`; :143 declares `changes: Array<{ itemId: string; answer: MapAnswer | null }>`, so a batch is the shape the service already takes.
- apps/web/lib/child-progress/effective-evidence.ts:200-212 picks the latest active row per item by observedAt, then createdAt, then id, so a later not_yet row wins without deleting anything, which is what leaves the firsts page untouched after a regression.
- supabase/migrations/20260711213330_agent_led_live_progress.sql table body: child_progress_evidence already has quote (char_length <= 500), channel, message_id, provider_message_id, supersedes_id, superseded_at, and 'correction' is in the source check constraint. NO MIGRATION for either path.
- apps/web/lib/child-progress/types.ts:8-20 lists ProgressSourceKind including "correction"; progress-service.ts:134-137 defines ProgressAnswerCorrectionSource as ProgressSourceKind minus journal, conversation and check_in, so "correction" is a legal source.
- apps/web/lib/child-progress/tool-result-payloads.ts:184-212 `progressUpdateResult` already loads the child progress view with the authenticated family id and returns kind progress_update with the child's name, affected topic statements, and an undo token, so a correction needs no new result kind.
- apps/web/lib/child-progress/tool-adapter.ts:51-63 refuses every channel outside web, sms and email (dispatch allowed only for mark_observation_used); :68-79 refuses record_journal_evidence and respond_check_in when canonicalInboundText or inboundMessageId is null.
- apps/web/lib/child-progress/tool-operations.ts:88-93 already declares listFamilyCheckIns and getChildProgressView on the operations interface, so the adapter can load a view without a new dependency.
- scripts/telnyx-provision.mts:364 splits the persona on the literal string "## What you know each turn"; :349-351 states the port trims tools because "the hosted assistant has none of them"; :355-357 appends the phone rules last "so they bind hardest"; :368-375 caps a turn at one or two short sentences with one thought.
- apps/web/agent/general-call-instructions.md:12-22 enumerates the four voice tools (send_email, remember, log_hours, send_signup_link); :24-33 is the "what you cannot do" list, covering worksheets, attachments and the binder but nothing about a child's map; :5-8 records the 2026-07-19 call that claimed a worksheet was emailed and binder-added.
- apps/web/lib/family-context.ts:154-157 pushes only "does easily" and "working edge" into the child snapshot. apps/web/agent/tools/explore_child_map.ts:50, :70 and :165 are the only source of ready_next, and that tool sits below the persona split so voice never sees it.
- apps/web/agent/instructions.md headings: "## Voice (binding)" at 24, "## Have opinions" at 48, "## What you know each turn" at 65, "## Live progress and check-ins" at 213, "## Multiple children" at 379. Lines 37-38 already carry "Never say 'behind'... Never compare siblings" ABOVE the split, so voice has the prohibition already and needs only the move.
- apps/web/lib/child-progress/projection.ts:433-463 builds each subject's domains from ProgressTopicCandidate entries derived from evidence, conflicts and ask_next, so the view's topic tree is evidence-scoped rather than the whole catalog, and it includes ask_next topics the child has not demonstrated. Verifying a model itemId against the derived sky rather than the view's topics is therefore the stricter and correct check.
- packages/core/src/map/copy-laws.ts:12 bans behind/delayed/disorder/diagnos*/screening/assessment/percentile but not "ahead"; packages/core/src/map/narrative-gate.ts runs only over ReportNarrative and PlanNarrative, never over chat prose.
- package.json:10 check:child-progress globs apps/web/lib/child-progress/*.test.ts, so new files there are covered automatically. package.json:16 check:progress-ui and package.json:21 check:admin ENUMERATE files, so stat-tiles.test.tsx and celebration-metrics.test.ts must be added to those lists by hand. apps/web/lib/child-progress/tool-adapter.test.ts does not exist yet; abilities.test.ts, abilities-view.test.ts, abilities-card.test.tsx, progress-service.test.ts, tool-contract.test.ts and progress-events.test.ts all do.
- apps/web/lib/child-progress/abilities-view.test.ts:104-133 is the catalog-size walk: it fails any serialized number over 1000, any key matching /percent|ratio|denominator/, any /total/ field, and any "of NNN" shape.
- apps/web/evals/ uses defineEval from "eve/evals" with t.send, t.succeeded, t.calledTool, t.notCalledTool, t.loadedSkill, t.eventsSatisfy, t.check, t.log, t.includes and t.skip.
- docs/homa-planning/plans/2026-07-22-celebration-system.md:340-342 is the coverage-is-not-ability requirement and its example sentence ("Sam's map is young. It is built from six things so far"); :373-379 is the correction and regression copy the spec asks for, including the implied source and its date; :403 is the §5G kill-condition set; :411-419 is the build order placing the comparison guard first and the instrument last; :485-493 is D7, superseded by the `kid-standing-chip` ruling.

## Objections folded in (already reflected above)

### [FATAL] The tranche's headline fix makes its own correction path unreachable: after the contested-set change a contested ability has no star, and the adapter refuses any correct_ability whose item is not a star. Even bypassing that guard, correctProgressAnswers returns conflict_pending for exactly these items, and the plan maps that to a bare refusal instead of the conflict card every sibling path returns.

**Evidence.** apps/web/lib/child-progress/abilities-from-view.ts:30 skips topics with answer === null, and apps/web/lib/child-progress/projection.ts writes a contested topic as answer:null/state:"conflict", so a contested item is never in `explicit`; the plan additionally does `confirmed.delete(itemId)` for contested ids, so no AbilityNode is pushed at apps/web/lib/child-progress/abilities.ts:163-179 or :182-196. The plan's adapter then does `if (!lit.has(command.itemId)) return refusedProgressResult()`. Independently, apps/web/lib/child-progress/progress-service.ts:760-780 returns `{status:"conflict_pending"}` and writes nothing whenever an open conflict names the item, while the plan's case does `if (result.status !== "answers_corrected") return refusedProgressResult()`; compare apps/web/lib/child-progress/tool-result-adapter.ts:163-169, which routes conflict_pending to progressConflictViewResult.

**Fix.** Verify the model's itemId against the view's own topics plus view.conflicts (both scoped by getChildProgressView(context.familyId, childId)), not against the derived sky, so a contested or corrected item is still addressable. Then handle the full CorrectProgressAnswersResult union in the adapter: conflict_pending -> progressConflictViewResult, unknown_item/unknown_child/idempotency_mismatch -> refusal.

### [SERIOUS] A replayed correction reports failure to the model after the write already succeeded. The plan collapses `duplicate` into a refusal, unlike every other progress adapter, which recurses into the stored original.

**Evidence.** apps/web/lib/child-progress/progress-service.ts:736-753 returns `{status:"duplicate", original}` when the operation receipt already exists with a matching payload hash. apps/web/lib/child-progress/tool-result-adapter.ts:82-83, :170-171 and :197-201 all do `return adaptXResult({...input, result: result.original})`. The plan's correct_ability case returns refusedProgressResult() for any status other than answers_corrected. Failing scenario: eve retries the tool call inside the same turn (same providerMessageId, so the same idempotency key and the same payload hash) after a stream hiccup; the star is already down and superseded, but Homa is told "refused" and tells the mother her correction did not land, or calls the tool a third time.

**Fix.** Add a `case "duplicate": return adaptCorrectionResult({...input, result: result.original})` recursion, mirroring adaptJournalResult, before the generic refusal.

### [SERIOUS] Two corrections in one message silently lose the second. The idempotency key is derived per action per turn, not per item, so the second correct_ability in a turn collides with the first and returns idempotency_mismatch, which the plan maps to a refusal.

**Evidence.** apps/web/lib/child-progress/tool-contract.ts:289-309 builds the key from `[action, ...provider-or-runtime identity]` only, with no item in it, and apps/web/lib/child-progress/tool-adapter.ts:90-93 computes it once per command. apps/web/lib/child-progress/progress-service.ts:701-708 hashes the payload over `changes`, and :734-735 returns `idempotency_mismatch` when an existing claim's hash differs. Failing scenario: "He can't actually count past ten, and he can't write his name either." The model calls correct_ability twice in one turn; call one writes, call two claims the same key with a different payload hash, gets idempotency_mismatch, and the plan refuses it. One correction lands, one vanishes with no trace and no telemetry. The plan's proposed remedy (adding quote/channel/messageId to hashChildProgressOperationPayload) cannot help, because those four values are identical for both calls in one message.

**Fix.** Scope the key at the adapter: pass `${idempotencyKey}:${command.itemId}` for correct_ability (the per-change suffix at progress-service.ts:868 already does this one level down for evidence rows). The plan's payload-hash change should be dropped: two corrections of one item from two different messages already get different keys via providerMessageId, and widening the hash only turns benign replays into idempotency_mismatch across the deploy boundary for receipts written before it.

### [SERIOUS] A correction message longer than 500 characters throws out of the write. Nothing in the specified code truncates the quote, and the plan's own note assigns truncation to a file where it then writes no truncation.

**Evidence.** apps/web/lib/child-progress/progress-service.ts:388-395 throws `TypeError("Progress evidence quote cannot exceed 500 characters")` inside validateProgressEvidenceWrite. context.canonicalInboundText is bounded to 8,000 characters, not 500, at apps/web/lib/child-progress/tool-contract.ts:197-202. The plan's manage_child_progress wiring passes `quote: context.canonicalInboundText` unmodified, and its tool-adapter case does no slicing. Failing scenario: a mother writes two paragraphs explaining why the ability was never real; the TypeError escapes correctProgressAnswers, the transaction never commits, no evidence row, no operation receipt, no event, and the tool surfaces an error rather than a receipt. The journal path already handles this correctly with `Array.from(claim.quote).slice(0, 500).join("")` at progress-service.ts:1586 and :1614.

**Fix.** Truncate in the manage_child_progress wiring exactly as the journal path does, `quote: context.canonicalInboundText === null ? null : Array.from(context.canonicalInboundText).slice(0, 500).join("")`, and add a test with an 800-character inbound message.

### [FATAL] celebration.correction_recorded cannot be emitted from the place the plan puts it. The progress event pipeline is typed to `progress.*` names only and dispatches through an exhaustive per-name switch, so as written this either fails typecheck or emits nothing, and pnpm check:events fails either way because the plan deliberately leaves the event unstaged.

**Evidence.** apps/web/lib/child-progress/progress-events.ts:28 declares `type ProgressEventName = Extract<EventName, `progress.${string}`>`, and :30-35 builds ProgressEvent as a mapped union over exactly that. progressEventsForCorrectionResult (:228-242) returns ProgressEvent[]. apps/web/lib/child-progress/progress-events.ts:552 onward is a per-name switch (`case "progress.evidence_recorded": ... await emitMapEvent("progress.evidence_recorded", event.props)`), so a name with no case is never emitted. scripts/events-check.mts:82-90 fails any registry name with no emitter unless it is in STAGED_EVENTS (:19), and the plan explicitly excludes celebration.correction_recorded and celebration.map_census from STAGED_EVENTS. Note also that the guard's emitter scanner (scripts/events-check.mts:50) only matches literal names inside emitEvent/emitMapEvent/emitMapEventOnce calls, so a name that only appears in a ProgressEvent object literal is invisible to it.

**Fix.** Either widen ProgressEventName to a union of `progress.${string}` and the two celebration names and add the matching switch case, or emit the celebration event with an explicit `emitMapEvent("celebration.correction_recorded", {...})` call from runtime.ts's committed-events callback (which is inside the scanner's roots and matches its regex). Name the file and line for the emitter in the plan, since check:events is a required CI guard.

### [SERIOUS] The regression half of the instrument is wired to a function that returns early for every recorded write, so `kind: "regression"` can never fire and the admin page's regression count is a permanent zero.

**Evidence.** apps/web/lib/child-progress/progress-events.ts:194-204: progressEventsForJournalObservation returns `[]` unless `result.status` is one of no_match, activity_only, or ambiguous, that is, unless nothing was recorded. A regression reported through record_journal_evidence commits with status "recorded" (RecordJournalProgressEvidenceResult, progress-service.ts:123-132), which the function discards. Failing scenario: a mother says "he used to read those and now he will not", the claim lands as a not_yet row exactly as the plan intends, and celebration.correction_recorded never fires. The admin page then shows regressions = 0 forever while corrections are counted, so the very split the plan says must never be summed is invisible, and the correction rate looks like the whole story.

**Fix.** Emit from the recorded branch instead: hook progressEventsForJournalRecorded / the `case "recorded"` path in apps/web/lib/child-progress/runtime.ts's journal wrapper, and pass through the previous state of each affected item (which the caller must read before the write, because after the write it is no longer lit).

### [SERIOUS] The coverage clause renders two different numbers for the same child under one sentence, because the stat tile's number comes from a stored report snapshot while the abilities card's comes from the live evidence ledger.

**Evidence.** apps/web/components/dashboard/stat-tiles.tsx:27 sums `report.scores.observationCount`, defined at packages/core/src/map/scoring.ts:310 as `answers.filter(isRealObservation).length` over the answers captured in a stored report; apps/web/lib/dashboard.ts:19-31 and :33-39 read those reports from the `child_reports` table, so the number is as old as the last scoring. The abilities card renders `abilitiesCoverageClause(childName, sky.reported)` derived live from effective evidence via abilities-from-view.ts:46-59. Failing scenario: a child answered 12 items during onboarding, then three more abilities were journaled through chat before any new report was generated. /app/kids/[childId] says "Ivy's map is built from the 12 things you have told me so far" and the Progress page says 15. The clause exists to make a number honest, and shipping it over two different numbers does the opposite.

**Fix.** Either do not put the clause on the stat tile in this tranche (leave "every answer sharpens the picture"), or feed the tile the same live `sky.reported` the abilities card uses. Do not attach the sentence "the N things you have told me" to a snapshot count whose definition is different.

### [SERIOUS] The implied-correction kill condition divides a fleet-wide flow by a visited-children stock, so the number it trips on is not a rate of anything and can exceed 1.

**Evidence.** The numerator counts celebration.correction_recorded rows with contested_state "implied", emitted from the chat path for every family. The denominator, impliedNodes, sums the latest census row per child, and the census only exists for children whose Progress page was opened, because the plan's beacon fires from a useEffect on that page (modeled on apps/web/app/api/map/report-viewed/route.ts). Failing scenario: corrections arrive mostly by SMS from families who rarely open the web Progress page; 30 implied corrections land against an impliedNodes sum drawn from the 25 children who did open it. The ratio reads well over 10 percent, trips `implied_corrections`, and the plan's stated action is "R5 pauses until the graph is fixed" when nothing about the graph changed. The `childrenWithCensus >= 20` gate sizes the denominator but does not make the two populations the same one.

**Fix.** Restrict the numerator to children that have a census row inside the same window (join on child_id), and report the covered-child count beside the rate. Alternatively make the census a nightly fleet job over all live-progress children rather than a page beacon, and keep the beacon only as a freshness top-up.

### [FATAL] The correction and regression paths make Homa celebrate the exact thing the mother just took away. `isNew` is state-blind: it fires on any node with a dated `observedAt` inside seven days (apps/web/lib/child-progress/abilities-view.ts:111-116), and `newThisWeek` counts those stars with no state filter (abilities-view.ts:207). abilities.ts:174 stamps `observedAt: entry.observedAt` on every explicit node, including `not_yet`. The plan's `correct_ability` writes an explicit `not_yet` dated `context.now` (its own manage_child_progress wiring passes `observedAt: context.now`), and its regression path deliberately routes a `not_yet` claim through `record_journal_evidence`, also dated now. Both therefore mint a NEW STAR THIS WEEK. The plan's edge-case register reasons about `lit` and never touches `newThisWeek`.

**Evidence.** Rowan's mother, Wednesday of week three. She types "he used to read those and now he will not." Homa replies with the plan's designed regression line (abilityRegressed): the day he first did it is still on his list of firsts. Thursday she opens Progress. apps/web/components/progress/abilities-card.tsx:148-149 renders, in sage green (`var(--sage-700)`), "1 new star since last week." and :140 renders "41 abilities so far · 1 new this week" (abilities-copy.ts:32-35, :38-42). The new star is the regression she reported. Same failure for `correct_ability`: she says "he cannot actually do that", and the ability she deleted is counted and coloured as this week's win.

**Fix.** Make `isNew` refuse a `not_yet` node in abilities-view.ts:111-116 (pass `node.state` into `isNew`, or filter at abilities-view.ts:207 with `star.isNew && star.state !== "not_yet"`). Add to the plan's abilities-view.test.ts case list: "a not_yet node dated today is never counted in newThisWeek" and "a correction dated today does not change newThisWeek". Ship this in the same tranche as `correct_ability`, not after it: the tranche is what makes the bug routine.

### [FATAL] The plan's own correction copy is false on the surface it describes. `abilityCorrectedImplied` and `abilityCorrectedReported` both say the statement "is off {child}'s map". It is not. A correction writes an explicit `not_yet`, which abilities.ts:163-179 pushes as a node like any other; abilities-card.tsx:33 and :89-91 draw it as a visible stone-ringed circle on the navy strip; abilities-view.ts:206 counts it in `lit`; and abilities-copy.ts:32-35 renders that unchanged number as "41 abilities so far". The plan's edge-case register spots this and waves it off because "the word 'lit' never appears in parent copy" ,  but the number does, it is rendered by the card the tranche is editing, and it does not move. Worse, the star sits under the card's live intro line.

**Evidence.** Nora's mother, Tuesday. Homa lit "multiply two-digit numbers" from an implied closure. She says "she cannot actually do that." Homa says: '"multiply two-digit numbers" is off Nora's map.' Nothing leaves the map. abilities-card.tsx:136 renders abilitiesIntro: "Every star is something Nora has shown. The map only ever counts up." (abilities-copy.ts:20). Directly under that sentence sits a star for the ability the mother just told Homa Nora has never shown, the headline count is identical to yesterday's, and the plan's new coverage clause count goes UP by one (a correction of an implied node adds an explicit row where there was none, so `reported` = N+1). She contested a claim; Homa told her it was removed; the page says it is still there and that she has now told Homa one more thing.

**Fix.** Either (a) change the copy to what is true: "I have written that down as not yet, in your words" plus the provenance sentence, and drop "off the map" from both correction strings; or (b) make it true by excluding `source: 'correction'` not_yet nodes from `nodes` in deriveAbilityMap and from `lit`. (a) is the receipt-law-consistent choice. Either way, add a test in abilities-card.test.tsx: "a corrected ability does not raise the headline count and the card never claims removal."

### [FATAL] The tranche instructs the phone line to perform a write the phone line cannot perform. Both new instructions.md sections are placed "after `## Have opinions` and BEFORE `## What you know each turn`", and scripts/telnyx-provision.mts:364 splits on exactly that heading, so both ship into the general voice persona. But the hosted Telnyx assistant has exactly four tools (apps/web/agent/general-call-instructions.md:12: send_email, remember, log_hours, send_signup_link) and manage_child_progress is not one of them; telnyx-provision.mts:349-351 says the port trims tools because "the hosted assistant has none of them." Independently, apps/web/lib/child-progress/tool-adapter.ts:51-63 refuses every channel outside web/sms/email. The plan's own test list even asserts "correct_ability is refused on the dispatch and voice channels" ,  and then hands voice an instruction that says "take the star down with correct_ability... Never argue, never re-light it."

**Evidence.** A mother calls the line on a Tuesday: "Actually Nora can't multiply two-digit numbers, I got that wrong." Voice-Homa, following the new always-on section verbatim, thanks her and describes the removal with its provenance sentence. No tool exists, nothing is written. Friday's letter can still ground a slot on that ability, and the star is still on her Progress page. This is the same class as the failure general-call-instructions.md:5-8 was written to stop ("on 2026-07-19 a live call claimed a worksheet was emailed and added to the binder when neither is possible on a call"), and that file's enumerated prohibitions cover worksheets and the binder only, so nothing catches a fabricated progress write. Section one has the same shape: step 4 tells voice-Homa to name "the one ability sitting open next for them, from ready-next", but ready_next reaches the agent only through explore_child_map (instructions.md:100-110, below the split so voice never sees it), the voice `{{family_context}}` carries no ready-next (apps/web/lib/family-context.ts pushes only "does easily" and "working edge" at :154-157), and voice has no such tool. The instruction asks for a specific named ability at the moment the plan itself calls her most frightened, with no source for it.

**Fix.** Move section two ("When she says an ability is not true") BELOW `## What you know each turn` so it stays web/SMS-only, and in the same tranche add a voice-specific paragraph to apps/web/agent/general-call-instructions.md's "What you cannot do on this call" list: on a call you cannot change, add to, or take anything off a child's map; say so and offer the text path. For section one, replace "from ready-next" with a source voice actually has, or gate the whole move below the split and give voice a shorter version that names only what is in the family-context snapshot.

### [SERIOUS] `YOUNG_MAP_REPORTED_MAX = 12` reinstates a ranked standing label on a child, built from the exact number a founder ruling four days ago found to be systematically backwards. The clause is not one clause: it is two, and which one a child gets is a binary class assignment rendered on that child's page, one tap from the sibling switcher. The plan's own justifying comment cites the production numbers that prove the underlying quantity is age-inverted, then builds a threshold out of it anyway.

**Evidence.** Family a64e1ba5, the plan's own cited case: the 12-year-old has 10 `easily` answers, the 7-year-old has 36. `reported` for the 12-year-old lands at or under 12, so his card reads "Ronan's map is young." The 7-year-old's reads "Ivy's map is built from the 41 things you have told me so far." The word "young" is attached to the older child. Founder ruling `kid-standing-chip` (2026-07-22, docs/homa-planning/journeys/10-reconciliation.md:174) removed "Ahead ✦"/"On track"/"Growing right now" from the per-kid header for precisely this reason, in these words: "the label was also frequently backwards, since age bands ask older children harder questions while implied closure pushes the other way." The tranche re-introduces the hazard one surface over, with a threshold instead of a colour.

**Fix.** Delete YOUNG_MAP_REPORTED_MAX and ship one clause shape at every count: `${childName}'s map is built from the ${things} you have told me so far. Each one you add lights more of it.` It is true at 1 and at 41, it carries no class boundary, and it is the shape the spec's own line 340 asks for. Add an abilities-view.test.ts case: "the clause has exactly one shape; no reported count produces different wording than any other."

### [SERIOUS] The plan's kid-pill facts are stale, its D7 escalation re-opens a shipped ruling, and meanwhile the one live ranked label on that page sits in the file the plan is editing and is deliberately left alone. verifiedFacts asserts "kid-pill.tsx:34-45 emits 'Growing right now', 'Ahead ✦', and 'On track'". Those were removed at commit 4042463 ("The kid header stops ranking the child"); kid-pill.tsx:53-63 now returns only getting-started chips or null. D7 was ruled the same day (`kid-standing-chip`, 10-reconciliation.md:174), and the ruling explicitly KEPT the getting-started chips, which is the opposite of the plan's edge-case recommendation to remove the chip entirely.

**Evidence.** What actually survives is apps/web/components/dashboard/stat-tiles.tsx:60-66: a gold tile labelled "Ahead of age", value = this child's `aheadCount`, sub "2 subjects across the family ✦" (wrong copy on a single-child page), rendered on the per-kid page by kid-view.tsx:109 with `kidCount={1}`, directly beneath the sibling switcher at kid-view.tsx:86-107. Family c9e840dd: the 6-year-old (45 answers) shows the gold "Ahead of age" tile; the 8-year-old (14 answers) shows none. The mother taps between them and Homa has performed the comparison for her, in gold, on the same page where this tranche adds a clause saying coverage is not ability. The plan opens stat-tiles.tsx, changes one sub-caption, names only the "Subjects mapped" denominator as out of scope, and never sees the tile two lines below it.

**Fix.** Drop the D7 edge case and the stale kid-pill fact. In stat-tiles.tsx, remove the "Ahead of age" branch (lines 60-66) in this tranche, since the file is already open and the `kid-standing-chip` ruling's stated cause covers it verbatim. Fall through to the existing "Reports" tile. Add a stat-tiles test: "the per-kid page renders no ranked whole-child label."

### [SERIOUS] On the per-kid page the coverage clause states a number that is not the number the sentence names. The plan renders `abilitiesCoverageClause(childName, observations)` where `observations` is `report.scores.observationCount` (stat-tiles.tsx:27), which packages/core/src/map/scoring.ts:310 computes as `answers.filter(isRealObservation).length` over CHECKLIST map answers (scoring.ts:123-125). That is a different catalog from the taxonomy abilities the sentence describes (`sky.reported`). The clause says "{child}'s map is built from the N things you have told me so far" about a map that number has nothing to do with.

**Evidence.** Ivy, one child, one Tuesday. Her kid page says "Ivy's map is built from the 34 things you have told me so far." Her Progress page's abilities card, computing `reported` from the taxonomy derivation, says a different number, and Homa in chat can quote a third from `explore_child_map`. Whichever she believes, two of the three sentences are false, and the plan proposes them as the same string from the same function so they read as the same claim. The threshold compounds it: checklist answers are bounded per age band (`maxQuestionsForAge`, scoring.ts:304-309), so an older child is structurally capped nearer the young-map boundary ,  the clause's own threshold inherits the age bias the clause exists to correct.

**Fix.** Do not put the abilities clause on stat-tiles.tsx at all in this tranche. Either leave "Your answers" with its existing sub-caption, or write a separate string that names what that tile actually counts (checklist and chat answers), and keep `abilitiesCoverageClause` bound to `sky.reported` on the abilities card only. If both must ship, add a test asserting the two surfaces cannot be fed from different counters.

### [SERIOUS] The contested-item fix makes the abilities count fall, silently, under a sentence on the same card promising it never does, and it makes the derivation contradict its own documented semantics. Removing contested ids from `confirmed` drops any previously implied star for that item, so `lit` decreases (abilities-view.ts:206) and `abilitiesCount` renders a smaller number (abilities-copy.ts:32-35) directly beneath abilitiesIntro's "The map only ever counts up" (abilities-copy.ts:20, rendered at abilities-card.tsx:136). The plan lists six tests for the contested set and no copy, no receipt, and no test for what the parent sees when a star leaves.

**Evidence.** A multi-parent family: dad answers "place value to 100: easily", mum answers "not yet" on the same item. A conflict opens (progress-service.ts:995-1006), effective evidence drops the item (effective-evidence.ts:296-297), and with the plan's change `confirmed.delete(itemId)` removes it. The child's Progress card goes from "41 abilities so far" to "40 abilities so far" overnight, with no line anywhere saying why, under a sentence guaranteeing the count only grows. Second defect in the same change: the child still has an explicit "two-digit subtraction: easily" whose hard closure includes place value, so the map now shows the harder ability lit and its own prerequisite dark, against the semantics abilities.ts:23-28 states ("'easily' confirms a topic AND its transitive hard prerequisites").

**Fix.** Keep the contested node visible in its own state rather than deleting it: add a `contested` AbilityState with a distinct render and copy ("you and {other adult} answered this differently, both are saved"), so nothing vanishes and `lit` never falls. If that is too large for this tranche, at minimum add a test "a conflict opening never lowers sky.lit" and change abilitiesIntro before shipping, and state in the docblock that an explicit `easily` whose closure includes a contested item leaves that item dark on purpose.

### [FATAL] correct_ability throws and loses the correction whenever the parent's message is longer than 500 characters. The plan passes the whole inbound text as the quote, but the service hard-throws above 500 chars, and none of the plan's code blocks truncate.

**Evidence.** apps/web/lib/child-progress/progress-service.ts:389-395 throws `new TypeError("Progress evidence quote cannot exceed 500 characters")` for any write whose quote exceeds 500 code points. The plan's `manage_child_progress.ts` block passes `quote: context.canonicalInboundText` raw. `boundedInboundText` (apps/web/lib/child-progress/tool-contract.ts:197-202) caps that value at 8_000, not 500, so the plan's cited precedent ("matching how boundedInboundText already bounds") does the opposite of what the plan claims, and its own tool-adapter case block contains no slice. Failing scenario: a mother writes a 620-character paragraph ending "...honestly he cannot count past ten, that was me being optimistic". The model calls correct_ability, `appendEvidenceWrite` -> `validateEvidenceWrite` throws inside the transaction, the throw escapes `withCommittedProgressEvents` (apps/web/lib/child-progress/progress-events.ts:654-663 only wraps `eventsForResult`, not the operation promise), the tool call errors, and the single most valuable message of her week writes nothing. The DB has the same ceiling independently: `quote text check (quote is null or char_length(quote) <= 500)` in supabase/migrations/20260711213330_agent_led_live_progress.sql:95.

**Fix.** Do not use the whole message as the quote. Make `correct_ability` carry a model-supplied `quote` field re-verified verbatim against `context.canonicalInboundText` by code, exactly as the journal path already does (claim quote max 400 at apps/web/lib/child-progress/claim-extraction.ts:36, re-checked by `quoteAppearsIn` at apps/web/lib/child-progress/claim-validation.ts:108). Refuse the command when the quote is not a verbatim substring. That satisfies the 500-char ceiling structurally and keeps provenance checkable, instead of storing a truncated prefix whose tail silently vanished.

### [FATAL] `abilityCorrectedImplied` asks for provenance the system does not have and cannot produce, so the model would be left to invent the ability and the date that a correction receipt traces to.

**Evidence.** The signature is `abilityCorrectedImplied(childName, statement, impliedByStatement, impliedByDate)` and the rendered string is `... It came from ${impliedByStatement} on ${impliedByDate}, which implies it ...`. Nothing records which mastered topic's closure lit an implied node: apps/web/lib/child-progress/abilities.ts:131-135 iterates `hardPrerequisiteClosure(itemId)` and adds bare ids to a `Set<string>`, discarding the originating item; `AbilityNode` (abilities.ts:45-54) has no `impliedBy` field; and abilities.ts:193 sets `observedAt: null` for every implied node, so there is no date to name either. The plan adds no field to carry them. It then states these strings are "quoted verbatim as the worked examples in instructions.md so there is one source", which means the only thing that can fill those two slots at runtime is the model's memory of the turn. Failing scenario: the mother taps "he cannot actually do that" on an implied star and Homa replies "It came from 'she counted to twenty' on 4 July, which implies it" for an item the closure actually reached from a different topic on a different date. That is a fabricated receipt on the one surface the spec's §1 law says must trace to her own words with a date.

**Fix.** Either add an `impliedBy: { itemId, statement, observedAt }` field to `AbilityNode`, populated in the closure loop at abilities.ts:131-135 (the loop already knows the originating `itemId` and its `explicit` entry with `observedAt`), and pass it into the copy function from verified data; or cut `impliedByStatement`/`impliedByDate` from the copy entirely and ship the shorter true sentence ("it was something the map inferred rather than something you told me") until the provenance field exists.

### [SERIOUS] Two corrections in one turn silently lose the second one. The idempotency key is derived from action plus turn, never from the item, so the second correct_ability collides and is refused.

**Evidence.** apps/web/lib/child-progress/tool-adapter.ts:90-93 computes one `idempotencyKey = progressOperationIdempotencyKey(context, command.action)` per invocation, and apps/web/lib/child-progress/tool-contract.ts:289-309 hashes only `[action, "runtime", runtimeSessionId, turnId]` (or `[action, channel, providerMessageId]`). Neither `childId` nor `itemId` enters it. `correct_ability` as specified carries exactly one `itemId`. apps/web/lib/child-progress/progress-service.ts:727-736: the second call claims the same key, `claim.kind === "existing"`, `claim.receipt.payloadHash !== payloadHash` (the hash at :701-708 includes `changes`), so it returns `{ status: "idempotency_mismatch" }`. Failing scenario: "Actually he cannot count past ten, and he cannot write his name either." Homa calls correct_ability twice in the turn. The first star comes down; the second returns idempotency_mismatch, the plan's adapter maps it to `refusedProgressResult()`, and the ability she just took back stays lit. Same collision for two children in one turn.

**Fix.** Make the action a batch: `itemIds: z.array(...).min(1).max(6)` mapping to `changes: itemIds.map(id => ({ itemId: id, answer }))`, which is the shape `correctProgressAnswers` already takes (progress-service.ts:144) and which keeps one operation per turn. Alternatively add the item to the key, but the batch matches how `record_journal_evidence` already handles N claims inside one operation.

### [SERIOUS] The adapter's `if (result.status !== "answers_corrected") return refusedProgressResult()` tells the parent a correction failed when it actually succeeded, and throws away the conflict card.

**Evidence.** `CorrectProgressAnswersResult` (apps/web/lib/child-progress/progress-service.ts:158-170) includes `{ status: "duplicate", original }` and `ProgressConflictPendingResult`. Every existing adapter in apps/web/lib/child-progress/tool-result-adapter.ts recurses on duplicate (:82-83, :170-171, :197-201) and renders conflict_pending as a conflict view (:84-104, :163-169). The plan's branch collapses both to a refusal. Failing scenario A: eve retries the identical tool call after a stream hiccup; the service returns `duplicate` with the real receipt, the plan returns REFUSED_PROGRESS_NOTE, and Homa tells the mother she needs to try again for a star that is already down. Failing scenario B: the other adult had answered the same item, so `correctProgressAnswers` returns `conflict_pending` at progress-service.ts:765-782; instead of the conflict card, she gets a flat refusal with no explanation.

**Fix.** Write `adaptCorrectionResult` in tool-result-adapter.ts alongside the three existing adapters: recurse on `duplicate` into `result.original`, route `conflict_pending` through `progressConflictViewResult`, refuse only on `unknown_child` / `unknown_actor` / `unknown_item` / `idempotency_mismatch`.

### [SERIOUS] `celebration.correction_recorded` has no emitter that can exist as described, and excluding it from STAGED_EVENTS turns `pnpm check:events` red.

**Evidence.** Three separate problems, all verified. (1) The plan puts the emitter in apps/web/lib/child-progress/tool-result-adapter.ts, a file it states it did not read; that file has no correction branch at all, and corrections emit from apps/web/lib/child-progress/runtime.ts:144-158. (2) `ProgressEvent` is typed `Extract<EventName, `progress.${string}`>` at apps/web/lib/child-progress/progress-events.ts:29-34, so returning a `celebration.*` event from `progressEventsForCorrectionResult` (:228-242) does not typecheck, and `emitProgressEvent` (:552-635) is a closed switch of literal `emitMapEvent("progress.x", ...)` calls with no celebration case. (3) The plan names `progressEventsForJournalObservation` (:194-213) as the regression emitter, but that function returns `[]` for everything except `no_match | activity_only | ambiguous` (:198-204), i.e. exactly the statuses where nothing was written; a recorded `not_yet` claim never reaches it. Failing scenario: CI runs `pnpm check:events`; scripts/events-check.mts:50 scans for the literal `emit(Map)?Event(Once)?(..."name.name"` shape, finds no site for `celebration.correction_recorded`, and :80-87 reports `registry "celebration.correction_recorded" has an emitter` FAIL because scripts/events-check.mts:19 deliberately omits it from STAGED_EVENTS. Build red on push.

**Fix.** Widen `ProgressEventName` to `Extract<EventName, "progress.${string}" | "celebration.correction_recorded">`, add the switch case with a literal `emitMapEvent("celebration.correction_recorded", event.props)` in `emitProgressEvent`, and emit from `progressEventsForCorrectionResult` (correction) and from the recorded-write path in runtime.ts:103-119 (regression), not from `progressEventsForJournalObservation`. Name the real files; drop tool-result-adapter.ts from the plan.

### [SERIOUS] The offer-declines kill condition has no data path. `conversation.reply_resolved` cannot be joined to a Friday letter, so `offersAccepted` / `offersDeclined` are unbuildable.

**Evidence.** packages/core/src/events.ts:726-745 defines `conversation.reply_resolved` as `.strict()` with exactly `family_id, channel, resolution, resolved_outcome, cross_channel, resolution_method, classifier_version`. There is no `task_run_id`, no `child_id`, no loop id. The plan's `loadCelebrationInstrument` says it "reads public.events for the five names plus conversation.reply_resolved joined to homa_task_runs.kind = 'friday_letter'" and the summary type declares `offersDecided/offersAccepted/offersDeclined`. There is no column to join on. Failing scenario: the only available correlation is family_id plus a time window, and the morning brief emits the same event for the same family in the same window (its offers are the other consumer of open loops), so every morning-brief decline is attributed to the letter. `celebrationKillVerdicts` then trips `offer_declines` with the hard-coded action "Ritual offers come out of the letter entirely", removing a feature on another feature's numbers.

**Fix.** Either add `source` and `task_run_id` to `conversation.reply_resolved` in the registry (an additive schema change, but it must ship with an emitter that populates them from the open-loop row), or cut the offer_declines kill condition from this tranche and say so, rather than shipping a summarizer field and a hard-coded action for a number nothing can compute.

### [SERIOUS] The coverage clause stacks a second, smaller count directly under the first with nothing naming the gap, which manufactures exactly the fraction the file exists to prevent.

**Evidence.** apps/web/components/progress/abilities-card.tsx:139-141 renders `abilitiesCount(sky.lit, sky.newThisWeek)`. The plan puts `abilitiesCoverageClause(childName, sky.reported)` immediately beneath it in the same right-aligned block. The two numbers are different by construction: `lit: stars.length` (apps/web/lib/child-progress/abilities-view.ts:206) counts every node including implied ones pushed at apps/web/lib/child-progress/abilities.ts:187-195, while the plan defines `reported` as `stars.filter(s => s.state !== "implied").length`. The plan's own test case states it: "STORY_EVIDENCE has 3 explicit answers plus graph implications; assert sky.reported === 3 and sky.lit > 3". Failing scenario: the card reads "38 abilities so far" and directly under it "Sam's map is young. It is built from 3 things you have told me so far." A reader supplies 3-of-38 herself. apps/web/lib/child-progress/abilities-view.ts:19-25 is the docblock the plan proposes to extend with a promise this layout breaks.

**Fix.** Render one count per surface. Either replace the headline with the reported count and drop `abilitiesCount(sky.lit, ...)` from this card, or place the clause where the two numbers are not adjacent and have the clause name both ("38 stars, built from the 3 things you have told me so far; the rest come with them"). Do not ship two counts of the same map one line apart.

### [SERIOUS] The stat-tiles clause states a third, different number for the same child on the same day, and lands in a grid with a literal denominator and a ranking tile.

**Evidence.** apps/web/components/dashboard/stat-tiles.tsx:27 computes `observations = reports.reduce((sum, r) => sum + r.scores.observationCount, 0)`, a report answer count. The plan's own verifiedFacts say these "are answer counts, not ability counts". Passing it into `abilitiesCoverageClause` produces "Ivy's map is built from the 47 things you have told me so far" on /app/kids/[childId] while /app/progress renders the same sentence with `sky.reported` = 6. Same child, same day, two receipts that disagree. Separately, the clause renders inside the three-column grid at stat-tiles.tsx:90 whose first tile is `${mapped} of ${possible}` (:41) and whose third can be "Ahead of age" with `${aheadCount} subjects across the family ✦` (:61-66). Failing scenario: the mother reads "Subjects mapped 4 of 6", then "Ahead of age 2", then a sentence claiming the map only ever counts up, one tap from the sibling switcher at apps/web/app/app/kids/[childId]/kid-view.tsx:86-107.

**Fix.** Do not put the abilities coverage clause on a report-scores tile. If the per-kid page needs the clause it must be fed `abilitiesSkyFromView(...).reported`, the same number the abilities card uses. And do not add the clause to that grid at all while `${mapped} of ${possible}` and the "Ahead of age" tile are still in it; fix or remove those first, or leave the tile's existing sub-caption alone.

### [SERIOUS] The comparative-question instruction cannot execute on voice, and voice coverage is the plan's stated reason for putting it in always-on instructions instead of a skill.

**Evidence.** scripts/telnyx-provision.mts:355-357 states the phone rules "are appended last so they bind hardest", and :368-375 spells them out: "One or two short sentences per turn, never three. One thought per turn; save the rest for after the caller responds." The plan's move is a five-part reply (name the worry, stay with the child, one concrete thing, the ready-next ability, one small offer) delivered "in one short reply". On the phone the later-binding rule wins and the procedure is unfollowable, yet the plan argues "Voice has no skill loading at all... so a skill would leave the two highest-stakes channels uncovered" as its placement justification. All three evals are chat evals; none exercises the voice persona. Failing scenario: a mother asks the phone line "is Ben behind his sister?". The model obeys the hardest-binding two-sentence rule, drops most of the five steps, and improvises which ones to keep, which is the exact failure the section exists to prevent, with no test that would ever show it.

**Fix.** Write a two-sentence voice variant of the move (name the worry, one true thing about the child she named, stop) and put it in apps/web/agent/general-call-instructions.md, which is appended after the split and binds at the same level as the phone rules. Then either add a voice-path eval or state plainly in the plan that voice is uncovered this tranche.

### [SERIOUS] The correction copy says the ability is off the map while the star is still visibly on the map, relabelled.

**Evidence.** `abilityCorrectedImplied` and `abilityCorrectedReported` both render `"${statement}" is off ${childName}'s map`. But the plan's own edge case insists a correction must write an explicit `not_yet` and never delete, and apps/web/lib/child-progress/abilities.ts:163-179 pushes every item in `explicit` as a node regardless of answer, so the corrected item remains a star with `state: "not_yet"`. Tapping it renders apps/web/lib/child-progress/abilities-copy.ts:105-108: "Not yet is a normal answer. This one stays on the map, ready to light up when Sam gets there." Failing scenario: she corrects an implied star, Homa says it is off the map, she opens the map, the star is still there and the popover tells her it stays. Two of Homa's own sentences contradict each other about the same node, on the surface the correction was supposed to make trustworthy.

**Fix.** Change the copy to describe what actually happens ("I have moved that to not yet on Sam's map, and taken the claim back"), or introduce a distinct `corrected` AbilityState that renders differently and escalate that as the ruling it is. Do not ship copy whose claim the next screen refutes.

