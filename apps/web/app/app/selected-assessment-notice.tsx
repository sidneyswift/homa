import type { ResolvedAssessmentAction } from "../../lib/child-progress/assessment-intent";

export function SelectedAssessmentNotice({action, unavailable, state, walled, onRetry, onAccountSetup}: {
  action: ResolvedAssessmentAction | null;
  unavailable: boolean;
  state: "opening" | "accepted" | "uncertain" | "unavailable";
  walled: boolean;
  onRetry: () => void;
  onAccountSetup: () => void;
}) {
  if (unavailable) return <p role="status" className="px-5 py-3 text-sm text-body">These deeper questions are not available for the signed-in family. Open a child&apos;s Progress and choose the subject again.</p>;
  if (!action || state === "accepted") return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm text-body">
    <p>{walled ? `Finish account setup to open ${action.subjectDisplayName} questions for ${action.childName}.`
      : state === "opening" ? `Opening ${action.subjectDisplayName} questions for ${action.childName}…`
        : state === "uncertain" ? "The request may still be arriving. Your saved answers are safe."
          : "The check-in could not be verified. Your saved answers are safe."}</p>
    {walled ? <button type="button" className="min-h-11 text-brand underline" onClick={onAccountSetup}>Continue account setup</button>
      : state === "uncertain" || state === "unavailable" ? <button type="button" className="min-h-11 text-brand underline" onClick={onRetry}>Check and try again</button> : null}
  </div>;
}
