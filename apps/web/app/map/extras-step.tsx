"use client";

import { useState } from "react";

import { HOMESCHOOL_STYLES } from "@homa/core";

import type { FlowChild } from "./flow-types";

/**
 * The extras step: optional context collected AFTER the checklist, right
 * before the report (read-through ruling: she's invested now, and these
 * answers make the report and the future product better). Everything is
 * skippable in one tap; interests are typeable tags, help-with allows
 * multiple, and family-level questions (style, curriculums, values) appear
 * only the first time.
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

function interestSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 96) {
    return ["dinosaurs", "horses", "space", "princesses", "trucks", "bugs", "ocean", "drawing", "music", "animals"];
  }
  return ["sports", "music", "gaming", "drawing", "reading", "animals", "building things", "science", "cooking", "fashion"];
}

function helpSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 60) {
    return ["letters", "counting", "writing their name", "scissors", "colors and shapes", "calm-down skills"];
  }
  if (ageMonths < 96) {
    return ["reading", "handwriting", "math", "focus", "science curiosity", "confidence"];
  }
  return ["reading", "writing", "math", "focus", "study habits", "confidence"];
}

function TagInput({
  label,
  hint,
  suggestions,
  tags,
  setTags,
  max,
}: {
  label: string;
  hint?: string;
  suggestions: readonly string[];
  tags: string[];
  setTags: (tags: string[]) => void;
  max: number;
}) {
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const clean = value.trim().slice(0, 40);
    if (!clean || tags.includes(clean) || tags.length >= max) return;
    setTags([...tags, clean]);
  }

  return (
    <div className="mt-5">
      <p className="font-medium text-strong">{label}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTags(tags.filter((item) => item !== tag))}
            className="min-h-10 rounded-pill border border-brand bg-brand px-4 py-2 text-sm text-on-brand"
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
              className="min-h-10 rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition duration-(--dur-fast) ease-out hover:border-brand"
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
        placeholder="type your own and press enter"
        className="mt-2 w-full rounded-md border border-border px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </div>
  );
}

export function ExtrasStep({
  child,
  askFamily,
  onDone,
}: {
  child: FlowChild;
  askFamily: boolean;
  onDone: () => void;
}) {
  const [interests, setInterests] = useState<string[]>([]);
  const [helpWith, setHelpWith] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [firstName, setFirstName] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [strictness, setStrictness] = useState<string | null>(null);
  const [curriculums, setCurriculums] = useState<string[]>([]);
  const [crew, setCrew] = useState<string[]>([]);
  const [values, setValues] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(skip: boolean) {
    setBusy(true);
    if (!skip) {
      const payload: Record<string, unknown> = {
        child: {
          childId: child.id,
          interests: interests.length > 0 ? interests : undefined,
          helpWith: helpWith.length > 0 ? helpWith : undefined,
          activities: activities.length > 0 ? activities : undefined,
          notes: notes.trim() || undefined,
        },
      };
      if (askFamily) {
        payload.family = {
          firstName: firstName.trim() || undefined,
          style: style ?? undefined,
          strictness: strictness ?? undefined,
          curriculums: curriculums.length > 0 ? curriculums : undefined,
          crew: crew.length > 0 ? crew : undefined,
          values: values.trim() || undefined,
        };
      }
      try {
        await fetch("/api/map/extras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Extras are a bonus, never a blocker: the report proceeds regardless.
      }
    }
    onDone();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        Checklist done. The report is next.
      </h1>
      <p className="mt-3 text-body">
        While I check the benchmarks: a few optional extras that make {child.name}&apos;s report
        (and everything Homa makes later) fit your family better. Skip any of it.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <TagInput
          label={`What is ${child.name} loving right now?`}
          hint="Tap or type anything: characters, songs, obsessions. It shows up in their materials."
          suggestions={interestSuggestions(child.ageMonths)}
          tags={interests}
          setTags={setInterests}
          max={12}
        />

        <TagInput
          label="What would you love a hand with?"
          hint="Pick as many as you like."
          suggestions={helpSuggestions(child.ageMonths)}
          tags={helpWith}
          setTags={setHelpWith}
          max={6}
        />

        <TagInput
          label={`Activities outside school?`}
          hint="Gymnastics, co-op, Spanish class, swim team. It all shapes the plans."
          suggestions={["gymnastics", "co-op", "swim", "dance", "sports team", "music lessons", "church group", "scouts"]}
          tags={activities}
          setTags={setActivities}
          max={12}
        />

        <div className="mt-5">
          <p className="font-medium text-strong">Anything else about {child.name}?</p>
          <p className="mt-1 text-sm text-muted">
            Activities, health, temperament, the neighbor kid they adore. Whatever helps.
          </p>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={1000}
            className="mt-2 w-full rounded-md border border-border px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {askFamily ? (
          <>
            <div className="mt-6 border-t border-border-subtle pt-5">
              <p className="font-display text-lg font-semibold text-strong">About your homeschool</p>
              <p className="mt-1 text-sm text-muted">
                So anything Homa builds works WITH what you&apos;re already doing.
              </p>
            </div>

            <div className="mt-4">
              <label className="font-medium text-strong" htmlFor="extras-name">
                What should Homa call you?
              </label>
              <input
                id="extras-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full rounded-md border border-border px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div className="mt-5">
              <p className="font-medium text-strong">A style you follow?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HOMESCHOOL_STYLES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStyle(style === value ? null : value)}
                    aria-pressed={style === value}
                    className={`min-h-10 rounded-pill border px-4 py-2 text-sm transition duration-(--dur-fast) ease-out ${
                      style === value ? "border-brand bg-brand text-on-brand" : "border-border bg-card text-strong hover:border-brand"
                    }`}
                  >
                    {STYLE_LABELS[value]}
                  </button>
                ))}
              </div>
              {style ? (
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
                        strictness === value ? "border-brand bg-brand text-on-brand" : "border-border bg-card text-strong hover:border-brand"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <TagInput
              label="Curriculums you're using now?"
              hint="Type any: The Good and the Beautiful, Math-U-See, Heggerty, your own..."
              suggestions={["The Good and the Beautiful", "Math-U-See", "Heggerty", "All About Reading", "Singapore Math", "Masterbooks"]}
              tags={curriculums}
              setTags={setCurriculums}
              max={12}
            />

            <TagInput
              label="The crew?"
              hint="Family members, pets, stuffed animals, the neighbor kid. They can star in personalized materials later. Names only, photos come after our privacy paperwork is signed."
              suggestions={["dad", "grandma", "the dog", "baby sister"]}
              tags={crew}
              setTags={setCrew}
              max={16}
            />

            <div className="mt-5">
              <p className="font-medium text-strong">Anything that matters to your family?</p>
              <p className="mt-1 text-sm text-muted">
                Faith, values, aesthetics, screen rules. Materials get made around it.
              </p>
              <textarea
                value={values}
                onChange={(event) => setValues(event.target.value)}
                rows={2}
                maxLength={500}
                className="mt-2 w-full rounded-md border border-border px-4 py-2.5 text-sm text-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition duration-(--dur-fast) ease-out hover:bg-brand-hover motion-safe:active:scale-[var(--press-scale)] disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : `See ${child.name}'s progress report`}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={busy}
          className="mt-2 w-full text-center text-sm text-subtle underline-offset-2 hover:underline"
        >
          skip, straight to the report
        </button>
      </div>
    </div>
  );
}
