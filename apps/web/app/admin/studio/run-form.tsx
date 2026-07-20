"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { launchStudioRunAction } from "./actions";
import type { StudioFamilyOption } from "../../../lib/admin/studio-data";

/**
 * The test bench's run composer (winning direction 1 "Bench" of the
 * 2026-07-18 material studio lab): sandbox family, optional child,
 * request text with preset chips, one Run button. Client component only
 * for the form state; the launch itself is a founder-gated server
 * action, and results land in the server-rendered runs list on refresh.
 */

const PRESETS = [
  "A counting worksheet with dinosaurs, counting groups of 8 to 12",
  "A letter tracing page for the first letter of the child's name",
  "A PEMDAS foldable with a small mnemonic illustration",
  "A five-paragraph essay outline",
  "A cut-and-paste short-a word work page",
  "A real-photo nature study page about monarch butterflies",
];

export function StudioRunForm({ families }: { families: StudioFamilyOption[] }) {
  const router = useRouter();
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "");
  const [childId, setChildId] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const family = useMemo(
    () => families.find((option) => option.id === familyId) ?? families[0],
    [families, familyId],
  );

  if (families.length === 0) {
    return (
      <p className="rounded-md bg-page px-3.5 py-3 text-[0.85rem] text-muted">
        No sandbox family yet. Mark one as a test family on its family page
        first; test runs only target sandbox families.
      </p>
    );
  }

  const launch = () => {
    if (pending) return;
    setNote(null);
    startTransition(async () => {
      const result = await launchStudioRunAction(family.id, childId, request);
      if (result.error) {
        setNote(result.error);
        return;
      }
      setNote(
        "Run started. It builds in the background for a minute or two; refresh the runs list below.",
      );
      setRequest("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Sandbox family"
          value={family.id}
          onChange={(event) => {
            setFamilyId(event.target.value);
            setChildId(null);
          }}
          className="min-h-10 rounded-md border border-border-default bg-card px-3 text-[0.85rem] text-body"
        >
          {families.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} (sandbox)
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Child">
          {family.children.map((child) => {
            const active = childId === child.id;
            return (
              <button
                key={child.id}
                type="button"
                aria-pressed={active}
                onClick={() => setChildId(active ? null : child.id)}
                className={
                  active
                    ? "rounded-pill border border-[var(--clay-300)] bg-brand-soft px-3 py-1.5 text-[0.78rem] font-bold text-[var(--clay-700)]"
                    : "rounded-pill border border-border-default bg-card px-3 py-1.5 text-[0.78rem] font-semibold text-muted hover:text-strong"
                }
              >
                {child.name}
                {child.ageYears !== null ? ` · ${child.ageYears}` : ""}
              </button>
            );
          })}
          {family.children.length === 0 ? (
            <span className="text-[0.78rem] text-subtle">
              This family has no kids yet; the skill needs one to aim at.
            </span>
          ) : null}
        </div>
      </div>

      <textarea
        aria-label="Request"
        value={request}
        onChange={(event) => setRequest(event.target.value)}
        rows={3}
        maxLength={600}
        placeholder="What should the parent have asked for?"
        className="w-full rounded-md border border-border-default bg-card px-3 py-2.5 text-[0.88rem] text-body placeholder:text-subtle"
      />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setRequest(preset)}
            className="rounded-pill border border-border-default bg-card px-3 py-1.5 text-[0.74rem] font-semibold text-muted hover:text-strong"
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={launch}
          disabled={pending || family.children.length === 0}
          className="rounded-pill bg-[var(--clay-500)] px-5 py-2.5 text-[0.85rem] font-bold text-white transition-colors hover:bg-[var(--clay-600)] disabled:opacity-50"
        >
          {pending ? "Starting…" : "Run in studio"}
        </button>
        {note ? <span className="text-[0.8rem] font-semibold text-muted">{note}</span> : null}
      </div>
    </div>
  );
}
