import { MAP_SUBJECTS } from "@homa/core";

import { SKILL_CATALOG } from "../../lib/child-progress/skill-catalog";
import { buildChildProgressView } from "../../lib/child-progress/projection";
import type { ChildProgressProjectionInput, StoredProgressEvidence } from "../../lib/child-progress/repository";
import { JOURNAL_HOURS_PROGRESS_NOTE, manageChildProgressResultSchema } from "../../lib/child-progress/tool-result-contract";

export const NEXT_MOVE_FAMILY = "11111111-1111-4111-8111-111111111111";
export const NEXT_MOVE_CHILD = "22222222-2222-4222-8222-222222222222";
export const NEXT_MOVE_OTHER_CHILD = "33333333-3333-4333-8333-333333333333";
export const NEXT_MOVE_NOW = new Date("2026-09-05T16:00:00.000Z");
export const CUT_LINE = "fine_motor.cuts-line";
export const CUT_CURVES = "fine_motor.cuts-curves";
export const MUSIC_ITEM = MAP_SUBJECTS.find(subject => subject.id === "music")!.items[0]!.id;

export function nextMoveEvidence(itemId: string, override: Partial<StoredProgressEvidence> = {}): StoredProgressEvidence {
  return {
    id: `synthetic-${itemId}`, childId: NEXT_MOVE_CHILD, familyId: NEXT_MOVE_FAMILY,
    itemId, answer: "getting_there", derivation: "direct", source: "check_in",
    memberUserId: "44444444-4444-4444-8444-444444444444", adultDisplayName: "Elena",
    quote: null, channel: "web", messageId: "synthetic-message", checkInId: "synthetic-check-in",
    supersedesId: null, supersededAt: null, observedAt: "2026-09-04T16:00:00.000Z",
    createdAt: "2026-09-04T16:00:01.000Z", idempotencyKey: `synthetic-${itemId}`,
    ...override,
  };
}

export function nextMoveLedger(rows: StoredProgressEvidence[], sourceRevision = BigInt(7)): ChildProgressProjectionInput {
  return { familyId: NEXT_MOVE_FAMILY, child: { id: NEXT_MOVE_CHILD, name: "Maya", birthDate: "2020-01-02" },
    timeZone: "America/New_York", sourceRevision, evidence: rows, conflicts: [], selectionAnswers: [] };
}

export function nextMoveState(ledger: ChildProgressProjectionInput) {
  return { familyId: NEXT_MOVE_FAMILY, ledger, view: buildChildProgressView({ ...ledger, now: NEXT_MOVE_NOW }), now: NEXT_MOVE_NOW };
}

/** Synthetic prior save in the real progress_update result shape. Capture and
 * durable writes are verified by the separate progress-capture harness. */
export function postSaveProgressReceipt() {
  const state = nextMoveState(nextMoveChatScenario("post_save_offer").ledger);
  const topic = state.view.subjects.flatMap(subject => subject.domains)
    .flatMap(domain => domain.topics).find(item => item.itemId === CUT_CURVES)!;
  return manageChildProgressResultSchema.parse({
    kind: "progress_update", label: "Progress updated", childName: state.view.childName,
    note: JOURNAL_HOURS_PROGRESS_NOTE,
    affectedTopics: [topic.statement], undoAvailable: true,
    undoToken: "55555555-5555-4555-8555-555555555555",
  });
}

export function crowdedNextMoveLedger() {
  const math = MAP_SUBJECTS.find(subject => subject.id === "math")!.items.slice(0, 8)
    .map(item => nextMoveEvidence(item.id, { answer: "not_yet" }));
  const earlierSubjects = MAP_SUBJECTS.slice(1, 6).map(subject => nextMoveEvidence(subject.items[0]!.id, { answer: "easily" }));
  return nextMoveLedger([...math, ...earlierSubjects, nextMoveEvidence(CUT_CURVES), nextMoveEvidence(MUSIC_ITEM)]);
}

export function cuttingCandidate(itemId = CUT_CURVES) {
  return { childId: NEXT_MOVE_CHILD, targetItemId: itemId, evidenceItemIds: [itemId], minutes: 5 as const,
    activity: itemId === MUSIC_ITEM ? "Play one familiar short song and sway together to the music."
      : itemId === CUT_LINE ? "With an adult beside Maya, cut along one wide straight line on ordinary paper using child scissors."
      : "With an adult beside Maya, use child scissors to cut out one large circle drawn on ordinary paper.",
    why: itemId === MUSIC_ITEM ? "You shared on September 4 that moving to music is getting there."
      : itemId === CUT_LINE ? "You shared on September 4 that cutting straight lines is getting there."
      : "You shared on September 4 that cutting curves is getting there." };
}

