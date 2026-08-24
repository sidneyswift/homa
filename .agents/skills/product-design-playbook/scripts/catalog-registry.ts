import {
  PLAY_IDS,
  STRATEGY_IDS,
  ScoreValidationError,
  type PlayAssessment,
  type PlayId,
  type StrategyId,
} from "./score-contract.ts";

export const STRATEGY_SOURCE_PATHS = Object.fromEntries(
  STRATEGY_IDS.map((strategyId, index) => [
    strategyId,
    `docs/product-design-playbook/strategies/${String(index + 1).padStart(2, "0")}-${strategyId}.md`,
  ]),
) as Record<StrategyId, string>;

export const PLAY_SOURCE_PATHS = Object.fromEntries(
  PLAY_IDS.map((playId, index) => [
    playId,
    `docs/product-design-playbook/plays/${String(index + 1).padStart(2, "0")}-${playId}.md`,
  ]),
) as Record<PlayId, string>;

export const STRATEGY_PLAY_IDS: Record<StrategyId, readonly PlayId[]> = {
  onboarding: [
    "empty-states",
    "setup-defaults",
    "progressive-disclosure",
    "time-to-value",
    "success-moments",
    "jtbd-copywriting",
    "pattern-alignment",
    "sandbox-experience",
    "personalisation",
    "momentum-bias",
    "micro-interactions",
    "permission-serve",
    "loading-feedback",
    "gamified-progress",
    "contact-bridge",
  ],
  monetisation: [
    "the-paywall",
    "intentional-friction",
    "limited-offer",
    "perceived-effort-delay",
    "success-moments",
    "time-to-value",
    "spark-curiosity",
    "gamified-progress",
    "effort-moat",
    "investment",
    "personalisation",
    "jtbd-copywriting",
  ],
  activation: [
    "time-to-value",
    "success-moments",
    "setup-defaults",
    "empty-states",
    "discovery",
    "personalisation",
    "micro-interactions",
    "momentum-bias",
    "progressive-disclosure",
    "jtbd-copywriting",
    "loading-feedback",
    "sandbox-experience",
    "contact-bridge",
  ],
  retention: [
    "gamified-progress",
    "system-widget",
    "value-replay",
    "effort-moat",
    "personalisation",
    "variable-reward",
    "commitment",
    "success-moments",
    "micro-interactions",
    "intent-mirroring",
    "pattern-alignment",
    "deep-link",
  ],
  "growth-and-viral": [
    "referral",
    "shareability",
    "contact-bridge",
    "deep-link",
    "success-moments",
    "gamified-progress",
    "effort-moat",
    "variable-reward",
    "system-widget",
    "spark-curiosity",
  ],
  engagement: [
    "micro-interactions",
    "gamified-progress",
    "variable-reward",
    "discovery",
    "personalisation",
    "intent-mirroring",
    "success-moments",
    "system-widget",
    "loading-feedback",
    "progressive-disclosure",
    "small-quirk",
  ],
  "trust-building": [
    "fail-safe",
    "pattern-alignment",
    "jtbd-copywriting",
    "loading-feedback",
    "perceived-effort-delay",
    "micro-interactions",
    "success-moments",
    "permission-serve",
    "progressive-disclosure",
    "intentional-friction",
  ],
  "conversion-optimisation": [
    "the-paywall",
    "limited-offer",
    "intentional-friction",
    "success-moments",
    "spark-curiosity",
    "momentum-bias",
    "time-to-value",
    "jtbd-copywriting",
    "perceived-effort-delay",
    "personalisation",
  ],
  "experience-refinement": [
    "micro-interactions",
    "small-quirk",
    "loading-feedback",
    "success-moments",
    "perceived-effort-delay",
    "pattern-alignment",
    "jtbd-copywriting",
    "variable-reward",
    "progressive-disclosure",
  ],
  "intent-shaping": [
    "investment",
    "personalisation",
    "setup-defaults",
    "progressive-disclosure",
    "commitment",
    "effort-moat",
    "intent-mirroring",
    "success-moments",
    "sandbox-experience",
  ],
  "habit-formation": [
    "commitment",
    "gamified-progress",
    "system-widget",
    "variable-reward",
    "value-replay",
    "investment",
    "personalisation",
    "success-moments",
    "micro-interactions",
    "effort-moat",
    "deep-link",
  ],
  "premium-positioning": [
    "perceived-effort-delay",
    "small-quirk",
    "micro-interactions",
    "intentional-friction",
    "loading-feedback",
    "success-moments",
    "jtbd-copywriting",
    "pattern-alignment",
    "progressive-disclosure",
  ],
};

