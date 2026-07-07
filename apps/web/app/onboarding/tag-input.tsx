"use client";

import { useState } from "react";

/**
 * Tap-or-type tag capture: suggestion chips toggle in, free text enters on
 * Enter/comma/blur. Shared by the extras step (interests, help-with) and
 * the post-report homeschool card (curriculums).
 *
 * Polish pass 2026-07-06 ("make this UI better"):
 * - Selected chips use the soft brand tint, not solid clay: with solid
 *   fills, three selections meant four orange pills fighting the one
 *   real CTA on screen. Soft tint + brand border + the little "x" still
 *   reads selected at a glance, and clay stays reserved for the action.
 * - The free-text input is a quiet dashed pill ("add your own...")
 *   instead of a full form field, it's an optional side door, not
 *   another required-looking input.
 * - Optional `aside` renders as a muted parenthetical on the label line
 *   (the house pattern for de-emphasized asides, per the kids step).
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

  function addTag(value: string) {
    const clean = value.trim().slice(0, 40);
    if (!clean || tags.includes(clean) || tags.length >= max) return;
    setTags([...tags, clean]);
  }

  return (
    <div className={className}>
      <p className="font-medium text-strong">
        {label}
        {aside ? <span className="font-normal text-muted"> ({aside})</span> : null}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTags(tags.filter((item) => item !== tag))}
            className="min-h-10 rounded-pill border border-brand bg-brand-soft px-4 py-2 text-sm font-medium text-[var(--clay-700)] transition duration-(--dur-fast) ease-out motion-safe:active:scale-[var(--press-scale)]"
          >
            {tag} {"\u00d7"}
          </button>
        ))}
        {suggestions
          .filter((chip) => !tags.includes(chip))
          .slice(0, 8)
          .map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addTag(chip)}
              className="min-h-10 rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition duration-(--dur-fast) ease-out hover:border-brand hover:bg-brand-soft motion-safe:active:scale-[var(--press-scale)]"
            >
              {chip}
            </button>
          ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(draft);
            setDraft("");
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft);
            setDraft("");
          }
        }}
        placeholder={"add your own\u2026"}
        className="mt-2.5 w-full rounded-pill border border-dashed border-border bg-transparent px-4 py-2 text-sm text-strong transition-colors duration-(--dur-fast) ease-out placeholder:text-subtle focus:border-solid focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
