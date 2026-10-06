"use client";

import { useWorkspaceSurface } from "../../../components/workspace/surface-context";
import { useCallback, useMemo, useState } from "react";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
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

const CHIP_ON = "quiet-filter quiet-filter--active";
const CHIP_OFF = "quiet-filter";

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
  const workspace = useWorkspaceSurface();
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

  const closeDetail = useCallback(() => setSelectedId(null), []);
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
    <div data-brand-surface="binder">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:var(--homa-brand-text)]">
            Kept to use again
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-[color:var(--homa-ink)]">
            Binder
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            {scopeChildName
              ? `Everything kept for ${scopeChildName}, plus anything for the whole family.`
              : "Everything your family keeps, in one place to browse and print."}
          </p>
        </div>
        <label className="quiet-search" aria-label="Search your Binder">
          <input
            type="search"
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search the Binder"
            aria-label="Search the Binder"
            className="quiet-search__input"
          />
        </label>
      </header>

      {kinds.length > 1 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
          <span className="mr-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
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
          <span className="mr-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
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
        <QuietFrame tone="paper" as="section" className="mt-8 border-dashed p-8 text-center">
          <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
            {scopeChildName ? `Nothing kept for ${scopeChildName} or the whole family yet.` : "Nothing kept yet."}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Tell Homa which material you would like to keep, or choose Keep this on a draft.
          </p>
          <div
            className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2"
            aria-hidden="true"
          >
            {EMPTY_STATE_PREVIEW.map((label) => (
              <span
                key={label}
                className="rounded-[var(--homa-radius-control)] border border-dashed border-[var(--homa-control-boundary)] px-3.5 py-1.5 text-xs font-bold text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-sm text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Make something new in chat.
          </p>
          <QuietAction href={workspace ? undefined : "/app"} onClick={workspace ? () => workspace.askHoma("Help me make something for our family.") : undefined} className="mt-3" size="large" icon={<Icon name="next" size={20} />}>
            Ask Homa
          </QuietAction>
        </QuietFrame>
      ) : (
        <>
          {showCover && cover.items.length > 0 ? (
            <QuietFrame tone="paper" as="section" className="mt-6 p-5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                {cover.eyebrow}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-[color:var(--homa-ink)]">
                {cover.heading}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cover.items.map((material) => (
                  <BinderCard key={material.id} material={material} onOpen={(item) => setSelectedId(item.id)} />
                ))}
              </div>
            </QuietFrame>
          ) : null}

          {!showCover || gridItems.length > 0 ? <section className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">{sectionTitle}</h2>
              <span className="text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
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
              <p className="mt-4 rounded-[var(--homa-radius-card)] border border-dashed border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-6 text-center text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                {noResultsMessage(filter)}
              </p>
            )}
          </section> : null}
        </>
      )}

      {selected ? (
        <MaterialDetailOverlay material={selected} timeZone={timeZone} onClose={closeDetail} />
      ) : null}
    </div>
  );
}
