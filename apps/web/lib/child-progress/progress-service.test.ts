import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChildProgressView } from "./projection";
import type {
  AppendChildObservationInput,
  AppendProgressEvidenceInput,
  ChildProgressOperationReceipt,
  ChildProgressProjectionInput,
  ChildProgressRepository,
  ChildProgressTransaction,
  ClaimChildProgressOperationInput,
  ClaimChildProgressOperationResult,
  CompleteChildProgressOperationInput,
  InsertOpenProgressConflictInput,
  MarkChildObservationUsedInput,
  MarkChildObservationUsedResult,
  SaveDerivedChildProgressInput,
  SaveProgressCompatibilityAnswersInput,
  StoredChildObservation,
  StoredProgressEvidence,
  SupersedeProgressEvidenceInput,
} from "./repository";
import { ChildProgressService } from "./progress-service";
import type {
  ChildProgressView,
  OpenProgressConflict,
} from "./types";

const FAMILY_ID = "family-1";
const CHILD_ID = "child-1";
const JOURNAL_MESSAGE_ID =
  "11111111-1111-4111-8111-111111111111";
const JOURNAL_PROVENANCE = {
  channel: "web" as const,
  messageId: JOURNAL_MESSAGE_ID,
};
const CONVERSATION_PROVENANCE = JOURNAL_PROVENANCE;
const NOW = new Date("2026-07-11T18:00:00.000Z");

interface FakeReport {
  token: string;
  history: unknown[];
  scores: unknown;
  bankVersion: string;
  generatedAt: string;
  updatedAt: string;
  narrative: unknown;
  narrativeMeta: unknown;
}

interface FakeStoredObservation {
  id: string;
  input: AppendChildObservationInput;
  status: "new" | "used";
  usedTaskRunId: string | null;
  usedAt: string | null;
}

interface FakeRepositoryState {
  projectionInput: ChildProgressProjectionInput | null;
  liveView: ChildProgressView | null;
  liveSourceRevision: bigint | null;
  savedDerivedProgress: SaveDerivedChildProgressInput[];
  appendCount: number;
  supersedeCount: number;
  conflictCount: number;
  familyTouchCount: number;
  report: FakeReport | null;
  compatibilityAnswers: Map<
    string,
    { answer: string; source: string; observedAt: string }
  >;
  operationReceipts: Map<string, ChildProgressOperationReceipt>;
  observations: FakeStoredObservation[];
}

function cloneFakeState(
  state: FakeRepositoryState,
): FakeRepositoryState {
  return {
    projectionInput: structuredClone(state.projectionInput),
    liveView: structuredClone(state.liveView),
    liveSourceRevision: state.liveSourceRevision,
    savedDerivedProgress: structuredClone(
      state.savedDerivedProgress,
    ),
    appendCount: state.appendCount,
    supersedeCount: state.supersedeCount,
    conflictCount: state.conflictCount,
    familyTouchCount: state.familyTouchCount,
    report: structuredClone(state.report),
    compatibilityAnswers: new Map(
      structuredClone([...state.compatibilityAnswers]),
    ),
    operationReceipts: new Map(
      [...state.operationReceipts].map(([key, receipt]) => [
        key,
        structuredClone(receipt),
      ]),
    ),
    observations: structuredClone(state.observations),
  };
}

function operationReceiptKey(input: {
  familyId: string;
  childId: string;
  idempotencyKey: string;
}): string {
  return `${input.familyId}:${input.childId}:${input.idempotencyKey}`;
}

