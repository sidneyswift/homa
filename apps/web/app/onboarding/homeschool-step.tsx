"use client";

import { useState } from "react";

import { HOMESCHOOL_STYLES } from "@homa/core";

import { HOMESCHOOL_STYLE_LABELS } from "../../lib/homeschool-styles";
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
      <h1 className="font-display text-3xl font-bold leading-tight text-[var(--homa-ink)]">
        About your homeschool.
      </h1>
      <p className="mt-3 text-[var(--homa-ink)]">
        Optional, and it makes your kids&apos; materials fit what you&apos;re already doing.
      </p>

      <div className="mt-6 rounded-[var(--homa-radius-card)] border border-[var(--homa-soft-boundary)] bg-[var(--homa-paper)] p-5 shadow-sm sm:p-6">
        <div>
          {/* Multi-select (founder request 2026-07-06: more than one must
              be pickable). Selected chips take the soft brand tint, same
              as the TagInput chips below: several solid clay pills would
              fight the one real CTA on this card. */}
          <p className="font-medium text-[var(--homa-ink)]">
            Styles you follow? <span className="font-normal text-[var(--homa-muted-ink)]">(pick any that fit)</span>
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
                  className={`min-h-10 rounded-[var(--homa-radius-control)] border px-4 py-2 text-sm transition duration-(--homa-motion-fast) ease-out ${
                    selected
                      ? "border-[var(--homa-visual-coral)] bg-[var(--homa-info-tint)] text-[var(--homa-brand-text)]"
                      : "border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[var(--homa-ink)] hover:border-[var(--homa-visual-coral)]"
                  }`}
                >
                  {HOMESCHOOL_STYLE_LABELS[value]}
                </button>
              );
            })}
          </div>
          {styles.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--homa-muted-ink)]">How closely?</span>
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
                  className={`min-h-10 rounded-[var(--homa-radius-control)] border px-4 py-2 text-sm ${
                    strictness === value
                      ? "border-[var(--homa-visual-coral)] bg-[var(--homa-info-tint)] text-[var(--homa-brand-text)]"
                      : "border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[var(--homa-ink)] hover:border-[var(--homa-visual-coral)]"
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
          <p className="font-medium text-[var(--homa-ink)]">Anything that matters to your family?</p>
          <p className="mt-1 text-sm text-[var(--homa-muted-ink)]">
            Faith, values, aesthetics, screen rules. Materials will respect it.
          </p>
          <textarea
            value={values}
            onChange={(event) => setValues(event.target.value)}
            rows={2}
            maxLength={500}
            className="mt-2 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] px-4 py-2.5 text-sm text-[var(--homa-ink)] focus:border-[var(--homa-visual-coral)] focus:outline-none focus:ring-2 focus:ring-[var(--homa-visual-coral)]/30"
          />
        </div>

        <button
          type="button"
          onClick={() => void saveAndContinue()}
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-[var(--homa-radius-control)] bg-[var(--homa-midnight-action)] px-6 py-3 text-base font-semibold text-[var(--homa-paper)] shadow-sm transition duration-(--homa-motion-fast) ease-out hover:bg-[var(--homa-ink)] motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : "Continue"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="mt-2 w-full text-center text-sm text-[var(--homa-muted-ink)] underline-offset-2 hover:underline"
        >
          skip for now
        </button>
      </div>
    </div>
  );
}
