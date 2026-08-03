"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { sendAbilitiesExplorerEvent } from "../../lib/child-progress/abilities-explorer-events";
import { setAbilityContextAction } from "../../app/app/ability-context-actions";
import type {
  AbilitiesExplorerDisplayState,
  AbilitiesExplorerNode,
  AbilitiesExplorerPayload,
  AbilitiesExplorerSubject,
  AbilitiesExplorerSubjectId,
} from "../../lib/child-progress/abilities-explorer-types";
import { ProgressChatDoor } from "./progress-chat-door";

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 590;
const PLOT_LEFT = 38;
const PLOT_RIGHT = 972;
const PLOT_TOP = 34;
const PLOT_BOTTOM = 492;
const AXIS_Y = 536;
const AXIS_TICKS = [48, 72, 96, 120, 144, 168] as const;

const STATUS_META: Record<
  AbilitiesExplorerDisplayState,
  { label: string; description: string; color: string; fill: string }
> = {
  knows: {
    label: "Knows",
    description: "A parent answer says this is in place.",
    color: "var(--sage-700)",
    fill: "var(--sage-700)",
  },
  working_on_now: {
    label: "Working on now",
    description: "A parent answer says this is the current practice edge.",
    color: "var(--gold-ink)",
    fill: "var(--gold-400)",
  },
  up_next: {
    label: "Up next",
    description: "Homa has not marked this as known yet.",
    color: "var(--text-muted)",
    fill: "var(--stone-400)",
  },
};

function graphX(node: AbilitiesExplorerNode): number {
  return PLOT_LEFT + node.x * (PLOT_RIGHT - PLOT_LEFT);
}

function graphY(node: AbilitiesExplorerNode): number {
  return PLOT_TOP + node.y * (PLOT_BOTTOM - PLOT_TOP);
}

