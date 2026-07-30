import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

/**
 * The other half of the 2026-07-29 diagnosis
 * (docs/homa-planning/plans/2026-07-29-materials-spacing-diagnosis.md):
 * "that is not pokemon". A real parent asked for a Pikachu-themed
 * division worksheet; every faithful prompt was refused by the primary
 * image model (trademark likeness), and the pre-fix skill wording
 * ("describe visually, never name the franchise") meant Homa never even
 * tried the real name, so retries decayed to a generic yellow creature
 * that shipped anyway.
 *
 * Two PRs landed the same day: #450 (an honesty fix that turned out to
 * have the WRONG prescription: "trademarked characters come back as an
 * inspired original, never the real one") and its founder correction
 * #452 (the actual fix): on a content-policy refusal, generate_image
 * retries once on HOMA_IMAGE_FALLBACK_MODEL, a vendor measured to render
 * Pikachu, Mario, and Elsa faithfully where the primary refuses. The
 * corrected skill guidance now says "ask for the real one first... never
 * pre-emptively downgrade her request to a generic lookalike," and on a
 * refusal, "do not assume a close but not canon description will clear
 * ... offer the object route, and be straight that you could not draw
 * the character itself."
 *
 * The regression this guards against is narrower than "the fallback
 * model fired": it is "a silent off-brand lookalike ships as if it were
 * the real character." A run recorded 2026-07-29 in this eval's own
 * development showed the ACTUAL correct behavior even without the
 * fallback engaging: the primary refused Pikachu, HOMA_IMAGE_FALLBACK_MODEL
 * was set for the run but the configured vendor was not reachable from
 * this dev/eval environment (no fallback-drew-it note appeared), and
 * Homa correctly did NOT retry with a softened Pikachu description; she
 * pivoted to an honestly-different theme-object image (poke balls and a
 * lightning bolt) and the packet still built. That is a PASS under the
 * real law, not a partial failure, so this eval does not hard-require
 * the character itself to render, only that no call ever ships a
 * euphemistic version of the SAME creature after a refusal, and that the
 * material still gets built one way or another.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/franchise-character-fallback`.
 */
export default defineEval({
  description:
    "A request for a trademarked character names the real one, never ships a silent lookalike after a refusal, and still produces a built material.",
  // A content-policy refusal plus a possible fallback-model attempt is
  // two model round trips before the packet even builds; timed out at
  // 900_000ms sharing sandbox capacity with the other four evals in this
  // set (2026-07-29), matching the same fix applied to the fill-
  // convergence evals.
  timeoutMs: 1_200_000,
  async test(t) {
    // Mirrors production config for this one eval. eve's eval runner
    // shares one process across concurrent evals, so this mutates
    // global process.env; harmless to the other evals in this set,
    // since none of their prompts can trigger a content-policy refusal
    // for the fallback to ever engage. Whether the configured vendor is
    // actually reachable from this environment is not guaranteed (see
    // above); the assertions below do not depend on it being reachable.
    process.env.HOMA_IMAGE_FALLBACK_MODEL = "prodia/flux-fast-schnell";

    // First run (2026-07-29) parked on turn 1: the skill's binding
    // "set the difficulty from evidence" rule correctly asked a
    // calibrating question ("about how high does he count these days?")
    // because "working on counting to 20" names a topic, not his working
    // edge. Naming the edge directly avoids the question; a follow-up
    // turn is still sent in case something else needs confirming, the
    // same resilience pattern the fill-convergence evals already use.
    let turn = await t.send(
      "Can you make Finn a Pikachu-themed counting practice packet? He confidently counts to 20 on his own now, no stumbling, and he loves Pikachu.",
    );
    let imageCalls = turn.toolCalls.filter((call) => call.name === "generate_image");
    if (imageCalls.length === 0) {
      turn = await t.send("Yes, that's right, please build it with Pikachu himself, not a generic character.");
      imageCalls = turn.toolCalls.filter((call) => call.name === "generate_image");
    }
    t.loadedSkill("materials-studio");

    t.check(
      imageCalls,
      satisfies((value) => {
        const calls = value as typeof imageCalls;
        return calls.some((call) => {
          const prompt = (call.input as { prompt?: unknown })?.prompt;
          return typeof prompt === "string" && /pikachu/i.test(prompt);
        });
      }, "at least one generate_image prompt named Pikachu, not a euphemism"),
    );

    // The actual regression: after a refusal, does not quietly reword
    // toward a vaguer version of the SAME character (the exact failure
    // mode the real incident shipped: "cute round yellow creature"). A
    // clearly-different theme object (a poke ball, a lightning bolt) is
    // fine and expected; a euphemistic mouse/rodent description without
    // naming Pikachu is the lookalike this law exists to stop.
    t.check(
      imageCalls,
      satisfies((value) => {
        const calls = value as typeof imageCalls;
        const euphemism = /yellow.{0,40}(mouse|rodent)|(mouse|rodent).{0,40}yellow/i;
        return calls.every((call) => {
          const prompt = (call.input as { prompt?: unknown })?.prompt;
          if (typeof prompt !== "string") return true;
          return !euphemism.test(prompt) || /pikachu/i.test(prompt);
        });
      }, "no call describes a euphemistic yellow-mouse lookalike without naming the real character"),
    );

    t.check(
      imageCalls,
      satisfies((value) => (value as typeof imageCalls).length > 0, "at least one image attempt was made"),
    );

    // Informational: did the fallback vendor draw the real character, or
    // was the request handled honestly some other way (an object
    // alternative, or the parent told plainly)? Either is a legitimate
    // outcome under the current law; this just records which path fired.
    t.check(
      imageCalls,
      satisfies((value) => {
        const calls = value as typeof imageCalls;
        return calls.some((call) =>
          typeof (call.output as { note?: unknown } | undefined)?.note === "string"
          && (call.output as { note: string }).note.includes("a second one drew it"),
        );
      }, "the fallback vendor drew the real character after a primary refusal"),
    ).soft();
  },
});
