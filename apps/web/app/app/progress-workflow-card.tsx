import Link from "next/link";

import { progressSubjectHref } from "../../lib/child-progress/assessment-intent";
import type { ProgressAssistantItem } from "./progress-message-parts";

const REASONS = {
  sitting_limit: "That's eight answers for this check-in.",
  bank_coverage_end: "The available questions stop here for now.",
  no_useful_question: "There isn't another useful question to ask from these answers.",
  parent_stopped: "Stopped here.",
} as const;

export function ProgressWorkflowCard({item}: {item: Extract<ProgressAssistantItem, {kind: "progress_workflow"}>}) {
  return <section className="flex max-w-full flex-col items-start gap-3 text-sm text-body" aria-label={item.label}>
    <p className="font-semibold text-strong">{item.label}</p>
    {item.scope ? <p>{item.scope.childName} · {item.scope.subjectDisplayName}</p> : null}
    {item.completion ? <>
      {item.completion.reason ? <p>{REASONS[item.completion.reason]}</p> : null}
      {item.completion.acceptedResponseCount !== null ? <p>{item.completion.acceptedResponseCount === 0 ? "No answers were added in this check-in." : `${item.completion.acceptedResponseCount} ${item.completion.acceptedResponseCount === 1 ? "answer" : "answers"} saved in this check-in.`}</p> : null}
      {(item.completion.uncertainResponseCount ?? 0) > 0 ? <p>You skipped or weren&apos;t sure about {item.completion.uncertainResponseCount} {item.completion.uncertainResponseCount === 1 ? "answer" : "answers"}.</p> : null}
      {item.completion.mixedEvidence ? <p>Some answers point in different directions, so this check-in leaves that open.</p> : null}
    </> : null}
    {item.activeCheckIn ? <p>{item.activeCheckIn.needsTakeover ? `${item.activeCheckIn.ownerDisplayName ?? "Another adult"} has this check-in open. You can ask to take over.` : "You can continue this check-in, or ask to stop it before changing subjects."}</p> : null}
    {item.scope ? <Link className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4" href={progressSubjectHref(item.scope.childId, item.scope.subjectId)}>{item.completion ? "Open updated Progress" : "Open Progress"}</Link> : null}
  </section>;
}