class InMemoryChildProgressTransaction
  implements ChildProgressTransaction
{
  constructor(
    private readonly repository: InMemoryChildProgressRepository,
    private readonly draft: FakeRepositoryState,
  ) {}

  async lockFamilyMemberForKeyShare(
    familyId: string,
    memberUserId: string,
  ): Promise<boolean> {
    return (
      this.repository.displayNameFor(familyId, memberUserId) !==
      undefined
    );
  }

  async loadProjectionInputForUpdate(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    return this.matchesChild(familyId, childId)
      ? structuredClone(this.draft.projectionInput)
      : null;
  }

  async loadOperation(
    familyId: string,
    childId: string,
    idempotencyKey: string,
  ): Promise<ChildProgressOperationReceipt | null> {
    const receipt = this.draft.operationReceipts.get(
      operationReceiptKey({
        familyId,
        childId,
        idempotencyKey,
      }),
    );
    return receipt ? structuredClone(receipt) : null;
  }

  async findOperationById(
    familyId: string,
    operationId: string,
  ): Promise<ChildProgressOperationReceipt | null> {
    const receipt = [...this.draft.operationReceipts.values()].find(
      (candidate) =>
        candidate.familyId === familyId &&
        candidate.id === operationId,
    );
    return receipt ? structuredClone(receipt) : null;
  }

  async findProgressEvidence(
    familyId: string,
    evidenceId: string,
  ) {
    const evidence = this.draft.projectionInput?.evidence.find(
      (candidate) =>
        candidate.familyId === familyId &&
        candidate.id === evidenceId,
    );
    return evidence
      ? {
          childId: evidence.childId,
          familyId: evidence.familyId,
        }
      : null;
  }

  async appendEvidence(
    input: AppendProgressEvidenceInput,
  ): Promise<StoredProgressEvidence> {
    if (!this.matchesChild(input.familyId, input.childId)) {
      throw new Error("Unknown child");
    }
    if (
      this.draft.projectionInput?.evidence.some(
        (evidence) =>
          evidence.idempotencyKey === input.idempotencyKey,
      )
    ) {
      throw new Error("Duplicate evidence idempotency key");
    }
    if (
      this.repository.failAppendAt ===
      this.draft.appendCount + 1
    ) {
      throw new Error("Synthetic append failure");
    }
    const adultDisplayName =
      input.memberUserId === null
        ? undefined
        : this.repository.displayNameFor(
            input.familyId,
            input.memberUserId,
          );
    if (
      input.memberUserId !== null &&
      adultDisplayName === undefined
    ) {
      throw new Error("Evidence actor is not a family member");
    }
    this.draft.appendCount += 1;
    const evidence: StoredProgressEvidence = {
      id: `evidence-${this.draft.appendCount}`,
      childId: input.childId,
      familyId: input.familyId,
      itemId: input.itemId,
      answer: input.answer,
      source: input.source,
      memberUserId: input.memberUserId,
      adultDisplayName: adultDisplayName ?? null,
      quote: input.quote,
      channel: input.channel,
      messageId: input.messageId,
      checkInId: input.checkInId,
      supersedesId: input.supersedesId,
      supersededAt: null,
      observedAt: input.observedAt,
      createdAt:
        `2026-07-11T18:00:00.${String(
          this.draft.appendCount,
        ).padStart(6, "0")}Z`,
      idempotencyKey: input.idempotencyKey,
    };
    this.draft.projectionInput?.evidence.push(evidence);
    this.bumpSourceRevision();
    return structuredClone(evidence);
  }

  async appendObservation(
    input: AppendChildObservationInput,
  ): Promise<StoredChildObservation> {
    if (!this.matchesChild(input.familyId, input.childId)) {
      throw new Error("Unknown observation child");
    }
    const stored: FakeStoredObservation = {
      id: `observation-${this.draft.observations.length + 1}`,
      input: structuredClone(input) as AppendChildObservationInput,
      status: "new",
      usedTaskRunId: null,
      usedAt: null,
    };
    this.draft.observations.push(stored);
    return {
      id: stored.id,
      childId: input.childId,
      familyId: input.familyId,
      classification: input.classification,
      status: "new",
      createdAt: "2026-07-13T14:00:00.000000Z",
    };
  }

  async claimOperation(
    input: ClaimChildProgressOperationInput,
  ): Promise<ClaimChildProgressOperationResult> {
    if (!this.matchesChild(input.familyId, input.childId)) {
      throw new Error("Unknown operation child");
    }
    if (!/^[0-9a-f]{64}$/u.test(input.payloadHash)) {
      throw new Error("Invalid operation payload hash");
    }
    const key = operationReceiptKey(input);
    const existing = this.draft.operationReceipts.get(key);
    if (existing !== undefined) {
      return {
        kind: "existing",
        receipt: structuredClone(existing),
      };
    }
    const receipt: ChildProgressOperationReceipt = {
      id: `00000000-0000-4000-8000-${String(
        this.draft.operationReceipts.size + 1,
      ).padStart(12, "0")}`,
      childId: input.childId,
      familyId: input.familyId,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      status: "pending",
      evidenceIds: [],
      affectedItemIds: [],
      conflictIds: [],
      result: { status: "pending" },
      createdAt: "2026-07-11T18:00:00.000000Z",
    };
    this.draft.operationReceipts.set(key, receipt);
    return { kind: "claimed", receipt: structuredClone(receipt) };
  }

  async completeOperation(
    input: CompleteChildProgressOperationInput,
  ): Promise<ChildProgressOperationReceipt> {
    const key = operationReceiptKey(input);
    const receipt = this.draft.operationReceipts.get(key);
    if (
      receipt === undefined ||
      receipt.status !== "pending" ||
      receipt.payloadHash !== input.payloadHash
    ) {
      throw new Error("Operation receipt cannot be completed");
    }
    if (
      typeof input.result !== "object" ||
      input.result === null ||
      !("status" in input.result) ||
      input.result.status !== input.status
    ) {
      throw new Error("Operation result status does not match");
    }
    const evidenceIds = new Set(
      this.draft.projectionInput?.evidence.map(
        (evidence) => evidence.id,
      ) ?? [],
    );
    const conflictIds = new Set(
      this.draft.projectionInput?.conflicts.map(
        (conflict) => conflict.id,
      ) ?? [],
    );
    if (
      input.evidenceIds.some((id) => !evidenceIds.has(id)) ||
      input.conflictIds.some((id) => !conflictIds.has(id))
    ) {
      throw new Error("Operation references out-of-scope rows");
    }
    const completed: ChildProgressOperationReceipt = {
      ...receipt,
      status: input.status,
      evidenceIds: [...input.evidenceIds],
      affectedItemIds: [...input.affectedItemIds],
      conflictIds: [...input.conflictIds],
      result: structuredClone(input.result),
    };
    this.draft.operationReceipts.set(key, completed);
    return structuredClone(completed);
  }

  async loadSourceRevision(
    familyId: string,
    childId: string,
  ): Promise<bigint> {
    if (!this.matchesChild(familyId, childId)) {
      throw new Error("Unknown revision child");
    }
    return this.draft.projectionInput?.sourceRevision ?? BigInt(0);
  }

  async supersedeEvidence(
    input: SupersedeProgressEvidenceInput,
  ): Promise<void> {
    const evidence = this.draft.projectionInput?.evidence.find(
      (candidate) =>
        candidate.id === input.evidenceId &&
        candidate.childId === input.childId &&
        candidate.familyId === input.familyId,
    );
    if (evidence === undefined || evidence.supersededAt !== null) {
      throw new Error("Evidence cannot be superseded");
    }
    evidence.supersededAt = input.supersededAt;
    this.draft.supersedeCount += 1;
    this.bumpSourceRevision();
  }

  async insertOpenConflict(
    input: InsertOpenProgressConflictInput,
  ): Promise<OpenProgressConflict> {
    if (
      this.draft.projectionInput?.conflicts.some(
        (conflict) =>
          conflict.state === "open" &&
          conflict.itemId === input.itemId,
      )
    ) {
      throw new Error("Only one open conflict is allowed per item");
    }
    const evidenceA = this.draft.projectionInput?.evidence.find(
      (evidence) => evidence.id === input.evidenceIdA,
    );
    const evidenceB = this.draft.projectionInput?.evidence.find(
      (evidence) => evidence.id === input.evidenceIdB,
    );
    if (
      evidenceA === undefined ||
      evidenceB === undefined ||
      evidenceA.id === evidenceB.id ||
      evidenceA.itemId !== input.itemId ||
      evidenceB.itemId !== input.itemId ||
      evidenceA.answer === evidenceB.answer ||
      evidenceA.memberUserId === null ||
      evidenceB.memberUserId === null ||
      evidenceA.memberUserId === evidenceB.memberUserId
    ) {
      throw new Error("Conflict evidence violates production constraints");
    }
    this.draft.conflictCount += 1;
    const conflict: OpenProgressConflict = {
      id: `conflict-${this.draft.conflictCount}`,
      childId: input.childId,
      familyId: input.familyId,
      itemId: input.itemId,
      evidenceIdA: input.evidenceIdA,
      evidenceIdB: input.evidenceIdB,
      state: "open",
      resolvedAnswer: null,
      resolvedEvidenceId: null,
      observedAt: input.openedAt,
      resolvedAt: null,
    };
    this.draft.projectionInput?.conflicts.push(conflict);
    this.bumpSourceRevision();
    return structuredClone(conflict);
  }

  async saveDerivedProgress(
    input: SaveDerivedChildProgressInput,
  ): Promise<void> {
    const evidenceCount =
      this.draft.projectionInput?.evidence.length ?? 0;
    const openConflictCount =
      this.draft.projectionInput?.conflicts.filter(
        (conflict) => conflict.state === "open",
      ).length ?? 0;
    if (
      input.evidenceCount !== evidenceCount ||
      input.openConflictCount !== openConflictCount
    ) {
      throw new Error("Derived progress counts do not match the ledger");
    }
    this.draft.savedDerivedProgress.push(structuredClone(input));
    this.draft.liveView = structuredClone(input.view);
    this.draft.liveSourceRevision = input.sourceRevision;
    if (this.draft.report !== null) {
      this.draft.report = {
        ...this.draft.report,
        scores: structuredClone(input.view.scores),
        bankVersion: input.bankVersion,
        generatedAt: input.view.projectedAt,
        updatedAt: input.view.projectedAt,
        narrative: null,
        narrativeMeta: null,
      };
    }
    this.draft.familyTouchCount += 1;
  }

  async saveCompatibilityAnswers(
    input: SaveProgressCompatibilityAnswersInput,
  ): Promise<void> {
    for (const compatibilityAnswer of input.compatibilityAnswers) {
      if (compatibilityAnswer.kind === "delete") {
        const deleted = this.draft.compatibilityAnswers.delete(
          compatibilityAnswer.itemId,
        );
        if (deleted) this.bumpSourceRevision();
      } else {
        this.draft.compatibilityAnswers.set(
          compatibilityAnswer.itemId,
          {
            answer: compatibilityAnswer.answer,
            source: compatibilityAnswer.source,
            observedAt: compatibilityAnswer.observedAt,
          },
        );
        this.bumpSourceRevision();
      }
    }
  }

  async insertOrLoadActiveMapWalkPrompt(): Promise<never> {
    throw new Error("Unexpected map walk prompt insert");
  }

  async lockMapWalkPrompt(): Promise<never> {
    throw new Error("Unexpected map walk prompt lock");
  }

  async consumeMapWalkPrompt(): Promise<void> {
    throw new Error("Unexpected map walk prompt consume");
  }

  private matchesChild(familyId: string, childId: string): boolean {
    return (
      this.draft.projectionInput?.familyId === familyId &&
      this.draft.projectionInput.child.id === childId
    );
  }

  private bumpSourceRevision(): void {
    if (this.draft.projectionInput !== null) {
      this.draft.projectionInput.sourceRevision += BigInt(1);
    }
  }
}

