"use client";

import { useState } from "react";

import { QuietField, QuietTag } from "../../components/design";

/**
 * Tap-or-type tag capture: suggestion chips toggle in place, free text
 * enters on Enter/comma/blur, and commas split into several tags (a typed
 * or pasted "Saxon, Heggerty, our own unit studies" lands as three).
 * Shared by the extras step (interests, help-with) and the post-report
 * homeschool card (curriculums).
 *
 * Polish pass 2026-07-06 ("make this UI better"):
 * - Selected chips use the soft brand tint, not solid clay: with solid
 *   fills, three selections meant four orange pills fighting the one
 *   real CTA on screen. Soft tint + brand border still reads selected
 *   at a glance, and clay stays reserved for the action.
 * - The free-text input is a quiet dashed pill ("add your own..."),
 *   it's an optional side door, not another required-looking input.
 * - Optional `aside` renders as a muted parenthetical on the label line
 *   (the house pattern for de-emphasized asides, per the kids step).
 *
 * Stability pass 2026-07-06 ("the pills move around, it's weird and
 * distracting"): chips never reorder. The old render moved every pick to
 * the front of the row and backfilled from the suggestion pool, so each
 * tap reshuffled the grid under her finger. Now the suggestions render
 * in a fixed order and only change tint when picked (same toggle
 * treatment in both states, so a chip never even changes width), and
 * typed tags append after the suggestions.
 */
export function TagInput({
  label,
  aside,
  hint,
  suggestions,
  tags,
  setTags,
  max,
  className = "",
}: {
  label: string;
  /** Muted parenthetical after the label, e.g. "pick as many as you like". */
  aside?: string;
  hint?: string;
  suggestions: readonly string[];
  tags: string[];
  setTags: (tags: string[]) => void;
  max: number;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  /** Adds free text, splitting on commas so one entry can carry several. */
  function addDraftTags(value: string) {
    const incoming = value
      .split(",")
      .map((piece) => piece.trim().slice(0, 40))
      .filter((piece) => piece.length > 0);
    let next = tags;
    for (const tag of incoming) {
      if (next.includes(tag) || next.length >= max) continue;
      next = [...next, tag];
    }
    if (next !== tags) setTags(next);
  }

  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      setTags(tags.filter((item) => item !== tag));
    } else if (tags.length < max) {
      setTags([...tags, tag]);
    }
  }

  function commitDraft() {
    if (!draft.trim()) return;
    addDraftTags(draft);
    setDraft("");
  }

  // Fixed set, fixed order: the row must not reshuffle as she picks.
  const visibleSuggestions = suggestions.slice(0, 8);
  const customTags = tags.filter((tag) => !visibleSuggestions.includes(tag));
  const inputId = `tag-input-${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`;

  return (
    <fieldset className={`quiet-onboarding__tag-input ${className}`.trim()}>
      <legend className="quiet-choice__legend">
        {label}
        {aside ? <span className="quiet-onboarding__field-aside"> ({aside})</span> : null}
      </legend>
      {hint ? <p className="quiet-field__hint">{hint}</p> : null}
      <div className="quiet-onboarding__choice-list">
        {visibleSuggestions.map((chip) => {
          const selected = tags.includes(chip);
          return (
            <QuietTag
              key={chip}
              label={chip}
              selected={selected}
              onClick={() => toggleTag(chip)}
            />
          );
        })}
        {customTags.map((tag) => (
          <QuietTag
            key={tag}
            label={tag}
            selected
            removable
            onClick={() => toggleTag(tag)}
          />
        ))}
      </div>
      <QuietField id={inputId} label="Add your own" className="quiet-onboarding__tag-input-control">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={"commas separate entries\u2026"}
        />
      </QuietField>
    </fieldset>
  );
}
