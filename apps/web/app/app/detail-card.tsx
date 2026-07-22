"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { useState } from "react";

import { US_STATES } from "@homa/core";

import { Logo } from "../../components/brand/Logo";

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
const LABEL_CLASS = "text-sm font-medium text-strong";

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

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
  const [callMeName, setCallMeName] = useState("");
  const [usState, setUsState] = useState("");
  const [childName, setChildName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBasics = card.kind === "family_basics";
  const ready = isBasics
    ? callMeName.trim().length > 0 && usState.length === 2
    : childName.trim().length > 0 && birthDate.length === 10;

  async function submit(): Promise<void> {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = isBasics
        ? await fetch("/api/onboarding/basics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callMeName: callMeName.trim(),
              usState,
              timeZone: browserTimeZone(),
            }),
          })
        : await fetch("/api/map/children", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: childName.trim(),
              birthDate,
              interests: [],
            }),
          });
      const data = (await response.json()) as { ok?: boolean };
      if (!response.ok || !data.ok) throw new Error("save failed");
      const summary = isBasics
        ? `${callMeName.trim()}, ${usState}`
        : `${childName.trim()}, born ${birthDate}`;
      setSaved(summary);
      onSaved?.(summary);
    } catch {
      setError(
        isBasics
          ? "That did not save. Nothing is lost, you can try again."
          : "That did not save. Nothing is lost, you can try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Spent: the settled receipt every other finished card uses. Her
  // answers stay readable; nothing here is pressable.
  if (saved !== null || !active) {
    return (
      <p className="inline-flex max-w-full items-baseline gap-1.5 self-start rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-xs">
        <span className="font-semibold text-sage">
          {isBasics ? "Saved" : "Added"}
        </span>
        {saved ? <span className="truncate text-body">{saved}</span> : null}
      </p>
    );
  }

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

      <div className={`flex flex-col gap-3 ${docked ? "" : "mt-3.5"}`}>
        {isBasics ? (
          <>
            <label className="block">
              <span className={LABEL_CLASS}>What should I call you?</span>
              <input
                className={FIELD_CLASS}
                value={callMeName}
                onChange={(event) => setCallMeName(event.target.value)}
                autoComplete="given-name"
                maxLength={60}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Your state</span>
              <select
                className={FIELD_CLASS}
                value={usState}
                onChange={(event) => setUsState(event.target.value)}
              >
                <option value="">Pick one</option>
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-subtle">
                This decides which homeschool rules I follow for you.
              </span>
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className={LABEL_CLASS}>Their name</span>
              <input
                className={FIELD_CLASS}
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                maxLength={60}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Their birthday</span>
              <input
                className={FIELD_CLASS}
                type="date"
                value={birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBirthDate(event.target.value)}
              />
              <span className="mt-1 block text-xs text-subtle">
                The real date, so the questions match their age in months.
              </span>
            </label>
          </>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-body">{error}</p> : null}

      <button
        type="button"
        disabled={!ready || saving || onSaved === undefined}
        onClick={() => void submit()}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-base font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : isBasics ? "That's me" : "Add them"}
      </button>
    </section>
  );
}
