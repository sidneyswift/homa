/**
 * Age-tuned suggestion chips for a kid's interests and help-with
 * questions, shared by onboarding's extras step and the settings kid
 * editor so both surfaces offer the same vocabulary.
 */

export function interestSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 96) {
    return ["dinosaurs", "horses", "space", "princesses", "trucks", "bugs", "ocean", "drawing", "music", "animals"];
  }
  return ["sports", "music", "gaming", "drawing", "reading", "animals", "building things", "science", "cooking", "fashion"];
}

export function helpSuggestions(ageMonths: number): readonly string[] {
  if (ageMonths < 60) {
    return ["letters", "counting", "writing their name", "scissors", "colors and shapes", "calm-down skills"];
  }
  if (ageMonths < 96) {
    return ["reading", "handwriting", "math", "focus", "science curiosity", "confidence"];
  }
  return ["reading", "writing", "math", "focus", "study habits", "confidence"];
}