function axisX(months: number, axis: readonly [number, number]): number {
  return (
    PLOT_LEFT +
    ((months - axis[0]) / (axis[1] - axis[0])) * (PLOT_RIGHT - PLOT_LEFT)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ageLabel(months: number): string {
  const years = months / 12;
  return Number.isInteger(years) ? `${years}` : years.toFixed(1);
}

function chooseInitialNode(
  subject: AbilitiesExplorerSubject,
  ageMonths: number,
): AbilitiesExplorerNode | null {
  return (
    [...subject.nodes]
      .sort(
        (left, right) =>
          Number(right.state === "knows") - Number(left.state === "knows") ||
          Number(right.state === "working_on_now") -
            Number(left.state === "working_on_now") ||
          Math.abs(
            (left.teachingWindowMonths[0] + left.teachingWindowMonths[1]) / 2 -
              ageMonths,
          ) -
            Math.abs(
              (right.teachingWindowMonths[0] + right.teachingWindowMonths[1]) /
                2 -
                ageMonths,
            ) ||
          left.id.localeCompare(right.id),
      )
      .at(0) ?? null
  );
}

function statusClass(state: AbilitiesExplorerDisplayState): string {
  return state === "working_on_now"
    ? "border-[var(--gold-ink)] bg-[var(--gold-400)]"
    : state === "knows"
      ? "border-[var(--sage-700)] bg-[var(--sage-700)]"
      : "border-[var(--stone-400)] bg-[var(--stone-300)]";
}

function evidenceLine(
  node: AbilitiesExplorerNode,
  childName: string,
): string {
  if (node.evidence.conflict) {
    return "Two parent answers need a closer look before Homa marks this one.";
  }
  if (node.evidence.answer === "easily") {
    return `${childName} has a parent answer showing this is familiar.`;
  }
  if (node.evidence.answer === "getting_there") {
    return `${childName} has a parent answer showing this is being practiced now.`;
  }
  if (node.evidence.answer === "not_yet") {
    return `${childName} has a parent answer saying this is still ahead.`;
  }
  return `Homa has not heard a direct answer about ${childName} doing this yet.`;
}

function formatObservedAt(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function countStates(subject: AbilitiesExplorerSubject) {
  return subject.nodes.reduce(
    (counts, node) => {
      counts[node.state] += 1;
      return counts;
    },
    { knows: 0, working_on_now: 0, up_next: 0 },
  );
}

function Connections({
  selected,
  subject,
  onSelect,
}: {
  selected: AbilitiesExplorerNode;
  subject: AbilitiesExplorerSubject;
  onSelect: (id: string, reason?: "connected") => void;
}) {
  const byId = new Map(subject.nodes.map((node) => [node.id, node]));
  const buildsOn = subject.edges
    .filter((edge) => edge.toId === selected.id)
    .map((edge) => byId.get(edge.fromId))
    .filter((node): node is AbilitiesExplorerNode => node !== undefined)
    .slice(0, 6);
  const leadsTo = subject.edges
    .filter((edge) => edge.fromId === selected.id)
    .map((edge) => byId.get(edge.toId))
    .filter((node): node is AbilitiesExplorerNode => node !== undefined)
    .slice(0, 6);

  if (buildsOn.length === 0 && leadsTo.length === 0) {
    return (
      <p className="mt-3 text-sm leading-6 text-muted">
        This ability is a starting point in the map.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {buildsOn.length > 0 ? (
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Builds on
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {buildsOn.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id, "connected")}
                className="min-h-11 rounded-pill border border-border-subtle bg-card px-3.5 py-2 text-left text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                {node.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {leadsTo.length > 0 ? (
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Leads to
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {leadsTo.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id, "connected")}
                className="min-h-11 rounded-pill border border-border-subtle bg-card px-3.5 py-2 text-left text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                {node.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AbilityDetail({
  childId,
  payload,
  subject,
  selected,
  onSelect,
  onClose,
  mobileOpen,
}: {
  childId: string;
  payload: AbilitiesExplorerPayload;
  subject: AbilitiesExplorerSubject;
  selected: AbilitiesExplorerNode;
  onSelect: (id: string, reason?: "connected") => void;
  onClose: () => void;
  mobileOpen: boolean;
}) {
  const selectedIndex = subject.nodes.findIndex((node) => node.id === selected.id);
  const practiceId = `practice-${selected.id}`;
  const [practiceShown, setPracticeShown] = useState(false);
  const status = STATUS_META[selected.state];
  const observedAt = formatObservedAt(selected.evidence.observedAt);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <aside
      aria-label={`Details for ${selected.name}`}
      className={
        mobileOpen
          ? "fixed inset-x-3 bottom-3 z-40 max-h-[78vh] overflow-y-auto rounded-xl border border-border-strong bg-card p-5 shadow-[0_24px_70px_rgba(32,36,43,0.22)] md:static md:max-h-none md:overflow-visible md:rounded-lg md:border-border-subtle md:p-6 md:shadow-sm"
          : "hidden rounded-lg border border-border-subtle bg-card p-6 shadow-sm md:block"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--clay-600)]">
            Selected ability
          </p>
          <h3 className="mt-2 font-display text-3xl font-semibold leading-[0.98] tracking-[-0.02em] text-strong">
            {selected.name}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[var(--sky-600)]">
            {selected.domainName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-subtle bg-card text-xl font-semibold text-strong md:hidden"
          aria-label="Close ability details"
        >
          ×
        </button>
      </div>

      <p className="mt-5 text-base leading-7 text-body">{selected.description}</p>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">{payload.childName}&apos;s progress</p>
        <p
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-bold"
          style={{ background: "var(--accent-sage-soft)", color: status.color }}
        >
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full border ${statusClass(selected.state)}`}
          />
          {status.label}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {evidenceLine(selected, payload.childName)}
        </p>
        {selected.evidence.source || observedAt ? (
          <p className="mt-2 text-xs font-medium text-subtle">
            {[selected.evidence.source, observedAt].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">Move through abilities</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => onSelect(subject.nodes[selectedIndex - 1]?.id ?? selected.id)}
            className="min-h-11 rounded-pill border border-border-subtle bg-card px-3 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-center text-xs font-semibold tabular-nums text-subtle">
            {selectedIndex + 1} of {subject.nodes.length}
          </span>
          <button
            type="button"
            disabled={selectedIndex < 0 || selectedIndex >= subject.nodes.length - 1}
            onClick={() => onSelect(subject.nodes[selectedIndex + 1]?.id ?? selected.id)}
            className="min-h-11 rounded-pill border border-border-subtle bg-card px-3 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">Connections</p>
        <Connections selected={selected} subject={subject} onSelect={onSelect} />
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <ProgressChatDoor
          childId={childId}
          variant="secondary"
          onOpen={async () => {
            sendAbilitiesExplorerEvent(
              "progress.explorer_ask_homa_opened",
              childId,
              subject.id,
            );
            await setAbilityContextAction(childId, selected.id);
          }}
        >
          Ask Homa about this ability
        </ProgressChatDoor>
        <p className="mt-2 text-xs leading-5 text-subtle">
          Homa will start with {payload.childName}&apos;s progress context.
        </p>
        <button
          type="button"
          onClick={() => setPracticeShown((shown) => !shown)}
          aria-expanded={practiceShown}
          aria-controls={practiceId}
          className="mt-4 min-h-11 w-full rounded-pill border border-border-subtle bg-card px-4 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          {practiceShown ? "Hide practice idea" : "Show a practice idea"}
        </button>
        <div
          id={practiceId}
          hidden={!practiceShown}
          className="mt-3 rounded-lg bg-[var(--accent-sage-soft)] p-4 text-sm leading-6 text-body"
        >
          Try a five-minute activity that uses <strong>{selected.name}</strong> in
          something {payload.childName} already enjoys. This preview does not send or save anything.
        </div>
      </div>
    </aside>
  );
}

function StatusKey({ childName }: { childName: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border-subtle bg-[var(--surface-raised)] px-4 py-3 text-sm">
      <span className="font-semibold text-strong">{childName}&apos;s progress</span>
      {(Object.keys(STATUS_META) as AbilitiesExplorerDisplayState[]).map((state) => (
        <span key={state} className="inline-flex items-center gap-2 font-semibold text-muted">
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full border ${statusClass(state)}`}
          />
          {STATUS_META[state].label}
        </span>
      ))}
      <span className="basis-full text-xs leading-5 text-subtle">
        Quiet dots are still abilities. They have not been marked as current progress yet.
      </span>
    </div>
  );
}

