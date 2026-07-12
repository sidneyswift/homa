import type { MapAnswer } from "@homa/core";

export function walkAnsweredEventProperties(input: {
  familyId: string;
  childId: string;
  subject: string;
  domain: string;
  answer: MapAnswer;
}) {
  return {
    family_id: input.familyId,
    child_id: input.childId,
    subject: input.subject,
    domain: input.domain,
    answer: input.answer,
  };
}
