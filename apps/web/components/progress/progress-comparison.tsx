import type { ProgressComparison } from "../../lib/child-progress/comparison";
import { formatProgressDate, progressAnswerLabel } from "../../lib/child-progress/view-copy";

export function ProgressComparisonReading({ comparison, timeZone }: { comparison: ProgressComparison; timeZone: string }) {
  if (comparison.status !== "measured") {
    const text = comparison.status === "exposure" ? "This subject records experiences, so it has no months-ahead comparison."
      : comparison.status === "unavailable" ? "The comparison could not be checked. Refresh this page to try again."
      : "There is not yet a measured skill to support a months-ahead comparison.";
    return <p className="text-sm leading-relaxed text-body">{text}</p>;
  }
  return (
    <section aria-label="About this comparison" className="space-y-3 text-sm leading-relaxed text-body">
      <p className="text-base font-semibold text-strong">{comparison.displayLabel ?? "These answers do not show a months-ahead estimate."}</p>
      {comparison.displayLabel ? <p>This compares the saved skills below with the ages in Homa&apos;s benchmark sources. It does not describe every skill in this subject.</p> : null}
      {comparison.observations === 1 ? <p>This reading has one saved answer to go on.</p> : null}
      {comparison.openConflicts > 0 ? <p>Answers awaiting confirmation are not included in this reading.</p> : null}
      <ul className="space-y-3">
        {comparison.basis.map(basis => (
          <li key={basis.itemId} className="space-y-1">
            <p className="font-semibold text-strong">{basis.statement}</p>
            <p>{progressAnswerLabel(basis.answer)} · {formatProgressDate(basis.observedAt, timeZone)}</p>
            <p>{basis.source} · {basis.derivationLabel}</p>
          </li>
        ))}
      </ul>
      {comparison.omittedBasisCount > 0 ? <p>{comparison.omittedBasisCount} more saved answers support the same reading. The subject&apos;s skill list has the remaining answers.</p> : null}
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-strong underline">How this comparison works</summary>
        <div className="mt-3 space-y-3">
          <p>As of {formatProgressDate(comparison.projectedAt, timeZone)}, this uses an age of {comparison.ageMonths} months in your family&apos;s time zone. The answer dates above show when the skills were recorded; reopening Progress does not make an older answer new.</p>
          <p>Homa uses the earliest age in a documented range, or the single age when there is no range. Getting there receives six months less credit than Easily. The highest credited skill is compared with your child&apos;s age.</p>
          {comparison.limitReason === "display_cap" ? <p>At least means this reading reached Homa&apos;s display limit: the smaller of 24 months and about one-third of your child&apos;s age. This does not tell us whether the checklist has harder questions. It is a limit of this reading, not of your child.</p> : null}
          {comparison.limitReason === "checklist_ceiling" ? <p>At least means an Easily answer reached the top of this subject&apos;s checklist. It is a limit of this reading, not of your child.</p> : null}
          {comparison.basis.map(basis => <div key={basis.itemId} className="space-y-1">
            <p className="font-semibold text-strong">{basis.statement}</p>
            <p>{basis.kind === "teaching_window" ? "Typical teaching window" : "Benchmark age"}: {basis.typicalWindowMonths ? `${basis.typicalWindowMonths[0]} to ${basis.typicalWindowMonths[1]}` : basis.typicalAgeMonths} months. Credited age: {basis.creditedAgeMonths} months.</p>
            {basis.citations.length > 0 ? <ul>{basis.citations.map(citation => <li key={citation.label}>{citation.url ? <a className="underline" href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a> : <span>{citation.label} (catalog reference)</span>}</li>)}</ul> : <p>A specific citation was not saved with this catalog item.</p>}
            {basis.standards.length > 0 ? <p>References: {basis.standards.join(", ")}</p> : null}
          </div>)}
          <p>These sources combine developmental milestones and learning standards. Teaching windows describe typical teaching ages. This is not a national standardized test, a percentile, or proof of mastery across the subject. More saved answers are not a statistical confidence score.</p>
        </div>
      </details>
    </section>
  );
}
