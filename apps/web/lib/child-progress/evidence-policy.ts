import type { MapAnswer } from "@homa/core";

import type { ProgressEvidenceAnswer } from "./types";

export function isProgressEvidenceAnswer(
  answer: MapAnswer,
): answer is ProgressEvidenceAnswer {
  return (
    answer === "easily" ||
    answer === "getting_there" ||
    answer === "not_yet"
  );
}