export function AbilitiesExplorer({
  payload,
}: {
  payload: AbilitiesExplorerPayload;
}) {
  const [subjectId, setSubjectId] = useState<AbilitiesExplorerSubjectId>(
    payload.subjects[0]?.id ?? "math",
  );
  const subject =
    payload.subjects.find((entry) => entry.id === subjectId) ??
    payload.subjects[0];
  const firstNode = subject
    ? chooseInitialNode(subject, payload.ageMonths)
    : null;
  const [selectedId, setSelectedId] = useState<string | null>(firstNode?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const openSelectedRef = useRef<HTMLButtonElement | null>(null);
  const subjectTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    sendAbilitiesExplorerEvent(
      "progress.explorer_opened",
      payload.childId,
      payload.subjects[0]?.id ?? "math",
    );
  }, [payload.childId, payload.subjects]);

  const selected = subject?.nodes.find((node) => node.id === selectedId) ?? firstNode;
  const selectedNeighbors = useMemo(() => {
    if (!subject || !selected) return new Set<string>();
    const ids = new Set<string>([selected.id]);
    for (const edge of subject.edges) {
      if (edge.fromId === selected.id) ids.add(edge.toId);
      if (edge.toId === selected.id) ids.add(edge.fromId);
    }
    return ids;
  }, [selected, subject]);

  function selectNode(id: string, open = true, reason?: "connected") {
    setSelectedId(id);
    if (open) setMobileOpen(true);
    sendAbilitiesExplorerEvent(
      reason === "connected"
        ? "progress.explorer_connected_ability_opened"
        : "progress.explorer_ability_detail_opened",
      payload.childId,
      subject?.id ?? "math",
    );
  }

  function selectSubject(id: AbilitiesExplorerSubjectId) {
    const nextSubject = payload.subjects.find((entry) => entry.id === id);
    setSubjectId(id);
    setSelectedId(nextSubject ? chooseInitialNode(nextSubject, payload.ageMonths)?.id ?? null : null);
    setMobileOpen(false);
    sendAbilitiesExplorerEvent("progress.explorer_subject_selected", payload.childId, id);
  }

  function closeDetails() {
    setMobileOpen(false);
    openSelectedRef.current?.focus();
  }

  function moveSubjectTab(index: number, direction: "previous" | "next" | "first" | "last") {
    const nextIndex =
      direction === "first"
        ? 0
        : direction === "last"
          ? payload.subjects.length - 1
          : (index + (direction === "next" ? 1 : -1) + payload.subjects.length) %
            payload.subjects.length;
    const nextSubject = payload.subjects[nextIndex];
    if (!nextSubject) return;
    selectSubject(nextSubject.id);
    subjectTabRefs.current[nextIndex]?.focus();
  }

  if (!subject || !selected) return null;

  const counts = countStates(subject);
  const ageBandStart = axisX(payload.ageRangeMonths[0], payload.axisMonths);
  const ageBandEnd = axisX(payload.ageRangeMonths[1], payload.axisMonths);
  const nodeById = new Map(subject.nodes.map((node) => [node.id, node]));

  return (
    <section
      aria-labelledby="abilities-explorer-heading"
      className="mt-8 rounded-xl border border-border-subtle bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--clay-600)]">
            {payload.childName}&apos;s learning map
          </p>
          <h2
            id="abilities-explorer-heading"
            className="mt-2 font-display text-4xl font-semibold leading-none tracking-[-0.025em] text-strong sm:text-5xl"
          >
            Abilities map
          </h2>
        </div>
        <div className="rounded-pill border border-[rgba(79,180,214,0.32)] bg-[var(--info-soft)] px-4 py-2 text-sm font-semibold text-[var(--sky-600)]">
          {payload.childName}&apos;s age · {ageLabel(payload.ageRangeMonths[0])} to {ageLabel(payload.ageRangeMonths[1])}
        </div>
      </div>

      <p className="mt-4 max-w-4xl text-base leading-7 text-body">
        <strong className="text-strong">Every dot is one ability.</strong> Left to right
        shows when an ability is usually introduced. The shaded band shows {payload.childName}&apos;s
        age range. Up and down only separates dots.
      </p>

      <div
        role="tablist"
        aria-label="Ability subjects"
        className="mt-6 flex gap-7 overflow-x-auto border-b border-border-subtle"
      >
        {payload.subjects.map((entry) => (
          <button
            key={entry.id}
            ref={(node) => {
              subjectTabRefs.current[payload.subjects.indexOf(entry)] = node;
            }}
            type="button"
            role="tab"
            aria-selected={entry.id === subjectId}
            tabIndex={entry.id === subjectId ? 0 : -1}
            onClick={() => selectSubject(entry.id)}
            onKeyDown={(event) => {
              const index = payload.subjects.indexOf(entry);
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveSubjectTab(index, "previous");
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveSubjectTab(index, "next");
              } else if (event.key === "Home") {
                event.preventDefault();
                moveSubjectTab(index, "first");
              } else if (event.key === "End") {
                event.preventDefault();
                moveSubjectTab(index, "last");
              }
            }}
            className="relative min-h-12 shrink-0 px-1 text-lg font-bold text-muted after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-[var(--text-strong)] after:transition-transform aria-selected:text-strong aria-selected:after:scale-x-100"
          >
            {entry.displayName}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-sm font-semibold text-strong">{subject.displayName}</p>
          <p className="mt-1 text-sm text-muted">
            {subject.nodes.length} abilities · {subject.edges.length} connections
          </p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <label htmlFor="abilities-find" className="sr-only">
            Find an ability
          </label>
          <select
            id="abilities-find"
            value={selected.id}
            onFocus={() =>
              sendAbilitiesExplorerEvent(
                "progress.explorer_find_opened",
                payload.childId,
                subject.id,
              )
            }
            onChange={(event) => selectNode(event.target.value)}
            className="min-h-11 w-full rounded-pill border border-border-subtle bg-card px-3.5 text-sm font-semibold text-strong sm:w-auto sm:max-w-[28rem]"
          >
            {subject.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <StatusKey childName={payload.childName} />

      <div
        id="abilities-graph"
        className="mt-4 overflow-x-auto rounded-lg border border-border-subtle bg-[var(--surface-raised)]"
      >
        <div className="min-w-[720px] p-2 sm:p-4">
          <svg
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            role="img"
            aria-labelledby="abilities-graph-title abilities-graph-description"
            className="block h-auto w-full"
          >
            <title id="abilities-graph-title">
              {`${subject.displayName} abilities map for ${payload.childName}`}
            </title>
            <desc id="abilities-graph-description">
              {subject.nodes.length} abilities connected by {subject.edges.length} prerequisite
              lines. The horizontal axis runs from age 4 to age 14. Green dots are known,
              gold dots are being worked on now, and quiet gray dots are up next.
            </desc>
            <rect
              x={ageBandStart}
              y={PLOT_TOP - 12}
              width={Math.max(8, ageBandEnd - ageBandStart)}
              height={PLOT_BOTTOM - PLOT_TOP + 24}
              rx="12"
              fill="var(--info-soft)"
            />
            <line
              x1={ageBandStart}
              x2={ageBandStart}
              y1={PLOT_TOP - 12}
              y2={PLOT_BOTTOM + 12}
              stroke="var(--sky-600)"
              strokeDasharray="7 7"
              strokeOpacity="0.6"
            />
            <line
              x1={ageBandEnd}
              x2={ageBandEnd}
              y1={PLOT_TOP - 12}
              y2={PLOT_BOTTOM + 12}
              stroke="var(--sky-600)"
              strokeDasharray="7 7"
              strokeOpacity="0.6"
            />
            <text
              x={(ageBandStart + ageBandEnd) / 2}
              y={PLOT_TOP - 18}
              textAnchor="middle"
              fill="var(--sky-600)"
              fontSize="14"
              fontWeight="700"
            >
              {payload.childName}&apos;s age range
            </text>

            {subject.edges.map((edge) => {
              const from = nodeById.get(edge.fromId);
              const to = nodeById.get(edge.toId);
              if (!from || !to) return null;
              const highlighted = selectedNeighbors.has(from.id) && selectedNeighbors.has(to.id);
              return (
                <line
                  key={`${edge.fromId}-${edge.toId}`}
                  x1={graphX(from)}
                  y1={graphY(from)}
                  x2={graphX(to)}
                  y2={graphY(to)}
                  stroke="var(--text-strong)"
                  strokeOpacity={highlighted ? 0.52 : 0.12}
                  strokeWidth={highlighted ? 2 : 1}
                />
              );
            })}

            {subject.nodes.map((node) => {
              const selectedNode = node.id === selected.id;
              const neighbor = selectedNeighbors.has(node.id);
              const quiet = !neighbor && !selectedNode;
              const fill = STATUS_META[node.state].fill;
              return (
                <g
                  key={node.id}
                  role="presentation"
                  onClick={() => selectNode(node.id)}
                  className="cursor-pointer"
                  opacity={quiet ? 0.48 : 1}
                >
                  <circle
                    cx={graphX(node)}
                    cy={graphY(node)}
                    r={selectedNode ? 18 : 12}
                    fill="transparent"
                    pointerEvents="all"
                  />
                  {selectedNode ? (
                    <circle
                      cx={graphX(node)}
                      cy={graphY(node)}
                      r="13"
                      fill="none"
                      stroke="var(--text-strong)"
                      strokeOpacity="0.35"
                      strokeWidth="2"
                    />
                  ) : null}
                  <circle
                    cx={graphX(node)}
                    cy={graphY(node)}
                    r={selectedNode ? 8 : neighbor ? 6 : 4.5}
                    fill={fill}
                    stroke={
                      node.state === "working_on_now"
                        ? "var(--gold-ink)"
                        : node.state === "up_next"
                          ? "var(--stone-500)"
                          : "var(--surface-card)"
                    }
                    strokeWidth={node.state === "up_next" ? 1.8 : 1.4}
                  />
                  <title>
                    {`${node.name}, ${STATUS_META[node.state].label}`}
                  </title>
                </g>
              );
            })}

            {(() => {
              const label =
                selected.name.length > 32
                  ? `${selected.name.slice(0, 31)}…`
                  : selected.name;
              const labelWidth = Math.min(270, Math.max(150, label.length * 8 + 28));
              const labelX = clamp(
                graphX(selected) + 18,
                PLOT_LEFT,
                PLOT_RIGHT - labelWidth,
              );
              const labelY = clamp(
                graphY(selected) - 44,
                PLOT_TOP + 4,
                PLOT_BOTTOM - 36,
              );
              return (
                <g pointerEvents="none">
                  <rect
                    x={labelX}
                    y={labelY}
                    width={labelWidth}
                    height="34"
                    rx="17"
                    fill="var(--surface-card)"
                    stroke="var(--border-strong)"
                  />
                  <text
                    x={labelX + 14}
                    y={labelY + 22}
                    fill="var(--text-strong)"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                </g>
              );
            })()}

            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={AXIS_Y}
              y2={AXIS_Y}
              stroke="var(--text-strong)"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
            {AXIS_TICKS.map((tick) => {
              const x = axisX(tick, payload.axisMonths);
              return (
                <g key={tick}>
                  <line
                    x1={x}
                    x2={x}
                    y1={AXIS_Y - 7}
                    y2={AXIS_Y + 7}
                    stroke="var(--text-strong)"
                    strokeOpacity="0.45"
                  />
                  <text
                    x={x}
                    y={AXIS_Y + 28}
                    textAnchor="middle"
                    fill="var(--text-subtle)"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {tick / 12}
                  </text>
                </g>
              );
            })}
            <text
              x={PLOT_LEFT}
              y={AXIS_Y - 17}
              fill="var(--text-strong)"
              fontSize="12"
              fontWeight="800"
              letterSpacing="1.2"
            >
              CURRICULUM AGE WINDOW
            </text>
          </svg>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-border-subtle bg-[var(--surface-raised)] p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold text-strong">Knows</p>
          <p className="mt-1 text-muted">{counts.knows} marked by a parent answer</p>
        </div>
        <div>
          <p className="font-semibold text-strong">Working on now</p>
          <p className="mt-1 text-muted">{counts.working_on_now} marked for practice</p>
        </div>
        <div>
          <p className="font-semibold text-strong">Up next</p>
          <p className="mt-1 text-muted">{counts.up_next} quiet or not there yet</p>
        </div>
      </div>

      <div className="mt-4 md:hidden">
        <button
          ref={openSelectedRef}
          type="button"
          onClick={() => selectNode(selected.id)}
          className="min-h-11 w-full rounded-pill bg-[var(--text-strong)] px-4 py-2 text-sm font-bold text-white"
        >
          Open selected ability
        </button>
      </div>

      <div className="mt-4 md:block">
        <AbilityDetail
          childId={payload.childId}
          payload={payload}
          subject={subject}
          selected={selected}
          onSelect={(id) => selectNode(id, true)}
          onClose={closeDetails}
          mobileOpen={mobileOpen}
        />
      </div>
    </section>
  );
}