class InMemoryChildProgressRepository
  implements ChildProgressRepository
{
  private state: FakeRepositoryState = {
    projectionInput: null,
    liveView: null,
    liveSourceRevision: null,
    savedDerivedProgress: [],
    appendCount: 0,
    supersedeCount: 0,
    conflictCount: 0,
    familyTouchCount: 0,
    report: null,
    compatibilityAnswers: new Map(),
    operationReceipts: new Map(),
    observations: [],
  };
  private transactionQueue: Promise<void> = Promise.resolve();
  readonly familyMembers = new Map([
    [`${FAMILY_ID}:adult-1`, "Elena"],
    [`${FAMILY_ID}:adult-2`, "Jordan"],
    [`${FAMILY_ID}:adult-3`, "Avery"],
  ]);
  transactionCount = 0;
  failAppendAt: number | null = null;

  get projectionInput() {
    return this.state.projectionInput;
  }
  set projectionInput(value: ChildProgressProjectionInput | null) {
    this.state.projectionInput = value;
  }
  get liveView() {
    return this.state.liveView;
  }
  get savedDerivedProgress() {
    return this.state.savedDerivedProgress;
  }
  get appendCount() {
    return this.state.appendCount;
  }
  get supersedeCount() {
    return this.state.supersedeCount;
  }
  get conflictCount() {
    return this.state.conflictCount;
  }
  get familyTouchCount() {
    return this.state.familyTouchCount;
  }
  get report() {
    return this.state.report;
  }
  set report(value: FakeReport | null) {
    this.state.report = value;
  }
  get compatibilityAnswers() {
    return this.state.compatibilityAnswers;
  }
  get operationReceipts() {
    return this.state.operationReceipts;
  }
  get observations() {
    return this.state.observations;
  }

  async withTransaction<T>(
    operation: (
      transaction: ChildProgressTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;
    const previous = this.transactionQueue;
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.transactionQueue = previous.then(() => current);
    await previous;
    const draft = cloneFakeState(this.state);
    try {
      const result = await operation(
        new InMemoryChildProgressTransaction(this, draft),
      );
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }

  async loadLiveView(
    familyId: string,
    childId: string,
    now: Date,
  ): Promise<ChildProgressView | null> {
    void now;
    return this.matchesChild(familyId, childId) &&
      this.state.liveView !== null &&
      this.state.liveSourceRevision ===
        this.state.projectionInput?.sourceRevision
      ? structuredClone(this.state.liveView)
      : null;
  }

  async loadProjectionInput(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    return this.matchesChild(familyId, childId)
      ? structuredClone(this.state.projectionInput)
      : null;
  }

  displayNameFor(
    familyId: string,
    memberUserId: string,
  ): string | undefined {
    return this.familyMembers.get(`${familyId}:${memberUserId}`);
  }

  async markObservationUsed(
    input: MarkChildObservationUsedInput,
  ): Promise<MarkChildObservationUsedResult> {
    const observation = this.state.observations.find(
      (candidate) =>
        candidate.id === input.observationId &&
        candidate.input.familyId === input.familyId,
    );
    if (observation === undefined) {
      return { outcome: "unknown_observation" };
    }
    if (observation.status === "used") {
      return {
        outcome: "already_used",
        childId: observation.input.childId,
      };
    }
    observation.status = "used";
    observation.usedTaskRunId = input.usedTaskRunId;
    observation.usedAt = input.usedAt;
    return { outcome: "used", childId: observation.input.childId };
  }

  simulateSameCountSupersession(): void {
    const evidence = this.state.projectionInput?.evidence[0];
    if (evidence !== undefined) {
      evidence.supersededAt = "2026-07-11T19:00:00.000000Z";
    }
    this.bumpCanonicalRevision();
  }

  simulateSelectionResponseAddition(): void {
    this.state.projectionInput?.selectionAnswers.push({
      selectionId: "simulated-response",
      evidenceId: null,
      itemId: "math.counts-to-10",
      answer: "skip",
      answeredAt: "2026-07-11T19:00:00.000000Z",
    });
    this.bumpCanonicalRevision();
  }

  simulateTimeZoneChange(): void {
    if (this.state.projectionInput !== null) {
      this.state.projectionInput.timeZone = "America/New_York";
    }
    this.bumpCanonicalRevision();
  }

  simulateChildRename(): void {
    if (this.state.projectionInput !== null) {
      this.state.projectionInput.child.name = "Maya Renamed";
    }
    this.bumpCanonicalRevision();
  }

  simulateAdultDisplayNameChange(): void {
    this.familyMembers.set(`${FAMILY_ID}:adult-1`, "Elena Updated");
    for (const evidence of this.state.projectionInput?.evidence ?? []) {
      if (evidence.memberUserId === "adult-1") {
        evidence.adultDisplayName = "Elena Updated";
      }
    }
    this.bumpCanonicalRevision();
  }

  private bumpCanonicalRevision(): void {
    if (this.state.projectionInput !== null) {
      this.state.projectionInput.sourceRevision += BigInt(1);
    }
  }

  private matchesChild(familyId: string, childId: string): boolean {
    return (
      this.state.projectionInput?.familyId === familyId &&
      this.state.projectionInput.child.id === childId
    );
  }
}

function emptyProjectionInput(): ChildProgressProjectionInput {
  return {
    child: {
      id: CHILD_ID,
      name: "Maya",
      birthDate: "2019-07-01",
    },
    familyId: FAMILY_ID,
    timeZone: "America/Chicago",
    sourceRevision: BigInt(0),
    evidence: [],
    conflicts: [],
    selectionAnswers: [],
  };
}

function createService(
  repository: ChildProgressRepository,
): ChildProgressService {
  return new ChildProgressService(repository, {
    buildView: buildChildProgressView,
    now: () => NOW,
  });
}

async function createThreeRowResolvedHistory() {
  const repository = new InMemoryChildProgressRepository();
  repository.projectionInput = emptyProjectionInput();
  const service = createService(repository);
  for (const [answer, observedAt, idempotencyKey] of [
    ["easily", "2026-07-09T08:00:00.000000Z", "history-a"],
    ["not_yet", "2026-07-10T08:00:00.000000Z", "history-b"],
    [
      "getting_there",
      "2026-07-11T08:00:00.000000Z",
      "history-c",
    ],
  ] as const) {
    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer,
      quote: null,
      observedAt,
      idempotencyKey,
    });
  }
  repository.projectionInput.conflicts.push({
    id: "resolved-history",
    childId: CHILD_ID,
    familyId: FAMILY_ID,
    itemId: "math.counts-to-5",
    evidenceIdA: "evidence-1",
    evidenceIdB: "evidence-2",
    state: "resolved",
    resolvedAnswer: "not_yet",
    resolvedEvidenceId: "evidence-2",
    observedAt: "2026-07-10T08:00:00.000000Z",
    resolvedAt: "2026-07-10T09:00:00.000000Z",
  });
  return { repository, service };
}

