"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  coverMaterials,
  filterMaterials,
  isDefaultFilter,
  KIND_LABELS,
  kindOptions,
  type BinderFilter,
  type BinderMaterial,
} from "../../../lib/materials/binder";
import { BinderCard } from "./binder-card";
import { MaterialDetailOverlay } from "./material-detail-overlay";

/**
 * The Binder page (binder design directions, 2026-07-11): Direction 1's
 * calm "this week" cover as the default landing, Direction 2's search,
 * filter chips, and large real previews underneath and whenever a
 * parent is actively narrowing. Scope (whole family or one kid) already
 * comes from the sidebar's view context, read once in page.tsx; this
 * component only searches and filters within whatever it was handed.
 */

const COVER_COUNT = 3;

export function BinderView({
  materials,
  scopeChildName,
  timeZone,
}: {
  materials: BinderMaterial[];
  scopeChildName: string | null;
  timeZone: string;
}) {
  const [filter, setFilter] = useState<BinderFilter>({ kind: null, query: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kinds = useMemo(() => kindOptions(materials), [materials]);
  const filtered = useMemo(() => filterMaterials(materials, filter), [materials, filter]);
  const showCover = materials.length > 0 && isDefaultFilter(filter);
  const cover = useMemo(
    () => (showCover ? coverMaterials(materials, COVER_COUNT) : []),
    [materials, showCover],
  );
  const coverIds = useMemo(() => new Set(cover.map((item) => item.id)), [cover]);
  const gridItems = showCover ? filtered.filter((item) => !coverIds.has(item.id)) : filtered;
  const selected = materials.find((item) => item.id === selectedId) ?? null;

  const sectionTitle = showCover
    ? "Everything else"
    : filter.query.trim()
      ? "Search results"
      : filter.kind
        ? KIND_LABELS[filter.kind]
        : "Everything in your Binder";

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
            Kept for later
          </p>
          <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            Binder
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            {scopeChildName
              ? `Everything approved for ${scopeChildName}, plus anything shared with the whole family.`
              : "Everything your family has approved, in one place to browse and print again."}
          </p>
        </div>
        <label className="flex min-h-11 min-w-[220px] items-center gap-2 rounded-pill border border-border-default bg-card px-4 py-2 text-subtle">
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
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          <button
            type="button"
            aria-pressed={filter.kind === null}
            onClick={() => setFilter((current) => ({ ...current, kind: null }))}
            className={
              filter.kind === null
                ? "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                : "min-h-9 rounded-pill border border-border-default bg-card px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:border-[var(--clay-200)]"
            }
          >
            All
          </button>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={filter.kind === kind}
              onClick={() => setFilter((current) => ({ ...current, kind }))}
              className={
                filter.kind === kind
                  ? "min-h-9 rounded-pill border border-[var(--clay-200)] bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-[var(--clay-700)]"
                  : "min-h-9 rounded-pill border border-border-default bg-card px-3.5 py-1.5 text-xs font-bold text-muted transition-colors hover:border-[var(--clay-200)]"
              }
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      ) : null}

      {materials.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-xl)] border border-dashed border-border-default bg-card p-8 text-center">
          <p className="font-display text-lg font-semibold text-strong">Nothing kept yet.</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            {scopeChildName
              ? `When you approve a worksheet, reader, or game Homa makes for ${scopeChildName}, it lands here.`
              : "When you approve a worksheet, reader, or game Homa makes, it lands here automatically."}
          </p>
        </div>
      ) : (
        <>
          {showCover && cover.length > 0 ? (
            <section className="mt-6 rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
                Ready now
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-strong">
                The newest things you&apos;ve kept
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cover.map((material) => (
                  <BinderCard key={material.id} material={material} onOpen={(item) => setSelectedId(item.id)} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-strong">{sectionTitle}</h2>
              <span className="text-xs text-subtle">
                {gridItems.length} {gridItems.length === 1 ? "item" : "items"}
              </span>
            </div>
            {gridItems.length > 0 ? (
              <div className="mt-4 grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {gridItems.map((material) => (
                  <BinderCard key={material.id} material={material} onOpen={(item) => setSelectedId(item.id)} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-border-default bg-card p-6 text-center text-sm text-muted">
                Nothing matches that search. Try a different word or clear the filter.
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
