import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveCharacterState,
  type CharacterInputs,
  type CharacterState,
} from "./character-state";

/**
 * The full truth table for the character's state, one row per input
 * combination, so precedence (speaking over thinking over listening
 * over idle) is pinned rather than implied.
 */
const CASES: readonly {
  name: string;
  inputs: CharacterInputs;
  expected: CharacterState;
}[] = [
  {
    name: "nothing happening reads as idle",
    inputs: {
      composerFocused: false,
      turnActive: false,
      assistantTextStreaming: false,
    },
    expected: "idle",
  },
  {
    name: "a focused composer alone reads as listening",
    inputs: {
      composerFocused: true,
      turnActive: false,
      assistantTextStreaming: false,
    },
    expected: "listening",
  },
  {
    name: "an active turn with no stream yet reads as thinking",
    inputs: {
      composerFocused: false,
      turnActive: true,
      assistantTextStreaming: false,
    },
    expected: "thinking",
  },
  {
    name: "an active turn outranks a still-focused composer",
    inputs: {
      composerFocused: true,
      turnActive: true,
      assistantTextStreaming: false,
    },
    expected: "thinking",
  },
  {
    name: "streaming text reads as speaking",
    inputs: {
      composerFocused: false,
      turnActive: true,
      assistantTextStreaming: true,
    },
    expected: "speaking",
  },
  {
    name: "streaming outranks everything at once",
    inputs: {
      composerFocused: true,
      turnActive: true,
      assistantTextStreaming: true,
    },
    expected: "speaking",
  },
  {
    name: "streaming wins even if the turn flag has already dropped",
    inputs: {
      composerFocused: false,
      turnActive: false,
      assistantTextStreaming: true,
    },
    expected: "speaking",
  },
  {
    name: "streaming wins over a focused composer with no turn flag",
    inputs: {
      composerFocused: true,
      turnActive: false,
      assistantTextStreaming: true,
    },
    expected: "speaking",
  },
];

describe("deriveCharacterState", () => {
  for (const { name, inputs, expected } of CASES) {
    it(name, () => {
      assert.equal(deriveCharacterState(inputs), expected);
    });
  }
});
