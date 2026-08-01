import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  armVoiceActionThenMutate,
  NON_UNDOABLE_VOICE_EFFECTS,
  voiceActionCandidatesAreAmbiguous,
  voiceActionEffectSchema,
} from "./action-receipts";

describe("Voice action receipt contract", () => {
  it("treats two effects in one turn as ambiguous", () => {
    assert.equal(
      voiceActionCandidatesAreAmbiguous(
        { turnId: "turn-1", createdAt: "2026-08-01T12:00:01.000Z" },
        { turnId: "turn-1", createdAt: "2026-08-01T12:00:00.000Z" },
      ),
      true,
    );
  });

  it("does not confuse actions far apart in the same session", () => {
    assert.equal(
      voiceActionCandidatesAreAmbiguous(
        { turnId: "turn-2", createdAt: "2026-08-01T12:10:00.000Z" },
        { turnId: "turn-1", createdAt: "2026-08-01T12:00:00.000Z" },
      ),
      false,
    );
  });

  it("keeps irreversible effects out of the compensator enum", () => {
    for (const effect of NON_UNDOABLE_VOICE_EFFECTS) {
      assert.equal(voiceActionEffectSchema.safeParse(effect).success, false);
    }
  });

  it("does not run a mutation when receipt arming fails", async () => {
    let mutated = false;
    await assert.rejects(
      armVoiceActionThenMutate({
        familyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        record: async () => {
          throw new Error("receipt store unavailable");
        },
        mutate: async () => {
          mutated = true;
        },
        replay: async () => undefined,
        succeeded: () => true,
      }),
      /receipt store unavailable/u,
    );
    assert.equal(mutated, false);
  });

  it("cancels an armed receipt when the mutation reports failure", async () => {
    let committed = false;
    let cancelled = false;
    const result = await armVoiceActionThenMutate({
      familyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      record: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        familyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        runtimeSessionId: "voice-test",
        turnId: "turn-test",
        objectKind: "hours_entry",
        objectId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        effect: "hours.logged",
        namedEffect: "logging math time",
        undoCapability: "exact_delete",
        lifecycleStatus: "pending",
        createdAt: "2026-08-01T12:00:00.000Z",
        expiresAt: "2026-08-01T12:10:00.000Z",
        undoneAt: null,
      }),
      mutate: async () => ({ ok: false }),
      replay: async () => ({ ok: true }),
      succeeded: (mutation) => mutation.ok,
      commit: async (receipt) => {
        committed = true;
        return receipt;
      },
      cancel: async () => {
        cancelled = true;
      },
    });

    assert.equal(result.result.ok, false);
    assert.equal(committed, false);
    assert.equal(cancelled, true);
  });
});
