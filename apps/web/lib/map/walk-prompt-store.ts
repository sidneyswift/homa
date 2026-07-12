import { createHash, randomUUID } from "node:crypto";

import { ageInMonths, type MapAnswer } from "@homa/core";
import {
  askableTopicIds,
  getTaxonomyDomain,
  getTopic,
  nextWalkCard,
  walkCardStatement,
  walkOutcome,
} from "@homa/taxonomy";

import { PostgresChildProgressRepository } from "../child-progress/postgres-repository";
import { buildChildProgressView } from "../child-progress/projection";
import {
  buildProgressSelectionAnswers,
} from "../child-progress/projection";
import type {
  ChildProgressProjectionInput,
  ChildProgressRepository,
  StoredMapWalkPrompt,
} from "../child-progress/repository";
import {
  ChildProgressService,
  type SavedWalkProgressResult,
} from "../child-progress/progress-service";
import {
  parseOffsetIsoTimestampEpochNanoseconds,
} from "../child-progress/timestamp";

const WALK_PROMPT_TTL_MS = 30 * 60_000;

export type MapWalkResponse =
  | {
      ok: true;
      done: false;
      card: {
        promptId: string;
        topicId: string;
        domainId: string;
        domainName: string;
        statement: string;
      };
    }
  | {
      ok: true;
      done: true;
      outcome: ReturnType<typeof walkOutcome> | "stopped_early";
    };

export type MapWalkStoredResult =
  | MapWalkResponse
  | {
      ok: false;
      reason: "expired_prompt" | "stale_prompt";
    };

function walkPayloadHash(input: {
  familyId: string;
  childId: string;
  subjectId: string;
  topicId: string;
  answer: MapAnswer;
  sitting: number;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      familyId: input.familyId,
      childId: input.childId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      answer: input.answer,
      sitting: input.sitting,
    }))
    .digest("hex");
}

function validAssessmentTopic(
  subjectId: string,
  topicId: string,
): ReturnType<typeof getTopic> {
  const topic = getTopic(topicId);
  if (!topic || topic.subject !== subjectId) return undefined;
  const domain = getTaxonomyDomain(topic.domain);
  return domain?.kind === "assessment" ? topic : undefined;
}

function selectionAnswers(
  projection: ChildProgressProjectionInput,
) {
  return buildProgressSelectionAnswers({
    childId: projection.child.id,
    familyId: projection.familyId,
    evidence: projection.evidence,
    conflicts: projection.conflicts,
    selectionAnswers: projection.selectionAnswers,
  });
}

function latestItemObservedAt(
  projection: ChildProgressProjectionInput,
  itemId: string,
): string | null {
  let latest: { value: string; instant: bigint; id: string } | null =
    null;
  for (const answer of selectionAnswers(projection)) {
    if (answer.itemId !== itemId) continue;
    const instant = parseOffsetIsoTimestampEpochNanoseconds(
      answer.answeredAt,
    );
    if (
      latest === null ||
      instant > latest.instant ||
      (instant === latest.instant && answer.selectionId > latest.id)
    ) {
      latest = {
        value: answer.answeredAt,
        instant,
        id: answer.selectionId,
      };
    }
  }
  return latest?.value ?? null;
}

function currentWalkAnswers(
  projection: ChildProgressProjectionInput,
): Record<string, MapAnswer> {
  const latest = new Map<
    string,
    { answer: MapAnswer; instant: bigint; id: string }
  >();
  for (const selection of selectionAnswers(projection)) {
    if (!getTopic(selection.itemId)) continue;
    const instant = parseOffsetIsoTimestampEpochNanoseconds(
      selection.answeredAt,
    );
    const current = latest.get(selection.itemId);
    if (
      current === undefined ||
      instant > current.instant ||
      (instant === current.instant && selection.selectionId > current.id)
    ) {
      latest.set(selection.itemId, {
        answer: selection.answer,
        instant,
        id: selection.selectionId,
      });
    }
  }
  return Object.fromEntries(
    [...latest].map(([itemId, entry]) => [itemId, entry.answer]),
  );
}

export interface MapWalkPromptServiceTestHooks {
  afterProgressWrite?: () => Promise<void>;
  beforeNextPromptInsert?: () => Promise<void>;
  nextPromptOverride?: {
    topicId: string;
    domainId: string;
    domainName: string;
    statement: string;
  };
}

