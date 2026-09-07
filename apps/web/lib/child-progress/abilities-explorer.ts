import {
  MAP_SUBJECTS,
  type MapSubject,
} from "@homa/core";
import {
  allPrerequisiteEdges,
  allTopics,
  getTaxonomyDomain,
  type TaxonomyTopic,
} from "@homa/taxonomy";
import { createHash } from "node:crypto";

import type { ChildProgressView, ProgressTopicView } from "./types";
import {
  ABILITIES_EXPLORER_SUBJECTS,
  type AbilitiesExplorerDisplayState,
  type AbilitiesExplorerEvidence,
  type AbilitiesExplorerNode,
  type AbilitiesExplorerPayload,
  type AbilitiesExplorerSubject,
  type AbilitiesExplorerSubjectId,
} from "./abilities-explorer-types";
import { ageInMonths } from "../child-age";
import { zonedDateString } from "../time-zone";

const AXIS_MONTHS = [48, 168] as const;
const SUBJECT_DISPLAY_NAMES: Record<AbilitiesExplorerSubjectId, string> = {
  math: "Math",
  literacy: "Literacy",
  science: "Science",
};

interface CatalogNode {
  id: string;
  name: string;
  description: string;
  subjectId: AbilitiesExplorerSubjectId;
  domainId: string;
  domainName: string;
  teachingWindowMonths: readonly [number, number];
}

export interface AbilitiesExplorerCatalogAbility {
  id: string;
  name: string;
  subjectId: AbilitiesExplorerSubjectId;
  domainName: string;
}

interface ProgressSignal {
  answer: ProgressTopicView["answer"];
  source: string | null;
  observedAt: string | null;
  conflict: boolean;
  derivation: AbilitiesExplorerEvidence["derivation"];
  conflictingAnswers: AbilitiesExplorerEvidence["conflictingAnswers"];
}

function isExplorerSubject(
  subject: string,
): subject is AbilitiesExplorerSubjectId {
  return (ABILITIES_EXPLORER_SUBJECTS as readonly string[]).includes(subject);
}