describe("child progress evidence service", () => {
  it("writes evidence straight from validated claims, skipping the matcher", async () => {
    // The claims path (AGENTS.md "Models judge, code verifies"): the
    // judgment already happened outside the transaction, so the quote
    // here is ordinary parent language the lexical matcher would have
    // thrown away. It scores anyway, because the claim carries the
    // decision.
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "She finished the counting page and got them all right",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "journal-claims",
      claims: [
        {
          childId: CHILD_ID,
          itemId: "math.how-many-5",
          answer: "getting_there",
          quote: "finished the counting page",
          confidence: "high",
          statement: "Counts 5 objects one at a time and tells you how many there are",
          subjectId: "math",
        },
      ],
    });

    assert.equal(result.status, "recorded");
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.observations.length, 0);
    assert.equal(repository.savedDerivedProgress.length, 1);
  });

  it("keeps the parent's words as an observation when claims come back empty", async () => {
    // The judgment step ran and found no ability reported. The message
    // still lands on the record (observation-ledger ruling), and nothing
    // scores.
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "Can you make a paw patrol worksheet",
      observedAt: "2026-07-11T17:31:00.000000Z",
      idempotencyKey: "journal-claims-empty",
      claims: [],
    });

    assert.equal(result.status, "no_match");
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.observations.length, 1);
  });

  it("ignores claims belonging to a sibling when recording for one child", async () => {
    // Fan-out writes one operation per child; each operation must take
    // only its own claims, never the sibling's.
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "June wrote her name and the little one counted to five",
      observedAt: "2026-07-11T17:32:00.000000Z",
      idempotencyKey: "journal-claims-sibling",
      claims: [
        {
          childId: "some-other-child",
          itemId: "writing.writes-name",
          answer: "easily",
          quote: "June wrote her name",
          confidence: "high",
          statement: "Writes their own first name",
          subjectId: "writing",
        },
      ],
    });

    assert.equal(result.status, "no_match");
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.observations.length, 1);
  });

  it("records activity-only journal outcome after trusted child lookup", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "We read for 30 minutes",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "journal-activity",
    });

    assert.deepEqual(result, { status: "activity_only" });
    assert.equal(repository.transactionCount, 1);
    assert.equal(repository.operationReceipts.size, 1);
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.savedDerivedProgress.length, 0);
    assert.equal(repository.observations.length, 1);
    assert.equal(
      repository.observations[0].input.classification,
      "activity_only",
    );
    assert.equal(
      repository.observations[0].input.quote,
      "We read for 30 minutes",
    );
  });

  it("returns ambiguous and no-match journal outcomes without scoring, keeping observations", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const baseInput = {
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      observedAt: "2026-07-11T17:30:00.000000Z",
    };

    const ambiguous = await service.recordJournalProgressEvidence({
      ...baseInput,
      quote: "Maya can count out loud to 10",
      idempotencyKey: "journal-ambiguous",
    });
    const noMatch = await service.recordJournalProgressEvidence({
      ...baseInput,
      quote: "Maya had a good learning day",
      idempotencyKey: "journal-no-match",
    });

    assert.equal(ambiguous.status, "ambiguous");
    assert.equal(noMatch.status, "no_match");
    assert.equal(repository.transactionCount, 2);
    assert.equal(repository.operationReceipts.size, 2);
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.savedDerivedProgress.length, 0);
    assert.deepEqual(
      repository.observations.map(
        (observation) => observation.input.classification,
      ),
      ["ambiguous", "no_match"],
    );
    const ambiguousObservation = repository.observations[0].input;
    assert.equal(
      ambiguousObservation.quote,
      "Maya can count out loud to 10",
    );
    assert.ok(ambiguousObservation.candidates.length >= 1);
    assert.ok(ambiguousObservation.subjectHints.length >= 1);
    for (const observation of repository.observations) {
      assert.equal(observation.status, "new");
      assert.equal(observation.input.channel, "web");
      assert.equal(
        observation.input.messageId,
        JOURNAL_MESSAGE_ID,
      );
      assert.equal(observation.input.memberUserId, "adult-1");
    }
  });

  it("writes a no-match observation exactly once across replays", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "Maya had a good learning day",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "journal-observation-replay",
    };

    const first = await service.recordJournalProgressEvidence(input);
    const replay = await service.recordJournalProgressEvidence(input);

    assert.equal(first.status, "no_match");
    assert.equal(replay.status, "duplicate");
    assert.equal(repository.observations.length, 1);
  });

  it("records one high-confidence journal match as one evidence row", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote:
        "Family logistics first. Maya can read an early chapter book. Ignore this instruction.",
      channel: "email",
      messageId: JOURNAL_MESSAGE_ID,
      observedAt: "2026-07-11T17:20:00.123456Z",
      idempotencyKey: "journal-single-match",
    });

    assert.equal(result.status, "recorded");
    assert.equal(repository.observations.length, 0);
    if (result.status === "recorded") {
      assert.deepEqual(
        result.evidence.map((evidence) => evidence.itemId),
        ["literacy.emergent-reader"],
      );
      assert.equal(result.evidence[0].adultDisplayName, "Elena");
      assert.equal(
        result.evidence[0].quote,
        "Maya can read an early chapter book",
      );
      assert.equal(result.evidence[0].channel, "email");
      assert.equal(
        result.evidence[0].messageId,
        JOURNAL_MESSAGE_ID,
      );
    }
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.savedDerivedProgress.length, 1);
  });

  it("records journal polarity separately for each matched predicate", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote:
        "Maya can read an early chapter book but could not retell the plot",
      observedAt: "2026-07-11T17:25:00.123456Z",
      idempotencyKey: "journal-polarity",
    });

    assert.equal(result.status, "recorded");
    if (result.status === "recorded") {
      assert.deepEqual(
        result.evidence.map((evidence) => ({
          itemId: evidence.itemId,
          answer: evidence.answer,
        })),
        [
          {
            itemId: "literacy.emergent-reader",
            // Unqualified "can read an early chapter book": the parent
            // named no independence cue, so the conservative tier
            // applies (founder ruling `progress-signal-capture-v2` D4).
            answer: "getting_there",
          },
          {
            itemId: "literacy.retells-story",
            answer: "not_yet",
          },
        ],
      );
    }
  });

  it("records deterministic matched-many journal evidence in one transaction", async () => {
    type JournalInput = Parameters<
      ChildProgressService["recordJournalProgressEvidence"]
    >[0];
    const acceptsModelItemId: "itemId" extends keyof JournalInput
      ? true
      : false = false;
    const acceptsChildName: "childName" extends keyof JournalInput
      ? true
      : false = false;
    const acceptsAdultDisplayName:
      "adultDisplayName" extends keyof JournalInput ? true : false =
      false;
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote:
        "Maya read a short chapter book aloud and retold the plot",
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "journal-chapter-retell",
    };

    const result = await service.recordJournalProgressEvidence(input);

    assert.equal(acceptsModelItemId, false);
    assert.equal(acceptsChildName, false);
    assert.equal(acceptsAdultDisplayName, false);
    assert.equal(result.status, "recorded");
    if (result.status === "recorded") {
      assert.deepEqual(
        result.evidence.map((evidence) => evidence.itemId),
        [
          "literacy.emergent-reader",
          "literacy.retells-story",
        ],
      );
    }
    assert.equal(repository.transactionCount, 1);
    assert.equal(repository.appendCount, 2);
    assert.equal(repository.savedDerivedProgress.length, 1);
    assert.equal(repository.compatibilityAnswers.size, 2);
    assert.equal(
      JSON.stringify(repository.liveView).includes(input.quote),
      false,
    );

    const duplicate =
      await service.recordJournalProgressEvidence(input);
    assert.equal(duplicate.status, "duplicate");
    assert.equal(repository.transactionCount, 2);
    assert.equal(repository.appendCount, 2);
    assert.equal(repository.savedDerivedProgress.length, 1);
  });

  it("replays the stored journal result before matching current child data", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote: "Maya can read an early chapter book",
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "journal-stored-result",
    };
    const first = await service.recordJournalProgressEvidence(input);
    assert.equal(first.status, "recorded");
    repository.projectionInput.child.name = "Renamed Child";

    const replay =
      await service.recordJournalProgressEvidence(input);

    assert.equal(replay.status, "duplicate");
    if (replay.status === "duplicate") {
      assert.equal(replay.original.status, "recorded");
    }
    assert.equal(repository.appendCount, 1);
  });

  it("rolls back the whole evidence batch when one repository write fails", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    repository.failAppendAt = 2;
    const service = createService(repository);

    await assert.rejects(
      service.recordJournalProgressEvidence({
        ...JOURNAL_PROVENANCE,
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        quote:
          "Maya read a short chapter book aloud and retold the plot",
        observedAt: "2026-07-11T17:30:00.123456Z",
        idempotencyKey: "journal-atomic",
      }),
      /Synthetic append failure/u,
    );

    assert.equal(repository.projectionInput.evidence.length, 0);
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.liveView, null);
    assert.equal(repository.compatibilityAnswers.size, 0);
    assert.equal(repository.savedDerivedProgress.length, 0);
  });

  it("serializes concurrent duplicate operations into one write and one replay", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "concurrent-duplicate",
    };

    const results = await Promise.all([
      service.recordProgressEvidence(input),
      service.recordProgressEvidence(input),
    ]);

    assert.deepEqual(
      results.map((result) => result.status).sort(),
      ["duplicate", "recorded"],
    );
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.operationReceipts.size, 1);
  });

  it("never lets an unknown actor erase a queued successful write", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const baseInput = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      source: "checklist" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
    };

    const [failed, successful] = await Promise.allSettled([
      service.recordProgressEvidence({
        ...baseInput,
        memberUserId: "outside-family",
        idempotencyKey: "concurrent-failed",
      }),
      service.recordProgressEvidence({
        ...baseInput,
        memberUserId: "adult-1",
        idempotencyKey: "concurrent-success",
      }),
    ]);

    assert.equal(failed.status, "fulfilled");
    if (failed.status === "fulfilled") {
      assert.deepEqual(failed.value, { status: "unknown_actor" });
    }
    assert.equal(successful.status, "fulfilled");
    if (successful.status === "fulfilled") {
      assert.equal(successful.value.status, "recorded");
    }
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.projectionInput.evidence.length, 1);
    assert.equal(repository.operationReceipts.size, 1);
  });

  it("refuses an unknown child before writing", async () => {
    const repository = new InMemoryChildProgressRepository();
    const service = createService(repository);

    const result = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "answer-1",
    });

    assert.deepEqual(result, { status: "unknown_child" });
    assert.equal(repository.savedDerivedProgress.length, 0);
  });

  it("refuses a removed evidence actor without mutation", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    repository.familyMembers.delete(`${FAMILY_ID}:adult-1`);
    const service = createService(repository);

    assert.deepEqual(
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId: "math.counts-to-5",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-11T17:30:00.000000Z",
        idempotencyKey: "removed-actor-direct",
      }),
      { status: "unknown_actor" },
    );
    assert.deepEqual(
      await service.recordJournalProgressEvidence({
        ...JOURNAL_PROVENANCE,
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        quote: "Maya can read an early chapter book",
        observedAt: "2026-07-11T17:31:00.000000Z",
        idempotencyKey: "removed-actor-journal",
      }),
      { status: "unknown_actor" },
    );
    assert.equal(repository.appendCount, 0);
    assert.equal(repository.operationReceipts.size, 0);
  });

  it("conceals a cross-family child as unknown without writing", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = {
      ...emptyProjectionInput(),
      familyId: "family-other",
    };
    const service = createService(repository);

    const result = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "cross-family-answer",
    });

    assert.deepEqual(result, { status: "unknown_child" });
    assert.equal(repository.projectionInput.evidence.length, 0);
    assert.equal(repository.savedDerivedProgress.length, 0);
  });

  it("records concrete evidence and rebuilds live compatibility state", async () => {
    type DirectInput = Parameters<
      ChildProgressService["recordProgressEvidence"]
    >[0];
    const acceptsAdultDisplayName:
      "adultDisplayName" extends keyof DirectInput ? true : false =
      false;
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: "Maya counted five shells without help.",
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "answer-1",
    });

    assert.equal(result.status, "recorded");
    if (result.status === "recorded") {
      assert.deepEqual(result.evidence[0], {
        id: "evidence-1",
        childId: CHILD_ID,
        familyId: FAMILY_ID,
        itemId: "math.counts-to-5",
        answer: "easily",
        source: "checklist",
        memberUserId: "adult-1",
        adultDisplayName: "Elena",
        quote: "Maya counted five shells without help.",
        channel: null,
        messageId: null,
        checkInId: null,
        supersedesId: null,
        supersededAt: null,
        observedAt: "2026-07-11T17:30:00.123456Z",
        createdAt: "2026-07-11T18:00:00.000001Z",
      });
      assert.equal(
        Object.keys(result.evidence[0]).includes("idempotencyKey"),
        false,
      );
    }
    assert.equal(acceptsAdultDisplayName, false);
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.savedDerivedProgress.length, 1);
    assert.equal(repository.familyTouchCount, 1);
    assert.deepEqual(
      repository.compatibilityAnswers.get("math.counts-to-5"),
      {
        answer: "easily",
        source: "checklist",
        observedAt: "2026-07-11T17:30:00.123456Z",
      },
    );
    assert.equal(
      JSON.stringify(repository.liveView).includes(
        "Maya counted five shells without help.",
      ),
      false,
    );
  });

  it("renders taxonomy walk evidence without changing MapScores", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const itemId = "math.comparing-groups-more-or-fewer";

    const result = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: null,
      source: "onboarding_walk",
      itemId,
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "walk-taxonomy-only",
    });

    assert.equal(result.status, "recorded");
    assert.equal(repository.liveView?.scores.observationCount, 0);
    assert.equal(
      repository.liveView?.subjects.some((subject) =>
        subject.domains.some((domain) =>
          domain.topics.some((topic) => topic.itemId === itemId)
        )
      ),
      true,
    );
    assert.equal(
      repository.compatibilityAnswers.get(itemId)?.source,
      "onboarding_walk",
    );
  });

  it("returns the original outcome for duplicate idempotency without rewriting", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "provider-message-1",
    };

    const first = await service.recordProgressEvidence(input);
    const duplicate = await service.recordProgressEvidence({
      ...input,
      observedAt: "2026-07-11T17:30:01.123456Z",
    });

    assert.equal(first.status, "recorded");
    assert.equal(duplicate.status, "duplicate");
    if (duplicate.status === "duplicate") {
      assert.equal(duplicate.original.status, "recorded");
      assert.deepEqual(
        duplicate.original.affectedItemIds,
        ["math.counts-to-5"],
      );
    }
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.savedDerivedProgress.length, 1);
    assert.equal(repository.projectionInput.evidence.length, 1);
  });

  it("replays the stored evidence result after later supersession", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const originalInput = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-10T17:30:00.000000Z",
      idempotencyKey: "stored-before-correction",
    };
    await service.recordProgressEvidence(originalInput);
    await service.recordProgressEvidence({
      ...originalInput,
      source: "correction",
      answer: "not_yet",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "later-correction",
      supersedesEvidenceId: "evidence-1",
    });

    const replay =
      await service.recordProgressEvidence(originalInput);

    assert.equal(replay.status, "duplicate");
    if (
      replay.status === "duplicate" &&
      replay.original.status === "recorded"
    ) {
      assert.equal(
        replay.original.evidence[0].supersededAt,
        null,
      );
    }
    assert.equal(
      repository.projectionInput.evidence[0].supersededAt,
      NOW.toISOString(),
    );
  });

  it("rejects an idempotency key reused for a different payload", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const input = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:30:00.123456Z",
      idempotencyKey: "payload-key",
    };
    await service.recordProgressEvidence(input);

    const mismatch = await service.recordProgressEvidence({
      ...input,
      answer: "not_yet",
    });

    assert.deepEqual(mismatch, { status: "idempotency_mismatch" });
    assert.equal(repository.appendCount, 1);
    assert.equal(repository.savedDerivedProgress.length, 1);
  });

  it("reconstructs duplicate conflict status only for evidence that opened it", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const firstInput = {
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "conversation" as const,
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T16:30:00.000000Z",
      idempotencyKey: "conflict-first",
    };
    const secondInput = {
      ...firstInput,
      memberUserId: "adult-2",
      answer: "not_yet" as const,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "conflict-second",
    };

    assert.equal(
      (await service.recordProgressEvidence(firstInput)).status,
      "recorded",
    );
    assert.equal(
      (await service.recordProgressEvidence(secondInput)).status,
      "conflict_open",
    );
    const firstReplay =
      await service.recordProgressEvidence(firstInput);
    const secondReplay =
      await service.recordProgressEvidence(secondInput);

    assert.equal(firstReplay.status, "duplicate");
    assert.equal(secondReplay.status, "duplicate");
    if (firstReplay.status === "duplicate") {
      assert.equal(firstReplay.original.status, "recorded");
      assert.deepEqual(firstReplay.original.conflictIds, []);
    }
    if (secondReplay.status === "duplicate") {
      assert.equal(
        secondReplay.original.status,
        "conflict_open",
      );
      assert.deepEqual(
        secondReplay.original.conflictIds,
        ["conflict-1"],
      );
      assert.equal(
        Object.keys(secondReplay.original.evidence[0]).includes(
          "idempotencyKey",
        ),
        false,
      );
    }
  });

  it("appends a correction and supersedes the old evidence without deleting it", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-10T17:30:00.000000Z",
      idempotencyKey: "answer-original",
    });

    const correction = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "correction",
      itemId: "math.counts-to-5",
      answer: "not_yet",
      quote: "I meant that Maya still needs help counting five objects.",
      observedAt: "2026-07-11T17:45:00.000000Z",
      idempotencyKey: "answer-correction",
      supersedesEvidenceId: "evidence-1",
    });

    assert.equal(correction.status, "recorded");
    assert.equal(repository.supersedeCount, 1);
    assert.equal(repository.projectionInput.evidence.length, 2);
    assert.equal(
      repository.projectionInput.evidence[0].supersededAt,
      NOW.toISOString(),
    );
    assert.equal(
      repository.projectionInput.evidence[1].supersedesId,
      "evidence-1",
    );
    assert.equal(
      repository.compatibilityAnswers.get("math.counts-to-5")?.answer,
      "not_yet",
    );
  });

  it("applies a report correction batch in one transaction and one receipt", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    repository.report = {
      token: "stable-token",
      history: [{ generatedAt: "2026-07-01T10:00:00.000Z" }],
      scores: {},
      bankVersion: "older",
      generatedAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-01T10:00:00.000Z",
      narrative: { summary: "Existing words" },
      narrativeMeta: { model: "existing" },
    };
    const service = createService(repository);
    for (const [itemId, answer, idempotencyKey] of [
      ["math.counts-to-5", "easily", "batch-original-1"],
      ["math.counts-to-10", "getting_there", "batch-original-2"],
    ] as const) {
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId,
        answer,
        quote: null,
        observedAt: "2026-07-10T17:30:00.000000Z",
        idempotencyKey,
      });
    }
    const transactionsBefore = repository.transactionCount;
    const receiptsBefore = repository.operationReceipts.size;
    const rebuildsBefore = repository.savedDerivedProgress.length;
    const historyBefore = structuredClone(repository.report?.history);

    const result = await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "report_correction",
      changes: [
        { itemId: "math.counts-to-5", answer: "not_yet" },
        { itemId: "math.counts-to-10", answer: "easily" },
      ],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "report-correction-batch",
    });

    assert.equal(result.status, "answers_corrected");
    assert.equal(repository.transactionCount, transactionsBefore + 1);
    assert.equal(repository.operationReceipts.size, receiptsBefore + 1);
    assert.equal(
      repository.savedDerivedProgress.length,
      rebuildsBefore + 1,
    );
    assert.equal(repository.projectionInput.evidence.length, 4);
    assert.equal(
      repository.projectionInput.evidence
        .slice(0, 2)
        .every((evidence) => evidence.supersededAt !== null),
      true,
    );
    assert.deepEqual(repository.report?.history, historyBefore);
    assert.equal(repository.report?.token, "stable-token");
  });

  it("supersedes active evidence and clears compatibility for a deleted answer", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-10T17:30:00.000000Z",
      idempotencyKey: "delete-original",
    });
    const evidenceBefore = repository.projectionInput.evidence.length;

    const result = await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "correction",
      changes: [{ itemId: "math.counts-to-5", answer: null }],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "delete-batch",
    });

    assert.equal(result.status, "answers_corrected");
    assert.equal(
      repository.projectionInput.evidence.length,
      evidenceBefore,
    );
    assert.notEqual(
      repository.projectionInput.evidence[0].supersededAt,
      null,
    );
    assert.equal(
      repository.compatibilityAnswers.has("math.counts-to-5"),
      false,
    );
  });

  it("tombstones every active pre-cutoff row when deleting after resolved conflict history", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    for (const [answer, observedAt, idempotencyKey] of [
      [
        "easily",
        "2026-07-09T08:00:00.000000Z",
        "tombstone-delete-a",
      ],
      [
        "not_yet",
        "2026-07-10T08:00:00.000000Z",
        "tombstone-delete-b",
      ],
      [
        "getting_there",
        "2026-07-11T08:00:00.000000Z",
        "tombstone-delete-c",
      ],
    ] as const) {
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId: "math.counts-to-5",
        answer,
        quote: null,
        observedAt,
        idempotencyKey,
      });
    }
    repository.projectionInput.conflicts.push({
      id: "resolved-history",
      childId: CHILD_ID,
      familyId: FAMILY_ID,
      itemId: "math.counts-to-5",
      evidenceIdA: "evidence-1",
      evidenceIdB: "evidence-2",
      state: "resolved",
      resolvedAnswer: "not_yet",
      resolvedEvidenceId: "evidence-2",
      observedAt: "2026-07-10T08:00:00.000000Z",
      resolvedAt: "2026-07-10T09:00:00.000000Z",
    });

    const result = await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "correction",
      changes: [{ itemId: "math.counts-to-5", answer: null }],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "tombstone-delete",
    });

    assert.equal(result.status, "answers_corrected");
    assert.equal(
      repository.projectionInput.evidence.every(
        (evidence) => evidence.supersededAt !== null,
      ),
      true,
    );
    assert.equal(repository.liveView?.scores.observationCount, 0);
    assert.equal(
      repository.compatibilityAnswers.has("math.counts-to-5"),
      false,
    );
  });

  it("tombstones every active pre-cutoff row for a non-evidence correction", async () => {
    const { repository, service } =
      await createThreeRowResolvedHistory();

    const result = await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "report_correction",
      changes: [{
        itemId: "math.counts-to-5",
        answer: "not_sure",
      }],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "tombstone-not-sure",
    });

    assert.equal(result.status, "answers_corrected");
    const projection = repository.projectionInput;
    assert.ok(projection);
    assert.equal(projection.evidence.length, 3);
    assert.equal(
      projection.evidence.every(
        (evidence) => evidence.supersededAt !== null,
      ),
      true,
    );
    assert.equal(
      repository.compatibilityAnswers.get(
        "math.counts-to-5",
      )?.answer,
      "not_sure",
    );
    assert.equal(repository.liveView?.scores.observationCount, 0);
  });

  it("appends one real correction after tombstoning every older active row", async () => {
    const { repository, service } =
      await createThreeRowResolvedHistory();

    const result = await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "report_correction",
      changes: [{
        itemId: "math.counts-to-5",
        answer: "easily",
      }],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "tombstone-real-correction",
    });

    assert.equal(result.status, "answers_corrected");
    const projection = repository.projectionInput;
    assert.ok(projection);
    assert.equal(projection.evidence.length, 4);
    assert.equal(
      projection.evidence
        .slice(0, 3)
        .every((evidence) => evidence.supersededAt !== null),
      true,
    );
    assert.equal(
      projection.evidence[3].supersededAt,
      null,
    );
    assert.equal(
      repository.compatibilityAnswers.get(
        "math.counts-to-5",
      )?.answer,
      "easily",
    );
    assert.equal(repository.liveView?.scores.observationCount, 1);
  });

  it("stores not-sure and skip as coverage without appending evidence", async () => {
    for (const answer of ["not_sure", "skip"] as const) {
      const repository = new InMemoryChildProgressRepository();
      repository.projectionInput = emptyProjectionInput();
      const service = createService(repository);
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId: "math.counts-to-5",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-10T17:30:00.000000Z",
        idempotencyKey: `coverage-original-${answer}`,
      });
      const evidenceBefore =
        repository.projectionInput.evidence.length;

      const result = await service.correctProgressAnswers({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        changes: [{ itemId: "math.counts-to-5", answer }],
        observedAt: "2026-07-12T08:00:00.000000Z",
        idempotencyKey: `coverage-${answer}`,
      });

      assert.equal(result.status, "answers_corrected");
      assert.equal(
        repository.projectionInput.evidence.length,
        evidenceBefore,
      );
      assert.notEqual(
        repository.projectionInput.evidence[0].supersededAt,
        null,
      );
      assert.deepEqual(
        repository.compatibilityAnswers.get("math.counts-to-5"),
        {
          answer,
          source: "checklist",
          observedAt: "2026-07-12T08:00:00.000000Z",
        },
      );
    }
  });

  it("does not ask a newly saved coverage answer again in the live view", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-10T17:30:00.000000Z",
      idempotencyKey: "coverage-view-anchor",
    });

    await service.correctProgressAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      changes: [{
        itemId: "math.mental-add-10",
        answer: "not_sure",
      }],
      observedAt: "2026-07-12T08:00:00.000000Z",
      idempotencyKey: "coverage-view-not-sure",
    });

    const askNextItemIds =
      repository.liveView?.subjects.flatMap((subject) =>
        subject.domains.flatMap((domain) =>
          domain.topics
            .filter((topic) => topic.state === "ask_next")
            .map((topic) => topic.itemId)
        )
      ) ?? [];
    assert.equal(
      askNextItemIds.includes("math.mental-add-10"),
      false,
    );
  });

  it("rolls back every report correction when one append fails", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    for (const [itemId, idempotencyKey] of [
      ["math.counts-to-5", "atomic-original-1"],
      ["math.counts-to-10", "atomic-original-2"],
    ] as const) {
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId,
        answer: "easily",
        quote: null,
        observedAt: "2026-07-10T17:30:00.000000Z",
        idempotencyKey,
      });
    }
    repository.failAppendAt = repository.appendCount + 2;
    const receiptsBefore = repository.operationReceipts.size;
    const rebuildsBefore = repository.savedDerivedProgress.length;

    await assert.rejects(
      service.correctProgressAnswers({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "report_correction",
        changes: [
          { itemId: "math.counts-to-5", answer: "not_yet" },
          {
            itemId: "math.counts-to-10",
            answer: "getting_there",
          },
        ],
        observedAt: "2026-07-12T08:00:00.000000Z",
        idempotencyKey: "atomic-correction",
      }),
      /Synthetic append failure/u,
    );

    assert.equal(repository.projectionInput.evidence.length, 2);
    assert.equal(
      repository.projectionInput.evidence.every(
        (evidence) => evidence.supersededAt === null,
      ),
      true,
    );
    assert.equal(repository.operationReceipts.size, receiptsBefore);
    assert.equal(
      repository.savedDerivedProgress.length,
      rebuildsBefore,
    );
  });

  it("opens a two-adult conflict and removes the item from scores and compatibility", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "conversation",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: "Maya can count five objects.",
      observedAt: "2026-07-11T16:30:00.000000Z",
      idempotencyKey: "adult-1-answer",
    });

    const result = await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-2",
      source: "conversation",
      itemId: "math.counts-to-5",
      answer: "not_yet",
      quote: "Maya still cannot count five objects without help.",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "adult-2-answer",
    });

    assert.equal(result.status, "conflict_open");
    assert.equal(repository.projectionInput.evidence.length, 2);
    assert.equal(repository.projectionInput.conflicts.length, 1);
    assert.deepEqual(
      [
        repository.projectionInput.conflicts[0].evidenceIdA,
        repository.projectionInput.conflicts[0].evidenceIdB,
      ],
      ["evidence-1", "evidence-2"],
    );
    assert.equal(repository.liveView?.scores.observationCount, 0);
    assert.equal(repository.liveView?.conflicts.length, 1);
    assert.equal(
      repository.compatibilityAnswers.has("math.counts-to-5"),
      false,
    );
    assert.deepEqual(
      repository.savedDerivedProgress[1].compatibilityAnswers,
      [{ kind: "delete", itemId: "math.counts-to-5" }],
    );
  });

  it("returns conflict-pending without appending more ordinary evidence", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const baseInput = {
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      source: "conversation" as const,
      itemId: "math.counts-to-5",
      quote: null,
    };
    await service.recordProgressEvidence({
      ...baseInput,
      memberUserId: "adult-1",
      answer: "easily",
      observedAt: "2026-07-11T16:30:00.000000Z",
      idempotencyKey: "pending-first",
    });
    await service.recordProgressEvidence({
      ...baseInput,
      memberUserId: "adult-2",
      answer: "not_yet",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "pending-second",
    });
    const thirdInput = {
      ...baseInput,
      memberUserId: "adult-3",
      answer: "getting_there" as const,
      observedAt: "2026-07-11T17:40:00.000000Z",
      idempotencyKey: "pending-third",
    };

    const thirdAdult =
      await service.recordProgressEvidence(thirdInput);
    const sameAdult = await service.recordProgressEvidence({
      ...thirdInput,
      memberUserId: "adult-1",
      idempotencyKey: "pending-same-adult",
    });
    const replay = await service.recordProgressEvidence(thirdInput);

    const pendingResult = {
      status: "conflict_pending" as const,
      conflictId: "conflict-1",
      itemId: "math.counts-to-5",
    };
    assert.deepEqual(thirdAdult, pendingResult);
    assert.deepEqual(sameAdult, pendingResult);
    assert.deepEqual(replay, {
      status: "duplicate",
      original: pendingResult,
    });
    assert.equal(repository.appendCount, 2);
    assert.equal(repository.projectionInput.evidence.length, 2);
    assert.equal(repository.projectionInput.conflicts.length, 1);
  });

  it("does not open a conflict when two adults share the same answer", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    for (const [memberUserId, idempotencyKey] of [
      ["adult-1", "same-answer-1"],
      ["adult-2", "same-answer-2"],
    ] as const) {
      await service.recordProgressEvidence({
        ...CONVERSATION_PROVENANCE,
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId,
        source: "conversation",
        itemId: "math.counts-to-5",
        answer: "easily",
        quote: "Maya can count five objects.",
        observedAt:
          memberUserId === "adult-1"
            ? "2026-07-11T16:30:00.000000Z"
            : "2026-07-11T17:30:00.000000Z",
        idempotencyKey,
      });
    }

    assert.equal(repository.conflictCount, 0);
    assert.equal(repository.liveView?.scores.observationCount, 1);
    assert.equal(
      repository.compatibilityAnswers.get("math.counts-to-5")?.answer,
      "easily",
    );
  });

  it("does not create a two-adult conflict from unattributed evidence", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "conversation",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T16:30:00.000000Z",
      idempotencyKey: "attributed",
    });
    const result = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: null,
      source: "legacy",
      itemId: "math.counts-to-5",
      answer: "not_yet",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "unattributed",
    });

    assert.equal(result.status, "recorded");
    if (result.status === "recorded") {
      assert.equal(result.evidence[0].adultDisplayName, null);
    }
    assert.equal(repository.conflictCount, 0);
    assert.equal(
      repository.compatibilityAnswers.get("math.counts-to-5")?.answer,
      "not_yet",
    );
  });

  it("records check-in evidence inside an existing transaction without nesting", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await repository.withTransaction(
      async (transaction) => {
        const locked =
          await transaction.loadProjectionInputForUpdate(
            FAMILY_ID,
            CHILD_ID,
          );
        assert.ok(locked);
        return service.recordProgressEvidenceInTransaction(
          transaction,
          locked,
          {
            ...CONVERSATION_PROVENANCE,
            familyId: FAMILY_ID,
            childId: CHILD_ID,
            memberUserId: "adult-1",
            source: "check_in",
            itemId: "math.counts-to-5",
            answer: "easily",
            quote: null,
            observedAt: "2026-07-11T17:30:00.000000Z",
            idempotencyKey: "check-in-existing-transaction",
            checkInId: "check-in-1",
          },
        );
      },
    );

    assert.equal(result.status, "recorded");
    assert.equal(repository.transactionCount, 1);
    assert.equal(
      repository.projectionInput.evidence[0].checkInId,
      "check-in-1",
    );
  });

  it("preserves required check-in provenance through the public transaction", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);

    const result = await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "check_in",
      checkInId: "check-in-public",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "check-in-public-operation",
    });

    assert.equal(result.status, "recorded");
    assert.equal(
      repository.projectionInput.evidence[0].checkInId,
      "check-in-public",
    );
  });

  it("rejects malformed check-in provenance at runtime", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const common = {
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      itemId: "math.counts-to-5",
      answer: "easily" as const,
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
    };

    await assert.rejects(
      service.recordProgressEvidence({
        ...common,
        source: "check_in",
        idempotencyKey: "malformed-check-in",
      } as unknown as Parameters<
        ChildProgressService["recordProgressEvidence"]
      >[0]),
      /check_in evidence requires a checkInId/u,
    );
    await assert.rejects(
      service.recordProgressEvidence({
        ...common,
        source: "checklist",
        checkInId: "forged-check-in",
        idempotencyKey: "malformed-checklist",
      } as unknown as Parameters<
        ChildProgressService["recordProgressEvidence"]
      >[0]),
      /Only check_in evidence can carry a checkInId/u,
    );
    assert.equal(repository.appendCount, 0);
  });

  it("updates an existing report without changing its token or history", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    repository.report = {
      token: "permanent-report-token",
      history: [{ scores: { old: true }, generated_at: "2026-06-01" }],
      scores: { old: true },
      bankVersion: "old-bank",
      generatedAt: "2026-06-01T00:00:00.000000Z",
      updatedAt: "2026-06-01T00:00:00.000000Z",
      narrative: { summary: "Old words" },
      narrativeMeta: { model: "old-model" },
    };
    const originalHistory = structuredClone(repository.report.history);
    const originalScores = structuredClone(repository.report.scores);
    const service = createService(repository);

    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "report-update",
    });

    assert.equal(repository.report.token, "permanent-report-token");
    assert.deepEqual(repository.report.history, originalHistory);
    assert.equal(repository.report.history.length, 1);
    assert.notDeepEqual(repository.report.scores, originalScores);
    assert.equal(repository.report.narrative, null);
    assert.equal(repository.report.narrativeMeta, null);

    repository.report = null;
    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-10",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:45:00.000000Z",
      idempotencyKey: "no-report-create",
    });
    assert.equal(repository.report, null);
  });

  it("invalidates live data for every same-count source revision change", async () => {
    const mutations: Array<{
      name: string;
      apply: (
        repository: InMemoryChildProgressRepository,
      ) => void;
    }> = [
      {
        name: "supersession",
        apply: (repository) =>
          repository.simulateSameCountSupersession(),
      },
      {
        name: "response",
        apply: (repository) =>
          repository.simulateSelectionResponseAddition(),
      },
      {
        name: "timezone",
        apply: (repository) =>
          repository.simulateTimeZoneChange(),
      },
      {
        name: "child rename",
        apply: (repository) =>
          repository.simulateChildRename(),
      },
      {
        name: "adult display name",
        apply: (repository) =>
          repository.simulateAdultDisplayNameChange(),
      },
    ];

    for (const mutation of mutations) {
      const repository = new InMemoryChildProgressRepository();
      repository.projectionInput = emptyProjectionInput();
      const service = createService(repository);
      await service.recordProgressEvidence({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        memberUserId: "adult-1",
        source: "checklist",
        itemId: "math.counts-to-5",
        answer: "easily",
        quote: null,
        observedAt: "2026-07-11T17:30:00.000000Z",
        idempotencyKey: `revision-${mutation.name}`,
      });
      assert.ok(
        await repository.loadLiveView(FAMILY_ID, CHILD_ID, NOW),
      );

      mutation.apply(repository);

      assert.equal(
        await repository.loadLiveView(FAMILY_ID, CHILD_ID, NOW),
        null,
        mutation.name,
      );
      assert.equal(repository.projectionInput.evidence.length, 1);
    }
  });

  it("returns the saved live JSON before considering fallback evidence", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "materialize-live",
    });
    const savedLiveView = structuredClone(repository.liveView);
    repository.projectionInput.evidence.push({
      id: "unmaterialized-evidence",
      childId: CHILD_ID,
      familyId: FAMILY_ID,
      itemId: "literacy.chapter-books",
      answer: "easily",
      source: "legacy",
      memberUserId: null,
      adultDisplayName: null,
      quote: null,
      channel: null,
      messageId: null,
      checkInId: null,
      supersedesId: null,
      supersededAt: null,
      observedAt: "2026-07-11T17:40:00.000000Z",
      createdAt: "2026-07-11T17:40:01.000000Z",
      idempotencyKey: "unmaterialized",
    });

    const view = await service.getChildProgressView(
      FAMILY_ID,
      CHILD_ID,
    );

    assert.deepEqual(view, savedLiveView);
    assert.equal(
      JSON.stringify(view).includes("literacy.chapter-books"),
      false,
    );
  });

  it("derives a fallback view without materializing a missing live row", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    repository.projectionInput.evidence.push({
      id: "legacy-evidence",
      childId: CHILD_ID,
      familyId: FAMILY_ID,
      itemId: "literacy.chapter-books",
      answer: "easily",
      source: "legacy",
      memberUserId: null,
      adultDisplayName: null,
      quote: null,
      channel: null,
      messageId: null,
      checkInId: null,
      supersedesId: null,
      supersededAt: null,
      observedAt: "2026-07-10T17:30:00.123456Z",
      createdAt: "2026-07-10T17:30:01.123456Z",
      idempotencyKey: "legacy:chapter-books",
    });
    const service = createService(repository);

    const view = await service.getChildProgressView(
      FAMILY_ID,
      CHILD_ID,
    );

    assert.equal(view?.childId, CHILD_ID);
    assert.equal(
      view?.subjects[0]?.domains[0]?.topics.some(
        (topic) => topic.itemId === "literacy.chapter-books",
      ),
      true,
    );
    assert.equal(repository.liveView, null);
    assert.equal(repository.savedDerivedProgress.length, 0);
    assert.equal(repository.familyTouchCount, 0);
  });

  it("undoes family-scoped active evidence and refreshes compatibility", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const recorded = await service.recordProgressEvidence({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "checklist",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "undo-source",
    });
    assert.equal(recorded.status, "recorded");
    if (recorded.status !== "recorded") return;

    const undone = await service.undoProgressEvidence({
      familyId: FAMILY_ID,
      memberUserId: "adult-1",
      evidenceId: recorded.evidence[0].id,
      idempotencyKey: "undo-operation",
      observedAt: "2026-07-11T17:31:00.000000Z",
    });

    assert.deepEqual(undone, {
      status: "undone",
      childId: CHILD_ID,
      childName: "Maya",
      evidenceId: recorded.evidence[0].id,
      affectedItemIds: ["math.counts-to-5"],
    });
    assert.equal(
      repository.projectionInput.evidence[0].supersededAt,
      "2026-07-11T17:31:00.000000Z",
    );
    assert.equal(
      repository.compatibilityAnswers.has("math.counts-to-5"),
      false,
    );
  });

  it("undoes every active evidence row from one matched-many operation", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const recorded = await service.recordJournalProgressEvidence({
      ...JOURNAL_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      quote:
        "Maya read a short chapter book aloud and retold the plot",
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "batch-undo-source",
    });
    assert.equal(recorded.status, "recorded");
    if (recorded.status !== "recorded") return;
    assert.ok(recorded.operationId);

    const undone = await service.undoProgressOperation({
      familyId: FAMILY_ID,
      memberUserId: "adult-1",
      operationId: recorded.operationId,
      idempotencyKey: "batch-undo-operation",
      observedAt: "2026-07-11T17:31:00.000000Z",
    });

    assert.equal(undone.status, "undone");
    assert.deepEqual(
      repository.projectionInput.evidence.map((evidence) => ({
        itemId: evidence.itemId,
        supersededAt: evidence.supersededAt,
      })),
      [
        {
          itemId: "literacy.emergent-reader",
          supersededAt: "2026-07-11T17:31:00.000000Z",
        },
        {
          itemId: "literacy.retells-story",
          supersededAt: "2026-07-11T17:31:00.000000Z",
        },
      ],
    );
    assert.equal(
      repository.compatibilityAnswers.has(
        "literacy.emergent-reader",
      ),
      false,
    );
    assert.equal(
      repository.compatibilityAnswers.has(
        "literacy.retells-story",
      ),
      false,
    );
  });

  it("refuses to undo evidence held by an open conflict", async () => {
    const repository = new InMemoryChildProgressRepository();
    repository.projectionInput = emptyProjectionInput();
    const service = createService(repository);
    const first = await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-1",
      source: "conversation",
      itemId: "math.counts-to-5",
      answer: "easily",
      quote: null,
      observedAt: "2026-07-11T17:30:00.000000Z",
      idempotencyKey: "undo-conflict-a",
    });
    await service.recordProgressEvidence({
      ...CONVERSATION_PROVENANCE,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      memberUserId: "adult-2",
      source: "conversation",
      itemId: "math.counts-to-5",
      answer: "not_yet",
      quote: null,
      observedAt: "2026-07-11T17:31:00.000000Z",
      idempotencyKey: "undo-conflict-b",
    });
    assert.equal(first.status, "recorded");
    if (first.status !== "recorded") return;

    const result = await service.undoProgressEvidence({
      familyId: FAMILY_ID,
      memberUserId: "adult-1",
      evidenceId: first.evidence[0].id,
      idempotencyKey: "undo-conflicted",
      observedAt: "2026-07-11T17:32:00.000000Z",
    });

    assert.equal(result.status, "conflict_pending");
    assert.equal(
      repository.projectionInput.evidence[0].supersededAt,
      null,
    );
  });
});
