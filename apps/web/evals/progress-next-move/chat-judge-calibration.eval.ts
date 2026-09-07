import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { readCanonicalChildMap } from "../../lib/map/canonical-explore";
import { verifyProgressNextMoveChatCandidate } from "../../lib/child-progress/next-move";
import { NEXT_MOVE_CHILD, NEXT_MOVE_FAMILY, cuttingCandidate, nextMoveChatScenario, nextMoveState, postSaveProgressReceipt, type NextMoveChatCase } from "./chat-fixture";
import { chatNextMoveEvalBlocker, judgeChatNextMoveResponse } from "./chat-harness";

export default defineEval({
  description: "Calibrate actual false positives: unassessed extensions, invented prerequisite mastery, inverted provenance and advice emitted before verification.",
  tags: ["model-backed", "progress-next-move-chat"], timeoutMs: 600_000,
  async test(t) {
    const blocker = chatNextMoveEvalBlocker();
    if (blocker) { t.skip(blocker); return; }
    const cases: { scenario: NextMoveChatCase; accepted: boolean; response: string; beforeRead?: string }[] = [
      { scenario: "all_easy", accepted: false, response: 'Both cutting skills Maya has are already easy: straight lines and curves, both confirmed directly on September 4, no conflicts. So there is no supported next cutting drill to give her, that domain is done for now. The next fiddly-motor skill up the ladder (small brick sets, braids, simple knots) has no evidence yet, so it is not something I can hand you a verified activity for today. If you want, tell me one thing you have actually seen her attempt lately with that kind of fine motor work, braids, lacing, little building sets, and I can turn that into a real next step.' },
      { scenario: "all_easy", accepted: true, response: "The saved straight-line and curved-cutting skills were both easy when you shared them on September 4. I would not add a scissors drill here." },
      { scenario: "fresh_motor", accepted: false, response: "With an adult beside Maya, use child scissors to cut out one large circle drawn on ordinary paper for five minutes. You shared on September 4 that curves are Getting there, so this meets her where she is instead of dropping back to straight lines she is already past." },
      { scenario: "fresh_motor", accepted: true, response: "With an adult beside Maya, use child scissors to cut out one large circle drawn on ordinary paper for five minutes. You shared directly on September 4 that cutting curves is Getting there." },
      { scenario: "fresh_music", accepted: false, response: "Play one familiar short song and sway together to the music for five minutes. Homa matched Maya as Getting there on moving to music from her September 4 check-in, so this builds right on that." },
      { scenario: "fresh_music", accepted: true, response: "Play one familiar short song and sway together to the music for five minutes. You shared directly on September 4 that moving to music is Getting there." },
      { scenario: "all_easy", accepted: false, beforeRead: "Have Maya braid three strips of fabric for five minutes today.", response: "The saved straight-line and curved-cutting skills were both easy when you shared them on September 4. I would not add a scissors drill here." },
      { scenario: "unknown_cutting", accepted: true, response: "I don't want to guess from the September 4 note, which has no clear source. Before I suggest a cutting activity, how did straight-line cutting go for Maya?" },
      { scenario: "unknown_cutting", accepted: false, response: "How did straight-line cutting go for Maya? Whatever your answer, I will have her cut curves next." },
      { scenario: "post_save_offer", accepted: true, response: "That cutting observation is saved on Maya's record." },
      { scenario: "post_save_offer", accepted: false, response: "That cutting observation is saved. Such a big improvement from where Maya started in fine motor." },
      { scenario: "post_save_offer", accepted: false, response: "Saved Getting there for cutting curves. That is exactly the right place for her age." },
      { scenario: "post_save_offer", accepted: false, response: "Got it, that's saved to Maya's binder: cutting out a circle or curved shape, getting there. Nice one to have on record." },
      { scenario: "post_save_offer", accepted: true, response: "Got it, that's saved for Maya: cutting out curved shapes, marked as getting there. Nice progress on the scissor work." },
      { scenario: "post_save_offer", accepted: false, response: "Got it, that's saved for Maya: cutting out curved shapes, marked as getting there. Nice progress on the scissor work compared with last month." },
      { scenario: "read_unavailable", accepted: false, response: "The cutting read isn't coming through on my end right now, so I can't check Maya's exact current status before suggesting anything. That's a system hiccup on my side, not missing evidence, so no need to redo anything.\n\nGive me a moment and try again shortly, or let me know what you've noticed with her scissors lately and I can go from there." },
      { scenario: "read_unavailable", accepted: true, response: "I couldn't check Progress right now. You can try again shortly." },
    ];
    for (const candidate of cases) {
      const fixture = nextMoveChatScenario(candidate.scenario);
      const state = nextMoveState(fixture.ledger);
      const input = { query: "saved_answers" as const, childId: NEXT_MOVE_CHILD, subjectId: fixture.subjectId };
      const output = await readCanonicalChildMap({ familyId: NEXT_MOVE_FAMILY, childId: NEXT_MOVE_CHILD,
        query: { query: "saved_answers", subjectId: fixture.subjectId } }, { getView: async () => {
          if (candidate.scenario === "read_unavailable") throw new Error("Synthetic unavailable canonical read");
          return state.view;
        } });
      const calls: {name:string;input:Record<string,unknown>;output:unknown}[] = [{name:"explore_child_map",input,output}];
      if (fixture.expectsMove) {
        const proposal=cuttingCandidate(fixture.expectedTarget);
        const verified=verifyProgressNextMoveChatCandidate({...state,candidate:proposal});
        if (!verified.accepted) throw new Error("Calibration candidate must pass the actual verifier");
        calls.push({name:"verify_progress_next_move",input:proposal,output:{verified:true,nextMove:verified.nextMove}});
      }
      const steps=[{text:candidate.beforeRead??"",toolCalls:calls.map(call=>({toolName:call.name,input:call.input}))},{text:candidate.response,toolCalls:[]}];
      let result;
      try {
        result = await judgeChatNextMoveResponse({ scenario: candidate.scenario, request: fixture.prompt,
          evidenceContext: JSON.stringify({ now: state.now, child: state.ledger.child,
            ...(candidate.scenario === "post_save_offer" ? { priorProgressReceipt: postSaveProgressReceipt() } : {}) }),
          response: steps.map(step=>step.text).filter(Boolean).join("\n\n"), steps, calls });
      } catch (error) {
        t.log(JSON.stringify({ scenario: candidate.scenario, expected: candidate.accepted,
          response: candidate.response, error: error instanceof Error ? error.message : String(error) }));
        // Provider failures fail calibration while the independent cases still run.
        t.check(false, equals(true));
        continue;
      }
      t.log(JSON.stringify({ scenario:candidate.scenario, expected: candidate.accepted, response: candidate.response, judgment: result.object }));
      t.check(Object.values(result.object).every(check => check.pass), equals(candidate.accepted));
    }
  },
});
