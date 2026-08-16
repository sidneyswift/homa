import { QuietAction } from "../../../components/design/QuietAction";
import { QuietStatus } from "../../../components/design/QuietStatus";
import { firstWeekAdjustmentHref } from "../../../lib/activation/first-week-handoff";

export function FirstWeekHandoff({ child }: { child: { id: string; name: string } }) {
  return (
    <QuietStatus tone="constructive" className="mb-5 p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--homa-constructive-ink)]">
        Start here
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-strong">
        {child.name}&apos;s first week is ready
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-body">
        It came from the answers you shared. If an activity, your schedule, or the supplies do not work, tell Homa which one to change before you begin.
      </p>
      <QuietAction href={firstWeekAdjustmentHref(child.id)} className="mt-4">
        Change one thing
      </QuietAction>
    </QuietStatus>
  );
}
