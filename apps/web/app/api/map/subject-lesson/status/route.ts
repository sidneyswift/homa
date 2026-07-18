import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../../lib/map/session";
import { subjectLessonsEnabled } from "../../../../../lib/subject-lessons/flag";
import {
  authorizeFamilyAccountOwner,
  isFamilyAccountOwner,
} from "../../../../../lib/subject-lessons/owner";
import { createSubjectLessonStatusHandler } from "../../../../../lib/subject-lessons/routes";
import {
  getSubjectLessonByToken,
  getSubjectLessonStateByTokenForFamily,
} from "../../../../../lib/subject-lessons/store";

export const GET = createSubjectLessonStatusHandler({
  subjectLessonsEnabled,
  isRateLimited: (request) =>
    rateLimited(`subject-lesson-status:${clientIp(request)}`, 120),
  getReadySubjectLessonByToken: getSubjectLessonByToken,
  authorizeOwner: async () =>
    await authorizeFamilyAccountOwner({
      requireFamilyWithActor,
      isFamilyAccountOwner,
    }),
  getSubjectLessonStateByTokenForFamily,
});
