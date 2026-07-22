import {
  MAP_SUBJECTS,
  getScorableItem,
  isTaxonomyScorable,
} from "@homa/core";
import { hardPrerequisiteClosure, readyTopics } from "@homa/taxonomy";

import type { ProgressEvidenceAnswer } from "./types";

/**
 * The abilities map's derivation layer (founder direction 2026-07-22:
 * the "video game" view, every demonstrated ability lit, next steps
 * glowing).
 *
 * Pure and synchronous: everything derives at read time from the same
 * effective evidence the projection already resolves, so there is no
 * new table, no migration, and nothing to reconcile. The taxonomy walk
 * has always computed implied prerequisites in memory and thrown them
 * away when the sitting ended; this module is that computation made
 * durable-at-read, plus the readiness frontier, for a parent-facing
 * surface.
 *
 * Semantics mirror the walk exactly (packages/taxonomy/src/walk.ts):
 *   - "easily" confirms a topic AND its transitive hard prerequisites.
 *   - An explicit answer always beats an implied confirmation: a topic
 *     the parent marked getting_there or not_yet is never counted
 *     confirmed, whatever the graph implies.
 *   - Ready-next is the graph's readiness frontier over the confirmed
 *     set: unconfirmed topics whose hard prerequisites are all met.
 *
 * Bank items participate as nodes (they light up like everything else)
 * but carry no graph edges, so implied/ready mechanics apply to
 * taxonomy topics only.
 */

export type AbilityState =
  | "mastered"
  | "emerging"
  | "not_yet"
  /** Never directly reported; implied by a mastered topic's hard
   *  prerequisite closure. Rendered dimmer than a reported ability and
   *  always superseded by any explicit answer. */
  | "implied";

export interface AbilityNode {
  itemId: string;
  /** Parent-plain name (bank statement or taxonomy topic name). */
  statement: string;
  subjectId: string;
  typicalMonths: number;
  state: AbilityState;
  /** Null for implied abilities, which nobody reported on a date. */
  observedAt: string | null;
}

export interface ReadyNextAbility {
  itemId: string;
  statement: string;
  subjectId: string;
  typicalMonths: number;
}

export interface SubjectAbilityMap {
  subjectId: string;
  displayName: string;
  /** Every lit node: reported (any answer) plus implied. Never the
   *  unexplored remainder; the map is a sky filling with stars, not a
   *  checklist of holes, and enumerating the dark is the never-behind
   *  law's job to prevent. */
  nodes: AbilityNode[];
  /** The readiness frontier, nearest the child's age first. */
  readyNext: ReadyNextAbility[];
  mastered: number;
  emerging: number;
  notYet: number;
  implied: number;
}

export interface AbilityEvidenceInput {
  itemId: string;
  answer: ProgressEvidenceAnswer;
  observedAt: string;
}

/** Ready-next stays a short, warm list, never a queue of obligations. */
const READY_NEXT_LIMIT = 5;

function stateForAnswer(answer: ProgressEvidenceAnswer): AbilityState {
  switch (answer) {
    case "easily":
      return "mastered";
    case "getting_there":
      return "emerging";
    case "not_yet":
      return "not_yet";
  }
}

/**
 * deriveAbilityMap(evidence, ageMonths): the whole map, one subject per
 * entry, subjects with nothing lit omitted entirely (an empty subject
 * is not a fact worth rendering). Evidence should be the EFFECTIVE set,
 * one row per item, as effective-evidence.ts resolves it.
 */
