import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  evaluateResearchBriefFixture,
  type ResearchBriefSemanticFixtureContext,
  type ResearchBriefSemanticRejection,
} from "./research-brief-semantic-fixture";

const RESEARCH_BRIEF_SKILL = readFileSync(
  new URL("../../agent/skills/research-brief/SKILL.md", import.meta.url),
  "utf8",
);

const OBVIOUS_CLAIM =
  "a stretchy sound stays on into the next sound, so the word reaches the ear as one piece.";
const ACTION_SHAPING_CLAIM =
  "In mat, mmm runs into a before the quick t closes mat.";
const OTHER_OBVIOUS_CLAIM = "Practice can help.";
const BASE_DRAFT = `Last night I researched keeping sounds together while reading

What I learned: Reading Rockets says ${OBVIOUS_CLAIM} ${ACTION_SHAPING_CLAIM}

Why it's interesting: Story said "ship" sounds choppy in Bob Books. Story can try "sh" running into "i" before the quick "p" closes "ship".

Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?`;

const BASE_CONTEXT: ResearchBriefSemanticFixtureContext = {
  allowedSourceNames: ["Reading Rockets"],
  allowedClaims: [
    { text: OBVIOUS_CLAIM, role: "finding" },
    { text: ACTION_SHAPING_CLAIM, role: "action_shaping" },
    { text: OTHER_OBVIOUS_CLAIM, role: "finding" },
  ],
  selectedKnowledgeId: "knowledge-smooth-reading",
  selectedChild: "Story",
  evidenceAnchors: ['"ship" sounds choppy', "reads Bob Books"],
  quotationRequiredEvidenceAnchors: ["ship"],
  siblingNames: ["Mae"],
  recentTraces: [],
  allowedChildPronouns: [],
  expectedParentFacingSkill: "keeping sounds together while reading",
  requiredPracticalChangeConcepts: [
    "mat",
    "mmm runs into a",
    "quick t closes mat",
  ],
  allowedArtifactExamples: ["mat", "ship", "sh"],
  expectedCtaConcepts: [
    "word strip",
    "keeping sounds together while reading",
  ],
};

function replace(from: string, to: string, draft = BASE_DRAFT): string {
  assert.ok(draft.includes(from), `fixture text not found: ${from}`);
  return draft.replace(from, to);
}

function rejectionReasons(
  draft: string,
  context: ResearchBriefSemanticFixtureContext = BASE_CONTEXT,
): ResearchBriefSemanticRejection[] {
  const result = evaluateResearchBriefFixture(draft, context);
  assert.equal(result.ok, false, `expected fixture rejection:\n${draft}`);
  return result.ok ? [] : result.reasons;
}

function assertOnlyReason(
  reason: ResearchBriefSemanticRejection,
  draft: string,
  context: ResearchBriefSemanticFixtureContext = BASE_CONTEXT,
): void {
  assert.deepEqual(rejectionReasons(draft, context), [reason]);
}

