/**
 * When the idle suggestion chips may float on the voice screen: only
 * while the surface is genuinely quiet, and never again once a turn has
 * started this visit. Pure on purpose (the whisper-text.ts idiom): tsx
 * --test cannot import react-native, so the decision logic lives here
 * and suggestion-chips.tsx stays a view.
 */

/** An inviting whisper, not a menu: never more than three chips. */
export const MAX_SUGGESTION_CHIPS = 3;

export interface SuggestionChipsInputs {
  /** A turn has started at some point this visit; once true the chips
   *  stay retired until the screen remounts. */
  retired: boolean;
  turnActive: boolean;
  composerEmpty: boolean;
  /** Any overlay signal is up (sheet or receipt). */
  overlayOpen: boolean;
  /** Homa has already said something this visit. */
  assistantHasReplied: boolean;
}

export function suggestionChipsVisible(inputs: SuggestionChipsInputs): boolean {
  return (
    !inputs.retired &&
    !inputs.turnActive &&
    inputs.composerEmpty &&
    !inputs.overlayOpen &&
    !inputs.assistantHasReplied
  );
}

/** The chips shown: the first few of the shared list, in chat's order. */
export function idleSuggestions(
  all: readonly string[],
): readonly string[] {
  return all.slice(0, MAX_SUGGESTION_CHIPS);
}
