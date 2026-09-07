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
import { abilityQuestion, abilityQuestionHref } from "../../lib/child-progress/ability-question";
import { formatProgressDate, progressEvidenceDerivationLabel } from "../../lib/child-progress/view-copy";
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
  { label: string; color: string; fill: string }
> = {
  knows: { label: "Easily", color: "var(--sage-700)", fill: "var(--sage-700)" },
  working_on_now: { label: "Getting there", color: "var(--gold-ink)", fill: "var(--gold-400)" },
  unobserved: { label: "Not observed", color: "var(--text-muted)", fill: "var(--surface-card)" },
  not_yet: { label: "Not yet", color: "var(--text-muted)", fill: "var(--stone-400)" },
  conflict: { label: "Different observations", color: "var(--sky-600)", fill: "var(--info-soft)" },
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

function StatusDot({ state }: { state: AbilitiesExplorerDisplayState }) {
  return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
    style={{ background: STATUS_META[state].fill, borderColor: STATUS_META[state].color,
      borderStyle: state === "conflict" ? "dashed" : "solid" }} />;
}

function evidenceLine(node: AbilitiesExplorerNode, childName: string): string {
  if (node.evidence.conflict) return "Saved observations differ. Homa has not settled on one answer.";
  if (node.evidence.answer === null) return `No observation is saved for ${childName} doing this. That does not tell us whether it is easy or not yet.`;
  if (node.evidence.answer === "not_yet") return "The saved answer is Not yet. This is an observation, not a missing answer or a next-lesson assignment.";
  return "This is the saved answer. Its source and date tell you what it is based on.";
}

function formatObservedAt(value: string | null, timeZone: string): string | null {
  return value === null ? null : formatProgressDate(value, timeZone);
}

function countStates(subject: AbilitiesExplorerSubject) {
  return subject.nodes.reduce(
    (counts, node) => {
      counts[node.state] += 1;
      return counts;
    },
    { knows: 0, working_on_now: 0, unobserved: 0, not_yet: 0, conflict: 0 },
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
        No connections are listed for this ability in this subject map.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {buildsOn.length > 0 ? (
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Builds on
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {buildsOn.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id, "connected")}
                className="min-h-11 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-3.5 py-2 text-left text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                {node.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {leadsTo.length > 0 ? (
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-subtle">
            Other abilities that build on this
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {leadsTo.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id, "connected")}
                className="min-h-11 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-3.5 py-2 text-left text-sm font-semibold text-strong transition-colors hover:border-brand"
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
  const status = STATUS_META[selected.state];
  const observedAt = formatObservedAt(selected.evidence.observedAt, payload.timeZone);
  const question = abilityQuestion(payload.childName, selected.name);

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
          ? "fixed inset-x-3 bottom-3 z-40 max-h-[78vh] overflow-y-auto rounded-xl border border-border-subtle bg-card p-5 shadow-[0_24px_70px_rgba(32,36,43,0.22)] md:static md:max-h-none md:overflow-visible md:rounded-lg md:border-border-subtle md:p-6 md:shadow-sm"
          : "hidden rounded-lg border border-border-subtle bg-card p-6 shadow-sm md:block"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--clay-600)]">
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
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[var(--homa-radius-control)] px-3.5 py-2 text-sm font-bold"
          style={{ background: "var(--accent-sage-soft)", color: status.color }}
        >
          <StatusDot state={selected.state} />
          {status.label}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {evidenceLine(selected, payload.childName)}
        </p>
        {selected.evidence.answer !== null ? (
          <p className="mt-2 text-sm font-medium text-body">
            {progressEvidenceDerivationLabel(selected.evidence.derivation ?? "unknown")}
          </p>
        ) : null}
        {selected.evidence.conflictingAnswers.map((answer, index) => (
          <p key={index} className="mt-2 text-sm leading-6 text-body">
            {answer.answer === "easily" ? "Easily" : answer.answer === "getting_there" ? "Getting there" : "Not yet"}
            {" · "}{progressEvidenceDerivationLabel(answer.derivation)}
            {" · "}{formatObservedAt(answer.observedAt, payload.timeZone) ?? "Date unavailable"}
          </p>
        ))}
        {selected.evidence.source || observedAt ? (
          <p className="mt-2 text-xs font-medium text-subtle">
            {[selected.evidence.source, observedAt ? `${selected.evidence.conflict ? "Conflict noted" : "Saved"} ${observedAt}` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">Browse abilities</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => onSelect(subject.nodes[selectedIndex - 1]?.id ?? selected.id)}
            className="min-h-11 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-3 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
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
            className="min-h-11 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-3 text-sm font-semibold text-strong transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">Connections</p>
        <p className="mt-2 text-sm leading-6 text-muted">These are curriculum relationships. A line does not show what {payload.childName} has mastered or unlock a personal lesson sequence.</p>
        <Connections selected={selected} subject={subject} onSelect={onSelect} />
      </div>

      <div className="mt-5 border-t border-border-subtle pt-5">
        <p className="text-sm font-semibold text-strong">Your question for Homa</p>
        <p className="mt-2 mb-3 text-sm leading-6 text-body">{question}</p>
        <ProgressChatDoor
          key={`${childId}:${selected.id}`}
          childId={childId}
          destination={abilityQuestionHref(childId, selected.id)}
          variant="secondary"
          onOpen={async () => {
            sendAbilitiesExplorerEvent(
              "progress.explorer_ask_homa_opened",
              childId,
              subject.id,
            );
            if (!await setAbilityContextAction(childId, selected.id)) throw new Error("Ability focus unavailable");
          }}
        >
          Ask Homa about this ability
        </ProgressChatDoor>
        <p className="mt-2 text-xs leading-5 text-subtle">
          The question opens in chat. You can edit it before sending. Nothing here records progress.
        </p>
      </div>
    </aside>
  );
}

function StatusKey({ childName }: { childName: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border-subtle py-3 text-sm">
      <span className="font-semibold text-strong">{childName}&apos;s progress</span>
      {(Object.keys(STATUS_META) as AbilitiesExplorerDisplayState[]).map((state) => (
        <span key={state} className="inline-flex items-center gap-2 font-semibold text-muted">
          <StatusDot state={state} />
          {STATUS_META[state].label}
        </span>
      ))}
      <span className="basis-full text-xs leading-5 text-subtle">
        Select a dot to see the saved answer, its source and date. Logging time or finishing a worksheet alone does not change an ability.
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
  const ageWithinAxis = payload.ageMonths >= payload.axisMonths[0] && payload.ageMonths < payload.axisMonths[1];
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
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.15em] text-[var(--clay-600)]">
            {payload.childName}&apos;s learning map
          </p>
          <h2
            id="abilities-explorer-heading"
            className="mt-2 font-display text-4xl font-semibold leading-none tracking-[-0.025em] text-strong sm:text-5xl"
          >
            Abilities map
          </h2>
        </div>
        <div className="rounded-[var(--homa-radius-control)] border border-[rgba(79,180,214,0.32)] bg-[var(--info-soft)] px-4 py-2 text-sm font-semibold text-[var(--sky-600)]">
          {payload.childName}&apos;s age · {Math.floor(payload.ageMonths / 12)} {Math.floor(payload.ageMonths / 12) === 1 ? "year" : "years"} {payload.ageMonths % 12} {payload.ageMonths % 12 === 1 ? "month" : "months"}
        </div>
      </div>

      <p className="mt-4 max-w-4xl text-base leading-7 text-body">
        <strong className="text-strong">Every dot is one ability.</strong> Left to right
        shows the middle of each ability&apos;s usual teaching-age window. Up and down only separates dots.
        {ageWithinAxis ? ` The shaded year contains ${payload.childName}'s chronological age, not an assessed level.` : ` ${payload.childName}'s age is outside this age 4 to age 14 chart, so no age band is shown.`}
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
            className="min-h-11 w-full rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-3.5 text-sm font-semibold text-strong sm:w-auto sm:max-w-[28rem]"
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
              lines. The horizontal axis runs from age 4 to age 14. Dots distinguish Easily,
              Getting there, Not observed, Not yet and Different observations. Select an ability to read its evidence.
            </desc>
            {ageWithinAxis ? <g>
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
              stroke="var(--info)"
              strokeDasharray="7 7"
              strokeOpacity="0.6"
            />
            <line
              x1={ageBandEnd}
              x2={ageBandEnd}
              y1={PLOT_TOP - 12}
              y2={PLOT_BOTTOM + 12}
              stroke="var(--info)"
              strokeDasharray="7 7"
              strokeOpacity="0.6"
            />
            <text
              x={(ageBandStart + ageBandEnd) / 2}
              y={PLOT_TOP - 18}
              textAnchor="middle"
              fill="var(--info)"
              fontSize="14"
              fontWeight="700"
            >
              {payload.childName}&apos;s chronological age
            </text>
            </g> : null}

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
                        : node.state === "unobserved"
                          ? "var(--stone-500)"
                          : "var(--surface-card)"
                    }
                    strokeWidth={node.state === "unobserved" ? 1.8 : 1.4}
                    strokeDasharray={node.state === "conflict" ? "3 2" : undefined}
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

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border-subtle pt-4 text-sm sm:grid-cols-5">
        {(Object.keys(STATUS_META) as AbilitiesExplorerDisplayState[]).map((state) => (
          <div key={state}>
            <dt className="font-semibold text-strong">{STATUS_META[state].label}</dt>
            <dd className="mt-1 tabular-nums text-muted">{counts[state]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 md:hidden">
        <button
          ref={openSelectedRef}
          type="button"
          onClick={() => selectNode(selected.id)}
          className="min-h-11 w-full rounded-[var(--homa-radius-control)] bg-[var(--text-strong)] px-4 py-2 text-sm font-bold text-white"
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
          onSelect={(id, reason) => selectNode(id, true, reason)}
          onClose={closeDetails}
          mobileOpen={mobileOpen}
        />
      </div>
    </section>
  );
}
