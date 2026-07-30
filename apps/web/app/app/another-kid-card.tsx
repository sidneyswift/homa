"use client";

/**
 * "Any other kids?", asked by the app between two child cards
 * (founder walk, 2026-07-28: "let me add a second child, instead of
 * making me send it first then asking if I have more").
 *
 * The question is the same every time and its answer changes nothing
 * about what Homa says next, so spending a model turn on it bought a
 * pause per child and made her type "yes" to get a card the app could
 * have drawn itself. This is the same chain the basics and homeschool
 * cards already run on, one child longer.
 *
 * Homa hears about ALL of them at once, after the last, so she reacts
 * to the family rather than greeting each child in turn.
 *
 * Button order follows the NextKidStep precedent: the secondary detour
 * sits above the clay primary, so the card reads in task order.
 */
export function AnotherKidCard({
  justAdded,
  onAddAnother,
  onDone,
}: {
  /** First name of the child whose card just saved, said back as the
   *  receipt that she landed. */
  justAdded: string;
  onAddAnother: () => void;
  onDone: () => void;
}) {
  return (
    <section
      className="w-full rounded-[22px] border border-border-subtle bg-card px-4 pb-4 pt-4 shadow-md"
      aria-label="Any other kids"
    >
      <p className="text-sm font-medium text-strong">
        {justAdded} is on the list. Any other kids?
      </p>
      <div className="mt-3.5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onAddAnother}
          className="min-h-12 w-full rounded-pill border-[1.5px] border-[var(--sage-300)] bg-transparent px-6 py-3 text-base font-semibold text-[var(--sage-700)] transition duration-(--dur-fast) ease-out hover:bg-[var(--sage-50)] motion-safe:active:scale-[var(--press-scale)]"
        >
          Add another child
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)]"
        >
          That&apos;s everyone
        </button>
      </div>
    </section>
  );
}
