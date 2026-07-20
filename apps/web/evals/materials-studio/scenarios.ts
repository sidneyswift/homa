import type { StudioEvalScenario } from "./studio-harness";

/**
 * Customer-shaped scenarios for the materials-studio decision harness.
 * Each replicates a real parent ask with the child context the runtime
 * would have, and states what a delighted-first-try outcome requires:
 * the right recipe read, the right anchor ridden, the theme actually
 * customized, and no thrash. Add a scenario whenever a new format ships
 * or a fleet family hits a failure the suite did not predict.
 */
export const STUDIO_SCENARIOS: StudioEvalScenario[] = [
  {
    id: "activity-pack-space-theme",
    request:
      "Can you make Leo one of those activity packs with a few different little activities on one page? He is completely obsessed with outer space right now.",
    child: {
      name: "Leo",
      ageYears: 5,
      mapEvidence: ["Counts to 15 comfortably", "Recognizes most uppercase letters"],
      interests: ["outer space", "rockets"],
    },
    expect: {
      readsFiles: ["references/recipes/activity-pack.md"],
      anchorId: "activity-pack",
      themeIncludes: ["space"],
      themeExcludes: ["bug", "insect"],
      maxBuilds: 2,
    },
  },
  {
    id: "pemdas-foldable-anchor",
    request:
      "Maya keeps mixing up the order of operations. Could you make her one of those fold-up reference charts for PEMDAS?",
    child: {
      name: "Maya",
      ageYears: 10,
      mapEvidence: ["Multiplies two-digit numbers", "Starting multi-step expressions"],
      interests: ["horses"],
    },
    expect: {
      readsFiles: ["references/recipes/foldable.md"],
      anchorId: "order-of-operations-chart",
      themeIncludes: ["order of operations"],
      maxBuilds: 2,
    },
  },
  {
    id: "essay-outline-restrained",
    request:
      "Jack has to write a five paragraph essay for co-op and he has no idea how to start. Can you make him something to plan it out on?",
    child: {
      name: "Jack",
      ageYears: 12,
      mapEvidence: ["Writes solid paragraphs", "Struggles organizing longer pieces"],
      interests: ["basketball"],
    },
    expect: {
      readsFiles: [
        "references/recipes/structured-outline.md",
        "references/subjects/essay-writing.md",
      ],
      anchorId: "five-paragraph-essay-outline",
      maxBuilds: 2,
    },
  },
  {
    id: "counting-dinosaurs-evidence",
    request: "Finn loves counting dinosaurs, can you make him a worksheet for that?",
    child: {
      name: "Finn",
      ageYears: 4,
      mapEvidence: ["Counts to 10 easily", "One-to-one correspondence solid to 8"],
      interests: ["dinosaurs"],
    },
    expect: {
      readsFiles: ["references/subjects/counting.md"],
      themeIncludes: ["dinosaur"],
      maxBuilds: 2,
    },
  },
  {
    id: "cut-and-paste-phonics",
    request:
      "Nora's speech therapist wants her practicing short a words. Something hands on please, she cannot just fill in blanks.",
    child: {
      name: "Nora",
      ageYears: 6,
      mapEvidence: ["Knows all letter sounds", "Blending CVC words with support"],
      interests: ["cats"],
    },
    expect: {
      readsFiles: [
        "references/recipes/cut-and-paste-word-work.md",
        "references/subjects/cvc-phonics.md",
      ],
      anchorId: "cut-and-paste-word-work",
      maxBuilds: 2,
    },
  },
  {
    id: "montessori-approach-read",
    request:
      "We do Montessori at home. Can you make Josie a set of those three part cards for ocean animals?",
    child: {
      name: "Josie",
      ageYears: 4,
      mapEvidence: ["Matches picture cards independently"],
      interests: ["ocean animals"],
      approach: "Montessori",
    },
    expect: {
      readsFiles: [
        "references/recipes/nomenclature-cards.md",
        "references/approaches/montessori.md",
      ],
      themeIncludes: ["ocean"],
      maxBuilds: 2,
    },
  },
  {
    id: "no-evidence-asks-first",
    request: "Can you make Theo a math worksheet?",
    child: {
      name: "Theo",
      ageYears: 7,
      mapEvidence: [],
      interests: [],
    },
    expect: {
      asksInsteadOfBuilding: true,
    },
  },
  {
    id: "theme-correction-follow-up",
    request:
      "Make Ella one of those activity packs, she likes bugs I think.",
    child: {
      name: "Ella",
      ageYears: 5,
      mapEvidence: ["Counts to 20", "Writes her name"],
      interests: ["bugs", "mermaids"],
    },
    followUps: [
      "Actually she is over bugs, she is all about mermaids now. Same pack but mermaids please.",
    ],
    expect: {
      readsFiles: ["references/recipes/activity-pack.md"],
      anchorId: "activity-pack",
      themeIncludes: ["mermaid"],
      maxBuilds: 3,
    },
  },
];
