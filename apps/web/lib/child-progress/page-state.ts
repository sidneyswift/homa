import { buildChildProgressView } from "./projection";
import type { ChildProgressView } from "./types";

export type ChildProgressPageState =
  | { status: "ready"; view: ChildProgressView }
  | { status: "unavailable"; error: unknown };

/**
 * Keeps live-read failures on the Progress route and turns a legitimate
 * missing projection into the canonical empty live view.
 */
export async function loadChildProgressPageState(
  input: {
    familyId: string;
    child: {
      id: string;
      name: string;
      birthDate: string;
    };
    timeZone: string;
    now?: Date;
  },
  dependencies: {
    loadView(
      familyId: string,
      childId: string,
    ): Promise<ChildProgressView | null>;
  },
): Promise<ChildProgressPageState> {
  try {
    const view = await dependencies.loadView(
      input.familyId,
      input.child.id,
    );
    if (view !== null) return { status: "ready", view };
  } catch (error) {
    return { status: "unavailable", error };
  }

  return {
    status: "ready",
    view: buildChildProgressView({
      child: input.child,
      familyId: input.familyId,
      timeZone: input.timeZone,
      evidence: [],
      conflicts: [],
      selectionAnswers: [],
      now: input.now ?? new Date(),
    }),
  };
}
