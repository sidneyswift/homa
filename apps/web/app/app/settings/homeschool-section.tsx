"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

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
  onClose,
}: {
  current: HomeschoolValues;
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
    <form action={action} className="mt-3 rounded-md bg-page p-4">
      {styles.map((style) => (
        <input key={style} type="hidden" name="styles" value={style} />
      ))}
      {strictness ? <input type="hidden" name="strictness" value={strictness} /> : null}
      {curriculums.map((tag) => (
        <input key={tag} type="hidden" name="curriculums" value={tag} />
      ))}

      <p className="font-medium text-strong">
        Styles you follow? <span className="font-normal text-muted">(pick any that fit)</span>
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
              className={`min-h-10 cursor-pointer rounded-pill border px-4 py-2 text-sm transition-colors ${
                selected
                  ? "border-brand bg-brand-soft text-[var(--clay-700)]"
                  : "border-border bg-card text-strong hover:border-brand"
              }`}
            >
              {HOMESCHOOL_STYLE_LABELS[value]}
            </button>
          );
        })}
      </div>
      {styles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">How closely?</span>
          {(["closely", "loosely", "exploring"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStrictness(strictness === value ? null : value)}
              aria-pressed={strictness === value}
              className={`min-h-10 cursor-pointer rounded-pill border px-4 py-2 text-sm ${
                strictness === value
                  ? "border-brand bg-brand-soft text-[var(--clay-700)]"
                  : "border-border bg-card text-strong hover:border-brand"
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

      <label className="mt-4 block font-medium text-strong" htmlFor="homeschool-values">
        Anything that matters to your family?
      </label>
      <p className="mt-1 text-sm text-muted">
        Faith, values, aesthetics, screen rules. Materials will respect it.
      </p>
      <textarea
        id="homeschool-values"
        name="values"
        rows={2}
        maxLength={500}
        defaultValue={current.values ?? ""}
        className="mt-2 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
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
          className="min-h-10 cursor-pointer rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Saving\u2026" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 cursor-pointer rounded-pill px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-strong"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function HomeschoolSection({ current }: { current: HomeschoolValues }) {
  const [editing, setEditing] = useState(false);
  const hasAnything =
    current.styles.length > 0 || current.curriculums.length > 0 || Boolean(current.values);

  return (
    <div>
      <SectionHeading>How you homeschool</SectionHeading>

      {editing ? (
        <HomeschoolEditor current={current} onClose={() => setEditing(false)} />
      ) : hasAnything ? (
        <>
          <dl className="mt-2 space-y-1.5">
            {current.styles.length > 0 ? (
              <div className="text-sm">
                <dt className="inline text-muted">Styles: </dt>
                <dd className="inline text-strong">
                  {current.styles.map(homeschoolStyleLabel).join(", ")}
                  {current.strictness
                    ? ` \u00b7 ${STRICTNESS_LABELS[current.strictness] ?? current.strictness}`
                    : ""}
                </dd>
              </div>
            ) : null}
            {current.curriculums.length > 0 ? (
              <div className="text-sm">
                <dt className="inline text-muted">Curriculums: </dt>
                <dd className="inline text-strong">{current.curriculums.join(", ")}</dd>
              </div>
            ) : null}
            {current.values ? (
              <div className="text-sm">
                <dt className="inline text-muted">What matters: </dt>
                <dd className="inline text-strong">{current.values}</dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 min-h-9 cursor-pointer rounded-pill border border-border bg-card px-4 py-1.5 text-sm font-medium text-body transition-colors hover:border-brand hover:text-strong"
          >
            Edit
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-body">
            Styles, curriculums, and what matters to your family. Homa&apos;s plans
            and materials follow whatever you add here.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-card px-5 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand"
          >
            <Plus size={16} aria-hidden="true" />
            Add how you homeschool
          </button>
        </>
      )}
    </div>
  );
}
