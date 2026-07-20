import { emitMapEvent } from "../../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import { subjectLessonsEnabled } from "../../../../../lib/subject-lessons/flag";
import {
  authorizeFamilyAccountOwner,
  isFamilyAccountOwner,
} from "../../../../../lib/subject-lessons/owner";
import { createSubjectLessonKeepHandler } from "../../../../../lib/subject-lessons/routes";
import { keepSubjectLessonMaterialWithReceipt } from "../../../../../lib/subject-lessons/store";

export const POST = createSubjectLessonKeepHandler({
  subjectLessonsEnabled,
  isRateLimited: (request) =>
    rateLimited(`subject-lesson-keep:${clientIp(request)}`, 20),
  authorizeOwner: async () =>
    await authorizeFamilyAccountOwner({
      requireFamilyWithActor,
      isFamilyAccountOwner,
    }),
  keepSubjectLessonMaterial: keepSubjectLessonMaterialWithReceipt,
  emitSubjectLessonKept: async (event) => {
    await emitMapEvent("map.subject_lesson_kept", event);
  },
  emitMaterialFinalized: async (event) => {
    await emitMapEvent("materials.finalized", event);
  },
});