export class MapWalkPromptService {
  constructor(
    private readonly repository: ChildProgressRepository,
    private readonly progressService: ChildProgressService,
    private readonly testHooks: MapWalkPromptServiceTestHooks = {},
  ) {}

  async createPrompt(input: {
    familyId: string;
    childId: string;
    memberUserId: string | null;
    subjectId: string;
    topicId: string;
    sitting: number;
    now?: Date;
  }): Promise<string | null> {
    if (!validAssessmentTopic(input.subjectId, input.topicId)) {
      return null;
    }
    const now = input.now ?? new Date();
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return null;
      }
      const projection =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (!projection) return null;
      const result =
        await transaction.insertOrLoadActiveMapWalkPrompt({
          id: randomUUID(),
          childId: input.childId,
          familyId: input.familyId,
          subjectId: input.subjectId,
          topicId: input.topicId,
          sitting: input.sitting,
          sourceRevision: projection.sourceRevision,
          itemObservedAt: latestItemObservedAt(
            projection,
            input.topicId,
          ),
          createdAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + WALK_PROMPT_TTL_MS,
          ).toISOString(),
        });
      const prompt = result.prompt;
      const currentItemObservedAt = latestItemObservedAt(
        projection,
        prompt.topicId,
      );
      const expired =
        new Date(prompt.expiresAt).getTime() <= now.getTime();
      const stale =
        projection.sourceRevision !== prompt.sourceRevision &&
        currentItemObservedAt !== prompt.itemObservedAt;
      if (result.kind === "existing" && (expired || stale)) {
        const reason = expired ? "expired_prompt" : "stale_prompt";
        const resultBody = { ok: false as const, reason };
        await transaction.consumeMapWalkPrompt({
          promptId: prompt.id,
          childId: input.childId,
          familyId: input.familyId,
          answer: null,
          terminalReason: expired ? "expired" : "stale",
          idempotencyKey: `server-retire:${prompt.id}:${reason}`,
          payloadHash: createHash("sha256")
            .update(`server-retire:${prompt.id}:${reason}`)
            .digest("hex"),
          result: resultBody,
          consumedAt: now.toISOString(),
        });
        const replacement =
          await transaction.insertOrLoadActiveMapWalkPrompt({
            id: randomUUID(),
            childId: input.childId,
            familyId: input.familyId,
            subjectId: input.subjectId,
            topicId: input.topicId,
            sitting: input.sitting,
            sourceRevision: projection.sourceRevision,
            itemObservedAt: latestItemObservedAt(
              projection,
              input.topicId,
            ),
            createdAt: now.toISOString(),
            expiresAt: new Date(
              now.getTime() + WALK_PROMPT_TTL_MS,
            ).toISOString(),
          });
        return replacement.prompt.id;
      }
      return (
        prompt.topicId === input.topicId &&
        prompt.sitting === input.sitting
      )
        ? prompt.id
        : null;
    });
  }

  async consumePrompt(input: {
    promptId: string;
    familyId: string;
    childId: string;
    memberUserId: string | null;
    subjectId: string;
    topicId: string;
    answer: MapAnswer;
    sitting: number;
    channel: "web" | "sms";
    idempotencyKey: string;
    now?: Date;
  }): Promise<ConsumeMapWalkPromptResult> {
    const topic = validAssessmentTopic(
      input.subjectId,
      input.topicId,
    );
    if (!topic) {
      return { status: "rejected", reason: "prompt_mismatch" };
    }
    const now = input.now ?? new Date();
    const payloadHash = walkPayloadHash(input);
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "rejected", reason: "progress_rejected" };
      }
      const projection =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (!projection) {
        return { status: "rejected", reason: "unknown_prompt" };
      }
      const prompt = await transaction.lockMapWalkPrompt(
        input.familyId,
        input.childId,
        input.promptId,
      );
      if (!prompt) {
        return { status: "rejected", reason: "unknown_prompt" };
      }
      const replay = this.replayResult(
        prompt,
        input.idempotencyKey,
        payloadHash,
      );
      if (replay) return replay;
      if (prompt.consumedAt !== null) {
        return {
          status: "rejected",
          reason: "prompt_already_consumed",
        };
      }
      if (
        prompt.subjectId !== input.subjectId ||
        prompt.topicId !== input.topicId
      ) {
        return { status: "rejected", reason: "prompt_mismatch" };
      }
      if (prompt.sitting !== input.sitting) {
        return { status: "rejected", reason: "stale_sitting" };
      }
      if (new Date(prompt.expiresAt).getTime() <= now.getTime()) {
        await transaction.consumeMapWalkPrompt({
          promptId: prompt.id,
          childId: input.childId,
          familyId: input.familyId,
          answer: null,
          terminalReason: "expired",
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          result: { ok: false, reason: "expired_prompt" },
          consumedAt: now.toISOString(),
        });
        return { status: "rejected", reason: "expired_prompt" };
      }
      const currentItemObservedAt = latestItemObservedAt(
        projection,
        input.topicId,
      );
      if (
        projection.sourceRevision !== prompt.sourceRevision &&
        currentItemObservedAt !== prompt.itemObservedAt
      ) {
        await transaction.consumeMapWalkPrompt({
          promptId: prompt.id,
          childId: input.childId,
          familyId: input.familyId,
          answer: null,
          terminalReason: "stale",
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          result: { ok: false, reason: "stale_prompt" },
          consumedAt: now.toISOString(),
        });
        return { status: "rejected", reason: "stale_prompt" };
      }
      const progress = await this.progressService
        .recordWalkAnswerInTransaction(
          transaction,
          projection,
          {
            familyId: input.familyId,
            childId: input.childId,
            memberUserId: input.memberUserId,
            itemId: input.topicId,
            answer: input.answer,
            channel: input.channel,
            observedAt: now.toISOString(),
            idempotencyKey:
              `walk-prompt:${prompt.id}:${input.idempotencyKey}`,
          },
        );
      if (progress.status !== "saved") {
        return { status: "rejected", reason: "progress_rejected" };
      }
      await this.testHooks.afterProgressWrite?.();
      const response = await this.buildResponse(
        transaction,
        projection,
        input,
        now,
      );
      await transaction.consumeMapWalkPrompt({
        promptId: prompt.id,
        childId: input.childId,
        familyId: input.familyId,
        answer: input.answer,
        terminalReason: "answered",
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        result: response,
        consumedAt: now.toISOString(),
      });
      if (!response.done) {
        await this.testHooks.beforeNextPromptInsert?.();
        const inserted =
          await transaction.insertOrLoadActiveMapWalkPrompt({
            id: response.card.promptId,
            childId: input.childId,
            familyId: input.familyId,
            subjectId: input.subjectId,
            topicId: response.card.topicId,
            sitting: input.sitting + 1,
            sourceRevision: projection.sourceRevision,
            itemObservedAt: latestItemObservedAt(
              projection,
              response.card.topicId,
            ),
            createdAt: now.toISOString(),
            expiresAt: new Date(
              now.getTime() + WALK_PROMPT_TTL_MS,
            ).toISOString(),
          });
        if (inserted.kind !== "inserted") {
          throw new Error("Next map walk prompt already exists");
        }
      }
      return {
        status: "accepted",
        response,
        domainId: topic.domain,
        progress,
      };
    });
  }

  async retirePrompt(input: {
    promptId: string;
    familyId: string;
    childId: string;
    memberUserId: string | null;
    subjectId: string;
    answeredCount: number;
    idempotencyKey: string;
    now?: Date;
  }): Promise<RetireMapWalkPromptResult> {
    const now = input.now ?? new Date();
    const response: MapWalkResponse = {
      ok: true,
      done: true,
      outcome: "stopped_early",
    };
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({
        action: "stop",
        familyId: input.familyId,
        childId: input.childId,
        subjectId: input.subjectId,
        answeredCount: input.answeredCount,
      }))
      .digest("hex");
    return this.repository.withTransaction(async (transaction) => {
      if (
        input.memberUserId !== null &&
        !await transaction.lockFamilyMemberForKeyShare(
          input.familyId,
          input.memberUserId,
        )
      ) {
        return { status: "rejected", reason: "unknown_prompt" };
      }
      const projection =
        await transaction.loadProjectionInputForUpdate(
          input.familyId,
          input.childId,
        );
      if (!projection) {
        return { status: "rejected", reason: "unknown_prompt" };
      }
      const prompt = await transaction.lockMapWalkPrompt(
        input.familyId,
        input.childId,
        input.promptId,
      );
      if (!prompt) {
        return { status: "rejected", reason: "unknown_prompt" };
      }
      if (prompt.consumedAt !== null) {
        return (
          prompt.terminalReason === "stopped" &&
          prompt.idempotencyKey === input.idempotencyKey &&
          prompt.payloadHash === payloadHash
        )
          ? { status: "replay", response }
          : {
              status: "rejected",
              reason: "prompt_already_consumed",
            };
      }
      if (
        prompt.subjectId !== input.subjectId ||
        prompt.sitting !== input.answeredCount + 1
      ) {
        return { status: "rejected", reason: "prompt_mismatch" };
      }
      await transaction.consumeMapWalkPrompt({
        promptId: prompt.id,
        childId: input.childId,
        familyId: input.familyId,
        answer: null,
        terminalReason: "stopped",
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        result: response,
        consumedAt: now.toISOString(),
      });
      return { status: "accepted", response };
    });
  }

  private replayResult(
    prompt: StoredMapWalkPrompt,
    idempotencyKey: string,
    payloadHash: string,
  ): ConsumeMapWalkPromptResult | null {
    if (
      prompt.consumedAt !== null &&
      prompt.idempotencyKey === idempotencyKey &&
      prompt.payloadHash === payloadHash &&
      prompt.result !== null
    ) {
      return {
        status: "replay",
        response: prompt.result as MapWalkStoredResult,
      };
    }
    return null;
  }

  private async buildResponse(
    _transaction: unknown,
    projection: ChildProgressProjectionInput,
    input: {
      familyId: string;
      childId: string;
      subjectId: string;
      sitting: number;
    },
    now: Date,
  ): Promise<MapWalkResponse> {
    if (this.testHooks.nextPromptOverride) {
      return {
        ok: true,
        done: false,
        card: {
          promptId: randomUUID(),
          ...this.testHooks.nextPromptOverride,
        },
      };
    }
    const ageMonths = ageInMonths(projection.child.birthDate, now);
    const answers = currentWalkAnswers(projection);
    const askable = askableTopicIds();
    const next = nextWalkCard(
      input.subjectId,
      ageMonths,
      answers,
      input.sitting,
      askable,
    );
    if (!next) {
      return {
        ok: true,
        done: true,
        outcome: walkOutcome(
          input.subjectId,
          ageMonths,
          answers,
          input.sitting,
          askable,
        ),
      };
    }
    const statement = walkCardStatement(next.topic.id);
    if (!statement) {
      throw new Error("Next map walk topic has no authored card");
    }
    return {
      ok: true,
      done: false,
      card: {
        promptId: randomUUID(),
        topicId: next.topic.id,
        domainId: next.domain.id,
        domainName: next.domain.displayName,
        statement,
      },
    };
  }
}

