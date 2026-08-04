"use client";

import { useState } from "react";

import { HOMESCHOOL_STYLES } from "@homa/core";

import { QuietAction, QuietChoice, QuietField, QuietFrame } from "../../components/design";
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
    <div className="quiet-onboarding__step">
      <h1 className="quiet-onboarding__step-heading">
        About your homeschool.
      </h1>
      <p className="quiet-onboarding__step-intro">
        Optional, and it makes your kids&apos; materials fit what you&apos;re already doing.
      </p>

      <QuietFrame className="quiet-onboarding__step-card">
        <QuietChoice
          name="homeschool-styles"
          label="Styles you follow?"
          type="checkbox"
          value={styles}
          hint="Pick any that fit."
          options={HOMESCHOOL_STYLES.map((value) => ({ value, label: HOMESCHOOL_STYLE_LABELS[value] }))}
          onChange={(value) => setStyles(Array.isArray(value) ? [...value] : [])}
          className="quiet-onboarding__style-choice"
        />
        {styles.length > 0 ? (
          <QuietChoice
            name="homeschool-strictness"
            label="How closely?"
            value={strictness ?? ""}
            options={[
              { value: "closely", label: "pretty closely" },
              { value: "loosely", label: "loosely" },
              { value: "exploring", label: "just exploring it" },
            ]}
            onChange={(value) => setStrictness(typeof value === "string" && value ? value : null)}
            className="quiet-onboarding__choice-group"
          />
        ) : null}

        <TagInput
          className="quiet-onboarding__tag-input"
          label="Curriculums you're using now?"
          hint="Type any: The Good and the Beautiful, Math-U-See, Heggerty, your own..."
          suggestions={["The Good and the Beautiful", "Math-U-See", "Heggerty", "All About Reading", "Singapore Math", "Masterbooks"]}
          tags={curriculums}
          setTags={setCurriculums}
          max={12}
        />

        <QuietField
          id="homeschool-values"
          label="Anything that matters to your family?"
          hint="Faith, values, aesthetics, screen rules. Materials will respect it."
          className="quiet-onboarding__choice-group"
        >
          <textarea
            value={values}
            onChange={(event) => setValues(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </QuietField>

        <div className="quiet-onboarding__step-actions">
          <QuietAction
            type="button"
            onClick={() => void saveAndContinue()}
            disabled={busy}
            className="w-full"
            size="large"
          >
            {busy ? "Saving\u2026" : "Continue"}
          </QuietAction>
          <QuietAction kind="quiet" type="button" onClick={onDone} disabled={busy} className="w-full">
            skip for now
          </QuietAction>
        </div>
      </QuietFrame>
    </div>
  );
}
