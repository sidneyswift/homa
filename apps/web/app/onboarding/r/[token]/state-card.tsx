import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";

/**
 * The state requirements card: the compliance data layer (migration #21)
 * finally surfaced where the fear lives. Reference data is joined at
 * render time, never copied into the report row, so a statute change
 * never strands a stale claim on anyone's permanent URL. Laws of this
 * card: reassure before inform, always show the verification date,
 * always name the boundary (this report satisfies nothing), never
 * legal advice.
 */
export function StateCard({
  summary,
  childName,
}: {
  summary: StateRequirementsSummary;
  childName: string;
}) {
  const verified = new Date(summary.sourceLastVerified).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
  const compulsory =
    summary.compulsoryStartAge !== null && summary.compulsoryEndAge !== null
      ? `ages ${summary.compulsoryStartAge} to ${summary.compulsoryEndAge}`
      : null;

  return (
    <div className="mt-9 rounded-lg border border-border-subtle bg-card p-5">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        Your state {"\u00b7"} last verified {verified}
      </p>
      <h3 className="mt-1 font-display text-base font-semibold text-strong">
        What {summary.stateName} asks of homeschooling families
      </h3>
      <p className="mt-2 text-sm text-body">
        First, the part that matters most: homeschooling is legal in all 50 states, including{" "}
        {summary.stateName}. Here is {summary.stateName}&apos;s shape, so nothing about it ever
        surprises you.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-body">
        <li>
          <span className="font-semibold text-strong">Telling the state:</span>{" "}
          {summary.notificationRequired
            ? "some form of notification is part of the default path."
            : "no notification is required on the default path."}
        </li>
        <li>
          <span className="font-semibold text-strong">Year-end check:</span>{" "}
          {summary.assessmentRequired
            ? "the default path asks for some year-end artifact, often with test-free options like an evaluator letter or a portfolio."
            : "the default path asks for no year-end artifact."}
        </li>
        {compulsory ? (
          <li>
            <span className="font-semibold text-strong">School-age window:</span> {compulsory}.
          </li>
        ) : null}
        {summary.defaultPathway ? (
          <li>
            <span className="font-semibold text-strong">Most families use:</span>{" "}
            {summary.defaultPathway}.
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-muted">
        One honest boundary: {childName}&apos;s progress report is your own observations,
        organized. It does not satisfy any state requirement of any kind, and different
        pathways in {summary.stateName} can carry different rules. Laws change; confirm
        against the current statute before acting. This is not legal advice.
        {summary.sourcePageUrl ? (
          <>
            {" "}
            <a
              href={summary.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-brand"
            >
              See the source
            </a>
            .
          </>
        ) : null}
      </p>
      <p className="mt-2 text-xs text-muted">
        When your invite opens, Homa tracks {summary.stateName}&apos;s requirements and deadlines
        for you.
      </p>
    </div>
  );
}
