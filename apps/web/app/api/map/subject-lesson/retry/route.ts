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
  createSubjectLessonRetryHandler,
  startSubjectLessonSession,
} from "../../../../../lib/subject-lessons/routes";
import { getSubjectLessonForFamily } from "../../../../../lib/subject-lessons/store";

export const POST = createSubjectLessonRetryHandler({
  subjectLessonsEnabled,
  isRateLimited: (request) =>
    rateLimited(`subject-lesson-retry:${clientIp(request)}`, 20),
  authorizeOwner: async () =>
    await authorizeFamilyAccountOwner({
      requireFamilyWithActor,
      isFamilyAccountOwner,
    }),
  familyWallCheckout,
  getSubjectLessonForFamily,
  startSession: startSubjectLessonSession,
  emitRetried: async (event) => {
    await emitMapEvent("map.subject_lesson_retried", event);
  },
  modelUsageSurface:
    ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface,
});
