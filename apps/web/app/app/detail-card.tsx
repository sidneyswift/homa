"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { useState } from "react";

import { HOMESCHOOL_STYLES, US_STATES } from "@homa/core";

import { Logo } from "../../components/brand/Logo";
import { HOMESCHOOL_STYLE_LABELS } from "../../lib/homeschool-styles";

/**
 * The facts card (plans/2026-07-21-chat-first-onboarding.md §2.3).
 *
 * Two shapes, one component, because they are the same interaction: a
 * few exact fields, saved on submit, then handed back to the
 * conversation. Splitting them into two components would duplicate the
 * save path, the error state and the spent receipt three times over.
 *
 * It saves itself. The card posts straight to its own authenticated
 * route rather than sending her answers through the model, which is
 * what makes the loop cheap and instant; Homa hears about it afterwards
 * and reacts. Her taps are never a model turn.
 *
 * The error state follows the copy kit's order: name it plainly, settle
 * the nerves, offer the next step. Never danger red, which is reserved
 * for account-level failure.
 *
 * ONE INPUT PER QUESTION (founder rule, 2026-07-22). Any card that asks
 * for more than one thing asks for them one at a time. Two fields on
 * screen at once is a form, and a form is the thing this whole rebuild
 * exists to stop being. It applies to every card that collects, not just
 * these two, so a new card kind adds entries to FIELDS rather than a
 * second field to a step.
 */

export type DetailCardKind = "family_basics" | "child";

export interface DetailCardData {
  kind: DetailCardKind;
  intro: string | null;
}

export function parseDetailCardPart(part: EveMessagePart): DetailCardData | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "ask_for_details" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.asked !== true) return null;
  if (output.kind !== "family_basics" && output.kind !== "child") return null;
  return {
    kind: output.kind,
    intro: typeof output.intro === "string" ? output.intro : null,
  };
}

export interface ActiveDetailRequest {
  message: EveMessage;
  partKey: string;
  card: DetailCardData;
}

/** The newest card with nothing from her after it, same rule as every
 *  other live card, so two can never both want the screen. */
export function latestDetailRequest(
  messages: readonly EveMessage[],
): ActiveDetailRequest | null {
  let latest: ActiveDetailRequest | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parseDetailCardPart(part);
      if (card) latest = { message, partKey: `${message.id}:${partIndex}`, card };
    }
  }
  return latest;
}

const FIELD_CLASS =
  "mt-1 w-full rounded-md border border-border bg-card px-3 py-2.5 text-base text-strong transition-colors placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * A date the way a parent would say it, for the bubble her answer becomes.
 *
 * Built from the string's own parts rather than through `new Date(iso)`,
 * which reads a bare date as UTC midnight and then renders it a day early
 * anywhere west of Greenwich. A birthday is the one date a parent will
 * notice being wrong.
 */