export const NEXT_MOVE_CHAT_CASES = [
  "fresh_motor", "fresh_music", "stale_cutting", "unknown_cutting", "corrected_cutting",
  "all_easy", "conflict", "conflict_with_easy", "ambiguous_child", "post_save_offer", "read_unavailable", "incomplete_easy", "decline",
] as const;
export type NextMoveChatCase = typeof NEXT_MOVE_CHAT_CASES[number];

export function nextMoveChatScenario(name: NextMoveChatCase) {
  let ledger = crowdedNextMoveLedger();
  if (name === "post_save_offer") ledger = nextMoveLedger([nextMoveEvidence(CUT_CURVES, {
    observedAt: NEXT_MOVE_NOW.toISOString(), createdAt: NEXT_MOVE_NOW.toISOString(),
    source: "conversation", derivation: "inferred",
  })]);
  if (name === "stale_cutting" || name === "unknown_cutting") ledger = nextMoveLedger([nextMoveEvidence(CUT_LINE, {
    observedAt: name === "stale_cutting" ? "2026-07-07T16:00:00.000Z" : "2026-09-04T16:00:00.000Z",
    derivation: "unknown",
  })]);
  if (name === "corrected_cutting") ledger = nextMoveLedger([
    nextMoveEvidence(CUT_LINE, { answer: "easily", source: "correction" }),
    nextMoveEvidence(CUT_CURVES, { source: "correction", derivation: "inferred" }),
  ], BigInt(8));
  if (name === "all_easy") ledger = nextMoveLedger([
    nextMoveEvidence(CUT_LINE, { answer: "easily" }), nextMoveEvidence(CUT_CURVES, { answer: "easily" }),
  ]);
  if (name === "incomplete_easy") ledger = nextMoveLedger(SKILL_CATALOG.filter(skill => skill.subjectId === "math").slice(0, 25)
    .map((skill, index) => nextMoveEvidence(skill.itemId, index < 24 ? { answer: "easily" }
      : { answer: "not_yet", observedAt: "2026-09-01T16:00:00.000Z" })));
  if (name === "conflict" || name === "conflict_with_easy") {
    const a = nextMoveEvidence(CUT_CURVES, { id: "conflict-a", answer: "easily" });
    const b = nextMoveEvidence(CUT_CURVES, { id: "conflict-b", answer: "not_yet" });
    ledger = nextMoveLedger([a, b, ...(name === "conflict_with_easy" ? [nextMoveEvidence(CUT_LINE, {answer: "easily"})] : [])]);
    ledger.conflicts = [{ id: "conflict", childId: NEXT_MOVE_CHILD, familyId: NEXT_MOVE_FAMILY,
      itemId: CUT_CURVES, evidenceIdA: a.id, evidenceIdB: b.id, state: "open", resolvedAnswer: null,
      resolvedEvidenceId: null, observedAt: "2026-09-04T17:00:00.000Z", resolvedAt: null }];
  }
  const prompts: Record<NextMoveChatCase, string> = {
    fresh_motor: "What is one fine-motor activity Maya could try next?",
    fresh_music: "What is one music activity Maya could try next?",
    stale_cutting: "What should Maya try next with cutting?",
    unknown_cutting: "What should Maya try next with cutting?",
    corrected_cutting: "That straight-line drill is already easy. The correction was just saved. What would fit her cutting now?",
    all_easy: "What should Maya try next with cutting?",
    conflict: "What should Maya try next with cutting?",
    conflict_with_easy: "What should Maya try next with cutting?",
    ambiguous_child: "What should she work on next?",
    post_save_offer: "Yes, that is the progress update I wanted to save about Maya using scissors today.",
    read_unavailable: "What should Maya try next with cutting?",
    incomplete_easy: "What should Maya try next in math?",
    decline: "No, thanks. Maya has done enough today. Please leave it there, no more practice or questions.",
  };
  return { name, ledger, prompt: prompts[name], subjectId: name === "fresh_music" ? "music" : name === "incomplete_easy" ? "math" : "fine_motor",
    expectedTarget: name === "fresh_music" ? MUSIC_ITEM : CUT_CURVES,
    expectsMove: ["fresh_motor", "fresh_music", "corrected_cutting"].includes(name) };
}
