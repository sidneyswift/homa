import { ACTION_COSTS } from "@homa/core";

import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import { subjectLessonsEnabled } from "../../../../../lib/subject-lessons/flag";
import {
  authorizeFamilyAccountOwner,
  isFamilyAccountOwner,
} from "../../../../../lib/subject-lessons/owner";
import {
  createSubjectLessonBuildHandler,
  startSubjectLessonSession,
} from "../../../../../lib/subject-lessons/routes";
import { claimOrReuseSubjectLesson } from "../../../../../lib/subject-lessons/store";

export const POST = createSubjectLessonBuildHandler({
  subjectLessonsEnabled,
  isRateLimited: (request) =>
    rateLimited(`subject-lesson-build:${clientIp(request)}`, 20),
  authorizeOwner: async () =>
    await authorizeFamilyAccountOwner({
      requireFamilyWithActor,
      isFamilyAccountOwner,
    }),
  familyWallCheckout,
  findReusableSubjectLesson: async (input) =>
    await claimOrReuseSubjectLesson({
      ...input,
      mode: "reuse-only",
    }),
  claimOrReuseSubjectLesson,
  emitRequested: async (event) => {
    await emitMapEvent("map.subject_lesson_requested", event);
  },
  startSession: startSubjectLessonSession,
  modelUsageSurface:
    ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface,
});
