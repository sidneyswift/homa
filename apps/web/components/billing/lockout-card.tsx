import { Logo } from "../brand/Logo";

/**
 * The lockout, designed dark
 * (plans/2026-07-21-chat-first-onboarding.md §7.3, F1).
 *
 * This is the moment the whole free period is built toward: she asks for
 * one more thing, the week's makings are gone, and she decides. Nothing
 * constructs this card in a live path, and nothing may until the P1
 * ruling lands, because turning the meter on supersedes four recorded
 * decisions. It exists now so the founder can look at the conversion
 * moment while the beats that lead to it are still being tuned, rather
 * than designing it last against whatever the rest turned out to be.
 *
 * Four shape decisions, all load-bearing:
 *
 * It opens with what she HAS, not with the gate. By the time this
 * appears she owns scored reports, artifacts with her children's names
 * on them, and a plan in motion. Leading with the gate throws that away
 * and reads as a toll booth; leading with the endowment makes the offer
 * "keep this going" instead of "pay to continue".
 *
 * It is an inline card in the conversation, never a modal. A modal
 * ambush at the moment she asked for something for her child is the
 * wrong feeling, and she should be able to scroll past it.
 *
 * Waiting is a real, equal choice, and it QUEUES the thing she asked
 * for. A parent who waits is not a lost sale, she is a guaranteed
 * return visit with a promise attached.
 *
 * Nothing is hostage. Her report, her binder, and her planner stay
 * readable while she waits. That line is on the card because it has to
 * be true, and putting it in writing is what keeps it true.
 */

export interface LockoutEndowment {
  /** Children with a scored report, by name. */
  scoredChildren: string[];
  /** Things made, newest first, by title. */
  artifacts: string[];
  /** Saved memories about this family. */
  memoryCount: number;
  /** Hours on the record so far. */
  hoursLogged: number;
}

export interface LockoutCardProps {
  /** What she just asked for, in her own terms. */
  requested: string;
  endowment: LockoutEndowment;
  /** When the week's makings come back, already formatted. */
  refillLabel: string;
  monthlyUrl: string;
  onWait?: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function LockoutCard({
  requested,
  endowment,
  refillLabel,
  monthlyUrl,
  onWait,
}: LockoutCardProps) {
  const madeLines = [
    endowment.scoredChildren.length > 0
      ? `${endowment.scoredChildren.join(" and ")}, with a progress report each`
      : null,
    endowment.artifacts.length > 0
      ? plural(endowment.artifacts.length, "thing you kept", "things you kept")
      : null,
    endowment.memoryCount > 0
      ? plural(endowment.memoryCount, "note about your family", "notes about your family")
      : null,
    endowment.hoursLogged > 0
      ? `${endowment.hoursLogged} hours on the record`
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <section
      className="w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      aria-label="About this week's makings"
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
        <Logo size={15} variant="mark" />
        Here is where we are
      </p>
      <p className="mt-2.5 text-body">{requested} is ready to make.</p>
      <p className="mt-1.5 text-body">
        This week&apos;s makings are used up. A fresh set arrives {refillLabel}.
      </p>

      {madeLines.length > 0 ? (
        <div className="mt-4 rounded-md border border-border-subtle bg-page p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">
            What we made together
          </p>
          <ul className="mt-2 space-y-1">
            {madeLines.map((line) => (
              <li key={line} className="flex items-baseline gap-2 text-sm text-body">
                <span aria-hidden="true" className="text-sage">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
          {endowment.artifacts.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {endowment.artifacts.slice(0, 4).map((title) => (
                <span
                  key={title}
                  className="max-w-full truncate rounded-pill border border-sage/30 bg-sage/10 px-2.5 py-1 text-xs text-body"
                >
                  {title}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-body">
        Membership is $19 a month and makings stop being counted. Your first 30 days are
        free.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <a
          href={monthlyUrl}
          className="flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
        >
          Start your 30 free days
        </a>
        <button
          type="button"
          onClick={onWait}
          className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Wait for {refillLabel}
        </button>
      </div>
      <p className="mt-2.5 text-xs text-subtle">
        If you wait, I&apos;ll make it the moment your makings are back and tell you it is
        there. Everything you already have stays open either way.
      </p>
    </section>
  );
}
