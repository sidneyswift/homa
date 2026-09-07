import { generateObject } from "ai";
import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { buildClaimExtractionRequest } from "../../lib/child-progress/claim-extraction";
import { validateProposedClaims } from "../../lib/child-progress/claim-validation";
import { isEvalIsolationActive } from "../../lib/eval-isolation";
import cases from "./replay-cases.json";

/** Judgment-only: production request/schema/validator, no conversation or progress writes. */
export default defineEval({
  description: "Contextual ability claims and catalog boundaries preserve child, current quote, help, refusal and age limits.",
  tags: ["model-backed", "progress-capture"],
  timeoutMs: 600_000,
  async test(t) {
    if (!isEvalIsolationActive(process.env) || !process.env.VERCEL_OIDC_TOKEN) t.skip("Requires canonical eval isolation and Vercel OIDC.");
    const findings: string[] = [];
    for (const fixture of cases) {
      const request = buildClaimExtractionRequest({
        familyId: "00000000-0000-4000-8000-000000000001", surface: "journal",
        children: fixture.children, message: fixture.message,
        interpretationContext: {
          recordingTargetChildId: fixture.recordingTargetChildId,
          previousAssistant: fixture.previousAssistant ? {
            messageId: "00000000-0000-4000-8000-000000000099",
            text: fixture.previousAssistant, createdAt: "2026-09-05T01:00:00Z",
          } : null,
        },
      });
      // A provider or schema error fails this eval; it cannot masquerade as a successful empty negative.
      const result = await generateObject(request);
      const validation = validateProposedClaims({message: fixture.message, children: fixture.children, claims: result.object.claims});
      const actual = validation.accepted.map(({childId, itemId, answer}) => ({childId, itemId, answer}));
      const order = (items: unknown[]) => items.map(item => JSON.stringify(item)).sort();
      if (JSON.stringify(order(actual)) !== JSON.stringify(order(fixture.expectedAccepted))) findings.push(fixture.id);
      t.log(JSON.stringify({id: fixture.id, proposed: result.object.claims, validation, expected: fixture.expectedAccepted, usage: result.usage}));
    }
    t.check(findings, equals([]));
  },
});
