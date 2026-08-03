"use client";

import { useActionState, useState } from "react";
import { HOMESCHOOL_STYLES } from "@homa/core";

import {
  HOMESCHOOL_STYLE_LABELS,
  homeschoolStyleLabel,
  STRICTNESS_LABELS,
} from "../../../lib/homeschool-styles";
import { TagInput } from "../../onboarding/tag-input";
import type { SetupFormState } from "./actions";
import { updateHomeschoolAction } from "./profile-actions";
import { SectionHeading } from "./section-heading";
import { Icon } from "../../../components/design/Icon";

/**
 * The how-you-homeschool section of the one family card on
 * /app/settings (founder direction 2026-07-12: the onboarding
 * homeschool answers were invisible after setup). Shows and edits the
 * same context bag onboarding's HomeschoolStep writes: styles,
 * strictness, curriculums, values. Plans and materials read these, so
 * an edit here changes what Homa makes next.
 */

const INITIAL_STATE: SetupFormState = { error: null };

const CURRICULUM_SUGGESTIONS = [
  "The Good and the Beautiful",
  "Math-U-See",
  "Heggerty",
  "All About Reading",
  "Singapore Math",
  "Masterbooks",
] as const;

export interface HomeschoolValues {
  styles: string[];
  strictness: string | null;
  curriculums: string[];
  values: string | null;
}