describe("research brief deterministic semantic fixtures", () => {
  it("stops without a brief when the bounded dispatch has no eligible source", () => {
    assert.match(
      RESEARCH_BRIEF_SKILL,
      /If no eligible candidate remains, stop without a brief\./u,
    );
    assert.doesNotMatch(RESEARCH_BRIEF_SKILL, /\bweb_search\b/u);
    assert.doesNotMatch(RESEARCH_BRIEF_SKILL, /\bsave_knowledge\b/u);
    assert.doesNotMatch(RESEARCH_BRIEF_SKILL, /This morning I researched/u);
  });

  it("accepts observation, frontier, method, and multi-child pick-one positives", () => {
    const positives = [
      { name: "observation", draft: BASE_DRAFT, context: BASE_CONTEXT },
      {
        name: "frontier",
        draft: replace(
          'Story said "ship" sounds choppy in Bob Books.',
          "Story is working toward keeping sounds together in Bob Books.",
        ),
        context: {
          ...BASE_CONTEXT,
          evidenceAnchors: ["working toward keeping sounds together"],
        },
      },
      {
        name: "method",
        draft: replace(
          'Story said "ship" sounds choppy in Bob Books.',
          "Story uses movable letters for the same words.",
        ),
        context: {
          ...BASE_CONTEXT,
          evidenceAnchors: ["uses movable letters"],
        },
      },
      {
        name: "multi-child pick-one",
        draft: BASE_DRAFT,
        context: { ...BASE_CONTEXT, siblingNames: ["Mae", "Finn"] },
      },
    ];

    for (const fixture of positives) {
      assert.deepEqual(
        evaluateResearchBriefFixture(fixture.draft, fixture.context),
        { ok: true },
        fixture.name,
      );
    }
  });

  it("rejects a generic source for the generic-source reason", () => {
    assertOnlyReason(
      "generic_source",
      replace("Reading Rockets says", "A research review says"),
    );
  });

  it("rejects an invented author for the invented-source reason", () => {
    assertOnlyReason(
      "invented_source",
      replace("Reading Rockets says", "Professor Made-Up says"),
    );
  });

  it("rejects unsupported extrapolation for the claim-grounding reason", () => {
    assertOnlyReason(
      "unsupported_claim",
      replace(
        OBVIOUS_CLAIM,
        "This feature guarantees fluent reading by Friday.",
      ),
    );
  });

  it("rejects obvious-only content for the missing action-shaping reason", () => {
    assertOnlyReason(
      "missing_action_shaping_detail",
      replace(ACTION_SHAPING_CLAIM, OTHER_OBVIOUS_CLAIM),
    );
  });

  it("rejects an unexplained teaching term in the headline", () => {
    assertOnlyReason(
      "unexplained_skill_name",
      replace(
        "keeping sounds together while reading",
        "connected phonation",
      ),
    );
  });

  it("rejects a vague non-obvious sentence that hides the practical change", () => {
    const vagueClaim = "The method changes as the word grows.";
    assertOnlyReason(
      "vague_action_shaping_detail",
      replace(ACTION_SHAPING_CLAIM, vagueClaim),
      {
        ...BASE_CONTEXT,
        allowedClaims: [
          { text: OBVIOUS_CLAIM, role: "finding" },
          { text: vagueClaim, role: "action_shaping" },
        ],
      },
    );
  });

  it("rejects an imperative teaching direction in What I learned", () => {
    const imperativeClaim =
      "For mat, hold mmm into a, then add the quick t at the end.";
    assertOnlyReason(
      "imperative_research_example",
      replace(ACTION_SHAPING_CLAIM, imperativeClaim),
      {
        ...BASE_CONTEXT,
        allowedClaims: [
          { text: OBVIOUS_CLAIM, role: "finding" },
          { text: imperativeClaim, role: "action_shaping" },
        ],
        requiredPracticalChangeConcepts: [
          "mat",
          "hold mmm",
          "quick t",
        ],
      },
    );
  });

  it("rejects an invented child pronoun", () => {
    assertOnlyReason(
      "unsupported_pronoun",
      replace(
        'Story can try "sh" running into "i" before the quick "p" closes "ship".',
        'She can try "sh" running into "i" before the quick "p" closes "ship".',
      ),
    );
  });

  it("requires the observed child word to remain quoted", () => {
    assertOnlyReason(
      "missing_child_anchor",
      replace('"ship" sounds choppy', "ship sounds choppy"),
    );
  });

  it("requires a marked evidence word to appear quoted once, but allows later ordinary use", () => {
    const draft = replace(
      'Story said "ship" sounds choppy in Bob Books. Story can try "sh" running into "i" before the quick "p" closes "ship".',
      "Story reads Bob Books. Story can try sh running into i before the quick p closes ship.",
    );

    assertOnlyReason("missing_quoted_child_anchor", draft, {
      ...BASE_CONTEXT,
      evidenceAnchors: ["reads Bob Books"],
    });
  });

  it("rejects a causal promise instead of a direct child attempt", () => {
    assertOnlyReason(
      "causal_child_connection",
      replace(
        'Story can try "sh" running into "i" before the quick "p" closes "ship".',
        'Story could smooth reading by running sh into i before the quick p closes ship.',
      ),
    );
  });

  it("rejects outcome constructions in the child connection", () => {
    const outcomeConnections = [
      'Story turns the choppy sound into one smooth word by running sh into i.',
      'Story keeps "ship" from breaking apart by holding sh into i.',
      'The strip gives Story smoother reading with "ship".',
      'Story makes reading smoother by running sh into i.',
    ];

    for (const connection of outcomeConnections) {
      assertOnlyReason(
        "causal_child_connection",
        replace(
          'Story can try "sh" running into "i" before the quick "p" closes "ship".',
          connection,
        ),
      );
    }
  });

  it("accepts a grounded direct child attempt", () => {
    assert.deepEqual(evaluateResearchBriefFixture(BASE_DRAFT, BASE_CONTEXT), {
      ok: true,
    });
  });

  it("requires a direct neutral child attempt", () => {
    assertOnlyReason(
      "missing_child_attempt",
      replace(
        'Story can try "sh" running into "i" before the quick "p" closes "ship".',
        'Story hears the sounds in "ship" as separate pieces.',
      ),
    );
  });

  it("rejects a repeated source or topic for the novelty reason", () => {
    assertOnlyReason("recent_repetition", BASE_DRAFT, {
      ...BASE_CONTEXT,
      recentTraces: [
        {
          knowledgeId: "knowledge-smooth-reading",
          topic: "keeping sounds together while reading",
          title: "Keeping sounds together",
          sourceNames: ["Reading Rockets"],
          claims: [OBVIOUS_CLAIM],
        },
      ],
    });
  });

  it("rejects a materially repeated topic and source claim from a different row", () => {
    assertOnlyReason("recent_repetition", BASE_DRAFT, {
      ...BASE_CONTEXT,
      recentTraces: [
        {
          knowledgeId: "knowledge-older",
          topic: "keeping sounds together while reading",
          title: "Keeping sounds together",
          sourceNames: ["Reading Rockets"],
          claims: [OBVIOUS_CLAIM],
        },
      ],
    });
  });

  it("allows the same publication for a materially different topic", () => {
    assert.deepEqual(
      evaluateResearchBriefFixture(BASE_DRAFT, {
        ...BASE_CONTEXT,
        recentTraces: [
          {
            knowledgeId: "knowledge-vocabulary",
            topic: "oral vocabulary",
            title: "Talking about new words",
            sourceNames: ["Reading Rockets"],
            claims: ["Conversation gives children more chances to use new words."],
          },
        ],
      }),
      { ok: true },
    );
  });

  it("rejects a sibling mention in Why for the sibling-safety reason", () => {
    assertOnlyReason(
      "sibling_reference",
      replace(
        'Story said "ship" sounds choppy in Bob Books.',
        'Story said "ship" sounds choppy in Bob Books, unlike Mae.',
      ),
    );
  });

  it("rejects a sibling mention in What I learned", () => {
    const siblingClaim =
      "Mae hears one word instead of separate sound pieces.";
    assertOnlyReason(
      "sibling_reference",
      replace(OBVIOUS_CLAIM, siblingClaim),
      {
        ...BASE_CONTEXT,
        allowedClaims: [
          { text: siblingClaim, role: "finding" },
          { text: ACTION_SHAPING_CLAIM, role: "action_shaping" },
        ],
      },
    );
  });

  it("rejects a sibling name in the CTA", () => {
    assertOnlyReason(
      "sibling_reference",
      replace(
        "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?",
        "Want me to make Mae a mat-and-ship word strip for keeping sounds together while reading?",
      ),
    );
  });

  it("rejects an unrelated CTA for the CTA-match reason", () => {
    assertOnlyReason(
      "cta_mismatch",
      replace(
        "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?",
        "Want me to make Story a map game for map tracing?",
      ),
    );
  });

  it("rejects a CTA that names an artifact without saying what it contains", () => {
    assertOnlyReason(
      "cta_mismatch",
      replace(
        "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?",
        "Want me to make Story a word strip for smoother blending?",
      ),
    );
  });

  it("accepts a natural CTA contents phrase using supplied examples", () => {
    const draft = replace(
      "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?",
      "Want me to make Story a word strip with ship and similar words for keeping sounds together while reading?",
    );
    assert.deepEqual(evaluateResearchBriefFixture(draft, BASE_CONTEXT), {
      ok: true,
    });
  });

  it("rejects specific CTA examples that the context did not supply", () => {
    const draft = replace(
      "Want me to make Story a mat-and-ship word strip for keeping sounds together while reading?",
      "Want me to make Story a word strip with ship, shop, shed, and slip for keeping sounds together while reading?",
    );
    assertOnlyReason("invented_artifact_example", draft);
  });

  it("rejects eleven carrier segments for the carrier-overflow reason", () => {
    assertOnlyReason(
      "carrier_overflow",
      replace(
        "Story can try",
        `${"^".repeat(700)}Story can try`,
      ),
    );
  });
});