export type ConsumeMapWalkPromptResult =
  | {
      status: "accepted";
      response: MapWalkResponse;
      domainId: string;
      progress: SavedWalkProgressResult;
    }
  | {
      status: "replay";
      response: MapWalkStoredResult;
    }
  | {
      status: "rejected";
      reason:
        | "unknown_prompt"
        | "expired_prompt"
        | "stale_prompt"
        | "stale_sitting"
        | "prompt_mismatch"
        | "prompt_already_consumed"
        | "progress_rejected";
    };

export type RetireMapWalkPromptResult =
  | {
      status: "accepted" | "replay";
      response: MapWalkResponse;
    }
  | {
      status: "rejected";
      reason:
        | "unknown_prompt"
        | "prompt_mismatch"
        | "prompt_already_consumed";
    };

const repository = new PostgresChildProgressRepository();
const progressService = new ChildProgressService(repository, {
  buildView: buildChildProgressView,
});
const service = new MapWalkPromptService(
  repository,
  progressService,
);

export function createMapWalkPrompt(
  input: Parameters<MapWalkPromptService["createPrompt"]>[0],
) {
  return service.createPrompt(input);
}

export function consumeMapWalkPrompt(
  input: Parameters<MapWalkPromptService["consumePrompt"]>[0],
) {
  return service.consumePrompt(input);
}

export function retireMapWalkPrompt(
  input: Parameters<MapWalkPromptService["retirePrompt"]>[0],
) {
  return service.retirePrompt(input);
}