export const PLAY_PAIRS: Record<PlayId, readonly PlayId[]> = {
  "micro-interactions": [
    "permission-serve",
    "success-moments",
    "loading-feedback",
    "gamified-progress",
    "small-quirk",
  ],
  "empty-states": [
    "jtbd-copywriting",
    "setup-defaults",
    "time-to-value",
    "progressive-disclosure",
    "discovery",
  ],
  "success-moments": [
    "micro-interactions",
    "loading-feedback",
    "gamified-progress",
    "permission-serve",
    "referral",
    "shareability",
    "value-replay",
  ],
  "loading-feedback": [
    "micro-interactions",
    "success-moments",
    "perceived-effort-delay",
    "jtbd-copywriting",
    "small-quirk",
  ],
  personalisation: [
    "setup-defaults",
    "commitment",
    "discovery",
    "pattern-alignment",
    "intent-mirroring",
  ],
  "jtbd-copywriting": [
    "micro-interactions",
    "empty-states",
    "loading-feedback",
    "permission-serve",
    "fail-safe",
  ],
  "permission-serve": [
    "success-moments",
    "empty-states",
    "contact-bridge",
    "setup-defaults",
    "jtbd-copywriting",
  ],
  "intentional-friction": [
    "time-to-value",
    "setup-defaults",
    "progressive-disclosure",
    "variable-reward",
    "fail-safe",
    "perceived-effort-delay",
  ],
  "time-to-value": [
    "gamified-progress",
    "intentional-friction",
    "progressive-disclosure",
    "empty-states",
    "setup-defaults",
    "commitment",
    "discovery",
  ],
  "setup-defaults": [
    "gamified-progress",
    "intentional-friction",
    "empty-states",
    "permission-serve",
    "progressive-disclosure",
    "personalisation",
  ],
  "progressive-disclosure": [
    "time-to-value",
    "intentional-friction",
    "loading-feedback",
    "investment",
    "personalisation",
    "intent-mirroring",
    "momentum-bias",
  ],
  commitment: [
    "personalisation",
    "gamified-progress",
    "time-to-value",
    "deep-link",
    "system-widget",
    "intent-mirroring",
  ],
  "deep-link": [
    "time-to-value",
    "commitment",
    "gamified-progress",
    "contact-bridge",
    "discovery",
    "limited-offer",
    "referral",
  ],
  "contact-bridge": [
    "permission-serve",
    "success-moments",
    "time-to-value",
    "deep-link",
    "discovery",
  ],
  "system-widget": ["gamified-progress", "commitment", "deep-link"],
  "value-replay": [
    "success-moments",
    "pattern-alignment",
    "effort-moat",
    "investment",
    "deep-link",
  ],
  "effort-moat": [
    "success-moments",
    "gamified-progress",
    "value-replay",
    "investment",
    "time-to-value",
  ],
  "perceived-effort-delay": [
    "loading-feedback",
    "intentional-friction",
    "gamified-progress",
    "time-to-value",
  ],
  "momentum-bias": [
    "gamified-progress",
    "setup-defaults",
    "progressive-disclosure",
    "time-to-value",
  ],
  "intent-mirroring": [
    "personalisation",
    "pattern-alignment",
    "progressive-disclosure",
    "time-to-value",
  ],
  "spark-curiosity": [
    "intentional-friction",
    "the-paywall",
    "variable-reward",
    "limited-offer",
    "success-moments",
  ],
  "sandbox-experience": [
    "time-to-value",
    "setup-defaults",
    "success-moments",
    "variable-reward",
    "intentional-friction",
  ],
  shareability: [
    "success-moments",
    "gamified-progress",
    "referral",
    "time-to-value",
    "effort-moat",
  ],
  referral: [
    "intentional-friction",
    "success-moments",
    "variable-reward",
    "deep-link",
    "limited-offer",
    "discovery",
    "shareability",
    "contact-bridge",
  ],
  "variable-reward": [
    "micro-interactions",
    "intentional-friction",
    "referral",
    "spark-curiosity",
    "discovery",
  ],
  "small-quirk": [
    "micro-interactions",
    "jtbd-copywriting",
    "pattern-alignment",
    "intentional-friction",
  ],
  "fail-safe": [
    "micro-interactions",
    "jtbd-copywriting",
    "intentional-friction",
  ],
  "limited-offer": [
    "the-paywall",
    "referral",
    "deep-link",
    "spark-curiosity",
    "time-to-value",
  ],
  discovery: [
    "empty-states",
    "contact-bridge",
    "spark-curiosity",
    "time-to-value",
    "referral",
    "the-paywall",
  ],
  "the-paywall": [
    "investment",
    "success-moments",
    "spark-curiosity",
    "time-to-value",
    "limited-offer",
    "discovery",
  ],
  investment: [
    "value-replay",
    "the-paywall",
    "progressive-disclosure",
    "time-to-value",
    "personalisation",
  ],
  "gamified-progress": [
    "success-moments",
    "micro-interactions",
    "system-widget",
    "time-to-value",
    "commitment",
    "shareability",
    "momentum-bias",
  ],
  "pattern-alignment": [
    "loading-feedback",
    "personalisation",
    "jtbd-copywriting",
    "progressive-disclosure",
    "small-quirk",
    "value-replay",
  ],
};