export function spokenDate(iso: string | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** One question, one input. Order is the order she is asked. */
export interface DetailField {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "state" | "date" | "chips-optional";
  autoComplete?: string;
  /** chips-optional only: the fixed list she picks any number from. */
  options?: { value: string; label: string }[];
}

/** Turns the comma-joined chips-optional value back into its list, empty
 *  string included, since "" split on "," is [""] rather than []. */
export function parseChipsValue(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * The name token. Any string here may contain {name}, and it is replaced
 * with the child's name as she typed it.
 *
 * This exists because one question at a time means her earlier answers
 * are off screen. By the birthday step the name input is gone, so a
 * pronoun has nothing visible to point at even though she supplied the
 * word herself a tap ago. Saying the name back is also the cheapest
 * proof that Homa was listening.
 *
 * A token in plain strings rather than a function per label, so FIELDS
 * stays a table of readable copy that can be found by searching for the
 * words a parent saw. A test asserts no literal {name} ever reaches the
 * screen, which is what makes the stringly-typed part safe.
 */
export const NAME_TOKEN = "{name}";

export function withChildName(
  text: string,
  values: Record<string, string>,
): string {
  // Unreachable in practice: the ready check will not let her past the
  // name step while it is blank. It reads correctly anyway if it ever
  // fires, which is the point of a fallback.
  const name = values.childName?.trim() || "your child";
  return text.split(NAME_TOKEN).join(name);
}

export const FIELDS: Record<DetailCardKind, DetailField[]> = {
  family_basics: [
    {
      key: "callMeName",
      label: "What should I call you?",
      kind: "text",
      autoComplete: "given-name",
    },
    {
      key: "usState",
      label: "Which state are you in?",
      hint: "This decides which homeschool rules I follow for you.",
      kind: "state",
    },
    {
      key: "homeschoolStyles",
      label: "Any particular homeschool approach you follow?",
      hint: "Pick any that fit, or skip. Totally optional.",
      kind: "chips-optional",
      options: HOMESCHOOL_STYLES.map((value) => ({
        value,
        label: HOMESCHOOL_STYLE_LABELS[value],
      })),
    },
  ],
  child: [
    {
      key: "childName",
      // Names the subject, because nothing else on this card does. The
      // eyebrow that used to ("About your child") is dropped in docked
      // mode, and docked is the only mode a live card is ever in, so
      // "What is their name?" arrived pointing at nobody. The nearest
      // human in the conversation was the parent herself.
      //
      // "first name" and not "name": one name per concept, and the rest
      // of the product already calls this datum a first name.
      label: "What is your child's first name?",
      // Not decoration. This value becomes the name Homa uses in every
      // question, report line and printable from here on, so the moment
      // to say a nickname is allowed is before she types the one on the
      // birth certificate.
      hint: "A nickname is fine.",
      kind: "text",
    },
    {
      key: "birthDate",
      label: `When was ${NAME_TOKEN} born?`,
      // "the questions I ask", not "the questions": she has not been
      // shown a checklist yet, so the definite article pointed at
      // something she had never seen. "Their" is fine here, and only
      // here, because the label above it now says the name.
      hint: "The real date. Their age in months decides which questions I ask.",
      kind: "date",
    },
  ],
};

export function DetailCard({
  card,
  active,
  docked = false,
  onSaved,
}: {
  card: DetailCardData;
  active: boolean;
  /** True when this is standing in for the composer rather than sitting
   *  in the transcript. It takes the composer's own geometry so the swap
   *  reads as one object changing shape, and it drops the eyebrow, which
   *  is a transcript affordance and pure noise at the bottom of the
   *  screen where she is already looking. */
  docked?: boolean;
  /** Hands the conversation back, with what she actually entered. */
  onSaved?: (summary: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBasics = card.kind === "family_basics";
  const fields = FIELDS[card.kind];
  const field = fields[Math.min(stepIndex, fields.length - 1)];
  const value = values[field.key] ?? "";
  const isLast = stepIndex === fields.length - 1;
  const ready =
    field.kind === "state"
      ? value.length === 2
      : field.kind === "date"
        ? value.length === 10
        : field.kind === "chips-optional"
          ? true
          : value.trim().length > 0;

  async function save(all: Record<string, string>): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const response = isBasics
        ? await fetch("/api/onboarding/basics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callMeName: all.callMeName?.trim(),
              usState: all.usState,
              timeZone: browserTimeZone(),
              homeschoolStyles: parseChipsValue(all.homeschoolStyles ?? ""),
            }),
          })
        : await fetch("/api/map/children", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: all.childName?.trim(),
              birthDate: all.birthDate,
              interests: [],
            }),
          });
      const data = (await response.json()) as { ok?: boolean };
      if (!response.ok || !data.ok) throw new Error("save failed");
      const pickedStyles = parseChipsValue(all.homeschoolStyles ?? "").map((value) =>
        (HOMESCHOOL_STYLE_LABELS as Record<string, string>)[value] ?? value,
      );
      const summary = isBasics
        ? // The state's name, not its postal code. This string becomes her
          // own bubble in the transcript, and "Sid, DC" reads as a
          // database row where "Sid, District of Columbia" reads as an
          // answer she gave. The style names, when she picked any, ride
          // on the same bubble rather than a second one: it is still one
          // answer, about herself, from one card.
          `${all.callMeName?.trim()}, ${
            US_STATES.find((state) => state.code === all.usState)?.name ??
            all.usState
          }${pickedStyles.length > 0 ? `, ${pickedStyles.join(", ")}` : ""}`
        : `${all.childName?.trim()}, born ${spokenDate(all.birthDate)}`;
      setSaved(summary);
      onSaved?.(summary);
    } catch {
      setError("That did not save. Nothing is lost, you can try again.");
      // Back to the last question so the button she just pressed is the
      // one that retries, rather than stranding her on a finished card.
      setStepIndex(fields.length - 1);
    } finally {
      setSaving(false);
    }
  }

  function advance(): void {
    if (!ready || saving) return;
    if (!isLast) {
      setStepIndex(stepIndex + 1);
      return;
    }
    void save(values);
  }

  function setValue(next: string): void {
    setValues((current) => ({ ...current, [field.key]: next }));
  }

  /** Toggles one chip in place, preserving pick order, same rule the old
   *  linear homeschool step used (the first pick stays primary
   *  downstream, e.g. the plan's style note). */
  function toggleChip(chipValue: string): void {
    const current = parseChipsValue(values[field.key] ?? "");
    const next = current.includes(chipValue)
      ? current.filter((entry) => entry !== chipValue)
      : [...current, chipValue];
    setValue(next.join(","));
  }

  // Spent: the settled receipt every other finished card uses. Her
  // answers stay readable; nothing here is pressable.
  //
  // Only a card that actually saved gets one. Deriving the receipt from
  // "not active" instead put a green "Saved" chip on a card nobody had
  // filled in, purely because a turn was running: a receipt claiming an
  // effect that never happened, which is the one thing a receipt may
  // never do.
  if (saved !== null) {
    return (
      <p className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
        <span className="font-semibold text-sage">
          {isBasics ? "Saved" : "Added"}
        </span>
        <span className="truncate text-body">{saved}</span>
      </p>
    );
  }
  // Superseded without ever being filled: she moved on and the card is
  // stale. Say nothing rather than leave a dead form in scrollback.
  if (!active) return null;

  return (
    <section
      className={
        docked
          ? "w-full rounded-[22px] border border-border-subtle bg-card px-4 pb-4 pt-4 shadow-md"
          : "w-full max-w-[26rem] rounded-lg border border-border-subtle bg-card p-4 shadow-md sm:p-5"
      }
      aria-label={isBasics ? "About you" : "About your child"}
    >
      {docked ? null : (
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
          <Logo size={15} variant="mark" />
          {isBasics ? "About you" : "About your child"}
        </p>
      )}
      {card.intro ? (
        <p className={`text-sm text-muted ${docked ? "" : "mt-2"}`}>{card.intro}</p>
      ) : null}

      {/* One question, one input (founder rule, 2026-07-22). Two fields
          at once is a form; one is a question. The container holds a
          fixed height so swapping the field never moves the button out
          from under her thumb, the same no-jump rule the checklist card
          settled on. */}
      <div
        className={`flex min-h-[5.5rem] flex-col justify-center ${docked ? "" : "mt-3.5"}`}
      >
        <label className="block" key={field.key}>
          <span className="text-sm font-medium text-strong">
            {withChildName(field.label, values)}
          </span>
          {field.kind === "chips-optional" ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(field.options ?? []).map((option) => {
                const selected = parseChipsValue(value).includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleChip(option.value)}
                    aria-pressed={selected}
                    className={`min-h-9 rounded-pill border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-brand bg-brand-soft text-[var(--clay-700)]"
                        : "border-border bg-card text-strong hover:border-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : field.kind === "state" ? (
            <select
              autoFocus
              className={FIELD_CLASS}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="">Pick one</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              className={FIELD_CLASS}
              type={field.kind === "date" ? "date" : "text"}
              value={value}
              maxLength={field.kind === "date" ? undefined : 60}
              max={field.kind === "date" ? new Date().toISOString().slice(0, 10) : undefined}
              autoComplete={field.autoComplete}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                advance();
              }}
            />
          )}
          {field.hint ? (
            <span className="mt-1 block text-xs text-subtle">
              {withChildName(field.hint, values)}
            </span>
          ) : null}
        </label>
      </div>

      {error ? <p className="mt-1 text-sm text-body">{error}</p> : null}

      <button
        type="button"
        disabled={!ready || saving || onSaved === undefined}
        onClick={advance}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* "Add Ivy", not "Add them": the last unbound pronoun on the
            screen, and a plural one, so it also read as though the button
            added more than one child. The product already builds a button
            label from the typed name on the card flow, after the founder
            hit the same confusion there. */}
        {saving
          ? "Saving…"
          : isLast
            ? isBasics
              ? "That's me"
              : withChildName(`Add ${NAME_TOKEN}`, values)
            : "Next"}
      </button>

      {fields.length > 1 ? (
        // Where she is, without a count. "2 of 2" turns two questions
        // into a form with a length; two dots just say there is one more.
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {fields.map((entry, index) => (
            <span
              key={entry.key}
              // bg-border, not bg-border-subtle: subtle is the track
              // colour for a progress bar, where a filled portion sits on
              // top of it and gives it its edge. A lone dot has no such
              // help, and at stone-200 on a white card it disappeared
              // entirely, which turned "you are on the second of two" back
              // into "there is one question".
              className={`h-1.5 w-1.5 rounded-pill transition-colors duration-(--dur-base) ${
                index === stepIndex ? "bg-brand" : "bg-border"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