export function deriveAbilityMap(
  evidence: readonly AbilityEvidenceInput[],
  ageMonths: number,
): SubjectAbilityMap[] {
  // Explicit answers, one per item (last one wins if the caller passed
  // duplicates; effective evidence should already be unique per item).
  const explicit = new Map<string, AbilityEvidenceInput>();
  for (const entry of evidence) {
    if (getScorableItem(entry.itemId)) explicit.set(entry.itemId, entry);
  }

  // The confirmed set, walk semantics: easily topics plus their hard
  // closures, minus anything with a weaker explicit answer.
  const confirmed = new Set<string>();
  for (const [itemId, entry] of explicit) {
    if (entry.answer !== "easily") continue;
    confirmed.add(itemId);
    if (isTaxonomyScorable(itemId)) {
      for (const implied of hardPrerequisiteClosure(itemId)) {
        confirmed.add(implied);
      }
    }
  }
  for (const [itemId, entry] of explicit) {
    if (entry.answer !== "easily") confirmed.delete(itemId);
  }

  const bySubject = new Map<string, SubjectAbilityMap>();
  const subjectMap = (subjectId: string): SubjectAbilityMap => {
    let subject = bySubject.get(subjectId);
    if (!subject) {
      subject = {
        subjectId,
        displayName:
          MAP_SUBJECTS.find((entry) => entry.id === subjectId)
            ?.displayName ?? subjectId,
        nodes: [],
        readyNext: [],
        mastered: 0,
        emerging: 0,
        notYet: 0,
        implied: 0,
      };
      bySubject.set(subjectId, subject);
    }
    return subject;
  };

  // Reported nodes first: an explicit answer always owns its node.
  for (const [itemId, entry] of explicit) {
    const found = getScorableItem(itemId);
    if (!found) continue;
    const state = stateForAnswer(entry.answer);
    const subject = subjectMap(found.subject.id);
    subject.nodes.push({
      itemId,
      statement: found.item.statement,
      subjectId: found.subject.id,
      typicalMonths: found.item.typicalMonths,
      state,
      observedAt: entry.observedAt,
    });
    if (state === "mastered") subject.mastered += 1;
    else if (state === "emerging") subject.emerging += 1;
    else subject.notYet += 1;
  }

  // Implied nodes: confirmed by the graph, never reported directly.
  for (const topicId of confirmed) {
    if (explicit.has(topicId)) continue;
    const found = getScorableItem(topicId);
    if (!found) continue;
    const subject = subjectMap(found.subject.id);
    subject.nodes.push({
      itemId: topicId,
      statement: found.item.statement,
      subjectId: found.subject.id,
      typicalMonths: found.item.typicalMonths,
      state: "implied",
      observedAt: null,
    });
    subject.implied += 1;
  }

  // The readiness frontier, subject by subject, nearest the child's
  // age first so the list reads as "right about now" rather than a
  // ladder into the distance.
  for (const ready of readyTopics(confirmed)) {
    const found = getScorableItem(ready.topic.id);
    if (!found) continue;
    const explicitEntry = explicit.get(ready.topic.id);
    // An explicitly not-yet/emerging topic is already on the map with
    // its honest state; offering it again as "ready" would nag.
    if (explicitEntry) continue;
    const subject = bySubject.get(found.subject.id);
    // Ready-next only for subjects the child has already lit: a brand
    // new subject's first step belongs to check-ins and lessons, not a
    // wall of suggestions.
    if (!subject) continue;
    subject.readyNext.push({
      itemId: ready.topic.id,
      statement: found.item.statement,
      subjectId: found.subject.id,
      typicalMonths: found.item.typicalMonths,
    });
  }
  for (const subject of bySubject.values()) {
    subject.readyNext.sort(
      (left, right) =>
        Math.abs(left.typicalMonths - ageMonths) -
        Math.abs(right.typicalMonths - ageMonths),
    );
    subject.readyNext = subject.readyNext.slice(0, READY_NEXT_LIMIT);
    subject.nodes.sort((left, right) =>
      left.typicalMonths - right.typicalMonths ||
      left.itemId.localeCompare(right.itemId),
    );
  }

  return [...bySubject.values()].sort(
    (left, right) =>
      right.mastered + right.emerging + right.implied -
      (left.mastered + left.emerging + left.implied),
  );
}