export function deriveCandidatePlayIds(
  strategyIds: readonly StrategyId[],
): PlayId[] {
  if (strategyIds.length === 0) {
    throw new ScoreValidationError(
      "candidate derivation requires a selected strategy",
    );
  }
  return [
    ...new Set(
      strategyIds.flatMap((strategyId) => STRATEGY_PLAY_IDS[strategyId]),
    ),
  ].sort();
}

function validateStrategyRoute(
  route: string,
  playId: PlayId,
  strategyIds: Set<StrategyId>,
): boolean {
  if (!route.startsWith("strategy:")) {
    return false;
  }
  const strategyId = route.slice("strategy:".length) as StrategyId;
  return (
    strategyIds.has(strategyId) &&
    STRATEGY_PLAY_IDS[strategyId].includes(playId)
  );
}

function validatePairRoute(
  route: string,
  playId: PlayId,
  strategyCandidates: Set<PlayId>,
): boolean {
  if (!route.startsWith("pair:")) {
    return false;
  }
  const chain = route.slice("pair:".length).split(">");
  if (chain.length !== 2) {
    throw new ScoreValidationError("pair provenance must be one-hop");
  }
  const [fromPlayId, toPlayId] = chain as [PlayId, PlayId];
  if (toPlayId !== playId || !strategyCandidates.has(fromPlayId)) {
    return false;
  }
  return PLAY_PAIRS[fromPlayId]?.includes(toPlayId) ?? false;
}

export function validateCandidateProvenance(
  strategyIds: readonly StrategyId[],
  plays: readonly PlayAssessment[],
): void {
  const strategyCandidates = new Set(deriveCandidatePlayIds(strategyIds));
  const selectedStrategies = new Set(strategyIds);
  const recordIds = new Set(plays.map((play) => play.playId));

  for (const play of plays) {
    if (play.sourceRefs.length !== 1 || play.sourceRefs[0] !== PLAY_SOURCE_PATHS[play.playId]) {
      throw new ScoreValidationError(
        `play source path is not canonical: ${play.playId}`,
      );
    }
    for (const route of play.provenanceRoutes) {
      if (route.startsWith("pair:") && route.split(">").length > 2) {
        throw new ScoreValidationError("pair provenance must be one-hop");
      }
    }
    const expectedStrategyRoutes = strategyIds
      .filter((strategyId) =>
        STRATEGY_PLAY_IDS[strategyId].includes(play.playId),
      )
      .map((strategyId) => `strategy:${strategyId}`);
    const missingStrategyRoute = expectedStrategyRoutes.find(
      (route) => !play.provenanceRoutes.includes(route),
    );
    if (missingStrategyRoute) {
      throw new ScoreValidationError(
        `play is missing strategy provenance: ${play.playId} via ${missingStrategyRoute}`,
      );
    }
    const everyRouteIsValid =
      play.provenanceRoutes.length > 0 &&
      play.provenanceRoutes.every(
      (route) =>
        validateStrategyRoute(route, play.playId, selectedStrategies) ||
        validatePairRoute(route, play.playId, strategyCandidates),
    );
    if (!everyRouteIsValid) {
      throw new ScoreValidationError(
        `play provenance is invalid: ${play.playId}`,
      );
    }
  }

  const missingStrategyCandidates = [...strategyCandidates].filter(
    (playId) => !recordIds.has(playId),
  );
  if (missingStrategyCandidates.length > 0) {
    throw new ScoreValidationError(
      `candidate universe is missing strategy plays: ${missingStrategyCandidates.join(", ")}`,
    );
  }
}
