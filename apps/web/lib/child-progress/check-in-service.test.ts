import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMapItem } from "@homa/core";

import {
  ProgressCheckInService,
  type ProgressCheckInServiceOptions,
} from "./check-in-service";
import {
  storedProgressCheckInResponseOutcomeSchema,
} from "./check-in-schema";
import { buildChildProgressView } from "./projection";
import type {
  AppendChildObservationInput,
  AppendProgressEvidenceInput,
  ChildProgressOperationReceipt,
  ChildProgressProjectionInput,
  ClaimChildProgressOperationInput,
  ClaimChildProgressOperationResult,
  CompleteChildProgressOperationInput,
  InsertOpenProgressConflictInput,
  MarkChildObservationUsedInput,
  MarkChildObservationUsedResult,
  ProgressCheckInRepository,
  ProgressCheckInTransaction,
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
  ProgressCheckInChannel,
  ProgressCheckInContext,
  ProgressCheckInRecord,
  ResolvedProgressConflict,
} from "./types";

const FAMILY_ID = "family-1";
const OTHER_FAMILY_ID = "family-2";
const CHILD_ID = "child-1";
const SIBLING_ID = "child-2";
const ADULT_A = "adult-1";
const ADULT_B = "adult-2";
const ADULT_C = "adult-3";
const NOW = "2026-07-11T18:00:00.000000Z";

interface FakeResponse {
  id: string;
  childId: string;
  familyId: string;
  checkInId: string;
  revision: number;
  itemId: string;
  answer: "easily" | "getting_there" | "not_yet" | "not_sure" | "skip";
  memberUserId: string | null;
  deliveryId: string | null;
  channel: ProgressCheckInChannel;
  providerMessageId: string | null;
  inboundMessageId: string | null;
  isEvidence: boolean;
  evidenceId: string | null;
  idempotencyKey: string;
  result: unknown;
  createdAt: string;
}

interface FakeSnapshot {
  checkInId: string;
  childId: string;
  familyId: string;
  evidenceIds: string[];
  projection: ChildProgressView;
}

interface FakeProgressReplyLoop {
  familyId: string;
  checkInId: string;
  deliveryId: string;
  revision: number;
  state: "open" | "cancelled";
}

interface FakeState {
  projectionInputs: Map<string, ChildProgressProjectionInput>;
  checkIns: Map<string, ProgressCheckInRecord>;
  responses: Map<string, FakeResponse>;
  snapshots: Map<string, FakeSnapshot>;
  progressReplyLoops: Map<string, FakeProgressReplyLoop>;
  operationReceipts: Map<string, ChildProgressOperationReceipt>;
  savedDerivedProgress: SaveDerivedChildProgressInput[];
  checkInSequence: number;
  responseSequence: number;
  evidenceSequence: number;
  conflictSequence: number;
}

function scopedChildKey(familyId: string, childId: string): string {
  return `${familyId}:${childId}`;
}

function operationKey(input: {
  familyId: string;
  childId: string;
  idempotencyKey: string;
}): string {
  return `${input.familyId}:${input.childId}:${input.idempotencyKey}`;
}

function emptyProjectionInput(
  childId = CHILD_ID,
  childName = "Maya",
  birthDate = "2019-07-01",
): ChildProgressProjectionInput {
  return {
    child: { id: childId, name: childName, birthDate },
    familyId: FAMILY_ID,
    timeZone: "UTC",
    sourceRevision: BigInt(0),
    evidence: [],
    conflicts: [],
    selectionAnswers: [],
  };
}

