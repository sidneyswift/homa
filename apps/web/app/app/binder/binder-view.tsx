"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  binderCover,
  filterMaterials,
  isDefaultFilter,
  KIND_LABELS,
  kindOptions,
  noResultsMessage,
  subjectOptions,
  type BinderFilter,
  type BinderMaterial,
} from "../../../lib/materials/binder";
import { BinderCard } from "./binder-card";
import { MaterialDetailOverlay } from "./material-detail-overlay";

/**
 * The Binder page (binder design directions, 2026-07-11; subject row
 * and this-week cover from the portfolio review session, 2026-07-12):
 * Direction 1's calm cover as the default landing, Direction 2's
 * search, filter chips, and large real previews underneath and
 * whenever a parent is actively narrowing. Scope (whole family or one
 * kid) already comes from the sidebar's view context, read once in
 * page.tsx; this component only searches and filters within whatever
 * it was handed.
 */

const COVER_COUNT = 3;

/** Free-text subjects could sprawl; past this the search box does the tail. */
const MAX_SUBJECT_CHIPS = 10;

const CHIP_ON =
  "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]";
const CHIP_OFF =
  "min-h-9 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:border-[var(--clay-200)]";

/**
 * The kinds a brand-new binder previews in its empty state, spelled by
 * the surface's one kind vocabulary (editor gate: no second inflection).
 */
const EMPTY_STATE_PREVIEW = [
  KIND_LABELS.worksheet,
  KIND_LABELS.coloring,
  KIND_LABELS.flashcards,
  KIND_LABELS.reader,
  KIND_LABELS.game,
];

export function BinderView({
  materials,
  scopeChildName,
  timeZone,
  now,
}: {
  materials: BinderMaterial[];
  scopeChildName: string | null;
  timeZone: string;
  /** Server-supplied, planner precedent: keeps render pure and testable. */
  now: Date;
}) {
  const [filter, setFilter] = useState<BinderFilter>({
    kind: null,
    subject: null,
    query: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kinds = useMemo(() => kindOptions(materials), [materials]);
  const subjects = useMemo(
    () => subjectOptions(materials).slice(0, MAX_SUBJECT_CHIPS),
    [materials],
  );
  const filtered = useMemo(() => filterMaterials(materials, filter), [materials, filter]);
  const showCover = materials.length > 0 && isDefaultFilter(filter);
  const nowMs = now.getTime();
  const cover = useMemo(
    () =>
      showCover
        ? binderCover(materials, nowMs, COVER_COUNT)
        : { eyebrow: "", heading: "", items: [] },
    [materials, showCover, nowMs],
  );
  const coverIds = useMemo(() => new Set(cover.items.map((item) => item.id)), [cover]);
  const gridItems = showCover ? filtered.filter((item) => !coverIds.has(item.id)) : filtered;
  const selected = materials.find((item) => item.id === selectedId) ?? null;

  const activeSubject = subjects.find((subject) => subject.key === filter.subject) ?? null;
  const sectionTitle = showCover
    ? "Everything else"
    : filter.query.trim()
      ? "Search results"
        : filter.kind
          ? KIND_LABELS[filter.kind]
          : activeSubject
            ? activeSubject.label
            : "In your Binder";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            Kept to use again
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            Binder
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            {scopeChildName
              ? `Everything kept for ${scopeChildName}, plus anything for the whole family.`
              : "Everything your family keeps, in one place to browse and print."}
          </p>
        </div>
        <label className="flex min-h-11 min-w-[220px] items-center gap-2 rounded-pill border border-border bg-card px-4 py-2 text-subtle">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search the Binder"
            aria-label="Search the Binder"
            className="w-full min-w-0 border-0 bg-transparent text-sm text-body outline-none placeholder:text-subtle"
          />
        </label>
      </header>

      {kinds.length > 1 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
          <span className="mr-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Type
          </span>
          <button
            type="button"
            aria-pressed={filter.kind === null}
            onClick={() => setFilter((current) => ({ ...current, kind: null }))}
            className={filter.kind === null ? CHIP_ON : CHIP_OFF}
          >
            All
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={filter.kind === kind}
              onClick={() => setFilter((current) => ({ ...current, kind }))}
              className={filter.kind === kind ? CHIP_ON : CHIP_OFF}
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      ) : null}

      {subjects.length > 1 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by subject">
          <span className="mr-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Subject
          </span>
          <button
            type="button"
            aria-pressed={filter.subject === null}
            onClick={() => setFilter((current) => ({ ...current, subject: null }))}
            className={filter.subject === null ? CHIP_ON : CHIP_OFF}
          >
            All
          </button>
          {subjects.map((subject) => (
            <button
              key={subject.key}
              type="button"
              aria-pressed={filter.subject === subject.key}
              onClick={() =>
                setFilter((current) => ({ ...current, subject: subject.key }))
              }
              className={filter.subject === subject.key ? CHIP_ON : CHIP_OFF}
            >
              {subject.label}
            </button>
          ))}
        </div>
      ) : null}

      {materials.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-dashed border-border bg-card p-8 text-center">
          <p className="font-display text-lg font-semibold text-strong">Nothing kept yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            {scopeChildName
              ? `When you tell Homa that something she made for ${scopeChildName} is a keeper, it lands here on its own.`
              : "When you tell Homa that something she made is a keeper, it lands here on its own."}
          </p>
          <div
            className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2"
            aria-hidden="true"
          >
            {EMPTY_STATE_PREVIEW.map((label) => (
              <span
                key={label}
                className="rounded-pill border border-dashed border-border px-3.5 py-1.5 text-xs font-bold text-subtle"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-sm text-sm text-muted">
            Your first one starts in chat.
          </p>
          <Link
            href="/app"
            className="mt-3 inline-block rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
          >
            Ask HOMA
          </Link>
        </div>
      ) : (
        <>
          {showCover && cover.items.length > 0 ? (
            <section className="mt-6 rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
                {cover.eyebrow}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-strong">
                {cover.heading}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cover.items.map((material) => (
                  <BinderCard key={material.id} material={material} onOpen={(item) => setSelectedId(item.id)} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-strong">{sectionTitle}</h2>
              <span className="text-xs text-subtle">
                {gridItems.length} {gridItems.length === 1 ? "thing" : "things"}
              </span>
            </div>
            {gridItems.length > 0 ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {gridItems.map((material) => (
                  <BinderCard key={material.id} material={material} onOpen={(item) => setSelectedId(item.id)} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
                {noResultsMessage(filter)}
              </p>
            )}
          </section>
        </>
      )}

      {selected ? (
        <MaterialDetailOverlay material={selected} timeZone={timeZone} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}
