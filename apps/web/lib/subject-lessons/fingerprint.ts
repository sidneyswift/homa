import { createHash } from "node:crypto";

import type { MapAnswer } from "@homa/core";

interface LessonSourceFingerprintInput {
  subjectId: string;
  targetItemId: string | null;
  targetStatement: string;
  startingLine: string | null;
  bankVersion: string;
  determinantAnswers: Array<{ itemId: string; answer: MapAnswer }>;
}

/**
 * Hashes only the reviewed facts that can change the selected lesson target.
 * Profile interests stay outside this identity so personalization never
 * rebuilds an otherwise current lesson.
 */
export function lessonSourceFingerprint(
  input: LessonSourceFingerprintInput,
): string {
  const canonicalSource = {
    subjectId: input.subjectId,
    targetItemId: input.targetItemId,
    targetStatement: input.targetStatement,
    startingLine: input.startingLine,
    bankVersion: input.bankVersion,
    determinantAnswers: [...input.determinantAnswers].sort((left, right) =>
      left.itemId < right.itemId ? -1 : left.itemId > right.itemId ? 1 : 0
    ),
  };

  return createHash("sha256")
    .update(JSON.stringify(canonicalSource))
    .digest("hex");
}