class FakeChildProgressTransaction
  implements ProgressCheckInTransaction
{
  constructor(
    private readonly repository: FakeChildProgressRepository,
    private readonly draft: FakeState,
  ) {}

  async loadProjectionInputForUpdate(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    const input = this.projectionInput(familyId, childId);
    return input === null ? null : structuredClone(input);
  }

  async appendEvidence(
    input: AppendProgressEvidenceInput,
  ): Promise<StoredProgressEvidence> {
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    this.draft.evidenceSequence += 1;
    const evidence: StoredProgressEvidence = {
      id: `evidence-${this.draft.evidenceSequence}`,
      childId: input.childId,
      familyId: input.familyId,
      itemId: input.itemId,
      answer: input.answer,
      derivation: input.derivation,
      source: input.source,
      memberUserId: input.memberUserId,
      adultDisplayName: this.repository.displayNameFor(
        input.familyId,
        input.memberUserId,
      ),
      quote: input.quote,
      channel: input.channel,
      messageId: input.messageId,
      checkInId: input.checkInId,
      supersedesId: input.supersedesId,
      supersededAt: null,
      observedAt: input.observedAt,
      createdAt:
        `2026-07-11T18:00:00.${String(
          this.draft.evidenceSequence,
        ).padStart(6, "0")}Z`,
      idempotencyKey: input.idempotencyKey,
    };
    projectionInput.evidence.push(evidence);
    this.bumpSourceRevision(projectionInput);
    return structuredClone(evidence);
  }

  async appendObservation(
    input: AppendChildObservationInput,
  ): Promise<StoredChildObservation> {
    this.requireProjectionInput(input.familyId, input.childId);
    return {
      id: "observation-1",
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
    this.requireProjectionInput(input.familyId, input.childId);
    const key = operationKey(input);
    const existing = this.draft.operationReceipts.get(key);
    if (existing !== undefined) {
      return { kind: "existing", receipt: structuredClone(existing) };
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
      createdAt: NOW,
    };
    this.draft.operationReceipts.set(key, receipt);
    return { kind: "claimed", receipt: structuredClone(receipt) };
  }

  async completeOperation(
    input: CompleteChildProgressOperationInput,
  ): Promise<ChildProgressOperationReceipt> {
    const key = operationKey(input);
    const receipt = this.draft.operationReceipts.get(key);
    if (
      receipt === undefined ||
      receipt.status !== "pending" ||
      receipt.payloadHash !== input.payloadHash
    ) {
      throw new Error("Progress operation cannot be completed");
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
    return this.requireProjectionInput(familyId, childId).sourceRevision;
  }

  async supersedeEvidence(
    input: SupersedeProgressEvidenceInput,
  ): Promise<void> {
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    const evidence = projectionInput.evidence.find(
      (candidate) => candidate.id === input.evidenceId,
    );
    if (evidence === undefined || evidence.supersededAt !== null) {
      throw new Error("Evidence cannot be superseded");
    }
    evidence.supersededAt = input.supersededAt;
    this.bumpSourceRevision(projectionInput);
  }

  async insertOpenConflict(
    input: InsertOpenProgressConflictInput,
  ): Promise<OpenProgressConflict> {
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    this.draft.conflictSequence += 1;
    const conflict: OpenProgressConflict = {
      id: `conflict-${this.draft.conflictSequence}`,
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
    projectionInput.conflicts.push(conflict);
    this.bumpSourceRevision(projectionInput);
    return structuredClone(conflict);
  }

  async saveDerivedProgress(
    input: SaveDerivedChildProgressInput,
  ): Promise<void> {
    this.draft.savedDerivedProgress.push(structuredClone(input));
  }

  async saveCompatibilityAnswers(
    input: SaveProgressCompatibilityAnswersInput,
  ): Promise<void> {
    if (input.compatibilityAnswers.length === 0) return;
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    projectionInput.sourceRevision += BigInt(
      input.compatibilityAnswers.length,
    );
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

  async loadOperation(
    familyId: string,
    childId: string,
    idempotencyKey: string,
  ): Promise<ChildProgressOperationReceipt | null> {
    const receipt = this.draft.operationReceipts.get(
      operationKey({ familyId, childId, idempotencyKey }),
    );
    return receipt === undefined ? null : structuredClone(receipt);
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
    for (const projectionInput of this.draft.projectionInputs.values()) {
      const evidence = projectionInput.evidence.find(
        (candidate) =>
          candidate.familyId === familyId &&
          candidate.id === evidenceId,
      );
      if (evidence) {
        return {
          childId: evidence.childId,
          familyId: evidence.familyId,
        };
      }
    }
    return null;
  }

  async lockFamilyMemberForKeyShare(
    familyId: string,
    memberUserId: string,
  ): Promise<boolean> {
    return this.repository.hasFamilyMember(familyId, memberUserId);
  }

  async findCheckIn(
    familyId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null> {
    const checkIn = this.draft.checkIns.get(checkInId);
    return checkIn?.familyId === familyId
      ? structuredClone(checkIn)
      : null;
  }

  async lockCheckIn(
    familyId: string,
    childId: string,
    checkInId: string,
  ): Promise<ProgressCheckInRecord | null> {
    const checkIn = this.draft.checkIns.get(checkInId);
    return checkIn?.familyId === familyId &&
      checkIn.childId === childId
      ? structuredClone(checkIn)
      : null;
  }

  async lockNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null> {
    const checkIn = [...this.draft.checkIns.values()].find(
      (candidate) =>
        candidate.familyId === familyId &&
        candidate.childId === childId &&
        (candidate.state === "active" ||
          candidate.state === "paused"),
    );
    return checkIn === undefined ? null : structuredClone(checkIn);
  }

  async insertCheckIn(
    input: Parameters<ProgressCheckInTransaction["insertCheckIn"]>[0],
  ): ReturnType<ProgressCheckInTransaction["insertCheckIn"]> {
    const existing = [...this.draft.checkIns.values()].find(
      (candidate) =>
        candidate.familyId === input.familyId &&
        candidate.childId === input.childId &&
        (candidate.state === "active" ||
          candidate.state === "paused"),
    );
    if (existing !== undefined) {
      return {
        kind: "existing",
        checkIn: structuredClone(existing),
      };
    }
    this.draft.checkInSequence += 1;
    const checkIn: ProgressCheckInRecord = {
      id: `check-in-${this.draft.checkInSequence}`,
      childId: input.childId,
      childName: input.childName,
      familyId: input.familyId,
      purpose: input.purpose,
      scope: structuredClone(input.scope),
      state: "active",
      ownerMemberUserId: input.ownerMemberUserId,
      ownerDisplayName: this.repository.displayNameFor(
        input.familyId,
        input.ownerMemberUserId,
      ),
      recipientMemberUserId: input.recipientMemberUserId,
      recipientDisplayName: this.repository.displayNameFor(
        input.familyId,
        input.recipientMemberUserId,
      ),
      revision: 1,
      currentItemId: input.currentItemId,
      currentDeliveryId: null,
      episodeId: input.episodeId,
      pendingRuntimeSessionId: input.pendingRuntimeSessionId,
      pendingTurnId: input.pendingTurnId,
      pauseReason: null,
      openedAt: input.openedAt,
      pausedAt: null,
      completedAt: null,
      stoppedAt: null,
      updatedAt: input.openedAt,
    };
    this.draft.checkIns.set(checkIn.id, checkIn);
    return { kind: "inserted", checkIn: structuredClone(checkIn) };
  }

  async compareAndSwapCheckIn(
    input: Parameters<
      ProgressCheckInTransaction["compareAndSwapCheckIn"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["compareAndSwapCheckIn"]
  > {
    const checkIn = this.draft.checkIns.get(input.checkInId);
    if (
      checkIn === undefined ||
      checkIn.familyId !== input.familyId ||
      checkIn.childId !== input.childId ||
      checkIn.revision !== input.expectedRevision
    ) {
      return null;
    }
    const updated: ProgressCheckInRecord = {
      ...checkIn,
      ...structuredClone(input.next),
      revision: input.expectedRevision + 1,
      ownerDisplayName: this.repository.displayNameFor(
        input.familyId,
        input.next.ownerMemberUserId,
      ),
      recipientDisplayName: this.repository.displayNameFor(
        input.familyId,
        input.next.recipientMemberUserId,
      ),
    };
    this.draft.checkIns.set(checkIn.id, updated);
    return structuredClone(updated);
  }

  async cancelProgressReplyLoops(input: {
    familyId: string;
    checkInId: string;
    keepDeliveryId: string | null;
    keepRevision: number | null;
  }): Promise<number> {
    let cancelled = 0;
    for (const loop of this.draft.progressReplyLoops.values()) {
      if (
        loop.familyId !== input.familyId ||
        loop.checkInId !== input.checkInId ||
        loop.state !== "open"
      ) {
        continue;
      }
      const keepCurrent =
        input.keepDeliveryId !== null &&
        input.keepRevision !== null &&
        loop.deliveryId === input.keepDeliveryId &&
        loop.revision === input.keepRevision;
      if (keepCurrent) continue;
      loop.state = "cancelled";
      cancelled += 1;
    }
    return cancelled;
  }

  async findCheckInResponseReplay(
    input: Parameters<
      ProgressCheckInTransaction["findCheckInResponseReplay"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["findCheckInResponseReplay"]
  > {
    const response = this.responseReplay(input);
    return response === null ? null : structuredClone(response);
  }

  async insertCheckInResponse(
    input: Parameters<
      ProgressCheckInTransaction["insertCheckInResponse"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["insertCheckInResponse"]
  > {
    const replay = this.responseReplay(input);
    if (replay !== null) {
      return { kind: "duplicate", response: structuredClone(replay) };
    }
    const checkIn = this.draft.checkIns.get(input.checkInId);
    if (
      checkIn === undefined ||
      checkIn.familyId !== input.familyId ||
      checkIn.childId !== input.childId ||
      checkIn.revision !== input.revision ||
      checkIn.state !== "active" ||
      checkIn.currentItemId !== input.itemId ||
      checkIn.recipientMemberUserId !== input.memberUserId ||
      checkIn.currentDeliveryId !== input.deliveryId
    ) {
      throw new Error(
        "Check-in response insert lost its validated prompt",
      );
    }
    this.draft.responseSequence += 1;
    const response: FakeResponse = {
      id: `response-${this.draft.responseSequence}`,
      childId: input.childId,
      familyId: input.familyId,
      checkInId: input.checkInId,
      revision: input.revision,
      itemId: input.itemId,
      answer: input.answer,
      memberUserId: input.memberUserId,
      deliveryId: input.deliveryId,
      channel: input.channel,
      providerMessageId: input.providerMessageId,
      inboundMessageId: input.inboundMessageId,
      isEvidence: false,
      evidenceId: null,
      idempotencyKey: input.idempotencyKey,
      result: { status: "pending" },
      createdAt: input.createdAt,
    };
    this.draft.responses.set(response.id, response);
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    projectionInput.selectionAnswers.push({
      selectionId: response.id,
      evidenceId: null,
      itemId: response.itemId,
      answer: response.answer,
      answeredAt: response.createdAt,
    });
    this.bumpSourceRevision(projectionInput);
    return {
      kind: "inserted",
      response: structuredClone(response),
    };
  }

  async completeCheckInResponse(
    input: Parameters<
      ProgressCheckInTransaction["completeCheckInResponse"]
    >[0],
  ): Promise<void> {
    const response = this.draft.responses.get(input.responseId);
    if (
      response === undefined ||
      response.familyId !== input.familyId ||
      response.childId !== input.childId ||
      response.checkInId !== input.checkInId
    ) {
      throw new Error("Response completion lost its scope");
    }
    response.isEvidence = input.evidenceId !== null;
    response.evidenceId = input.evidenceId;
    response.result = structuredClone(input.result);
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    const answer = projectionInput.selectionAnswers.find(
      (candidate) => candidate.selectionId === input.responseId,
    );
    if (answer !== undefined) answer.evidenceId = input.evidenceId;
  }

  async insertCheckInBaselineSnapshot(
    input: Parameters<
      ProgressCheckInTransaction["insertCheckInBaselineSnapshot"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["insertCheckInBaselineSnapshot"]
  > {
    if (this.draft.snapshots.has(input.checkInId)) return "existing";
    this.draft.snapshots.set(input.checkInId, {
      checkInId: input.checkInId,
      childId: input.childId,
      familyId: input.familyId,
      evidenceIds: [...input.evidenceIds],
      projection: structuredClone(input.projection),
    });
    return "inserted";
  }

  async findProgressConflict(
    familyId: string,
    conflictId: string,
  ): ReturnType<
    ProgressCheckInTransaction["findProgressConflict"]
  > {
    for (const projectionInput of this.draft.projectionInputs.values()) {
      const conflict = projectionInput.conflicts.find(
        (candidate) =>
          candidate.id === conflictId &&
          candidate.familyId === familyId,
      );
      if (conflict !== undefined) {
        return {
          childId: conflict.childId,
          familyId: conflict.familyId,
        };
      }
    }
    return null;
  }

  async lockProgressConflict(
    familyId: string,
    childId: string,
    conflictId: string,
  ): ReturnType<
    ProgressCheckInTransaction["lockProgressConflict"]
  > {
    const projectionInput = this.projectionInput(familyId, childId);
    const conflict = projectionInput?.conflicts.find(
      (candidate) => candidate.id === conflictId,
    );
    if (projectionInput === null || conflict === undefined) return null;
    const evidenceA = projectionInput.evidence.find(
      (evidence) => evidence.id === conflict.evidenceIdA,
    );
    const evidenceB = projectionInput.evidence.find(
      (evidence) => evidence.id === conflict.evidenceIdB,
    );
    if (evidenceA === undefined || evidenceB === undefined) {
      throw new Error("Conflict evidence is missing");
    }
    return {
      conflict: structuredClone(conflict),
      evidenceA: structuredClone(evidenceA),
      evidenceB: structuredClone(evidenceB),
    };
  }

  async resolveProgressConflict(
    input: Parameters<
      ProgressCheckInTransaction["resolveProgressConflict"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["resolveProgressConflict"]
  > {
    const projectionInput = this.requireProjectionInput(
      input.familyId,
      input.childId,
    );
    const index = projectionInput.conflicts.findIndex(
      (candidate) =>
        candidate.id === input.conflictId &&
        candidate.state === "open",
    );
    const conflict = projectionInput.conflicts[index];
    if (conflict === undefined || conflict.state !== "open") return null;
    const selectedEvidence = projectionInput.evidence.find(
      (evidence) => evidence.id === input.evidenceId,
    );
    if (
      selectedEvidence === undefined ||
      (
        selectedEvidence.id !== conflict.evidenceIdA &&
        selectedEvidence.id !== conflict.evidenceIdB
      ) ||
      selectedEvidence.itemId !== conflict.itemId ||
      selectedEvidence.answer !== input.answer
    ) {
      return null;
    }
    const resolved: ResolvedProgressConflict = {
      ...conflict,
      state: "resolved",
      resolvedAnswer: input.answer,
      resolvedEvidenceId: input.evidenceId,
      resolvedAt: input.resolvedAt,
    };
    projectionInput.conflicts[index] = resolved;
    this.bumpSourceRevision(projectionInput);
    return structuredClone(resolved);
  }

  async bindCurrentCheckInDelivery(
    input: Parameters<
      ProgressCheckInTransaction["bindCurrentCheckInDelivery"]
    >[0],
  ): ReturnType<
    ProgressCheckInTransaction["bindCurrentCheckInDelivery"]
  > {
    const checkIn = this.draft.checkIns.get(input.checkInId);
    if (
      checkIn === undefined ||
      checkIn.familyId !== input.familyId ||
      checkIn.childId !== input.childId ||
      checkIn.revision !== input.expectedRevision ||
      checkIn.state !== "active" ||
      checkIn.pendingRuntimeSessionId !==
        input.runtimeSessionId ||
      checkIn.pendingTurnId !== input.turnId ||
      this.repository.deliveryRecipientFor(
        input.familyId,
        input.deliveryId,
      ) !== checkIn.recipientMemberUserId
    ) {
      return null;
    }
    checkIn.currentDeliveryId = input.deliveryId;
    checkIn.episodeId = input.episodeId;
    checkIn.updatedAt = input.updatedAt;
    return structuredClone(checkIn);
  }

  private responseReplay(input: {
    familyId: string;
    checkInId: string;
    idempotencyKey: string;
    channel: string;
    providerMessageId: string | null;
  }): FakeResponse | null {
    return (
      [...this.draft.responses.values()].find(
        (response) =>
          response.familyId === input.familyId &&
          (
            (
              response.checkInId === input.checkInId &&
              response.idempotencyKey === input.idempotencyKey
            ) ||
            (
              input.providerMessageId !== null &&
              response.channel === input.channel &&
              response.providerMessageId === input.providerMessageId
            )
          ),
      ) ?? null
    );
  }

  private projectionInput(
    familyId: string,
    childId: string,
  ): ChildProgressProjectionInput | null {
    return (
      this.draft.projectionInputs.get(
        scopedChildKey(familyId, childId),
      ) ?? null
    );
  }

  private requireProjectionInput(
    familyId: string,
    childId: string,
  ): ChildProgressProjectionInput {
    const projectionInput = this.projectionInput(familyId, childId);
    if (projectionInput === null) throw new Error("Unknown child");
    return projectionInput;
  }

  private bumpSourceRevision(
    projectionInput: ChildProgressProjectionInput,
  ): void {
    projectionInput.sourceRevision += BigInt(1);
  }
}

class FakeChildProgressRepository
  implements ProgressCheckInRepository
{
  private state: FakeState = {
    projectionInputs: new Map([
      [
        scopedChildKey(FAMILY_ID, CHILD_ID),
        emptyProjectionInput(),
      ],
      [
        scopedChildKey(FAMILY_ID, SIBLING_ID),
        emptyProjectionInput(
          SIBLING_ID,
          "Noah",
          "2020-07-01",
        ),
      ],
    ]),
    checkIns: new Map(),
    responses: new Map(),
    snapshots: new Map(),
    progressReplyLoops: new Map(),
    operationReceipts: new Map(),
    savedDerivedProgress: [],
    checkInSequence: 0,
    responseSequence: 0,
    evidenceSequence: 0,
    conflictSequence: 0,
  };
  private transactionQueue: Promise<void> = Promise.resolve();
  readonly familyMembers = new Map([
    [`${FAMILY_ID}:${ADULT_A}`, "Elena"],
    [`${FAMILY_ID}:${ADULT_B}`, "Jordan"],
    [`${FAMILY_ID}:${ADULT_C}`, "Avery"],
  ]);
  readonly deliveryRecipients = new Map<string, string | null>([
    [`${FAMILY_ID}:delivery-1`, ADULT_A],
    [`${FAMILY_ID}:delivery-2`, ADULT_A],
    [`${FAMILY_ID}:delivery-adult-2`, ADULT_B],
    [`${FAMILY_ID}:delivery-unpinned`, null],
  ]);
  transactionCount = 0;

  get checkIns(): ProgressCheckInRecord[] {
    return [...this.state.checkIns.values()];
  }

  get responses(): FakeResponse[] {
    return [...this.state.responses.values()];
  }

  get snapshots(): FakeSnapshot[] {
    return [...this.state.snapshots.values()];
  }

  progressReplyLoop(deliveryId: string): FakeProgressReplyLoop {
    const loop = this.state.progressReplyLoops.get(deliveryId);
    assert.ok(loop);
    return loop;
  }

  get savedDerivedProgress(): SaveDerivedChildProgressInput[] {
    return this.state.savedDerivedProgress;
  }

  get operationReceipts(): ChildProgressOperationReceipt[] {
    return [...this.state.operationReceipts.values()];
  }

  projectionInput(childId = CHILD_ID): ChildProgressProjectionInput {
    const input = this.state.projectionInputs.get(
      scopedChildKey(FAMILY_ID, childId),
    );
    assert.ok(input);
    return input;
  }

  async withTransaction<T>(
    operation: (
      transaction: ProgressCheckInTransaction,
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
    const draft = structuredClone(this.state);
    try {
      const result = await operation(
        new FakeChildProgressTransaction(this, draft),
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
    void familyId;
    void childId;
    void now;
    return null;
  }

  async loadProjectionInput(
    familyId: string,
    childId: string,
  ): Promise<ChildProgressProjectionInput | null> {
    const input = this.state.projectionInputs.get(
      scopedChildKey(familyId, childId),
    );
    return input === undefined ? null : structuredClone(input);
  }

  async markObservationUsed(
    input: MarkChildObservationUsedInput,
  ): Promise<MarkChildObservationUsedResult> {
    void input;
    return { outcome: "unknown_observation" };
  }

  async listNonterminalCheckInsByFamily(
    familyId: string,
  ): Promise<ProgressCheckInRecord[]> {
    return [...this.state.checkIns.values()]
      .filter(
        (checkIn) =>
          checkIn.familyId === familyId &&
          (checkIn.state === "active" ||
            checkIn.state === "paused"),
      )
      .map((checkIn) => structuredClone(checkIn));
  }

  async loadNonterminalCheckInByChild(
    familyId: string,
    childId: string,
  ): Promise<ProgressCheckInRecord | null> {
    const checkIn = [...this.state.checkIns.values()].find(
      (candidate) =>
        candidate.familyId === familyId &&
        candidate.childId === childId &&
        (candidate.state === "active" ||
          candidate.state === "paused"),
    );
    return checkIn === undefined ? null : structuredClone(checkIn);
  }

  async loadActiveCheckInByRecipientOrDelivery(
    input: Parameters<
      ProgressCheckInRepository[
        "loadActiveCheckInByRecipientOrDelivery"
      ]
    >[0],
  ): ReturnType<
    ProgressCheckInRepository[
      "loadActiveCheckInByRecipientOrDelivery"
    ]
  > {
    const matches = [...this.state.checkIns.values()].filter(
      (checkIn) =>
        checkIn.familyId === input.familyId &&
        checkIn.state === "active" &&
        checkIn.recipientMemberUserId === input.memberUserId &&
        checkIn.currentDeliveryId === input.repliedDeliveryId,
    );
    return matches.length === 1
      ? structuredClone(matches[0])
      : null;
  }

  displayNameFor(
    familyId: string,
    memberUserId: string | null,
  ): string | null {
    if (memberUserId === null) return null;
    return (
      this.familyMembers.get(`${familyId}:${memberUserId}`) ?? null
    );
  }

  deliveryRecipientFor(
    familyId: string,
    deliveryId: string,
  ): string | null | undefined {
    return this.deliveryRecipients.get(`${familyId}:${deliveryId}`);
  }

  hasFamilyMember(
    familyId: string,
    memberUserId: string,
  ): boolean {
    return this.familyMembers.has(`${familyId}:${memberUserId}`);
  }

  removeFamilyMember(
    memberUserId: string,
    removedAt = "2026-07-11T19:00:00.000000Z",
  ): void {
    this.familyMembers.delete(`${FAMILY_ID}:${memberUserId}`);
    for (const checkIn of this.state.checkIns.values()) {
      if (
        checkIn.familyId !== FAMILY_ID ||
        (
          checkIn.state !== "active" &&
          checkIn.state !== "paused"
        ) ||
        (
          checkIn.ownerMemberUserId !== memberUserId &&
          checkIn.recipientMemberUserId !== memberUserId
        )
      ) {
        continue;
      }
      checkIn.state = "paused";
      checkIn.ownerMemberUserId = null;
      checkIn.ownerDisplayName = null;
      checkIn.recipientMemberUserId = null;
      checkIn.recipientDisplayName = null;
      checkIn.currentDeliveryId = null;
      checkIn.pendingRuntimeSessionId = null;
      checkIn.pendingTurnId = null;
      checkIn.pauseReason = "member_removed";
      checkIn.revision += 1;
      checkIn.pausedAt = removedAt;
      checkIn.completedAt = null;
      checkIn.stoppedAt = null;
      checkIn.updatedAt = removedAt;
    }
  }

  openProgressReplyLoop(input: {
    checkInId: string;
    deliveryId: string;
    revision: number;
  }): void {
    const checkIn = this.state.checkIns.get(input.checkInId);
    assert.ok(checkIn);
    this.state.progressReplyLoops.set(input.deliveryId, {
      familyId: checkIn.familyId,
      checkInId: input.checkInId,
      deliveryId: input.deliveryId,
      revision: input.revision,
      state: "open",
    });
  }

  seedEvidence(input: {
    childId?: string;
    itemId: string;
    answer: "easily" | "getting_there" | "not_yet";
    memberUserId: string;
    observedAt?: string;
  }): StoredProgressEvidence {
    this.state.evidenceSequence += 1;
    const projectionInput = this.projectionInput(
      input.childId ?? CHILD_ID,
    );
    const evidence: StoredProgressEvidence = {
      id: `evidence-${this.state.evidenceSequence}`,
      childId: projectionInput.child.id,
      familyId: FAMILY_ID,
      itemId: input.itemId,
      answer: input.answer,
      derivation: "direct",
      source: "conversation",
      memberUserId: input.memberUserId,
      adultDisplayName: this.displayNameFor(
        FAMILY_ID,
        input.memberUserId,
      ),
      quote: null,
      channel: "web",
      messageId: "00000000-0000-4000-8000-000000000020",
      checkInId: null,
      supersedesId: null,
      supersededAt: null,
      observedAt:
        input.observedAt ?? "2026-07-10T18:00:00.000000Z",
      createdAt: "2026-07-10T18:00:01.000000Z",
      idempotencyKey: `seed-${this.state.evidenceSequence}`,
    };
    projectionInput.evidence.push(evidence);
    projectionInput.sourceRevision += BigInt(1);
    return evidence;
  }
}

function context(
  overrides: Partial<ProgressCheckInContext> = {},
): ProgressCheckInContext {
  return {
    familyId: FAMILY_ID,
    memberUserId: ADULT_A,
    channel: "sms",
    providerMessageId: "provider-start",
    repliedDeliveryId: null,
    episodeId: "episode-1",
    runtimeSessionId: "runtime-session-1",
    turnId: "turn-1",
    canonicalInboundText: "Maya can answer this check-in.",
    inboundMessageId: "00000000-0000-4000-8000-000000000020",
    now: NOW,
    ...overrides,
  };
}

function createFixture(
  options: ProgressCheckInServiceOptions = {},
): {
  repository: FakeChildProgressRepository;
  service: ProgressCheckInService;
} {
  const repository = new FakeChildProgressRepository();
  const childProgressService = new ChildProgressService(repository, {
    buildView: buildChildProgressView,
    now: () => new Date("2026-07-11T18:00:00.000Z"),
  });
  return {
    repository,
    service: new ProgressCheckInService(
      repository,
      childProgressService,
      options,
    ),
  };
}

async function startArtCheckIn(
  service: ProgressCheckInService,
  overrides: Partial<ProgressCheckInContext> = {},
) {
  return service.startCheckIn(context(overrides), {
    childId: CHILD_ID,
    purpose: "subject_deep_dive",
    subjectIds: ["art"],
    idempotencyKey: "start-art",
  });
}

async function startBoundArtCheckInWithReplyLoop(
  fixture: ReturnType<typeof createFixture>,
  deliveryId = "delivery-1",
) {
  const started = await startArtCheckIn(fixture.service);
  assert.equal(started.status, "started");
  if (started.status !== "started") {
    throw new Error("Bound-loop fixture did not start");
  }
  const bound = await fixture.service.bindCurrentDelivery(context(), {
    checkInId: started.checkIn.id,
    expectedRevision: started.checkIn.revision,
    deliveryId,
  });
  assert.equal(bound.status, "bound");
  fixture.repository.openProgressReplyLoop({
    checkInId: started.checkIn.id,
    deliveryId,
    revision: started.checkIn.revision,
  });
  return started;
}

describe("durable progress check-in workflow", () => {
  it("refuses an unknown child without creating workflow state", async () => {
    const { repository, service } = createFixture();

    const result = await service.startCheckIn(context(), {
      childId: "missing-child",
      purpose: "whole_map_refresh",
      idempotencyKey: "start-missing",
    });

    assert.deepEqual(result, { status: "unknown_child" });
    assert.equal(repository.checkIns.length, 0);
    assert.equal(repository.snapshots.length, 0);
  });

  it("refuses a removed authenticated member before child locking", async () => {
    const { repository, service } = createFixture();
    repository.removeFamilyMember(ADULT_A);

    assert.deepEqual(
      await service.startCheckIn(context(), {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "removed-member-start",
      }),
      { status: "wrong_recipient" },
    );
    assert.equal(repository.checkIns.length, 0);
    assert.equal(repository.snapshots.length, 0);
  });

  it("refuses missing, empty, or unknown subject deep-dive scope", async () => {
    const { repository, service } = createFixture();

    for (const [index, subjectIds] of [
      undefined,
      [],
      ["not-a-subject"],
    ].entries()) {
      assert.deepEqual(
        await service.startCheckIn(
          context({
            providerMessageId: `provider-invalid-${index}`,
          }),
          {
            childId: CHILD_ID,
            purpose: "subject_deep_dive",
            subjectIds,
            idempotencyKey: `invalid-scope-${index}`,
          },
        ),
        { status: "invalid_scope" },
      );
    }
    assert.equal(repository.checkIns.length, 0);
    assert.equal(repository.snapshots.length, 0);
  });

  it("starts with a smart server item at revision one and one baseline", async () => {
    const { repository, service } = createFixture();

    const result = await startArtCheckIn(service);

    assert.equal(result.status, "started");
    if (result.status !== "started") return;
    assert.equal(result.checkIn.revision, 1);
    assert.equal(result.checkIn.state, "active");
    assert.equal(
      result.checkIn.pendingRuntimeSessionId,
      "runtime-session-1",
    );
    assert.equal(result.checkIn.pendingTurnId, "turn-1");
    assert.equal(result.prompt.checkInId, result.checkIn.id);
    assert.equal(result.prompt.revision, 1);
    assert.equal(result.prompt.childName, "Maya");
    assert.equal(result.prompt.subjectDisplayName, "Art & creative");
    assert.match(result.prompt.personalizedStatement, /^Maya /u);
    assert.equal(
      getMapItem(result.prompt.itemId)?.subject.id,
      "art",
    );
    assert.equal(result.prompt.ownerDisplayName, "Elena");
    assert.equal(repository.snapshots.length, 1);
    assert.deepEqual(
      repository.snapshots[0].evidenceIds,
      [],
    );
    assert.equal(
      repository.snapshots[0].projection.childId,
      CHILD_ID,
    );
  });

  it("returns the existing nonterminal workflow and allows sibling workflows", async () => {
    const { repository, service } = createFixture();
    const first = await startArtCheckIn(service);
    assert.equal(first.status, "started");

    const existing = await service.startCheckIn(
      context({
        providerMessageId: "provider-start-retry",
        runtimeSessionId: "runtime-retry",
        turnId: "turn-retry",
      }),
      {
        childId: CHILD_ID,
        purpose: "whole_map_refresh",
        idempotencyKey: "different-start-key",
      },
    );
    const sibling = await service.startCheckIn(
      context({ providerMessageId: "provider-sibling" }),
      {
        childId: SIBLING_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "start-sibling",
      },
    );

    assert.equal(existing.status, "existing");
    assert.equal(sibling.status, "started");
    if (
      first.status === "started" &&
      existing.status === "existing"
    ) {
      assert.equal(existing.checkIn.id, first.checkIn.id);
      assert.equal(
        existing.checkIn.pendingRuntimeSessionId,
        "runtime-retry",
      );
      assert.equal(existing.checkIn.pendingTurnId, "turn-retry");
    }
    assert.equal(repository.checkIns.length, 2);
    assert.equal(repository.snapshots.length, 2);
  });

  it("retires the delivered revision when reissuing a prompt", async () => {
    const reissue = createFixture();
    await startBoundArtCheckInWithReplyLoop(reissue);
    const reissued = await reissue.service.startCheckIn(
      context({
        providerMessageId: "provider-reissue",
        runtimeSessionId: "runtime-reissue",
        turnId: "turn-reissue",
      }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "start-art-reissue",
      },
    );
    assert.equal(reissued.status, "existing");
    if (reissued.status !== "existing") return;
    assert.equal(reissued.checkIn.revision, 2);
    assert.equal(reissued.checkIn.currentDeliveryId, null);
    const oldRevisionLoop =
      reissue.repository.progressReplyLoop("delivery-1");
    assert.equal(oldRevisionLoop.state, "cancelled");

    assert.equal(
      (
        await reissue.service.bindCurrentDelivery(
          context({
            providerMessageId: "provider-reissue-bind",
            runtimeSessionId: "runtime-reissue",
            turnId: "turn-reissue",
          }),
          {
            checkInId: reissued.checkIn.id,
            expectedRevision: reissued.checkIn.revision,
            deliveryId: "delivery-2",
          },
        )
      ).status,
      "bound",
    );
    reissue.repository.openProgressReplyLoop({
      checkInId: reissued.checkIn.id,
      deliveryId: "delivery-2",
      revision: reissued.checkIn.revision,
    });
    const currentRevisionLoop =
      reissue.repository.progressReplyLoop("delivery-2");
    assert.equal(currentRevisionLoop.state, "open");
  });

  it("clears the delivered reply loop when advancing", async () => {
    const advance = createFixture();
    const started = await advance.service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-advance-loop",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    assert.equal(
      (
        await advance.service.bindCurrentDelivery(context(), {
          checkInId: started.checkIn.id,
          expectedRevision: started.checkIn.revision,
          deliveryId: "delivery-1",
        })
      ).status,
      "bound",
    );
    advance.repository.openProgressReplyLoop({
      checkInId: started.checkIn.id,
      deliveryId: "delivery-1",
      revision: started.checkIn.revision,
    });

    const advanced = await advance.service.respondCheckIn(
      context({
        providerMessageId: "provider-advance-loop",
        repliedDeliveryId: "delivery-1",
      }),
      {
        checkInId: started.checkIn.id,
        answer: "skip",
        idempotencyKey: "advance-loop",
      },
    );

    assert.equal(advanced.status, "advanced");
    const advancedLoop =
      advance.repository.progressReplyLoop("delivery-1");
    assert.equal(advancedLoop.state, "cancelled");
  });

  it("clears the delivered reply loop when pausing", async () => {
    const pause = createFixture();
    const pauseStarted =
      await startBoundArtCheckInWithReplyLoop(pause);
    const sibling = await pause.service.startCheckIn(
      context({ providerMessageId: "provider-sibling-loop" }),
      {
        childId: SIBLING_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "start-sibling-loop",
      },
    );
    assert.equal(sibling.status, "started");
    if (sibling.status !== "started") return;
    pause.repository.openProgressReplyLoop({
      checkInId: sibling.checkIn.id,
      deliveryId: "sibling-loop",
      revision: sibling.checkIn.revision,
    });
    const paused = await pause.service.pauseCheckIn(context(), {
      checkInId: pauseStarted.checkIn.id,
      reason: "explicit_pause",
    });
    assert.equal(paused.status, "paused");
    if (paused.status !== "paused") return;
    assert.equal(paused.checkIn.currentDeliveryId, null);
    const pausedLoop = pause.repository.progressReplyLoop("delivery-1");
    assert.equal(pausedLoop.state, "cancelled");
    const siblingLoop = pause.repository.progressReplyLoop("sibling-loop");
    assert.equal(siblingLoop.state, "open");
  });

  it("clears the delivered reply loop when stopping", async () => {
    const stop = createFixture();
    const stopStarted =
      await startBoundArtCheckInWithReplyLoop(stop);
    assert.equal(
      (
        await stop.service.stopCheckIn(context(), {
          checkInId: stopStarted.checkIn.id,
        })
      ).status,
      "stopped",
    );
    const stoppedLoop = stop.repository.progressReplyLoop("delivery-1");
    assert.equal(stoppedLoop.state, "cancelled");
  });

  it("clears the delivered reply loop when completing", async () => {
    const complete = createFixture();
    const completeStarted =
      await startBoundArtCheckInWithReplyLoop(complete);
    assert.equal(
      (
        await complete.service.respondCheckIn(
          context({
            providerMessageId: "provider-complete-loop",
            repliedDeliveryId: "delivery-1",
          }),
          {
            checkInId: completeStarted.checkIn.id,
            answer: "skip",
            idempotencyKey: "complete-loop",
          },
        )
      ).status,
      "completed",
    );
    const completedLoop =
      complete.repository.progressReplyLoop("delivery-1");
    assert.equal(completedLoop.state, "cancelled");
  });

  it("enforces family, state, recipient, and bound delivery", async () => {
    const { repository, service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    assert.deepEqual(
      await service.respondCheckIn(
        context({
          providerMessageId: "provider-unbound-unrelated",
          repliedDeliveryId: "delivery-1",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 1,
          answer: "not_yet",
          idempotencyKey: "unbound-unrelated",
        },
      ),
      { status: "wrong_delivery" },
    );
    const bound = await service.bindCurrentDelivery(
      context(),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        deliveryId: "delivery-1",
      },
    );
    assert.equal(bound.status, "bound");
    if (bound.status === "bound") {
      assert.equal(bound.checkIn.currentDeliveryId, "delivery-1");
    }

    const common = {
      checkInId: started.checkIn.id,
      answer: "not_yet" as const,
      idempotencyKey: "response-guard",
    };
    assert.deepEqual(
      await service.respondCheckIn(
        context({ familyId: OTHER_FAMILY_ID }),
        common,
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.respondCheckIn(
        context({
          memberUserId: ADULT_B,
          repliedDeliveryId: "delivery-1",
        }),
        common,
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.respondCheckIn(
        context({ repliedDeliveryId: "delivery-wrong" }),
        common,
      ),
      { status: "wrong_delivery" },
    );
    assert.deepEqual(
      await service.respondCheckIn(context(), common),
      { status: "wrong_delivery" },
    );
    assert.equal(repository.responses.length, 0);
    assert.equal(repository.projectionInput().evidence.length, 0);
  });

  it("returns every typed delivery bind refusal without mutation", async () => {
    const { repository, service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const input = {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      deliveryId: "delivery-1",
    };

    assert.deepEqual(
      await service.bindCurrentDelivery(context(), {
        ...input,
        checkInId: "missing-check-in",
      }),
      { status: "no_active_check_in" },
    );
    assert.deepEqual(
      await service.bindCurrentDelivery(context(), {
        ...input,
        expectedRevision: 0,
      }),
      { status: "stale_prompt" },
    );
    assert.deepEqual(
      await service.bindCurrentDelivery(
        context({ memberUserId: ADULT_B }),
        input,
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.bindCurrentDelivery(context(), {
        ...input,
        deliveryId: " ",
      }),
      { status: "wrong_delivery" },
    );
    assert.deepEqual(
      await service.bindCurrentDelivery(context(), {
        ...input,
        deliveryId: "delivery-adult-2",
      }),
      { status: "wrong_delivery" },
    );

    const bound = await service.bindCurrentDelivery(context(), input);
    assert.equal(bound.status, "bound");
    if (bound.status !== "bound") return;
    assert.equal(bound.checkIn.currentDeliveryId, "delivery-1");
    assert.equal(repository.checkIns[0].currentDeliveryId, "delivery-1");
    assert.deepEqual(
      await service.bindCurrentDelivery(context(), {
        ...input,
        deliveryId: "delivery-2",
      }),
      { status: "wrong_delivery" },
    );
    const rebound = await service.bindCurrentDelivery(context(), input);
    assert.equal(rebound.status, "bound");
    if (rebound.status === "bound") {
      assert.equal(rebound.checkIn.currentDeliveryId, "delivery-1");
    }
  });

  it("saves non-evidence answers and advances without refreshing exhausted scope", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-skip",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    const advanced = await service.respondCheckIn(
      context({
        providerMessageId: "provider-skip-1",
        runtimeSessionId: "runtime-advance",
        turnId: "turn-advance",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "skip",
        idempotencyKey: "skip-1",
      },
    );
    assert.equal(advanced.status, "advanced");
    if (advanced.status !== "advanced") return;
    assert.equal("progressUpdate" in advanced, false);
    assert.notEqual(advanced.prompt.itemId, started.prompt.itemId);
    assert.equal(advanced.prompt.revision, 2);
    assert.equal(
      advanced.checkIn.pendingRuntimeSessionId,
      "runtime-advance",
    );
    assert.equal(
      advanced.checkIn.pendingTurnId,
      "turn-advance",
    );
    assert.equal(repository.responses[0].isEvidence, false);
    assert.equal(repository.responses[0].evidenceId, null);
    assert.equal(repository.projectionInput().evidence.length, 0);

    const completed = await service.respondCheckIn(
      context({ providerMessageId: "provider-skip-2" }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 2,
        answer: "not_sure",
        idempotencyKey: "skip-2",
      },
    );
    assert.equal(completed.status, "completed");
    if (completed.status === "completed") {
      assert.equal(completed.checkIn.state, "completed");
      assert.equal(completed.checkIn.currentItemId, null);
      assert.equal("progressUpdate" in completed, false);
      assert.equal(
        completed.checkIn.pendingRuntimeSessionId,
        null,
      );
      assert.equal(completed.checkIn.pendingTurnId, null);
    }
    assert.equal(repository.responses.length, 2);
    assert.equal(repository.projectionInput().evidence.length, 0);
    assert.equal(repository.savedDerivedProgress.length, 0);
    assert.deepEqual(
      await service.respondCheckIn(
        context({
          providerMessageId: "provider-after-completed",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
          answer: "skip",
          idempotencyKey: "after-completed",
        },
      ),
      { status: "no_active_check_in" },
    );
  });

  it("matches an unpinned recipient with nullable equality", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(
      context({
        memberUserId: null,
        providerMessageId: "provider-unpinned-start",
      }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "start-unpinned",
      },
    );
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    assert.deepEqual(
      await service.respondCheckIn(
        context({
          memberUserId: ADULT_A,
          providerMessageId: "provider-pinned-answer",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 1,
          answer: "not_yet",
          idempotencyKey: "pinned-answer",
        },
      ),
      { status: "wrong_recipient" },
    );
    const completed = await service.respondCheckIn(
      context({
        memberUserId: null,
        providerMessageId: "provider-unpinned-answer",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "not_yet",
        idempotencyKey: "unpinned-answer",
      },
    );
    assert.equal(completed.status, "completed");
    if (completed.status === "completed") {
      assert.equal(completed.progressUpdate?.undoAvailable, true);
      assert.deepEqual(
        completed.progressUpdate?.affectedItemIds,
        [started.prompt.itemId],
      );
      assert.ok(completed.progressUpdate?.operationId);
    }
    const replay = await service.respondCheckIn(
      context({
        memberUserId: null,
        providerMessageId: "provider-unpinned-answer",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "not_yet",
        idempotencyKey: "unpinned-answer",
      },
    );
    assert.equal(replay.status, "duplicate");
    if (
      replay.status === "duplicate" &&
      replay.original.status === "completed" &&
      completed.status === "completed"
    ) {
      assert.deepEqual(
        replay.original.progressUpdate,
        completed.progressUpdate,
      );
    }
    assert.equal(repository.projectionInput().evidence.length, 1);
    assert.equal(
      repository.projectionInput().evidence[0].memberUserId,
      null,
    );
  });

  it("records evidence atomically and replays provider or idempotency duplicates", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["literacy"],
      idempotencyKey: "start-evidence",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const responseContext = context({
      providerMessageId: "provider-answer-1",
    });
    const input = {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      answer: "easily" as const,
      idempotencyKey: "answer-1",
    };

    const first = await service.respondCheckIn(
      responseContext,
      input,
    );
    assert.equal(first.status, "advanced");
    if (first.status === "advanced") {
      assert.equal(first.progressUpdate?.undoAvailable, true);
      assert.deepEqual(
        first.progressUpdate?.affectedItemIds,
        [started.prompt.itemId],
      );
      assert.ok(first.progressUpdate?.operationId);
      assert.ok(
        (first.progressUpdate?.affectedTopics[0]?.length ?? 0) > 0,
      );
    }
    assert.equal(repository.transactionCount, 2);
    assert.equal(repository.responses.length, 1);
    assert.equal(repository.projectionInput().evidence.length, 1);
    assert.equal(
      repository.projectionInput().evidence[0].checkInId,
      started.checkIn.id,
    );
    assert.equal(
      repository.projectionInput().evidence[0].source,
      "check_in",
    );

    const idempotencyReplay = await service.respondCheckIn(
      responseContext,
      input,
    );
    const providerReplay = await service.respondCheckIn(
      responseContext,
      {
        ...input,
        answer: "not_yet",
        idempotencyKey: "different-key-same-provider",
      },
    );

    assert.equal(idempotencyReplay.status, "duplicate");
    assert.equal(providerReplay.status, "duplicate");
    if (idempotencyReplay.status === "duplicate") {
      assert.equal(idempotencyReplay.original.status, "advanced");
      if (idempotencyReplay.original.status === "advanced") {
        assert.deepEqual(
          idempotencyReplay.original.progressUpdate,
          first.status === "advanced"
            ? first.progressUpdate
            : undefined,
        );
      }
    }
    assert.equal(repository.responses.length, 1);
    assert.equal(repository.projectionInput().evidence.length, 1);

    const savesBeforeStop = repository.savedDerivedProgress.length;
    const stopped = await service.stopCheckIn(responseContext, {
      checkInId: started.checkIn.id,
      expectedRevision: 2,
    });
    assert.equal(stopped.status, "stopped");
    assert.equal(repository.projectionInput().evidence.length, 1);
    assert.equal(
      repository.savedDerivedProgress.length,
      savesBeforeStop,
    );
  });

  it("refuses duplicate replay from the wrong member or delivery", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-duplicate-guards",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const bound = await service.bindCurrentDelivery(context(), {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      deliveryId: "delivery-1",
    });
    assert.equal(bound.status, "bound");
    const responseContext = context({
      providerMessageId: "provider-duplicate-guards",
      repliedDeliveryId: "delivery-1",
    });
    const responseInput = {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      answer: "skip" as const,
      idempotencyKey: "duplicate-guards",
    };
    assert.equal(
      (await service.respondCheckIn(responseContext, responseInput))
        .status,
      "advanced",
    );

    assert.deepEqual(
      await service.respondCheckIn(
        {
          ...responseContext,
          memberUserId: ADULT_B,
        },
        responseInput,
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.respondCheckIn(
        {
          ...responseContext,
          repliedDeliveryId: "delivery-2",
        },
        responseInput,
      ),
      { status: "wrong_delivery" },
    );
    assert.equal(
      (
        await service.respondCheckIn(
          responseContext,
          responseInput,
        )
      ).status,
      "duplicate",
    );
    assert.equal(repository.responses.length, 1);
  });

  it("rejects non-strict stored response outcomes recursively", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-strict-replay",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const responseContext = context({
      providerMessageId: "provider-strict-replay",
    });
    const responseInput = {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      answer: "skip" as const,
      idempotencyKey: "strict-replay",
    };
    assert.equal(
      (await service.respondCheckIn(responseContext, responseInput))
        .status,
      "advanced",
    );
    const response = repository.responses[0];
    const original = structuredClone(response.result) as Record<
      string,
      unknown
    >;
    for (const nestedKey of ["checkIn", "prompt"] as const) {
      const nested = original[nestedKey] as Record<string, unknown>;
      response.result = {
        ...original,
        [nestedKey]: { ...nested, unexpected: true },
      };
      await assert.rejects(
        service.respondCheckIn(responseContext, responseInput),
      );
    }
    response.result = {
      ...original,
      status: "paused",
    };
    await assert.rejects(
      service.respondCheckIn(responseContext, responseInput),
    );
  });

  it("pauses after a saved response and resumes the same prompt across channels", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-pause-after-response",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const advanced = await service.respondCheckIn(
      context({ providerMessageId: "provider-before-pause" }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "skip",
        idempotencyKey: "before-pause",
      },
    );
    assert.equal(advanced.status, "advanced");
    if (advanced.status !== "advanced") return;
    assert.equal(repository.responses.length, 1);

    const paused = await service.pauseCheckIn(context(), {
      checkInId: started.checkIn.id,
      expectedRevision: 2,
      reason: "topic_change",
    });
    assert.equal(paused.status, "paused");
    if (paused.status !== "paused") return;
    assert.equal(paused.checkIn.currentItemId, advanced.prompt.itemId);
    assert.equal(paused.checkIn.revision, 3);
    assert.equal(repository.responses.length, 1);

    assert.deepEqual(
      await service.respondCheckIn(
        context({ providerMessageId: "provider-paused-answer" }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
          answer: "not_yet",
          idempotencyKey: "paused-answer",
        },
      ),
      { status: "no_active_check_in" },
    );

    const resumed = await service.resumeCheckIn(
      context({
        channel: "web",
        providerMessageId: "web-resume",
        episodeId: "episode-web",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 3,
      },
    );
    assert.equal(resumed.status, "resumed");
    if (resumed.status === "resumed") {
      assert.equal(resumed.prompt.itemId, advanced.prompt.itemId);
      assert.equal(resumed.prompt.revision, 4);
      assert.equal(resumed.checkIn.episodeId, "episode-web");
      assert.equal(resumed.checkIn.currentDeliveryId, null);
    }
    assert.equal(repository.responses.length, 1);
  });

  it("requires explicit authenticated takeover and keeps prompt and responses", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-takeover",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const firstAnswer = await service.respondCheckIn(
      context({ providerMessageId: "provider-before-takeover" }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "skip",
        idempotencyKey: "before-takeover",
      },
    );
    assert.equal(firstAnswer.status, "advanced");
    if (firstAnswer.status !== "advanced") return;

    assert.deepEqual(
      await service.takeoverCheckIn(
        context({ memberUserId: null }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 2,
        },
      ),
      { status: "wrong_recipient" },
    );
    repository.openProgressReplyLoop({
      checkInId: firstAnswer.checkIn.id,
      deliveryId: "takeover-loop",
      revision: firstAnswer.checkIn.revision,
    });

    const takeover = await service.takeoverCheckIn(
      context({
        memberUserId: ADULT_B,
        providerMessageId: "provider-takeover",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 2,
      },
    );
    assert.equal(takeover.status, "takeover_accepted");
    if (takeover.status !== "takeover_accepted") return;
    assert.equal(takeover.checkIn.ownerMemberUserId, ADULT_B);
    assert.equal(takeover.checkIn.recipientMemberUserId, ADULT_B);
    assert.equal(takeover.prompt.itemId, firstAnswer.prompt.itemId);
    assert.equal(takeover.prompt.revision, 3);
    assert.equal(repository.responses.length, 1);
    assert.equal(
      repository.progressReplyLoop("takeover-loop").state,
      "cancelled",
    );

    assert.deepEqual(
      await service.respondCheckIn(
        context({
          memberUserId: ADULT_A,
          providerMessageId: "provider-old-owner",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
          answer: "not_yet",
          idempotencyKey: "old-owner-answer",
        },
      ),
      { status: "wrong_recipient" },
    );
  });

  it("pauses on member removal and requires a current-member takeover", async () => {
    const { repository, service } = createFixture();
    const started = await service.startCheckIn(context(), {
      childId: CHILD_ID,
      purpose: "subject_deep_dive",
      subjectIds: ["art", "music"],
      idempotencyKey: "start-member-removal",
    });
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const advanced = await service.respondCheckIn(
      context({ providerMessageId: "member-removal-response" }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "skip",
        idempotencyKey: "member-removal-response",
      },
    );
    assert.equal(advanced.status, "advanced");
    if (advanced.status !== "advanced") return;
    repository.removeFamilyMember(ADULT_A);

    const removed = repository.checkIns[0];
    assert.equal(removed.state, "paused");
    assert.equal(removed.pauseReason, "member_removed");
    assert.equal(removed.ownerMemberUserId, null);
    assert.equal(removed.recipientMemberUserId, null);
    assert.equal(removed.currentDeliveryId, null);
    assert.equal(removed.currentItemId, advanced.prompt.itemId);
    assert.equal(removed.revision, 3);
    assert.equal(repository.responses.length, 1);
    assert.deepEqual(
      await service.resumeCheckIn(
        context({ memberUserId: null }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
        },
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.takeoverCheckIn(
        context({ memberUserId: ADULT_A }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
        },
      ),
      { status: "wrong_recipient" },
    );

    const takeover = await service.takeoverCheckIn(
      context({ memberUserId: ADULT_B }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 3,
      },
    );
    assert.equal(takeover.status, "takeover_accepted");
    if (takeover.status !== "takeover_accepted") return;
    assert.equal(takeover.checkIn.state, "active");
    assert.equal(takeover.checkIn.pauseReason, null);
    assert.equal(takeover.checkIn.pausedAt, null);
    assert.equal(takeover.checkIn.ownerMemberUserId, ADULT_B);
    assert.equal(takeover.checkIn.recipientMemberUserId, ADULT_B);
    assert.equal(takeover.prompt.itemId, advanced.prompt.itemId);
    assert.equal(repository.responses.length, 1);
  });

  it("requires conflict resolution before member-removed takeover", async () => {
    const { repository, service } = createFixture();
    const literacyItem = getMapItem("literacy.emergent-reader");
    assert.ok(literacyItem);
    repository.seedEvidence({
      itemId: literacyItem.item.id,
      answer: "not_yet",
      memberUserId: ADULT_A,
    });
    const started = await service.startCheckIn(
      context({ memberUserId: ADULT_B }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["literacy"],
        idempotencyKey: "start-member-conflict",
      },
    );
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const opened = await service.respondCheckIn(
      context({
        memberUserId: ADULT_B,
        providerMessageId: "member-conflict-response",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "easily",
        idempotencyKey: "member-conflict-response",
      },
    );
    assert.equal(opened.status, "conflict_open");
    if (opened.status !== "conflict_open") return;
    assert.equal("progressUpdate" in opened, false);
    assert.equal(
      storedProgressCheckInResponseOutcomeSchema.safeParse({
        ...opened,
        progressUpdate: {
          operationId: "33333333-3333-4333-8333-333333333333",
          affectedItemIds: [opened.conflict.itemId],
          affectedTopics: [opened.conflict.skillStatement],
          undoAvailable: true,
        },
      }).success,
      false,
    );
    repository.removeFamilyMember(ADULT_B);
    const removed = repository.checkIns[0];
    assert.equal(removed.pauseReason, "member_removed");

    assert.deepEqual(
      await service.takeoverCheckIn(
        context({ memberUserId: ADULT_C }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 3,
        },
      ),
      {
        status: "conflict_pending",
        conflictId: opened.conflict.id,
      },
    );
    assert.equal(repository.checkIns[0].state, "paused");
    assert.equal(
      repository.checkIns[0].pauseReason,
      "member_removed",
    );
  });

  it("keeps internal pause reasons out of the public pause command", async () => {
    type PauseReason = Parameters<
      ProgressCheckInService["pauseCheckIn"]
    >[1]["reason"];
    const acceptsConflict: "conflict" extends PauseReason
      ? true
      : false = false;
    const acceptsMemberRemoved:
      "member_removed" extends PauseReason ? true : false = false;
    const { service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    assert.equal(acceptsConflict, false);
    assert.equal(acceptsMemberRemoved, false);
    for (const reason of ["conflict", "member_removed"] as const) {
      assert.deepEqual(
        await service.pauseCheckIn(context(), {
          checkInId: started.checkIn.id,
          expectedRevision: 1,
          reason,
        } as unknown as Parameters<
          ProgressCheckInService["pauseCheckIn"]
        >[1]),
        { status: "invalid_scope" },
      );
    }
  });

  it("pauses an unseen uncertain delivery and resumes with a fresh marker", async () => {
    const { repository, service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const itemId = started.checkIn.currentItemId;
    repository.openProgressReplyLoop({
      checkInId: started.checkIn.id,
      deliveryId: "delivery-pause-loop",
      revision: started.checkIn.revision,
    });

    const paused = await service.pauseCheckInForDeliveryOutcome(
      context(),
      {
        checkInId: started.checkIn.id,
        expectedRevision: started.checkIn.revision,
        reason: "delivery_uncertain",
      },
    );

    assert.equal(paused.status, "paused");
    if (paused.status !== "paused") return;
    assert.equal(paused.checkIn.pauseReason, "delivery_uncertain");
    assert.equal(paused.checkIn.currentItemId, itemId);
    assert.equal(paused.checkIn.currentDeliveryId, null);
    assert.equal(paused.checkIn.pendingRuntimeSessionId, null);
    assert.equal(paused.checkIn.pendingTurnId, null);
    assert.equal(
      repository.progressReplyLoop("delivery-pause-loop").state,
      "cancelled",
    );
    assert.equal(repository.responses.length, 0);
    assert.deepEqual(
      await service.respondCheckIn(
        context({
          providerMessageId: "unrelated-after-uncertain",
          runtimeSessionId: "runtime-unrelated",
          turnId: "turn-unrelated",
        }),
        {
          checkInId: started.checkIn.id,
          answer: "easily",
          idempotencyKey: "unrelated-after-uncertain",
        },
      ),
      { status: "no_active_check_in" },
    );
    repository.openProgressReplyLoop({
      checkInId: paused.checkIn.id,
      deliveryId: "resume-loop",
      revision: paused.checkIn.revision,
    });

    const resumed = await service.resumeCheckIn(
      context({
        runtimeSessionId: "runtime-resume",
        turnId: "turn-resume",
      }),
      { checkInId: started.checkIn.id },
    );
    assert.equal(resumed.status, "resumed");
    if (resumed.status === "resumed") {
      assert.equal(
        resumed.checkIn.pendingRuntimeSessionId,
        "runtime-resume",
      );
      assert.equal(resumed.checkIn.pendingTurnId, "turn-resume");
      assert.equal(resumed.checkIn.currentItemId, itemId);
    }
    assert.equal(
      repository.progressReplyLoop("resume-loop").state,
      "cancelled",
    );
  });

  it("stops without another report write and frees the child slot", async () => {
    const { repository, service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const savedBeforeStop = repository.savedDerivedProgress.length;

    const stopped = await service.stopCheckIn(context(), {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
    });

    assert.equal(stopped.status, "stopped");
    if (stopped.status === "stopped") {
      assert.equal(stopped.checkIn.state, "stopped");
      assert.equal(stopped.checkIn.currentItemId, null);
    }
    assert.equal(repository.snapshots.length, 1);
    assert.equal(
      repository.savedDerivedProgress.length,
      savedBeforeStop,
    );
    assert.deepEqual(
      await service.respondCheckIn(
        context({ providerMessageId: "provider-after-stopped" }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 2,
          answer: "not_yet",
          idempotencyKey: "after-stopped",
        },
      ),
      { status: "no_active_check_in" },
    );

    const restarted = await service.startCheckIn(
      context({ providerMessageId: "provider-restart" }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["art"],
        idempotencyKey: "restart-art",
      },
    );
    assert.equal(restarted.status, "started");
    assert.equal(repository.checkIns.length, 2);
    assert.equal(repository.snapshots.length, 2);
  });

  it("pauses for a conflict, preserves both rows, and resumes after exact resolution", async () => {
    const committedAnswers: unknown[] = [];
    const committedResolutions: unknown[] = [];
    const { repository, service } = createFixture({
      onAnswerCommitted: async (event) => {
        committedAnswers.push(event);
      },
      onConflictResolutionCommitted: async (event) => {
        committedResolutions.push(event);
      },
    });
    const literacyItem = getMapItem("literacy.emergent-reader");
    assert.ok(literacyItem);
    repository.seedEvidence({
      itemId: literacyItem.item.id,
      answer: "not_yet",
      memberUserId: ADULT_A,
    });
    const started = await service.startCheckIn(
      context({
        memberUserId: ADULT_B,
        providerMessageId: "provider-conflict-start",
      }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["literacy"],
        idempotencyKey: "start-conflict",
      },
    );
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    assert.equal(started.prompt.itemId, literacyItem.item.id);
    assert.equal(
      (
        await service.bindCurrentDelivery(
          context({
            memberUserId: ADULT_B,
            providerMessageId: "provider-conflict-bind",
          }),
          {
            checkInId: started.checkIn.id,
            expectedRevision: started.checkIn.revision,
            deliveryId: "delivery-adult-2",
          },
        )
      ).status,
      "bound",
    );
    repository.openProgressReplyLoop({
      checkInId: started.checkIn.id,
      deliveryId: "delivery-adult-2",
      revision: started.checkIn.revision,
    });

    const opened = await service.respondCheckIn(
      context({
        memberUserId: ADULT_B,
        providerMessageId: "provider-conflict-answer",
        repliedDeliveryId: "delivery-adult-2",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "easily",
        idempotencyKey: "open-conflict",
      },
    );
    assert.equal(opened.status, "conflict_open");
    if (opened.status !== "conflict_open") return;
    assert.equal(opened.checkIn.state, "paused");
    assert.equal(opened.checkIn.pauseReason, "conflict");
    assert.equal(
      repository.progressReplyLoop("delivery-adult-2").state,
      "cancelled",
    );
    assert.equal(
      opened.checkIn.currentItemId,
      literacyItem.item.id,
    );
    assert.deepEqual(opened.conflict.answers, [
      {
        evidenceId: "evidence-1",
        answer: "not_yet",
        adultDisplayName: "Elena",
        observedAt: "2026-07-10T18:00:00.000000Z",
        source: "conversation",
      },
      {
        evidenceId: "evidence-2",
        answer: "easily",
        adultDisplayName: "Jordan",
        observedAt: NOW,
        source: "check_in",
      },
    ]);
    assert.equal(repository.projectionInput().evidence.length, 2);
    assert.deepEqual(committedAnswers, [{
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: literacyItem.item.id,
      answer: "easily",
      outcome: "conflict_open",
    }]);
    const conflictResponse = repository.responses[0];
    const storedConflictOutcome = structuredClone(
      conflictResponse.result,
    ) as Record<string, unknown>;
    const storedConflict = storedConflictOutcome.conflict as Record<
      string,
      unknown
    >;
    conflictResponse.result = {
      ...storedConflictOutcome,
      conflict: { ...storedConflict, unexpected: true },
    };
    await assert.rejects(
      service.respondCheckIn(
        context({
          memberUserId: ADULT_B,
          providerMessageId: "provider-conflict-answer",
          repliedDeliveryId: "delivery-adult-2",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 1,
          answer: "easily",
          idempotencyKey: "open-conflict",
        },
      ),
    );
    conflictResponse.result = storedConflictOutcome;

    assert.deepEqual(
      await service.resolveProgressConflict(
        context({
          familyId: OTHER_FAMILY_ID,
          memberUserId: ADULT_C,
          providerMessageId: "provider-wrong-family-resolution",
        }),
        {
          conflictId: opened.conflict.id,
          answer: "easily",
          idempotencyKey: "wrong-family-resolution",
        },
      ),
      { status: "wrong_recipient" },
    );
    assert.deepEqual(
      await service.resolveProgressConflict(
        context({
          memberUserId: ADULT_C,
          providerMessageId: "provider-invalid-resolution",
        }),
        {
          conflictId: opened.conflict.id,
          answer: "getting_there",
          idempotencyKey: "invalid-resolution",
        },
      ),
      { status: "invalid_scope" },
    );

    assert.deepEqual(
      await service.respondCheckIn(
        context({
          memberUserId: ADULT_B,
          providerMessageId: "provider-conflict-extra",
        }),
        {
          checkInId: started.checkIn.id,
          expectedRevision: 2,
          answer: "not_yet",
          idempotencyKey: "conflict-extra",
        },
      ),
      {
        status: "conflict_pending",
        conflictId: opened.conflict.id,
      },
    );

    repository.openProgressReplyLoop({
      checkInId: opened.checkIn.id,
      deliveryId: "conflict-resolution-loop",
      revision: opened.checkIn.revision,
    });
    const resolved = await service.resolveProgressConflict(
      context({
        memberUserId: ADULT_C,
        providerMessageId: "provider-conflict-resolution",
        episodeId: "episode-resolver",
      }),
      {
        conflictId: opened.conflict.id,
        answer: "easily",
        idempotencyKey: "resolve-conflict",
      },
    );
    assert.equal(resolved.status, "conflict_resolved");
    if (resolved.status !== "conflict_resolved") return;
    assert.equal(resolved.selectedEvidenceId, "evidence-2");
    assert.equal(resolved.checkIn?.state, "active");
    assert.equal(resolved.checkIn?.episodeId, "episode-1");
    assert.equal(resolved.prompt?.revision, 3);
    assert.equal(repository.projectionInput().evidence.length, 2);
    assert.equal(
      repository.progressReplyLoop("conflict-resolution-loop").state,
      "cancelled",
    );
    assert.deepEqual(committedResolutions, [{
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: literacyItem.item.id,
      checkInState: "active",
    }]);
    const conflict = repository.projectionInput().conflicts[0];
    assert.equal(conflict.state, "resolved");
    if (conflict.state === "resolved") {
      assert.equal(conflict.resolvedAnswer, "easily");
      assert.equal(conflict.resolvedEvidenceId, "evidence-2");
    }

    const replay = await service.resolveProgressConflict(
      context({
        memberUserId: ADULT_C,
        providerMessageId: "provider-conflict-resolution",
      }),
      {
        conflictId: opened.conflict.id,
        answer: "easily",
        idempotencyKey: "resolve-conflict",
      },
    );
    assert.deepEqual(replay, {
      status: "duplicate",
      original: resolved,
    });
    assert.equal(committedAnswers.length, 1);
    assert.equal(committedResolutions.length, 1);
    assert.deepEqual(
      await service.resolveProgressConflict(
        context({
          memberUserId: ADULT_C,
          providerMessageId: "provider-conflict-mismatch",
        }),
        {
          conflictId: opened.conflict.id,
          answer: "not_yet",
          idempotencyKey: "resolve-conflict",
        },
      ),
      { status: "idempotency_mismatch" },
    );
    assert.equal(repository.operationReceipts.length, 2);
    assert.equal(
      repository.operationReceipts.find(
        (receipt) => receipt.idempotencyKey === "resolve-conflict",
      )?.status,
      "conflict_resolved",
    );
    assert.equal(repository.projectionInput().evidence.length, 2);
  });

  it("rejects a third same-item row as resolved conflict evidence", async () => {
    const { repository, service } = createFixture();
    const literacyItem = getMapItem("literacy.emergent-reader");
    assert.ok(literacyItem);
    repository.seedEvidence({
      itemId: literacyItem.item.id,
      answer: "not_yet",
      memberUserId: ADULT_A,
    });
    const started = await service.startCheckIn(
      context({ memberUserId: ADULT_B }),
      {
        childId: CHILD_ID,
        purpose: "subject_deep_dive",
        subjectIds: ["literacy"],
        idempotencyKey: "start-third-evidence",
      },
    );
    assert.equal(started.status, "started");
    if (started.status !== "started") return;
    const opened = await service.respondCheckIn(
      context({
        memberUserId: ADULT_B,
        providerMessageId: "third-evidence-open",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 1,
        answer: "easily",
        idempotencyKey: "third-evidence-open",
      },
    );
    assert.equal(opened.status, "conflict_open");
    if (opened.status !== "conflict_open") return;
    const third = repository.seedEvidence({
      itemId: literacyItem.item.id,
      answer: "getting_there",
      memberUserId: ADULT_C,
      observedAt: "2026-07-11T18:30:00.000000Z",
    });

    const resolved = await repository.withTransaction((transaction) =>
      transaction.resolveProgressConflict({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        conflictId: opened.conflict.id,
        answer: third.answer,
        evidenceId: third.id,
        resolverMemberUserId: ADULT_C,
        resolvedAt: "2026-07-11T18:31:00.000000Z",
      })
    );
    assert.equal(resolved, null);
    assert.equal(
      repository.projectionInput().conflicts[0].state,
      "open",
    );
  });

  it("exposes scoped read helpers and prompt lookup without channel ownership", async () => {
    const { service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    const family = await service.listActiveFamilyCheckIns(FAMILY_ID);
    const child = await service.getActiveChildCheckIn(
      FAMILY_ID,
      CHILD_ID,
    );
    const prompt = await service.getPromptContext(
      context({ channel: "web", providerMessageId: "web-context" }),
    );

    assert.deepEqual(
      family.map((checkIn) => checkIn.id),
      [started.checkIn.id],
    );
    assert.equal(child?.id, started.checkIn.id);
    assert.equal(prompt?.checkInId, started.checkIn.id);
    assert.equal(prompt?.itemId, started.prompt.itemId);
  });

  it("requires recipient and nullable delivery parity for prompt lookup", async () => {
    const { service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    assert.equal(
      (
        await service.getPromptContext(
          context({
            memberUserId: ADULT_A,
            repliedDeliveryId: null,
          }),
        )
      )?.checkInId,
      started.checkIn.id,
    );
    for (const lookup of [
      { memberUserId: ADULT_B, repliedDeliveryId: null },
      { memberUserId: ADULT_A, repliedDeliveryId: "delivery-1" },
      { memberUserId: ADULT_B, repliedDeliveryId: "delivery-1" },
    ] as const) {
      assert.equal(
        await service.getPromptContext(context(lookup)),
        null,
      );
    }

    const bound = await service.bindCurrentDelivery(context(), {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      deliveryId: "delivery-1",
    });
    assert.equal(bound.status, "bound");
    assert.equal(
      (
        await service.getPromptContext(
          context({
            memberUserId: ADULT_A,
            repliedDeliveryId: "delivery-1",
          }),
        )
      )?.checkInId,
      started.checkIn.id,
    );
    for (const lookup of [
      { memberUserId: ADULT_A, repliedDeliveryId: null },
      { memberUserId: ADULT_A, repliedDeliveryId: "delivery-2" },
      { memberUserId: ADULT_B, repliedDeliveryId: "delivery-1" },
    ] as const) {
      assert.equal(
        await service.getPromptContext(context(lookup)),
        null,
      );
    }

    const paused = await service.pauseCheckIn(context(), {
      checkInId: started.checkIn.id,
      expectedRevision: 1,
      reason: "topic_change",
    });
    assert.equal(paused.status, "paused");
    const resumed = await service.resumeCheckIn(
      context({
        channel: "web",
        repliedDeliveryId: null,
        episodeId: "episode-web",
      }),
      {
        checkInId: started.checkIn.id,
        expectedRevision: 2,
      },
    );
    assert.equal(resumed.status, "resumed");
    assert.equal(
      (
        await service.getPromptContext(
          context({
            channel: "web",
            repliedDeliveryId: null,
            episodeId: "episode-web",
          }),
        )
      )?.checkInId,
      started.checkIn.id,
    );
  });

  it("uses the locked current revision when responding", async () => {
    const { service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    const result = await service.respondCheckIn(
      context({
        providerMessageId: "provider-current-revision",
      }),
      {
        checkInId: started.checkIn.id,
        answer: "skip",
        idempotencyKey: "trusted-response-key",
      },
    );

    assert.notEqual(result.status, "stale_prompt");
  });

  it("uses locked revisions for pause, resume, takeover, and stop", async () => {
    const { service } = createFixture();
    const started = await startArtCheckIn(service);
    assert.equal(started.status, "started");
    if (started.status !== "started") return;

    const paused = await service.pauseCheckIn(context(), {
      checkInId: started.checkIn.id,
      reason: "topic_change",
    });
    assert.equal(paused.status, "paused");
    const resumed = await service.resumeCheckIn(context(), {
      checkInId: started.checkIn.id,
    });
    assert.equal(resumed.status, "resumed");
    const moved = await service.takeoverCheckIn(
      context({ memberUserId: ADULT_B }),
      { checkInId: started.checkIn.id },
    );
    assert.equal(moved.status, "takeover_accepted");
    const stopped = await service.stopCheckIn(
      context({ memberUserId: ADULT_B }),
      { checkInId: started.checkIn.id },
    );
    assert.equal(stopped.status, "stopped");
  });
});
