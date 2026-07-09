"use client";

import { useState } from "react";

import { HOMESCHOOL_STYLES } from "@homa/core";

import { TagInput } from "./tag-input";

/**
 * The "About your homeschool" questions as an onboarding step, right
 * after the family card and before kids (founder call 2026-07-08:
 * "during onboarding instead of putting it in the report"). This is the
 * same card that used to live on the report page (the 2026-07-06
 * relocation put it after the payoff; today's ruling brings it forward
 * into the one linear setup flow). Everything stays optional: Continue
 * saves whatever was picked, "skip for now" moves on without writing
 * anything, and the flow never routes back through this step, so a skip
 * is never nagged about.
 *
 * Saves through the same cookie-authed /api/map/extras family bag the
 * report card used, so plans and materials read the exact same context
 * fields downstream.
 */

const STYLE_LABELS: Record<(typeof HOMESCHOOL_STYLES)[number], string> = {
  montessori: "Montessori",
  charlotte_mason: "Charlotte Mason",
  classical: "Classical",
  reggio: "Reggio",
  waldorf: "Waldorf",
  unit_studies: "Unit studies",
  unschooling: "Unschooling",
  eclectic: "Eclectic (a bit of everything)",
  traditional: "Traditional",
};

export function HomeschoolStep({ onDone }: { onDone: () => void }) {
  const [styles, setStyles] = useState<string[]>([]);
  const [strictness, setStrictness] = useState<string | null>(null);
  const [curriculums, setCurriculums] = useState<string[]>([]);
  const [values, setValues] = useState("");
  const [busy, setBusy] = useState(false);

  const hasAnything = styles.length > 0 || curriculums.length > 0 || values.trim().length > 0;

  /** Toggles in place, preserving pick order (the first pick stays the
   * primary style downstream, e.g. the plan's style note). */
  function toggleStyle(value: string) {
    setStyles(
      styles.includes(value) ? styles.filter((item) => item !== value) : [...styles, value],
    );
  }

  /** Saves whatever was picked, then moves on either way: this context
   * is a bonus, never a blocker between her and her kids' setup. */
  async function saveAndContinue() {
    if (!hasAnything) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/map/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family: {
            styles: styles.length > 0 ? styles : undefined,
            strictness: strictness ?? undefined,
            curriculums: curriculums.length > 0 ? curriculums : undefined,
            values: values.trim() || undefined,
          },
        }),
      });
    } catch {
      // Optional context, never a blocker: the flow proceeds regardless.
    }
    onDone();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        About your homeschool.
      </h1>
      <p className="mt-3 text-body">
        Optional, and it makes your kids&apos; materials fit what you&apos;re already doing.
      </p>

      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm sm:p-6">
        <div>
          {/* Multi-select (founder request 2026-07-06: more than one must
              be pickable). Selected chips take the soft brand tint, same
              as the TagInput chips below: several solid clay pills would
              fight the one real CTA on this card. */}
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
                  className={`min-h-10 rounded-pill border px-4 py-2 text-sm transition duration-(--dur-fast) ease-out ${
                    selected
                      ? "border-brand bg-brand-soft text-[var(--clay-700)]"
                      : "border-border bg-card text-strong hover:border-brand"
                  }`}
                >
                  {STYLE_LABELS[value]}
                </button>
              );
            })}
          </div>
          {styles.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">How closely?</span>
              {(
                [
                  ["closely", "pretty closely"],
                  ["loosely", "loosely"],
                  ["exploring", "just exploring it"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStrictness(strictness === value ? null : value)}
                  aria-pressed={strictness === value}
                  className={`min-h-10 rounded-pill border px-4 py-2 text-sm ${
                    strictness === value
                      ? "border-brand bg-brand-soft text-[var(--clay-700)]"
                      : "border-border bg-card text-strong hover:border-brand"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <TagInput
          className="mt-5"
          label="Curriculums you're using now?"
          hint="Type any: The Good and the Beautiful, Math-U-See, Heggerty, your own..."
          suggestions={["The Good and the Beautiful", "Math-U-See", "Heggerty", "All About Reading", "Singapore Math", "Masterbooks"]}
          tags={curriculums}
          setTags={setCurriculums}
          max={12}
        />

        <div className="mt-5">
          <p className="font-medium text-strong">Anything that matters to your family?</p>
          <p className="mt-1 text-sm text-muted">
            Faith, values, aesthetics, screen rules. Materials will respect it.
          </p>
          <textarea
            value={values}
            onChange={(event) => setValues(event.target.value)}
            rows={2}
            maxLength={500}
            className="mt-2 w-full rounded-md border border-border px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <button
          type="button"
          onClick={() => void saveAndContinue()}
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : "Continue"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="mt-2 w-full text-center text-sm text-subtle underline-offset-2 hover:underline"
        >
          skip for now
        </button>
      </div>
    </div>
  );
}
