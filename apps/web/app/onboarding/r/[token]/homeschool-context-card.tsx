"use client";

import { useState } from "react";

import { HOMESCHOOL_STYLES } from "@homa/core";

import { TagInput } from "../../tag-input";

/**
 * The "About your homeschool" questions, relocated from the pre-report
 * extras step to here (UX review 2026-07-06: the wall of optional
 * questions stood between her and the report; after the payoff,
 * reciprocity is on our side). Saves through the same cookie-authed
 * extras route as the whats-working boxes, with the same gentle hint for
 * shared-link viewers who don't hold the resume cookie.
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

export function HomeschoolContextCard({ childName }: { childName: string }) {
  const [styles, setStyles] = useState<string[]>([]);
  const [strictness, setStrictness] = useState<string | null>(null);
  const [curriculums, setCurriculums] = useState<string[]>([]);
  const [values, setValues] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "no-session">("idle");

  const hasAnything = styles.length > 0 || curriculums.length > 0 || values.trim().length > 0;

  /** Toggles in place, preserving pick order (the first pick stays the
   * primary style downstream, e.g. the plan's style note). */
  function toggleStyle(value: string) {
    setStyles(
      styles.includes(value) ? styles.filter((item) => item !== value) : [...styles, value],
    );
  }

  async function save() {
    if (!hasAnything) return;
    setState("busy");
    try {
      const response = await fetch("/api/map/extras", {
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
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      setState(response.ok ? "saved" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "saved") {
    return (
      <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
        <p className="font-display text-lg font-semibold text-strong">Saved.</p>
        <p className="mt-1 text-sm text-body">
          Everything Homa builds for {childName} will fit what you&apos;re already doing.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-9 rounded-lg border border-border-subtle bg-card p-5 shadow-sm print:hidden sm:p-6">
      <p className="font-display text-lg font-semibold text-strong">About your homeschool</p>
      <p className="mt-1 text-sm text-muted">
        Optional, and it makes {childName}&apos;s plans fit what you&apos;re already doing.
      </p>

      <div className="mt-4">
        {/* Multi-select (founder request 2026-07-06: more than one must be
            pickable). Selected chips take the soft brand tint, same as the
            TagInput chips below: several solid clay pills would fight the
            one real CTA on this card. */}
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

      {state === "no-session" ? (
        <p className="mt-4 text-sm" style={{ color: "var(--gold-ink)" }}>
          This box works on the device you used for the questionnaire. Or open your email link
          here first.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void save()}
          disabled={state === "busy" || !hasAnything}
          className="mt-5 min-h-11 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-50"
        >
          {state === "busy" ? "Saving\u2026" : "Save"}
        </button>
      )}
    </div>
  );
}
