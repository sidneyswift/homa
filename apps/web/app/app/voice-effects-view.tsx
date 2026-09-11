"use client";

import type { EveMessage } from "eve/react";

import { latestDetailRequest } from "./detail-card";
import { MessageView } from "./message-parts";
import { latestChecklistRequest, latestReportReveal } from "./onboarding-cards";
import type { PlannerOpenSignal } from "./planner-canvas";
import { latestReportOpen } from "./report-open";
import { voiceEffectPresentation } from "./voice-effects";
import { VoiceWorkStatus } from "./voice-work-status";

/** Receipts use the normal chat renderer. Form saves and navigation have their
 * own authenticated paths; choice answers remain in the spoken conversation. */
export function VoiceEffectsView({
  message,
  working = false,
  voiceActive = false,
  currentRequest,
  canAnswerOutLoud,
  timeZone,
  familyId,
  childNameById,
  onOpenPlanner,
  onOpenChecklist,
  onOpenReport,
}: {
  message: EveMessage;
  working?: boolean;
  voiceActive?: boolean;
  currentRequest: boolean;
  canAnswerOutLoud: boolean;
  timeZone: string;
  familyId: string | null;
  childNameById: ReadonlyMap<string, string>;
  onOpenPlanner: (signal: PlannerOpenSignal) => void;
  onOpenChecklist: (childId: string) => void;
  onOpenReport: (childId: string) => void;
}) {
  const presentation = voiceEffectPresentation(message);
  const messages = [presentation.message];
  const detail = latestDetailRequest(messages);
  const checklist = latestChecklistRequest(messages);
  const report = latestReportReveal(messages);
  const reportOpen = latestReportOpen(messages);
  if (working) return <div role="status" aria-live="polite"><VoiceWorkStatus voiceActive={voiceActive} /></div>;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      {message.parts.every((part) => part.type === "text") ? (
        <p className="text-sm text-muted">Update from your request</p>
      ) : null}
      <MessageView
        message={presentation.message}
        timeZone={timeZone}
        familyId={familyId}
        childNameById={childNameById}
        onOpenPlanner={onOpenPlanner}
        activeDetailPartKey={currentRequest ? detail?.partKey : undefined}
        // DetailCard renders its own save receipt. A save here must not send
        // a hidden follow-up into the unrelated ordinary text session.
        onDetailsSaved={() => undefined}
        activeChecklistPartKey={currentRequest ? checklist?.partKey : undefined}
        onOpenChecklist={onOpenChecklist}
        activeReportPartKey={report?.partKey}
        onOpenReport={onOpenReport}
      />
      {detail && !currentRequest ? (
        <p className="text-sm text-muted">
          {detail.card.intro ?? "Homa asked for details during your voice conversation."}
        </p>
      ) : null}
      {reportOpen ? (
        <button
          type="button"
          className="quiet-action quiet-action--primary self-start"
          onClick={() => onOpenReport(reportOpen.signal.childId)}
        >
          Open report
        </button>
      ) : null}
      {presentation.questions.length > 0 ? (
        <section
          aria-label="Questions from your voice conversation"
          className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4"
        >
          {presentation.questions.map((question, index) => (
            <div key={index}>
              <p className="font-semibold text-strong">{question.question}</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-body">
                {question.options.map((option) => (
                  <li key={option.label}>
                    {option.label}
                    {option.description ? `: ${option.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm text-muted">
            {canAnswerOutLoud
              ? "Tell Homa your answer out loud."
              : "Asked during your voice conversation."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
