/**
 * All of onboarding v2's answers, held on device only. No backend: no
 * anonymous auth, no writes to child_answers or families.context. The
 * council review's own v2.0 definition (docs/homa-planning/plans/
 * 2026-09-07-onboarding-v2-council-review.md, section 2 "Lab staging"):
 * the complete flow, real @homa/core scoring and planning computed here on
 * device, three slots sample-stamped. Wiring this to the real anonymous-
 * auth server contract is v2.1, out of scope for this lab.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MapAnswer } from "@homa/core";

import { withChildInterests } from "./interest-options";

export type Relationship = "Mom" | "Dad" | "Grandparent" | "Someone else";
export type HomeschoolStatus = "already" | "starting" | "exploring";
export type HardestNow =
  | "schedule"
  | "on-track"
  | "materials"
  | "juggling"
  | "little-one"
  | "hours"
  | "all-of-it";
export type LessonMinutes = 10 | 20 | 30 | 45;
export type SchoolDay = 1 | 2 | 3 | 4 | 5; // Mon..Fri

export interface V2Kid {
  id: string;
  name: string;
  birthMonth: number; // 1-12
  birthYear: number;
  interests?: string[];
}

/** One answered ladder item, in the shape @homa/core's scoreMap expects. */
export interface V2Answer {
  itemId: string;
  answer: MapAnswer;
}

export interface V2State {
  // "You and your kids"
  kids: V2Kid[];
  parentName: string;
  parentLastName: string;
  /** Defaults to the parent's last name; the UI adds "The" and "family". */
  familyName: string;
  relationship: Relationship | null;
  usState: string | null; // two-letter, or null for "outside the US"
  homeschoolStatus: HomeschoolStatus | null;
  hardestNow: HardestNow[];
  // Curriculum and the first child
  curriculumTags: string[];
  curriculumStatus: "have-it" | "still-looking" | "building-own" | null;
  firstChildId: string | null;
  startWithSubjectId: string | null;
  lessonMinutes: LessonMinutes | null;
  // Questionnaire
  answers: Record<string, V2Answer>; // keyed by itemId
  // Building
  schoolDays: SchoolDay[];
  // Funnel
  notificationsGranted: boolean | null;
  reminderHour: number | null;
  howFoundUs: string | null;
}

const INITIAL_STATE: V2State = {
  kids: [],
  parentName: "",
  parentLastName: "",
  familyName: "",
  relationship: null,
  usState: null,
  homeschoolStatus: null,
  hardestNow: [],
  curriculumTags: [],
  curriculumStatus: null,
  firstChildId: null,
  startWithSubjectId: null,
  lessonMinutes: null,
  answers: {},
  schoolDays: [1, 2, 3, 4, 5],
  notificationsGranted: null,
  reminderHour: null,
  howFoundUs: null,
};

interface V2ContextValue {
  state: V2State;
  update: <K extends keyof V2State>(key: K, value: V2State[K]) => void;
  addKid: (kid: Omit<V2Kid, "id">) => string;
  setAnswer: (itemId: string, answer: MapAnswer) => void;
  setChildInterests: (childId: string, interests: string[]) => void;
  firstChild: V2Kid | null;
  reset: () => void;
}

const V2Context = createContext<V2ContextValue | null>(null);

let kidCounter = 0;

export function OnboardingV2Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<V2State>(INITIAL_STATE);

  const update = useCallback(
    <K extends keyof V2State>(key: K, value: V2State[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addKid = useCallback((kid: Omit<V2Kid, "id">) => {
    kidCounter += 1;
    const id = `v2kid_${kidCounter}`;
    setState((prev) => ({
      ...prev,
      kids: [...prev.kids, { ...kid, id }],
      firstChildId: prev.firstChildId ?? id,
    }));
    return id;
  }, []);

  const setAnswer = useCallback((itemId: string, answer: MapAnswer) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [itemId]: { itemId, answer } },
    }));
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const setChildInterests = useCallback((childId: string, interests: string[]) => {
    setState((prev) => ({ ...prev, kids: withChildInterests(prev.kids, childId, interests) }));
  }, []);

  const firstChild = useMemo(
    () => state.kids.find((kid) => kid.id === state.firstChildId) ?? state.kids[0] ?? null,
    [state.kids, state.firstChildId],
  );

  const value = useMemo(
    () => ({ state, update, addKid, setAnswer, setChildInterests, firstChild, reset }),
    [state, update, addKid, setAnswer, setChildInterests, firstChild, reset],
  );

  return <V2Context.Provider value={value}>{children}</V2Context.Provider>;
}

export function useOnboardingV2(): V2ContextValue {
  const ctx = useContext(V2Context);
  if (!ctx) {
    throw new Error("useOnboardingV2 must be used inside OnboardingV2Provider");
  }
  return ctx;
}

/** Birth month/year -> age in months, the precision @homa/core's scorer needs. */
export function ageInMonthsFromParts(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const months =
    (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth);
  return Math.max(0, months);
}
