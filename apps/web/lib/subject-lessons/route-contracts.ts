import { ACTION_COSTS } from "@homa/core";

import type { WallCheckout } from "../billing/wall-types";
import type { SubjectLessonOwnerAuthorization } from "./owner";
import type {
  SubjectLessonBuildStatus,
  SubjectLessonContent,
  SubjectLessonKeepResult,
} from "./types";

export type SubjectLessonModelUsageSurface =
  typeof ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface;

export interface SubjectLessonRouteIdentity {
  id: string;
  childId: string;
  subjectId: string;
  buildStatus: SubjectLessonBuildStatus;
}

export interface SubjectLessonRouteRecord {
  lesson: SubjectLessonRouteIdentity;
  token: string;
}

export interface SubjectLessonClaimResult extends SubjectLessonRouteRecord {
  created: boolean;
}

export interface SubjectLessonStateProjectionInput {
  buildStatus: SubjectLessonBuildStatus;
  content: SubjectLessonContent;
}

export interface SubjectLessonReadyProjectionInput {
  id: string;
}

export interface SubjectLessonEventIdentity {
  family_id: string;
  child_id: string;
  subject: string;
}

export interface SubjectLessonRetriedEvent extends SubjectLessonEventIdentity {
  attempt: number;
}

export interface SubjectLessonMaterialFinalizedEvent {
  family_id: string;
  channel: "web";
  versions_superseded: number;
}

export interface StartSubjectLessonSessionInput {
  familyId: string;
  lessonId: string;
  retry: boolean;
  modelUsageSurface: SubjectLessonModelUsageSurface;
}

export type StartSubjectLessonSessionResult =
  | {
      ok: true;
      started: boolean;
      attempt: number | null;
    }
  | {
      ok: false;
      note: string;
      started?: boolean;
      attempt?: number;
    };

export interface MutationRouteDependencies {
  subjectLessonsEnabled(): boolean;
  isRateLimited(request: Request): boolean;
  authorizeOwner(): Promise<SubjectLessonOwnerAuthorization>;
}

export interface SubjectLessonBuildRouteDependencies
  extends MutationRouteDependencies {
  familyWallCheckout(familyId: string): Promise<WallCheckout | null>;
  findReusableSubjectLesson(input: {
    familyId: string;
    childId: string;
    subjectId: string;
  }): Promise<SubjectLessonClaimResult | null>;
  claimOrReuseSubjectLesson(input: {
    familyId: string;
    childId: string;
    subjectId: string;
  }): Promise<SubjectLessonClaimResult | null>;
  emitRequested(event: SubjectLessonEventIdentity): Promise<void>;
  startSession(
    input: StartSubjectLessonSessionInput
  ): Promise<StartSubjectLessonSessionResult>;
  modelUsageSurface: SubjectLessonModelUsageSurface;
}

export interface SubjectLessonRetryRouteDependencies
  extends MutationRouteDependencies {
  familyWallCheckout(familyId: string): Promise<WallCheckout | null>;
  getSubjectLessonForFamily(
    familyId: string,
    lessonId: string
  ): Promise<SubjectLessonRouteRecord | null>;
  startSession(
    input: StartSubjectLessonSessionInput
  ): Promise<StartSubjectLessonSessionResult>;
  emitRetried(event: SubjectLessonRetriedEvent): Promise<void>;
  modelUsageSurface: SubjectLessonModelUsageSurface;
}

export interface SubjectLessonKeepRouteDependencies
  extends MutationRouteDependencies {
  keepSubjectLessonMaterial(
    familyId: string,
    lessonId: string
  ): Promise<SubjectLessonKeepResult | null>;
  emitSubjectLessonKept(event: SubjectLessonEventIdentity): Promise<void>;
  emitMaterialFinalized(
    event: SubjectLessonMaterialFinalizedEvent
  ): Promise<void>;
}

export interface SubjectLessonStatusRouteDependencies {
  subjectLessonsEnabled(): boolean;
  isRateLimited(request: Request): boolean;
  getReadySubjectLessonByToken(
    token: string,
    subjectId: string
  ): Promise<SubjectLessonReadyProjectionInput | null>;
  authorizeOwner(): Promise<SubjectLessonOwnerAuthorization>;
  getSubjectLessonStateByTokenForFamily(
    familyId: string,
    token: string,
    subjectId: string
  ): Promise<SubjectLessonStateProjectionInput | null>;
}