function stableUnit(id: string, salt: string): number {
  const digest = createHash("sha256")
    .update(`${salt}:${id}`)
    .digest();
  return digest.readUInt32BE(0) / 0xffffffff;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function midpoint(window: readonly [number, number]): number {
  return (window[0] + window[1]) / 2;
}

function xFor(window: readonly [number, number]): number {
  const center = clamp(midpoint(window), AXIS_MONTHS[0], AXIS_MONTHS[1]);
  return (center - AXIS_MONTHS[0]) / (AXIS_MONTHS[1] - AXIS_MONTHS[0]);
}

function sourceLabel(topic: ProgressTopicView): string | null {
  if (topic.source === null) return null;
  return topic.detail;
}

function stateForAnswer(
  answer: ProgressTopicView["answer"],
): AbilitiesExplorerDisplayState {
  switch (answer) {
    case "easily":
      return "knows";
    case "getting_there":
      return "working_on_now";
    case "not_yet":
      return "not_yet";
    case null:
      return "unobserved";
  }
}

function mapProgressSignals(view: ChildProgressView): Map<string, ProgressSignal> {
  const signals = new Map<string, ProgressSignal>();
  for (const subject of view.subjects) {
    for (const domain of subject.domains) {
      for (const topic of domain.topics) {
        if (topic.state === "conflict") {
          signals.set(topic.itemId, {
            answer: null,
            source: null,
            observedAt: topic.observedAt,
            conflict: true,
            derivation: null,
            conflictingAnswers: view.conflicts.find((conflict) => conflict.itemId === topic.itemId)?.adultAnswers.map((answer) => ({
              answer: answer.answer, derivation: answer.source.derivation, observedAt: answer.observedAt,
            })) ?? [],
          });
          continue;
        }
        signals.set(topic.itemId, {
          answer: topic.answer,
          source: sourceLabel(topic),
          observedAt: topic.observedAt,
          conflict: false,
          derivation: topic.source?.derivation ?? null,
          conflictingAnswers: [],
        });
      }
    }
  }
  return signals;
}

function taxonomyCatalogNodes(): CatalogNode[] {
  return allTopics().flatMap((topic: TaxonomyTopic) => {
    if (!isExplorerSubject(topic.subject)) return [];
    const domain = getTaxonomyDomain(topic.domain);
    if (domain === undefined || domain.kind !== "assessment") return [];
    const subjectId = topic.subject as AbilitiesExplorerSubjectId;
    return [{
      id: topic.id,
      name: topic.name,
      description: topic.description,
      subjectId,
      domainId: topic.domain,
      domainName: domain.displayName,
      teachingWindowMonths: topic.teachingWindowMonths,
    }];
  });
}

function bankCatalogNodes(): CatalogNode[] {
  return MAP_SUBJECTS.flatMap((subject: MapSubject) => {
    if (!isExplorerSubject(subject.id)) return [];
    const subjectId = subject.id as AbilitiesExplorerSubjectId;
    return subject.items.map((item) => ({
      id: item.id,
      name: item.statement,
      description: item.statement,
      subjectId,
      domainId: subject.id,
      domainName: subject.displayName,
      teachingWindowMonths: [item.typicalMonths, item.typicalMonths + 12] as const,
    }));
  });
}

function catalogNodes(): CatalogNode[] {
  const byId = new Map<string, CatalogNode>();
  for (const node of [...taxonomyCatalogNodes(), ...bankCatalogNodes()]) {
    if (!byId.has(node.id)) byId.set(node.id, node);
  }
  return [...byId.values()].sort((left, right) =>
    left.subjectId.localeCompare(right.subjectId) ||
    left.domainName.localeCompare(right.domainName) ||
    midpoint(left.teachingWindowMonths) - midpoint(right.teachingWindowMonths) ||
    left.id.localeCompare(right.id),
  );
}

export function findAbilitiesExplorerAbility(
  id: string,
): AbilitiesExplorerCatalogAbility | null {
  const node = catalogNodes().find((candidate) => candidate.id === id);
  return node
    ? {
        id: node.id,
        name: node.name,
        subjectId: node.subjectId,
        domainName: node.domainName,
      }
    : null;
}

function buildNode(
  catalog: CatalogNode,
  signals: ReadonlyMap<string, ProgressSignal>,
): AbilitiesExplorerNode {
  const signal = signals.get(catalog.id);
  const answer = signal?.answer ?? null;
  return {
    ...catalog,
    x: xFor(catalog.teachingWindowMonths),
    // Vertical position is visual separation only. It deliberately does not
    // encode a second measure, a domain rank, or a child's performance.
    y: 0.08 + stableUnit(catalog.id, "abilities-y") * 0.84,
    state: signal?.conflict ? "conflict" : stateForAnswer(answer),
    evidence: {
      answer,
      derivation: signal?.derivation ?? null,
      conflictingAnswers: signal?.conflictingAnswers ?? [],
      source: signal?.source ?? null,
      observedAt: signal?.observedAt ?? null,
      conflict: signal?.conflict ?? false,
    },
  };
}

function buildSubject(
  subjectId: AbilitiesExplorerSubjectId,
  catalog: readonly CatalogNode[],
  signals: ReadonlyMap<string, ProgressSignal>,
): AbilitiesExplorerSubject {
  const nodes = catalog
    .filter((node) => node.subjectId === subjectId)
    .map((node) => buildNode(node, signals));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = allPrerequisiteEdges()
    .filter(
      (edge) =>
        edge.strength === "hard" &&
        nodeIds.has(edge.prerequisiteId) &&
        nodeIds.has(edge.topicId),
    )
    .map((edge) => ({ fromId: edge.prerequisiteId, toId: edge.topicId }))
    .sort(
      (left, right) =>
        left.fromId.localeCompare(right.fromId) ||
        left.toId.localeCompare(right.toId),
    );
  return {
    id: subjectId,
    displayName: SUBJECT_DISPLAY_NAMES[subjectId],
    nodes,
    edges,
  };
}

function ageRangeFor(ageMonths: number): readonly [number, number] {
  const start = clamp(Math.floor(ageMonths / 12) * 12, AXIS_MONTHS[0], 156);
  return [start, Math.min(start + 12, AXIS_MONTHS[1])] as const;
}

/**
 * Builds the complete, read-only graph and overlays the already validated
 * Progress projection. The catalog has no family or child data, and the
 * overlay only accepts the projection's known item ids. Missing observations,
 * explicit not-yet answers and conflicts remain distinct. Saved evidence keeps
 * its date and provenance; this view does not decay or infer a score.
 */
export function buildAbilitiesExplorerPayload(
  view: ChildProgressView,
  now: Date,
): AbilitiesExplorerPayload {
  const signals = mapProgressSignals(view);
  const catalog = catalogNodes();
  const localDate = zonedDateString(now, view.timeZone);
  const ageMonths = Math.max(0, ageInMonths(view.birthDate, new Date(`${localDate}T12:00:00.000Z`)));
  return {
    childId: view.childId,
    childName: view.childName,
    timeZone: view.timeZone,
    ageMonths,
    axisMonths: AXIS_MONTHS,
    ageRangeMonths: ageRangeFor(ageMonths),
    subjects: ABILITIES_EXPLORER_SUBJECTS.map((subjectId) =>
      buildSubject(subjectId, catalog, signals),
    ),
  };
}