function HomeschoolEditor({
  current,
  schoolYearStartOn,
  filingParentName,
  onClose,
}: {
  current: HomeschoolValues;
  schoolYearStartOn: string | null;
  filingParentName: string | null;
  onClose: () => void;
}) {
  const [styles, setStyles] = useState<string[]>(current.styles);
  const [strictness, setStrictness] = useState<string | null>(current.strictness);
  const [curriculums, setCurriculums] = useState<string[]>(current.curriculums);
  const [state, action, pending] = useActionState(
    async (prev: SetupFormState, formData: FormData) => {
      const result = await updateHomeschoolAction(prev, formData);
      if (result.saved) onClose();
      return result;
    },
    INITIAL_STATE,
  );

  function toggleStyle(value: string) {
    setStyles(
      styles.includes(value) ? styles.filter((item) => item !== value) : [...styles, value],
    );
  }

  return (
    <form action={action} className="mt-3 rounded-md bg-[var(--homa-canvas)] p-4">
      {styles.map((style) => (
        <input key={style} type="hidden" name="styles" value={style} />
      ))}
      {strictness ? <input type="hidden" name="strictness" value={strictness} /> : null}
      {curriculums.map((tag) => (
        <input key={tag} type="hidden" name="curriculums" value={tag} />
      ))}

      <p className="font-medium text-[color:var(--homa-ink)]">
        Styles you follow? <span className="font-normal text-[color:var(--homa-ink-muted)]">(pick any that fit)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HOMESCHOOL_STYLES.map((value) => {
          const selected = styles.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleStyle(value)}
              aria-pressed={selected}
              className={`min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] border px-4 py-2 text-sm transition-colors ${
                selected
                  ? "border-[var(--homa-midnight-action)] bg-[color-mix(in_srgb,var(--homa-midnight-action)_10%,var(--homa-paper))] text-[color:var(--homa-brand-text)]"
                  : "border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] hover:border-[var(--homa-midnight-action)]"
              }`}
            >
              {HOMESCHOOL_STYLE_LABELS[value]}
            </button>
          );
        })}
      </div>
      {styles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[color:var(--homa-ink-muted)]">How closely?</span>
          {(["closely", "loosely", "exploring"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStrictness(strictness === value ? null : value)}
              aria-pressed={strictness === value}
              className={`min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] border px-4 py-2 text-sm ${
                strictness === value
                  ? "border-[var(--homa-midnight-action)] bg-[color-mix(in_srgb,var(--homa-midnight-action)_10%,var(--homa-paper))] text-[color:var(--homa-brand-text)]"
                  : "border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] hover:border-[var(--homa-midnight-action)]"
              }`}
            >
              {STRICTNESS_LABELS[value]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <TagInput
          label="Curriculums you're using now?"
          hint="Type any: The Good and the Beautiful, Math-U-See, Heggerty, your own..."
          suggestions={CURRICULUM_SUGGESTIONS}
          tags={curriculums}
          setTags={setCurriculums}
          max={12}
        />
      </div>

      <label className="mt-4 block font-medium text-[color:var(--homa-ink)]" htmlFor="filing-parent-name">
        Your name, as it should appear on an official filing
      </label>
      <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">
        Kept separate from what Homa calls you, because a notice to your
        school district wants the name on your paperwork. Homa leaves this
        blank on the filing rather than guessing it (gh#424).
      </p>
      <input
        id="filing-parent-name"
        name="filing_parent_name"
        type="text"
        maxLength={120}
        autoComplete="name"
        defaultValue={filingParentName ?? ""}
        className="mt-2 w-full rounded-md border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-2.5 text-sm text-[color:var(--homa-ink)] focus:border-[var(--homa-midnight-action)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--homa-visual-coral)_24%,transparent)]"
      />

      <label className="mt-4 block font-medium text-[color:var(--homa-ink)]" htmlFor="school-year-start">
        When does your school year start?
      </label>
      <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">
        Most states that ask for a filing count the deadline from this day, so
        it is how Homa knows when your paperwork is due.
      </p>
      <input
        id="school-year-start"
        name="school_year_start_on"
        type="date"
        defaultValue={schoolYearStartOn ?? ""}
        className="mt-2 w-full rounded-md border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-2.5 text-sm text-[color:var(--homa-ink)] focus:border-[var(--homa-midnight-action)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--homa-visual-coral)_24%,transparent)]"
      />

      <label className="mt-4 block font-medium text-[color:var(--homa-ink)]" htmlFor="homeschool-values">
        Anything that matters to your family?
      </label>
      <p className="mt-1 text-sm text-[color:var(--homa-ink-muted)]">
        Faith, values, aesthetics, screen rules. Materials will respect it.
      </p>
      <textarea
        id="homeschool-values"
        name="values"
        rows={2}
        maxLength={500}
        defaultValue={current.values ?? ""}
        className="mt-2 w-full rounded-md border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-2.5 text-sm text-[color:var(--homa-ink)] focus:border-[var(--homa-midnight-action)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--homa-visual-coral)_24%,transparent)]"
      />

      {state.error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-5 py-2 text-sm font-semibold text-[color:var(--homa-paper)] transition-colors hover:bg-[color-mix(in_srgb,var(--homa-midnight-action)_88%,var(--homa-ink))] disabled:opacity-60"
        >
          {pending ? "Saving\u2026" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 cursor-pointer rounded-[var(--homa-radius-control)] px-4 py-2 text-sm font-medium text-[color:var(--homa-ink-muted)] transition-colors hover:text-[color:var(--homa-ink)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function HomeschoolSection({
  current,
  schoolYearStartOn,
  filingParentName,
}: {
  current: HomeschoolValues;
  /** gh#418: drives filing deadlines in the 25 states whose rule counts
   * from the day the family started. Null means never asked. */
  schoolYearStartOn: string | null;
  /** gh#424: the name a filing carries, never the greeting name. */
  filingParentName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const hasAnything =
    current.styles.length > 0 || current.curriculums.length > 0 || Boolean(current.values);

  return (
    <div>
      <SectionHeading>How you homeschool</SectionHeading>

      {editing ? (
        <HomeschoolEditor
          current={current}
          schoolYearStartOn={schoolYearStartOn}
          filingParentName={filingParentName}
          onClose={() => setEditing(false)}
        />
      ) : hasAnything ? (
        // Values left, one Edit pill trailing right: the same row grammar
        // as the kid and parent rows (2026-07-13 UX read: four section
        // shapes on one page is what "clunky" feels like).
        <div className="flex items-start justify-between gap-3">
          <dl className="mt-2 min-w-0 flex-1 space-y-1.5">
            {current.styles.length > 0 ? (
              <div className="text-sm">
                <dt className="inline text-[color:var(--homa-ink-muted)]">Styles: </dt>
                <dd className="inline text-[color:var(--homa-ink)]">
                  {current.styles.map(homeschoolStyleLabel).join(", ")}
                  {current.strictness
                    ? ` \u00b7 ${STRICTNESS_LABELS[current.strictness] ?? current.strictness}`
                    : ""}
                </dd>
              </div>
            ) : null}
            {current.curriculums.length > 0 ? (
              <div className="text-sm">
                <dt className="inline text-[color:var(--homa-ink-muted)]">Curriculums: </dt>
                <dd className="inline text-[color:var(--homa-ink)]">{current.curriculums.join(", ")}</dd>
              </div>
            ) : null}
            {current.values ? (
              <div className="text-sm">
                <dt className="inline text-[color:var(--homa-ink-muted)]">What matters: </dt>
                <dd className="inline text-[color:var(--homa-ink)]">{current.values}</dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 min-h-9 shrink-0 cursor-pointer rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-4 py-1.5 text-sm font-medium text-[color:var(--homa-ink-muted)] transition-colors hover:border-[var(--homa-midnight-action)] hover:text-[color:var(--homa-ink)]"
          >
            Edit
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-[color:var(--homa-ink-muted)]">
            Styles, curriculums, and what matters to your family. Homa&apos;s plans
            and materials follow whatever you add here.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] px-5 py-2 text-sm font-semibold text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)]"
          >
            <Icon name="add" size={16} />
            Add how you homeschool
          </button>
        </>
      )}
    </div>
  );
}
